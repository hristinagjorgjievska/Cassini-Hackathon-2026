import type { SatelliteData } from "./waterData";

const API_BASE = "http://localhost:8000";

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
