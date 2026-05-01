"""
data_fetch.py
-------------
Handles all communication with the Copernicus Data Space via the openEO API.
Fetches Sentinel-2 L2A data for a given bounding box and time range.

ROOT CAUSE FIX (422 error):
  The SCL mask kept only classes 4,5,6,7. In spring/cloudy conditions over
  Macedonia this wipes ALL pixels → all NaN → ValueError in processing → 422.

  Fix strategy (3 layers):
  1. PRIMARY:    Loosen SCL mask to also keep class 3 (cloud shadow) and 8
                 (medium cloud probability). Covers most real-world cases.
  2. FALLBACK:   If >80% pixels are still NaN, retry with NO SCL mask at all
                 (raw median composite). Slightly noisier but always has data.
  3. WIDER TIME: If 15-day window is empty, automatically widen to 45 days.

RAINFALL (Open-Meteo / ERA5):
  The Copernicus openEO backend has no ERA5 / climate collections available.
  Rainfall is fetched from the Open-Meteo Historical Weather API instead,
  which is backed by ERA5 reanalysis data and requires no API key.

FORECAST:
  5-day precipitation forecast from Open-Meteo forecast API (GFS/ECMWF blend).
  Returned as a list of daily dicts and passed into processing.py for
  rule-based water quality prediction.
"""

import io
import json as _json
import logging
import requests
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import openeo
import rasterio

logger = logging.getLogger(__name__)

OPENEO_URL     = "https://openeo.dataspace.copernicus.eu"
COLLECTION     = "SENTINEL2_L2A"
REQUIRED_BANDS = ["B02", "B03", "B04", "B05", "B08"]
BBOX_OFFSET    = 0.01   # ~1 km radius in degrees
RAINFALL_DAYS_BACK = 5  # historical window (matches S2 revisit cycle)
FORECAST_DAYS      = 5  # forward window
NAN_THRESHOLD      = 0.80


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def get_bounding_box(lat: float, lon: float, offset: float = BBOX_OFFSET) -> Dict:
    return {
        "west":  lon - offset,
        "south": lat - offset,
        "east":  lon + offset,
        "north": lat + offset,
        "crs":   "EPSG:4326",
    }


def get_time_range(days_back: int) -> Tuple[str, str]:
    end   = datetime.utcnow()
    start = end - timedelta(days=days_back)
    return start.strftime("%Y-%m-%d"), end.strftime("%Y-%m-%d")


def connect_to_openeo() -> openeo.Connection:
    try:
        conn = openeo.connect(OPENEO_URL)
        conn.authenticate_oidc()
        logger.info("Connected to Copernicus openEO backend successfully.")
        return conn
    except Exception as e:
        logger.error(f"openEO connection failed: {e}")
        raise RuntimeError(f"openEO connection failed: {e}")


# ---------------------------------------------------------------------------
# Sentinel-2 band fetching
# ---------------------------------------------------------------------------

def _build_composite(
    conn: openeo.Connection,
    bbox: Dict,
    start_date: str,
    end_date: str,
    band: str,
    use_scl_mask: bool = True,
) -> openeo.DataCube:
    bands_to_load = [band, "SCL"] if use_scl_mask else [band]
    cube = conn.load_collection(
        COLLECTION,
        spatial_extent=bbox,
        temporal_extent=[start_date, end_date],
        bands=bands_to_load,
        max_cloud_cover=90,
    )
    if use_scl_mask:
        scl = cube.band("SCL")
        valid_mask = (
            (scl == 3) | (scl == 4) | (scl == 5) |
            (scl == 6) | (scl == 7) | (scl == 8)
        )
        cube = cube.filter_bands([band]).mask(~valid_mask)
    composite = cube.reduce_dimension(dimension="t", reducer="median")
    return composite / 10000.0


def _download_to_array(datacube: openeo.DataCube, band_name: str) -> np.ndarray:
    logger.info(f"Per-band download starting for {band_name}...")
    raw = datacube.download(format="GTiff")
    with rasterio.open(io.BytesIO(raw)) as src:
        arr = src.read(1).astype(np.float32)
        if src.nodata is not None:
            arr[arr == src.nodata] = np.nan
    arr[arr == 0.0] = np.nan
    nan_frac = float(np.mean(np.isnan(arr)))
    logger.info(f"Per-band download completed for {band_name}: shape={arr.shape}, NaN={nan_frac:.1%}")
    return arr


def _nan_fraction(bands: Dict[str, np.ndarray]) -> float:
    fracs = [np.mean(np.isnan(arr)) for arr in bands.values()]
    return float(np.mean(fracs)) if fracs else 1.0


# ---------------------------------------------------------------------------
# Rainfall historical — Open-Meteo archive API (ERA5 reanalysis)
# ---------------------------------------------------------------------------

def fetch_era5_rainfall(
    conn: openeo.Connection,
    bbox: Dict,
    days_back: int = RAINFALL_DAYS_BACK,
) -> Optional[float]:
    """
    Fetch accumulated precipitation (mm) for the past `days_back` days.
    Uses Open-Meteo archive API (ERA5-backed, no API key needed).
    `conn` is unused but kept for signature compatibility.
    """
    lat = (bbox["south"] + bbox["north"]) / 2
    lon = (bbox["west"]  + bbox["east"])  / 2
    start_date, end_date = get_time_range(days_back)

    url = (
        f"https://archive-api.open-meteo.com/v1/archive"
        f"?latitude={lat}&longitude={lon}"
        f"&start_date={start_date}&end_date={end_date}"
        f"&daily=precipitation_sum&timezone=UTC"
    )
    logger.info(f"Fetching Open-Meteo ERA5 rainfall | lat={lat:.4f}, lon={lon:.4f} | {start_date}/{end_date}")

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        values = data.get("daily", {}).get("precipitation_sum", [])
        if not values:
            logger.warning("Open-Meteo: no precipitation data returned.")
            return None
        total_mm = max(0.0, sum(v for v in values if v is not None))
        logger.info(f"Open-Meteo rainfall: {total_mm:.2f} mm over {days_back} days")
        return round(total_mm, 2)
    except Exception as e:
        logger.warning(f"Open-Meteo rainfall fetch failed (non-fatal): {e}")
        return None


# ---------------------------------------------------------------------------
# Rainfall forecast — Open-Meteo forecast API
# ---------------------------------------------------------------------------

def fetch_rainfall_forecast(
    lat: float,
    lon: float,
    days: int = FORECAST_DAYS,
) -> List[Dict[str, Any]]:
    """
    Fetch daily precipitation forecast for the next `days` days.
    Uses Open-Meteo forecast API (GFS/ECMWF blend, no API key needed).

    Returns a list of dicts:
        [{"date": "2026-04-26", "predicted_rainfall_mm": 3.2}, ...]

    Today is excluded (partial day). Returns [] on failure.
    """
    today    = datetime.utcnow().date()
    end_date = today + timedelta(days=days)

    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=precipitation_sum"
        f"&forecast_days={days + 1}"
        f"&timezone=UTC"
    )
    logger.info(f"Fetching Open-Meteo forecast | lat={lat:.4f}, lon={lon:.4f} | next {days} days")

    try:
        resp = requests.get(url, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        dates  = data.get("daily", {}).get("time", [])
        values = data.get("daily", {}).get("precipitation_sum", [])

        forecast = []
        for date_str, val in zip(dates, values):
            if date_str <= today.strftime("%Y-%m-%d"):
                continue  # skip today (partial)
            if date_str > end_date.strftime("%Y-%m-%d"):
                break
            forecast.append({
                "date":                  date_str,
                "predicted_rainfall_mm": round(val, 2) if val is not None else None,
            })

        logger.info(f"Open-Meteo forecast: {len(forecast)} days fetched")
        return forecast

    except Exception as e:
        logger.warning(f"Open-Meteo forecast fetch failed (non-fatal): {e}")
        return []


# ---------------------------------------------------------------------------
# Public interface
# ---------------------------------------------------------------------------

def fetch_sentinel2_bands(lat: float, lon: float) -> Dict[str, Any]:
    """
    Fetch Sentinel-2 bands + historical rainfall + 5-day forecast.

    Returns
    -------
    dict with keys: bands, bbox, time_range, timestamp, masked,
                    rainfall_mm, rainfall_forecast
    """
    conn = connect_to_openeo()
    bbox = get_bounding_box(lat, lon)

    attempts = [
        (15, True,  "15-day window + SCL mask"),
        (15, False, "15-day window, NO mask (fallback)"),
        (45, False, "45-day window, NO mask (wide fallback)"),
    ]

    for days_back, use_mask, label in attempts:
        start_date, end_date = get_time_range(days_back)
        logger.info(f"Fetching Sentinel-2 | strategy='{label}' | bbox={bbox} | time={start_date}/{end_date}")

        bands: Dict[str, np.ndarray] = {}
        download_ok = True

        for band in REQUIRED_BANDS:
            try:
                cube = _build_composite(conn, bbox, start_date, end_date, band, use_mask)
                bands[band] = _download_to_array(cube, band)
            except Exception as e:
                logger.warning(f"Band {band} download failed ({label}): {e}")
                download_ok = False
                break

        if not download_ok:
            continue

        nan_frac = _nan_fraction(bands)
        logger.info(f"Strategy '{label}': average NaN fraction = {nan_frac:.1%}")

        if nan_frac < NAN_THRESHOLD:
            logger.info(f"Valid data obtained with strategy: '{label}'")
            rainfall_mm       = fetch_era5_rainfall(conn, bbox, days_back=RAINFALL_DAYS_BACK)
            rainfall_forecast = fetch_rainfall_forecast(lat, lon, days=FORECAST_DAYS)
            return {
                "bands":             bands,
                "bbox":              bbox,
                "time_range":        (start_date, end_date),
                "timestamp":         datetime.utcnow().isoformat(),
                "masked":            use_mask,
                "rainfall_mm":       rainfall_mm,
                "rainfall_forecast": rainfall_forecast,
            }

        logger.warning(f"Strategy '{label}': NaN={nan_frac:.1%} exceeds threshold. Trying next.")

    raise ValueError(
        f"No valid Sentinel-2 data for lat={lat}, lon={lon} after all fallback strategies."
    )