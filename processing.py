"""
processing.py
-------------
Computes water quality indices from Sentinel-2 reflectance bands.

Indices:
    NDWI  = (B03 - B08) / (B03 + B08)   → Water detection (>0 = water)
    NDCI  = (B05 - B04) / (B05 + B04)   → Chlorophyll/algae proxy (pollution indicator)
    TURB  = B04 / B03                    → Turbidity proxy (red/green ratio)
    SSD   = B04 / B02                    → Suspended sediment proxy (red/blue ratio)

Pollution classification:
    NDCI < 0       → LOW    (clean water or non-water surface)
    NDCI 0–0.2     → MEDIUM (moderate algae presence)
    NDCI > 0.2     → HIGH   (likely algae bloom / pollution)

Rainfall impact classification:
    < 5 mm   → DRY         (no significant runoff contribution)
    5–20 mm  → MODERATE    (light runoff; minor sediment/nutrient wash-in expected)
    20–50 mm → HIGH        (significant runoff; elevated turbidity and nutrient load likely)
    > 50 mm  → EXTREME     (heavy runoff; strong water quality degradation expected)

EU Bathing Water Directive (2006/7/EC) NDCI thresholds:
    NDCI < 0.05    → EXCELLENT  (risk 0.0–0.20)  — BLUE
    NDCI 0.05–0.12 → GOOD       (risk 0.20–0.45) — GREEN
    NDCI 0.12–0.20 → SUFFICIENT (risk 0.45–0.70) — YELLOW
    NDCI > 0.20    → POOR       (risk 0.70–1.0)  — RED  ← EU alert threshold
"""

import numpy as np
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List

logger = logging.getLogger(__name__)


# ── EU Bathing Water Directive thresholds ──────────────────────────────────────
# Mapped from chlorophyll-a/cyanobacteria guidelines to NDCI proxy values.
# Reference: EU Directive 2006/7/EC + WHO Guidelines for Safe Recreational Waters.
EU_THRESHOLDS = [
    # (max_ndci, category,    risk_max, color,    risk_min)
    (0.05,  "EXCELLENT",  0.20, "BLUE",   0.00),
    (0.12,  "GOOD",       0.45, "GREEN",  0.20),
    (0.20,  "SUFFICIENT", 0.70, "YELLOW", 0.45),
    (None,  "POOR",       1.00, "RED",    0.70),
]


# Rainfall-to-NDCI runoff coefficient:
# Each mm of rain is estimated to raise NDCI by this amount (nutrient/sediment wash-in).
# Based on empirical range from Sentinel-2 water quality literature (~0.003–0.006 per mm).
RUNOFF_COEFF = 0.004

# Natural attenuation rate per day (self-purification: dilution, sedimentation, photodegradation).
ATTENUATION_RATE = 0.015  # 1.5% reduction per day when no significant rain


def safe_normalized_difference(band_a: np.ndarray, band_b: np.ndarray) -> np.ndarray:
    """
    Compute normalized difference index: (A - B) / (A + B)
    Handles division-by-zero gracefully by returning NaN where denominator is 0.
    """
    with np.errstate(divide="ignore", invalid="ignore"):
        result = np.where(
            (band_a + band_b) == 0,
            np.nan,
            (band_a - band_b) / (band_a + band_b),
        )
    return result.astype(np.float32)


def compute_ndwi(B03: np.ndarray, B08: np.ndarray) -> np.ndarray:
    """NDWI = (Green - NIR) / (Green + NIR). Positive = open water."""
    return safe_normalized_difference(B03, B08)


def compute_turbidity(B04: np.ndarray, B03: np.ndarray) -> np.ndarray:
    """Turbidity proxy = Red / Green ratio."""
    return safe_normalized_difference(B04, B03)


def compute_suspendent_sediment(B04: np.ndarray, B02: np.ndarray) -> np.ndarray:
    """Suspended sediment proxy = Red / Blue ratio."""
    return safe_normalized_difference(B04, B02)


def compute_ndci(B05: np.ndarray, B04: np.ndarray) -> np.ndarray:
    """NDCI = (RedEdge - Red) / (RedEdge + Red). Higher = more chlorophyll."""
    return safe_normalized_difference(B05, B04)


def classify_eu_water_quality(ndci_value: float) -> Dict[str, Any]:
    """
    Classify water quality against EU Bathing Water Directive (2006/7/EC).

    Args:
        ndci_value: Scalar NDCI value

    Returns:
        Dict with category, risk (0–1), color, and alert flag
    """
    if ndci_value is None or np.isnan(ndci_value):
        return {"category": "UNKNOWN", "risk": None, "color": "GREY", "eu_alert": False}

    for max_ndci, category, risk_max, color, risk_min in EU_THRESHOLDS:
        if max_ndci is None or ndci_value <= max_ndci:
            # Interpolate risk within this band
            if max_ndci is None:
                # POOR band — clamp at 1.0
                risk = min(1.0, risk_min + (ndci_value - 0.20) * 3.0)
            else:
                prev_threshold = {
                    "EXCELLENT": 0.0,
                    "GOOD": 0.05,
                    "SUFFICIENT": 0.12,
                }.get(category, 0.0)
                band_width = max_ndci - prev_threshold
                position   = (ndci_value - prev_threshold) / band_width if band_width > 0 else 0
                risk       = round(risk_min + position * (risk_max - risk_min), 4)

            return {
                "category":  category,
                "risk":      round(max(0.0, min(1.0, risk)), 2),
                "color":     color,
                "eu_alert":  category == "POOR",
            }

    # Fallback (shouldn't reach here)
    return {"category": "POOR", "risk": 1.0, "color": "RED", "eu_alert": True}


def classify_pollution(ndci_value: float) -> str:
    """Classify pollution level: LOW / MEDIUM / HIGH."""
    if ndci_value is None or np.isnan(ndci_value):
        return "UNKNOWN"
    if ndci_value < 0:
        return "LOW"
    elif ndci_value <= 0.2:
        return "MEDIUM"
    else:
        return "HIGH"


def classify_rainfall_impact(rainfall_mm: Optional[float]) -> str:
    """Classify likely water quality impact of recent rainfall."""
    if rainfall_mm is None:
        return "UNKNOWN"
    if rainfall_mm < 5:
        return "DRY"
    elif rainfall_mm < 20:
        return "MODERATE"
    elif rainfall_mm < 50:
        return "HIGH"
    else:
        return "EXTREME"


def extract_point_value(array: np.ndarray) -> Optional[float]:
    """Extract spatial median from a 2D array. Returns None if all NaN."""
    valid = array[~np.isnan(array)]
    if len(valid) == 0:
        return None
    return float(np.median(valid))


# ── 5-day forecast prediction engine ──────────────────────────────────────────

# def predict_water_quality_forecast(
#     base_ndci: float,
#     base_ndwi: float,
#     rainfall_forecast: List[Dict[str, Any]],
# ) -> List[Dict[str, Any]]:
#     """
#     Project water quality indices forward 5 days using forecast rainfall.
#
#     Model:
#         ndci[d] = ndci[d-1] * (1 - ATTENUATION_RATE) + rain[d] * RUNOFF_COEFF
#
#     The attenuation term simulates natural self-purification (dilution,
#     sedimentation, photodegradation). The runoff term simulates nutrient
#     and sediment wash-in from precipitation.
#
#     Args:
#         base_ndci:         Today's measured NDCI value
#         base_ndwi:         Today's measured NDWI value (for water presence context)
#         rainfall_forecast: List of dicts from fetch_rainfall_forecast():
#                            [{"date": "2026-04-26", "predicted_rainfall_mm": 3.2}, ...]
#
#     Returns:
#         List of daily forecast dicts, one per forecast day.
#     """
#     forecast_days = []
#     current_ndci  = base_ndci if base_ndci is not None else 0.0
#
#     # Pad forecast list if shorter than expected
#     padded = list(rainfall_forecast) + [None] * max(0, 5 - len(rainfall_forecast))
#
#     for i, day_data in enumerate(padded[:5], start=1):
#         # Extract forecast values
#         if day_data and day_data.get("predicted_rainfall_mm") is not None:
#             rain_mm   = max(0.0, float(day_data["predicted_rainfall_mm"]))
#             date_str  = day_data.get("date", (datetime.utcnow() + timedelta(days=i)).strftime("%Y-%m-%d"))
#         else:
#             rain_mm  = 0.0
#             date_str = (datetime.utcnow() + timedelta(days=i)).strftime("%Y-%m-%d")
#
#         # Project NDCI forward one day
#         attenuation  = current_ndci * ATTENUATION_RATE
#         runoff_input = rain_mm * RUNOFF_COEFF
#         current_ndci = max(-0.5, min(0.8, current_ndci - attenuation + runoff_input))
#
#         # Classify against EU standard
#         eu = classify_eu_water_quality(current_ndci)
#
#         # Pollution category (legacy field kept for compatibility)
#         pollution_pred = round(current_ndci, 4)
#
#         # Build human-readable message
#         message = (
#             f"EU Standard: {eu['category']} (Risk {eu['risk']:.2f})"
#             + (" ⚠️ ALERT" if eu["eu_alert"] else "")
#         )
#
#         forecast_days.append({
#             "day":            i,
#             "date":           date_str,
#             "risk":           eu["risk"],
#             "category":       eu["category"],
#             "status_color":   eu["color"],
#             "rain":           round(rain_mm, 2),
#             "pollution_pred": pollution_pred,
#             "eu_alert":       eu["eu_alert"],
#             "message":        message,
#         })
#
#     return forecast_days
def predict_water_quality_forecast(
        base_ndci: float,
        base_ndwi: float,  # Put this back
        rainfall_forecast: List[Dict[str, Any]],
        base_ssd: float = 0.0,  # Add these as optional so they don't break the call
        base_turb: float = 0.0,
) -> List[Dict[str, Any]]:
    forecast_days = []
    current_ndci = base_ndci if base_ndci is not None else 0.0
    current_turb = base_turb if base_turb is not None else 0.0
    current_ssd = base_ssd if base_ssd is not None else 0.0

    # Logic for Irrigation
    # Irrigation is threatened by Algae (clogs filters) and Sediment (SSD)
    padded_forecast = list(rainfall_forecast) + [{}] * max(0, 5 - len(rainfall_forecast))
    for i, day_data in enumerate(padded_forecast[:5], start=1):
        if day_data:
            rain = float(day_data.get("predicted_rainfall_mm", 0) or 0)
            date_str = day_data.get("date", (datetime.utcnow() + timedelta(days=i)).strftime("%Y-%m-%d"))
        else:
            rain = 0.0
            date_str = (datetime.utcnow() + timedelta(days=i)).strftime("%Y-%m-%d")

        # Simple projection
        current_ndci = (current_ndci * (1 - ATTENUATION_RATE)) + (rain * RUNOFF_COEFF)
        current_turb = (current_turb * (1 - ATTENUATION_RATE)) - (rain * 0.002)
        current_ssd = (current_ssd * (1 - ATTENUATION_RATE)) + (rain * 0.005)

        # Count disturbances
        disturbances = 0
        if current_ndci > 0.05:
            disturbances += 1
        if current_ndci >= 0.0:
            disturbances += 1
        if current_turb < -0.05 or current_ssd > 0.15:
            disturbances += 1

        if disturbances >= 4:
            risk = 1.00
            category = "Critical"
            color = "RED"
        elif disturbances == 3:
            risk = 0.75
            category = "Harmful"
            color = "ORANGE"
        elif disturbances >= 1:
            risk = 0.45
            category = "Mediocre"
            color = "YELLOW"
        else:
            risk = 0.00
            category = "Healthy"
            color = "GREEN"

        forecast_days.append({
            "day": i,
            "date": date_str,
            "risk": risk,
            "category": category,
            "status_color": color,
            "rain": round(rain, 2),
            "pollution_pred": round(current_ndci, 4),
            "eu_alert": risk >= 0.75,
            "message": f"Projected disturbances: {disturbances} ({int(risk*100)}% risk)"
        })
    return forecast_days

# def build_eu_alert(forecast: List[Dict[str, Any]], current_ndci: Optional[float]) -> Dict[str, Any]:
#     """
#     Build the top-level EU alert object from forecast data.
#
#     Triggers if:
#       - Today's measured NDCI already exceeds POOR threshold (> 0.20), OR
#       - Any forecast day hits POOR category.
#
#     Returns:
#         Dict with triggered, first_exceedance_day, category, and message.
#     """
#     # Check today first
#     if current_ndci is not None and current_ndci > 0.20:
#         return {
#             "triggered":             True,
#             "first_exceedance_date": datetime.utcnow().strftime("%Y-%m-%d"),
#             "days_until_exceedance": 0,
#             "category":              "POOR",
#             "message": (
#                 "⚠️ Water quality currently POOR — exceeds EU Bathing Water "
#                 "Directive 2006/7/EC safe limit (NDCI > 0.20)."
#             ),
#         }
#
#     # Check forecast days
#     for day in forecast:
#         if day.get("eu_alert"):
#             return {
#                 "triggered":             True,
#                 "first_exceedance_date": day["date"],
#                 "days_until_exceedance": day["day"],
#                 "category":              day["category"],
#                 "message": (
#                     f"⚠️ Water quality predicted to reach POOR on {day['date']} "
#                     f"(day +{day['day']}) — EU Bathing Water Directive 2006/7/EC "
#                     f"safe limit will be exceeded (projected NDCI > 0.20)."
#                 ),
#             }
#
#     return {
#         "triggered":             False,
#         "first_exceedance_date": None,
#         "days_until_exceedance": None,
#         "category":              None,
#         "message":               "No EU Bathing Water Directive exceedance predicted in the next 5 days.",
#     }

def build_eu_alert(forecast: List[Dict[str, Any]], current_ndci: Optional[float]) -> Dict[str, Any]:
    # Just change the text inside, keep the keys the same
    for day in forecast:
        if day["eu_alert"]:
            return {
                "triggered": True,
                "first_exceedance_date": day["date"],
                "days_until_exceedance": day["day"],
                "category": day["category"],
                "message": f"⚠️ Warning: Predicted water quality hazard ({day['category']}) on {day['date']}."
            }
    return {
        "triggered": False,
        "first_exceedance_date": None,
        "days_until_exceedance": None,
        "category": None,
        "message": "Water safe from critical disturbances."
    }

def process_water_quality(
    bands: Dict[str, np.ndarray],
    rainfall_mm: Optional[float] = None,
    rainfall_forecast: Optional[List[Dict[str, Any]]] = None,
) -> Dict[str, Any]:
    """
    Full processing pipeline:
    1. Compute NDWI, NDCI, turbidity and suspended sediment from band reflectances
    2. Extract median values for the area of interest
    3. Determine water presence and pollution status
    4. Attach rainfall accumulation and its likely impact classification
    5. Generate 5-day water quality forecast with EU standard alerts

    Args:
        bands:             Dict of band arrays {"B02", "B03", "B04", "B05", "B08"}
        rainfall_mm:       Accumulated precipitation over past 5 days in mm (ERA5), or None
        rainfall_forecast: List of daily forecast dicts from fetch_rainfall_forecast(), or None

    Returns:
        Dict with ndwi, ndci, turbidity, suspendent_sediment, water_detected,
        pollution_status, rainfall_mm, rainfall_impact, forecast, eu_alert.

    Raises:
        ValueError if no valid satellite data is available.
    """
    B02 = bands.get("B02")
    B03 = bands.get("B03")
    B04 = bands.get("B04")
    B05 = bands.get("B05")
    B08 = bands.get("B08")

    if any(b is None for b in [B02, B03, B04, B05, B08]):
        raise ValueError("Missing required bands. Cannot compute water quality indices.")

    # Compute indices across the spatial extent
    ndwi_array     = compute_ndwi(B03, B08)
    ndci_array     = compute_ndci(B05, B04)
    turb_array     = compute_turbidity(B04, B03)
    sediment_array = compute_suspendent_sediment(B04, B02)

    # Extract representative scalar values (spatial median)
    ndwi_val     = extract_point_value(ndwi_array)
    ndci_val     = extract_point_value(ndci_array)
    turb_val     = extract_point_value(turb_array)
    sediment_val = extract_point_value(sediment_array)

    if all(v is None for v in [ndwi_val, ndci_val, turb_val, sediment_val]):
        raise ValueError(
            "No valid satellite data available for this location. "
            "The area may be fully cloud-covered. Try again in a few days."
        )

    water_detected   = bool(ndwi_val is not None and ndwi_val > 0.1)
    pollution_status = classify_pollution(ndci_val if ndci_val is not None else float("nan"))
    rainfall_impact  = classify_rainfall_impact(rainfall_mm)

    # ── 5-day forecast ─────────────────────────────────────────────────────────
    forecast = predict_water_quality_forecast(
        base_ndci         = ndci_val  if ndci_val  is not None else 0.0,
        base_ndwi         = ndwi_val  if ndwi_val  is not None else 0.0,
        rainfall_forecast = rainfall_forecast or [],
        base_turb         = turb_val  if turb_val  is not None else 0.0,
        base_ssd          = sediment_val if sediment_val is not None else 0.0,
    )

    # ── EU alert ───────────────────────────────────────────────────────────────
    eu_alert = build_eu_alert(forecast, ndci_val)

    logger.info(
        f"Processing complete: NDWI={ndwi_val:.4f}, NDCI={ndci_val:.4f}, "
        f"water={water_detected}, pollution={pollution_status}, "
        f"rainfall={rainfall_mm} mm ({rainfall_impact}), "
        f"EU alert={eu_alert['triggered']}"
    )

    return {
        "ndwi":                round(ndwi_val, 4)     if ndwi_val     is not None else None,
        "ndci":                round(ndci_val, 4)     if ndci_val     is not None else None,
        "turbidity":           round(turb_val, 4)     if turb_val     is not None else None,
        "suspendent_sediment": round(sediment_val, 4) if sediment_val is not None else None,
        "water_detected":      water_detected,
        "pollution_status":    pollution_status,
        "rainfall_mm":         rainfall_mm,
        "rainfall_impact":     rainfall_impact,
        "forecast":            forecast,
        "eu_alert":            eu_alert,
    }