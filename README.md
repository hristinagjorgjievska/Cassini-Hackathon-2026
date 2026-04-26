This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

# 🌊 Water Quality Monitor — Backend

Real-time water quality analysis using Copernicus Sentinel-2 satellite data.

## Project Structure

```
water_quality/
├── api.py              # FastAPI app — endpoints + ThreadPoolExecutor
├── data_fetch.py       # openEO data pipeline — fetches Sentinel-2 bands
├── processing.py       # NDWI/NDCI computation + pollution classification
├── requirements.txt    # Python dependencies
└── water_quality_notebook.ipynb  # Copernicus JupyterHub exploration notebook
```

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. First-time Copernicus authentication
```bash
python -c "import openeo; c = openeo.connect('https://openeo.dataspace.copernicus.eu'); c.authenticate_oidc()"
```
```bash
Invoke-RestMethod -Uri "http://localhost:8000/analyze-water" -Method Post -ContentType "application/json" -Body '{"lat": 41.0297, "lon": 20.7169}'
```

### 3. Run the API server
```bash
uvicorn api:app --host 0.0.0.0 --port 8000 --reload
```

### 4. Test it
```bash
curl -X POST http://localhost:8000/analyze-water \
  -H "Content-Type: application/json" \
  -d '{"lat": 41.0297, "lon": 20.7169}'
```

Expected response:
```json
{
    "location": {
        "lat": 41.233839,
        "lon": 22.765841
    },
    "ndwi": 0.4404,
    "ndci": 0.0027,
    "turbidity": -0.257,
    "suspendent_sediment": -0.0582,
    "water_detected": true,
    "pollution_status": "MEDIUM",
    "rainfall_mm": 22.3,
    "rainfall_impact": "HIGH",
    "forecast": [
        {
            "day": 1,
            "date": "2026-04-26",
            "risk": 0.01,
            "category": "GOOD",
            "status_color": "GREEN",
            "rain": 0.0,
            "pollution_pred": 0.0027,
            "eu_alert": false,
            "message": "Safe for Irrigation"
        },
        {
            "day": 2,
            "date": "2026-04-27",
            "risk": 0.01,
            "category": "GOOD",
            "status_color": "GREEN",
            "rain": 0.0,
            "pollution_pred": 0.0026,
            "eu_alert": false,
            "message": "Safe for Irrigation"
        },
        {
            "day": 3,
            "date": "2026-04-28",
            "risk": 0.01,
            "category": "GOOD",
            "status_color": "GREEN",
            "rain": 0.0,
            "pollution_pred": 0.0026,
            "eu_alert": false,
            "message": "Safe for Irrigation"
        },
        {
            "day": 4,
            "date": "2026-04-29",
            "risk": 0.01,
            "category": "GOOD",
            "status_color": "GREEN",
            "rain": 0.0,
            "pollution_pred": 0.0026,
            "eu_alert": false,
            "message": "Safe for Irrigation"
        },
        {
            "day": 5,
            "date": "2026-04-30",
            "risk": 0.07,
            "category": "GOOD",
            "status_color": "GREEN",
            "rain": 2.7,
            "pollution_pred": 0.0133,
            "eu_alert": false,
            "message": "Safe for Irrigation"
        }
    ],
    "eu_alert": {
        "triggered": false,
        "first_exceedance_date": null,
        "days_until_exceedance": null,
        "category": null,
        "message": "Water safe for irrigation."
    },
    "alert_dispatched": false,
    "timestamp": "2026-04-25T21:19:43.142304",
    "cached": false
}
```

## API Endpoints

| Method | Path             | Description                            |
|--------|------------------|----------------------------------------|
| POST   | `/analyze-water` | Analyze water quality at {lat, lon}    |
| GET    | `/health`        | Health check + cache stats             |
| GET    | `/docs`          | Auto-generated Swagger UI              |

## Connecting the Frontend

In your frontend (the Macedonia map), when a user clicks a water area:
```javascript
const response = await fetch('http://localhost:8000/analyze-water', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ lat: clickedLat, lon: clickedLon })
});
const data = await response.json();
// data.pollution_status → "LOW" | "MEDIUM" | "HIGH"
// data.water_detected   → true/false
// data.ndwi             → float
// data.ndci             → float
```

## Pollution Classification

| NDCI Value | Status | Meaning |
|------------|--------|---------|
| < 0        | 🟢 LOW    | Clean water or land surface |
| 0 – 0.2    | 🟡 MEDIUM | Moderate algae presence |
| > 0.2      | 🔴 HIGH   | Algae bloom / likely pollution |

## JupyterHub Notebook

Upload `water_quality_notebook.ipynb` to:
https://jupyterhub.dataspace.copernicus.eu

The notebook lets you:
- Explore any coordinate interactively
- Visualize NDWI and NDCI maps
- Run batch analysis on multiple Macedonian lakes
- Call the FastAPI backend from the notebook

## Performance Notes

- Satellite data fetch takes **60–120 seconds** per unique location (openEO job execution)
- Results are **cached for 30 minutes** to avoid redundant requests
- Cache key rounds to ±0.01° (~1km grid)

