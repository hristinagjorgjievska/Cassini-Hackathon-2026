import numpy as np
import logging
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, List
logger = logging.getLogger(__name__)
EU_THRESHOLDS = [(0.05, 'EXCELLENT', 0.2, 'BLUE', 0.0), (0.12, 'GOOD', 0.45, 'GREEN', 0.2), (0.2, 'SUFFICIENT', 0.7, 'YELLOW', 0.45), (None, 'POOR', 1.0, 'RED', 0.7)]
RUNOFF_COEFF = 0.004
ATTENUATION_RATE = 0.015

def safe_normalized_difference(band_a: np.ndarray, band_b: np.ndarray) -> np.ndarray:
    with np.errstate(divide='ignore', invalid='ignore'):
        result = np.where(band_a + band_b == 0, np.nan, (band_a - band_b) / (band_a + band_b))
    return result.astype(np.float32)

def compute_ndwi(B03: np.ndarray, B08: np.ndarray) -> np.ndarray:
    return safe_normalized_difference(B03, B08)

def compute_turbidity(B04: np.ndarray, B03: np.ndarray) -> np.ndarray:
    return safe_normalized_difference(B04, B03)

def compute_suspendent_sediment(B04: np.ndarray, B02: np.ndarray) -> np.ndarray:
    return safe_normalized_difference(B04, B02)

def compute_ndci(B05: np.ndarray, B04: np.ndarray) -> np.ndarray:
    return safe_normalized_difference(B05, B04)

def classify_eu_water_quality(ndci_value: float) -> Dict[str, Any]:
    if ndci_value is None or np.isnan(ndci_value):
        return {'category': 'UNKNOWN', 'risk': None, 'color': 'GREY', 'eu_alert': False}
    for max_ndci, category, risk_max, color, risk_min in EU_THRESHOLDS:
        if max_ndci is None or ndci_value <= max_ndci:
            if max_ndci is None:
                risk = min(1.0, risk_min + (ndci_value - 0.2) * 3.0)
            else:
                prev_threshold = {'EXCELLENT': 0.0, 'GOOD': 0.05, 'SUFFICIENT': 0.12}.get(category, 0.0)
                band_width = max_ndci - prev_threshold
                position = (ndci_value - prev_threshold) / band_width if band_width > 0 else 0
                risk = round(risk_min + position * (risk_max - risk_min), 4)
            return {'category': category, 'risk': round(max(0.0, min(1.0, risk)), 2), 'color': color, 'eu_alert': category == 'POOR'}
    return {'category': 'POOR', 'risk': 1.0, 'color': 'RED', 'eu_alert': True}

def classify_pollution(ndci_value: float) -> str:
    if ndci_value is None or np.isnan(ndci_value):
        return 'UNKNOWN'
    if ndci_value < 0:
        return 'LOW'
    elif ndci_value <= 0.2:
        return 'MEDIUM'
    else:
        return 'HIGH'

def classify_rainfall_impact(rainfall_mm: Optional[float]) -> str:
    if rainfall_mm is None:
        return 'UNKNOWN'
    if rainfall_mm < 5:
        return 'DRY'
    elif rainfall_mm < 20:
        return 'MODERATE'
    elif rainfall_mm < 50:
        return 'HIGH'
    else:
        return 'EXTREME'

def extract_point_value(array: np.ndarray) -> Optional[float]:
    valid = array[~np.isnan(array)]
    if len(valid) == 0:
        return None
    return float(np.median(valid))

def predict_water_quality_forecast(base_ndci: float, base_ndwi: float, rainfall_forecast: List[Dict[str, Any]], base_ssd: float=0.0, base_turb: float=0.0) -> List[Dict[str, Any]]:
    forecast_days = []
    current_ndci = base_ndci if base_ndci is not None else 0.0
    current_turb = base_turb if base_turb is not None else 0.0
    current_ssd = base_ssd if base_ssd is not None else 0.0
    padded_forecast = list(rainfall_forecast) + [{}] * max(0, 5 - len(rainfall_forecast))
    for i, day_data in enumerate(padded_forecast[:5], start=1):
        if day_data:
            rain = float(day_data.get('predicted_rainfall_mm', 0) or 0)
            date_str = day_data.get('date', (datetime.utcnow() + timedelta(days=i)).strftime('%Y-%m-%d'))
        else:
            rain = 0.0
            date_str = (datetime.utcnow() + timedelta(days=i)).strftime('%Y-%m-%d')
        current_ndci = current_ndci * (1 - ATTENUATION_RATE) + rain * RUNOFF_COEFF
        current_turb = current_turb * (1 - ATTENUATION_RATE) - rain * 0.002
        current_ssd = current_ssd * (1 - ATTENUATION_RATE) + rain * 0.005
        disturbances = 0
        if current_ndci > 0.05:
            disturbances += 1
        if current_ndci >= 0.0:
            disturbances += 1
        if current_turb < -0.05 or current_ssd > 0.15:
            disturbances += 1
        if disturbances >= 4:
            risk = 1.0
            category = 'Critical'
            color = 'RED'
        elif disturbances == 3:
            risk = 0.75
            category = 'Harmful'
            color = 'ORANGE'
        elif disturbances >= 1:
            risk = 0.45
            category = 'Mediocre'
            color = 'YELLOW'
        else:
            risk = 0.0
            category = 'Healthy'
            color = 'GREEN'
        forecast_days.append({'day': i, 'date': date_str, 'risk': risk, 'category': category, 'status_color': color, 'rain': round(rain, 2), 'pollution_pred': round(current_ndci, 4), 'eu_alert': risk >= 0.75, 'message': f'Projected disturbances: {disturbances} ({int(risk * 100)}% risk)'})
    return forecast_days

def build_eu_alert(forecast: List[Dict[str, Any]], current_ndci: Optional[float]) -> Dict[str, Any]:
    for day in forecast:
        if day['eu_alert']:
            return {'triggered': True, 'first_exceedance_date': day['date'], 'days_until_exceedance': day['day'], 'category': day['category'], 'message': f"⚠️ Warning: Predicted water quality hazard ({day['category']}) on {day['date']}."}
    return {'triggered': False, 'first_exceedance_date': None, 'days_until_exceedance': None, 'category': None, 'message': 'Water safe from critical disturbances.'}

def process_water_quality(bands: Dict[str, np.ndarray], rainfall_mm: Optional[float]=None, rainfall_forecast: Optional[List[Dict[str, Any]]]=None) -> Dict[str, Any]:
    B02 = bands.get('B02')
    B03 = bands.get('B03')
    B04 = bands.get('B04')
    B05 = bands.get('B05')
    B08 = bands.get('B08')
    if any((b is None for b in [B02, B03, B04, B05, B08])):
        raise ValueError('Missing required bands. Cannot compute water quality indices.')
    ndwi_array = compute_ndwi(B03, B08)
    ndci_array = compute_ndci(B05, B04)
    turb_array = compute_turbidity(B04, B03)
    sediment_array = compute_suspendent_sediment(B04, B02)
    ndwi_val = extract_point_value(ndwi_array)
    ndci_val = extract_point_value(ndci_array)
    turb_val = extract_point_value(turb_array)
    sediment_val = extract_point_value(sediment_array)
    if all((v is None for v in [ndwi_val, ndci_val, turb_val, sediment_val])):
        raise ValueError('No valid satellite data available for this location. The area may be fully cloud-covered. Try again in a few days.')
    water_detected = bool(ndwi_val is not None and ndwi_val > 0.1)
    pollution_status = classify_pollution(ndci_val if ndci_val is not None else float('nan'))
    rainfall_impact = classify_rainfall_impact(rainfall_mm)
    forecast = predict_water_quality_forecast(base_ndci=ndci_val if ndci_val is not None else 0.0, base_ndwi=ndwi_val if ndwi_val is not None else 0.0, rainfall_forecast=rainfall_forecast or [], base_turb=turb_val if turb_val is not None else 0.0, base_ssd=sediment_val if sediment_val is not None else 0.0)
    eu_alert = build_eu_alert(forecast, ndci_val)
    logger.info(f"Processing complete: NDWI={ndwi_val:.4f}, NDCI={ndci_val:.4f}, water={water_detected}, pollution={pollution_status}, rainfall={rainfall_mm} mm ({rainfall_impact}), EU alert={eu_alert['triggered']}")
    return {'ndwi': round(ndwi_val, 4) if ndwi_val is not None else None, 'ndci': round(ndci_val, 4) if ndci_val is not None else None, 'turbidity': round(turb_val, 4) if turb_val is not None else None, 'suspendent_sediment': round(sediment_val, 4) if sediment_val is not None else None, 'water_detected': water_detected, 'pollution_status': pollution_status, 'rainfall_mm': rainfall_mm, 'rainfall_impact': rainfall_impact, 'forecast': forecast, 'eu_alert': eu_alert}