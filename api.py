"""
api.py
------
FastAPI backend for real-time water quality monitoring.

Endpoints:
    POST /analyze-water   → accepts {lat, lon}, returns water quality analysis
    GET  /health          → health check

Uses ThreadPoolExecutor to run blocking openEO calls off the async event loop,
so multiple users can query different coordinates simultaneously without blocking.

Rainfall:
    The response includes two fields derived from ERA5-LAND (via Open-Meteo):
        rainfall_mm     – total accumulated precipitation (mm) over the past 5 days
        rainfall_impact – qualitative classification: DRY / MODERATE / HIGH / EXTREME

Forecast (NEW):
    The response includes a 5-day forward projection:
        forecast        – list of daily dicts with risk, category, EU color, rain, message
        eu_alert        – top-level alert object (triggered if POOR threshold is breached)

    The forecast model is rule-based:
        ndci[d] = ndci[d-1] * (1 - 0.015) + rain[d] * 0.004
    Classification follows EU Bathing Water Directive 2006/7/EC thresholds.
"""

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Optional, List, Any, Dict
import json
import os
from alerts import dispatch_alerts
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

from data_fetch import fetch_sentinel2_bands
from processing import process_water_quality

# ── Logging ────────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)

# ── FastAPI app ─────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Water Quality Monitor API",
    description=(
        "Real-time water quality analysis using Copernicus Sentinel-2 and ERA5-LAND data. "
        "Includes 5-day forecast and EU Bathing Water Directive (2006/7/EC) alerts."
    ),
    version="1.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Thread pool for blocking openEO calls ───────────────────────────────────────
executor = ThreadPoolExecutor(max_workers=10)

# ── Simple in-memory cache ──────────────────────────────────────────────────────
_cache: dict = {}
CACHE_TTL_MINUTES = 30
CACHE_PRECISION = 2


def _cache_key(lat: float, lon: float) -> str:
    return f"{round(lat, CACHE_PRECISION)},{round(lon, CACHE_PRECISION)}"


def _get_cached(lat: float, lon: float) -> Optional[dict]:
    key = _cache_key(lat, lon)
    if key in _cache:
        result, cached_at = _cache[key]
        if datetime.utcnow() - cached_at < timedelta(minutes=CACHE_TTL_MINUTES):
            logger.info(f"Cache HIT for key={key}")
            return result
        del _cache[key]
    return None


def _set_cached(lat: float, lon: float, result: dict):
    _cache[_cache_key(lat, lon)] = (result, datetime.utcnow())


# ── Pydantic models ─────────────────────────────────────────────────────────────

class WaterAnalysisRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description="Latitude (-90 to 90)")
    lon: float = Field(..., ge=-180, le=180, description="Longitude (-180 to 180)")

    @field_validator("lat")
    @classmethod
    def validate_lat(cls, v):
        if v < -90 or v > 90:
            raise ValueError("Latitude must be between -90 and 90")
        return v

    @field_validator("lon")
    @classmethod
    def validate_lon(cls, v):
        if v < -180 or v > 180:
            raise ValueError("Longitude must be between -180 and 180")
        return v


class LocationInfo(BaseModel):
    lat: float
    lon: float


class ForecastDay(BaseModel):
    """Single day of 5-day water quality forecast."""
    day: int  # 1–5
    date: str  # ISO date string, e.g. "2026-04-26"
    risk: float  # 0.0 (best) → 1.0 (worst)
    category: str  # EXCELLENT / GOOD / SUFFICIENT / POOR
    status_color: str  # BLUE / GREEN / YELLOW / RED
    rain: float  # predicted precipitation (mm)
    pollution_pred: float  # projected NDCI value
    eu_alert: bool  # True if category == POOR
    message: str  # human-readable summary


class EUAlert(BaseModel):
    """EU Bathing Water Directive (2006/7/EC) alert object."""
    triggered: bool
    first_exceedance_date: Optional[str]  # ISO date or None
    days_until_exceedance: Optional[int]  # 0 = today, 1–5 = forecast day, None = no breach
    category: Optional[str]
    message: str


class WaterAnalysisResponse(BaseModel):
    location: LocationInfo
    ndwi: Optional[float]
    ndci: Optional[float]
    turbidity: Optional[float]
    suspendent_sediment: Optional[float]
    water_detected: bool
    pollution_status: str
    # ── Rainfall (ERA5 via Open-Meteo) ────────────────────────────────────────
    rainfall_mm: Optional[float]
    rainfall_impact: Optional[str]
    # ── 5-day forecast + EU alert (NEW) ───────────────────────────────────────
    forecast: List[ForecastDay]
    eu_alert: EUAlert
    # ─────────────────────────────────────────────────────────────────────────
    timestamp: str
    cached: bool = False


# ── Persistence helper ──────────────────────────────────────────────────────────

def save_result_to_json(data: dict):
    from datetime import datetime
    lat = data["location"]["lat"]
    lon = data["location"]["lon"]
    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"output_{lat}_{lon}_{timestamp_str}.json"
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, "satelite_data_output")
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, filename)
    try:
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        logger.info(f"Result saved to {file_path}")
    except Exception as e:
        logger.warning(f"Could not save JSON file: {e}")


# ── Core analysis function (runs in thread pool) ────────────────────────────────

def _run_analysis(lat: float, lon: float) -> dict:
    """
    Synchronous function that fetches satellite + ERA5 + forecast data and
    computes water quality indices + 5-day prediction.
    Called from the thread pool so it does not block the async event loop.
    """
    logger.info(f"Starting satellite analysis for lat={lat}, lon={lon}")

    # Step 1: Fetch Sentinel-2 bands + ERA5 historical rainfall + 5-day forecast
    fetch_result = fetch_sentinel2_bands(lat, lon)

    # Step 2: Compute indices, classify pollution, generate forecast & EU alert
    quality = process_water_quality(
        bands=fetch_result["bands"],
        rainfall_mm=fetch_result.get("rainfall_mm"),
        rainfall_forecast=fetch_result.get("rainfall_forecast", []),
    )

    alert_dispatch_result = dispatch_alerts(quality)


    result = {
        "location": {"lat": lat, "lon": lon},
        "ndwi": quality["ndwi"],
        "ndci": quality["ndci"],
        "turbidity": quality["turbidity"],
        "suspendent_sediment": quality["suspendent_sediment"],
        "water_detected": quality["water_detected"],
        "pollution_status": quality["pollution_status"],
        "rainfall_mm": quality["rainfall_mm"],
        "rainfall_impact": quality["rainfall_impact"],
        "forecast": quality["forecast"],
        "eu_alert": quality["eu_alert"],
        "alert_dispatched": alert_dispatch_result is not None,
        "timestamp": fetch_result["timestamp"],
        "cached": False,
    }

    save_result_to_json(result)
    return result


# ── API Endpoints ───────────────────────────────────────────────────────────────

@app.post("/analyze-water", response_model=WaterAnalysisResponse)
async def analyze_water(request: WaterAnalysisRequest):
    """
    Analyze water quality at the given coordinates using Sentinel-2 and ERA5-LAND.

    Returns:
    - NDWI, NDCI, turbidity, suspended sediment (current)
    - Rainfall accumulation + impact (last 5 days via ERA5/Open-Meteo)
    - **5-day forecast** with daily risk score, EU category, and color
    - **EU Bathing Water Directive alert** (triggered when POOR threshold is breached)

    Results are cached for 30 minutes to avoid redundant satellite requests.
    """
    lat, lon = request.lat, request.lon

    cached = _get_cached(lat, lon)
    if cached:
        cached["cached"] = True
        return WaterAnalysisResponse(**cached)

    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(executor, _run_analysis, lat, lon)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f"Satellite data service error: {e}")
    except Exception as e:
        logger.exception(f"Unexpected error for lat={lat}, lon={lon}")
        raise HTTPException(status_code=500, detail=f"Internal error: {e}")

    _set_cached(lat, lon, result)
    return WaterAnalysisResponse(**result)


@app.get("/health")
async def health():
    """Simple health check endpoint."""
    return {
        "status": "ok",
        "service": "Water Quality Monitor API",
        "version": "1.2.0",
        "cache_size": len(_cache),
        "timestamp": datetime.utcnow().isoformat(),
    }


# ── Entry point ─────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
