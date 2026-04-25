This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

> The frontend detects whether the Python API is online automatically. If it's offline, an orange banner appears on the map with the exact command to start it.

---

## How It Works

1. The user opens the **My Map** page and clicks **"Add a Dot"** to place a Point of Interest anywhere on the map.
2. The POI is **saved immediately** to localStorage with a pending state (pulsing grey marker).
3. The frontend fires a `POST /analyze-water` request to the Python API with the POI's `{lat, lon}`.
4. The Python backend runs the **Sentinel-2 satellite pipeline** (60–120 seconds) — fetching cloud-masked imagery from Copernicus openEO, computing NDWI/NDCI, and classifying pollution.
5. When the result arrives, the map marker **updates automatically** with the real pollution colour and disturbances inferred from satellite data.
6. Clicking **"View Detailed Analysis"** opens a detail page showing NDWI, NDCI, turbidity, sediment load, water detection, and pollution status.

---

## Python API Endpoints

| Method | Path              | Description                              |
|--------|-------------------|------------------------------------------|
| `POST` | `/analyze-water`  | Analyze water quality at `{lat, lon}`    |
| `GET`  | `/health`         | Health check + cache stats               |
| `GET`  | `/docs`           | Auto-generated Swagger UI                |

**Example request:**
```bash
curl -X POST http://localhost:8000/analyze-water \
  -H "Content-Type: application/json" \
  -d '{"lat": 41.0297, "lon": 20.7169}'
```

**Example response:**
```json
{
    "location": { "lat": 41.0297, "lon": 20.7169 },
    "ndwi": 0.1805,
    "ndci": -0.0046,
    "turbidity": -0.0817,
    "suspendent_sediment": -0.1879,
    "water_detected": true,
    "pollution_status": "LOW",
    "timestamp": "2026-04-25T14:23:40.120744",
    "cached": false
}
```

---

## Pollution Classification

| NDCI Value | Status        | Meaning                          |
|------------|---------------|----------------------------------|
| `< 0`      | 🟢 **LOW**    | Clean water or land surface      |
| `0 – 0.2`  | 🟡 **MEDIUM** | Moderate algae presence          |
| `> 0.2`    | 🔴 **HIGH**   | Algae bloom / likely pollution   |

Disturbances inferred automatically from satellite data:

| Satellite signal           | Disturbance type |
|----------------------------|------------------|
| `ndci > 0.05`              | Algae            |
| `pollution_status` MEDIUM/HIGH | Pollution    |
| `turbidity < -0.05` or `sediment > 0.15` | Turbidity |

---

## Performance Notes

- Satellite data fetch: **60–120 seconds** per unique location (openEO job execution)
- Results are **cached for 30 minutes** (cache key rounds to ±0.01° ~1 km grid)
- Up to **10 concurrent** satellite requests via `ThreadPoolExecutor`
- Frontend polls the Python health endpoint every **30 seconds** and auto-recovers if the server starts mid-session

---

## JupyterHub Notebook

Upload `water_quality_notebook.ipynb` to [https://jupyterhub.dataspace.copernicus.eu](https://jupyterhub.dataspace.copernicus.eu) to:
- Explore any coordinate interactively
- Visualise NDWI and NDCI maps
- Run batch analysis on multiple Macedonian lakes
- Call the FastAPI backend directly from the notebook
