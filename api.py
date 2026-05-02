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
logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(name)s: %(message)s')
logger = logging.getLogger(__name__)
app = FastAPI(title='Water Quality Monitor API', description='Real-time water quality analysis using Copernicus Sentinel-2 and ERA5-LAND data. Includes 5-day forecast and EU Bathing Water Directive (2006/7/EC) alerts.', version='1.2.0')
app.add_middleware(CORSMiddleware, allow_origins=['*'], allow_methods=['*'], allow_headers=['*'])
executor = ThreadPoolExecutor(max_workers=10)
_cache: dict = {}
CACHE_TTL_MINUTES = 30
CACHE_PRECISION = 2

def _cache_key(lat: float, lon: float) -> str:
    return f'{round(lat, CACHE_PRECISION)},{round(lon, CACHE_PRECISION)}'

def _get_cached(lat: float, lon: float) -> Optional[dict]:
    key = _cache_key(lat, lon)
    if key in _cache:
        result, cached_at = _cache[key]
        if datetime.utcnow() - cached_at < timedelta(minutes=CACHE_TTL_MINUTES):
            logger.info(f'Cache HIT for key={key}')
            return result
        del _cache[key]
    return None

def _set_cached(lat: float, lon: float, result: dict):
    _cache[_cache_key(lat, lon)] = (result, datetime.utcnow())

class WaterAnalysisRequest(BaseModel):
    lat: float = Field(..., ge=-90, le=90, description='Latitude (-90 to 90)')
    lon: float = Field(..., ge=-180, le=180, description='Longitude (-180 to 180)')

    @field_validator('lat')
    @classmethod
    def validate_lat(cls, v):
        if v < -90 or v > 90:
            raise ValueError('Latitude must be between -90 and 90')
        return v

    @field_validator('lon')
    @classmethod
    def validate_lon(cls, v):
        if v < -180 or v > 180:
            raise ValueError('Longitude must be between -180 and 180')
        return v

class LocationInfo(BaseModel):
    lat: float
    lon: float

class ForecastDay(BaseModel):
    day: int
    date: str
    risk: float
    category: str
    status_color: str
    rain: float
    pollution_pred: float
    eu_alert: bool
    message: str

class EUAlert(BaseModel):
    triggered: bool
    first_exceedance_date: Optional[str]
    days_until_exceedance: Optional[int]
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
    rainfall_mm: Optional[float]
    rainfall_impact: Optional[str]
    forecast: List[ForecastDay]
    eu_alert: EUAlert
    timestamp: str
    cached: bool = False

def save_result_to_json(data: dict):
    from datetime import datetime
    lat = data['location']['lat']
    lon = data['location']['lon']
    timestamp_str = datetime.now().strftime('%Y%m%d_%H%M%S')
    filename = f'output_{lat}_{lon}_{timestamp_str}.json'
    base_dir = os.path.dirname(os.path.abspath(__file__))
    output_dir = os.path.join(base_dir, 'satelite_data_output')
    os.makedirs(output_dir, exist_ok=True)
    file_path = os.path.join(output_dir, filename)
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=4)
        logger.info(f'Result saved to {file_path}')
    except Exception as e:
        logger.warning(f'Could not save JSON file: {e}')

def _run_analysis(lat: float, lon: float) -> dict:
    logger.info(f'Starting satellite analysis for lat={lat}, lon={lon}')
    fetch_result = fetch_sentinel2_bands(lat, lon)
    quality = process_water_quality(bands=fetch_result['bands'], rainfall_mm=fetch_result.get('rainfall_mm'), rainfall_forecast=fetch_result.get('rainfall_forecast', []))
    alert_dispatch_result = dispatch_alerts(quality)
    result = {'location': {'lat': lat, 'lon': lon}, 'ndwi': quality['ndwi'], 'ndci': quality['ndci'], 'turbidity': quality['turbidity'], 'suspendent_sediment': quality['suspendent_sediment'], 'water_detected': quality['water_detected'], 'pollution_status': quality['pollution_status'], 'rainfall_mm': quality['rainfall_mm'], 'rainfall_impact': quality['rainfall_impact'], 'forecast': quality['forecast'], 'eu_alert': quality['eu_alert'], 'alert_dispatched': alert_dispatch_result is not None, 'timestamp': fetch_result['timestamp'], 'cached': False}
    save_result_to_json(result)
    return result

@app.post('/analyze-water', response_model=WaterAnalysisResponse)
async def analyze_water(request: WaterAnalysisRequest):
    lat, lon = (request.lat, request.lon)
    cached = _get_cached(lat, lon)
    if cached:
        cached['cached'] = True
        return WaterAnalysisResponse(**cached)
    loop = asyncio.get_event_loop()
    try:
        result = await loop.run_in_executor(executor, _run_analysis, lat, lon)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=f'Satellite data service error: {e}')
    except Exception as e:
        logger.exception(f'Unexpected error for lat={lat}, lon={lon}')
        raise HTTPException(status_code=500, detail=f'Internal error: {e}')
    _set_cached(lat, lon, result)
    return WaterAnalysisResponse(**result)

@app.get('/health')
async def health():
    return {'status': 'ok', 'service': 'Water Quality Monitor API', 'version': '1.2.0', 'cache_size': len(_cache), 'timestamp': datetime.utcnow().isoformat()}
if __name__ == '__main__':
    import uvicorn
    uvicorn.run(app, host='0.0.0.0', port=8000, log_level='info')