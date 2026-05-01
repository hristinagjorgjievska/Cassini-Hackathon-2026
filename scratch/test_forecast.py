import logging
import json
from datetime import datetime, timedelta
import urllib.request

logging.basicConfig(level=logging.INFO)

def fetch_rainfall_forecast(lat, lon, days=5):
    today    = datetime.utcnow().date()
    end_date = today + timedelta(days=days)
    url = (
        f"https://api.open-meteo.com/v1/forecast"
        f"?latitude={lat}&longitude={lon}"
        f"&daily=precipitation_sum"
        f"&forecast_days={days + 1}"
        f"&timezone=UTC"
    )
    print(f"URL: {url}")
    try:
        with urllib.request.urlopen(url, timeout=15) as resp:
            data = json.loads(resp.read().decode())
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
        return forecast
    except Exception as e:
        print(f"Error: {e}")
        return []

res = fetch_rainfall_forecast(41.068, 20.721)
print(f"Result: {res}")
