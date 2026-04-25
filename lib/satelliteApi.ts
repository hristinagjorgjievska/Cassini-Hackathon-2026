/**
 * satelliteApi.ts
 * ---------------
 * Owns all communication with the Python FastAPI backend on localhost:8000.
 * All fetch() calls to the satellite pipeline live here.
 */

import type { SatelliteData } from "./waterData";

const API_BASE = "http://localhost:8000";

/**
 * Pings the health endpoint with a 2-second timeout.
 * Returns true if the Python backend is running, false otherwise.
 */
export async function checkApiHealth(): Promise<boolean> {
    try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000);
        const res = await fetch(`${API_BASE}/health`, {
            signal: controller.signal,
        });
        clearTimeout(timeout);
        return res.ok;
    } catch {
        return false;
    }
}

/**
 * POST /analyze-water — triggers the Sentinel-2 satellite pipeline.
 * Takes 60–120 seconds to resolve. Throws on network error or non-200 status.
 */
export async function analyzeWater(
    lat: number,
    lon: number
): Promise<SatelliteData> {
    const res = await fetch(`${API_BASE}/analyze-water`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lat, lon }),
    });
    if (!res.ok) {
        let errMsg = `${res.status} ${res.statusText}`;
        try {
            const errData = await res.json();
            errMsg = `${errMsg} - ${JSON.stringify(errData)}`;
        } catch (e) {}
        throw new Error(`Satellite API error: ${errMsg}`);
    }
    return res.json();
}
