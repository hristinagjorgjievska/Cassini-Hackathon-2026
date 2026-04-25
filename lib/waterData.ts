import { sendAnalysisCompleteEmail } from "./sendEmail";

export const disturbanceIntensityColors: [number, string][] = [
    [0, "#22c55e"],   // Healthy (Green)
    [45, "#eab308"],  // Moderate (Yellow)
    [75, "#f97316"],  // Severe (Orange)
    [100, "#ef4444"], // Critical (Red)
];

export function interpolateColor(c1: string, c2: string, t: number) {
    const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
    const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
    return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(b1 + (b2 - b1) * t)})`;
}

export function getDisturbanceLevel(source: WaterSource): number {
    if (source.disturbances && source.disturbances.length > 0) {
        const count = source.disturbances.length;
        if (count >= 4) return 100;
        if (count === 3) return 75;
        if (count >= 1) return 45;
        return 0;
    }
    const p = Number(source.disturbancePercentage) || 0;
    if (p >= 100) return 100;
    if (p >= 75) return 75;
    if (p >= 45) return 45;
    return 0;
}

export function getDisturbanceColor(source: WaterSource) {
    const level = getDisturbanceLevel(source);
    if (level === 0) return "#22c55e";
    if (level === 45) return "#eab308";
    if (level === 75) return "#f97316";
    return "#ef4444";
}

export function getDisturbanceLabel(source: WaterSource): string {
    const level = getDisturbanceLevel(source);
    if (level === 0) return "0% - Healthy";
    if (level === 45) return "45% - Mediocre";
    if (level === 75) return "75% - Harmfull";
    return "100% - Critical";
}

export function colorToHex(color: string): string {
    if (color.startsWith("#")) return color;
    const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!m) return "#ffffff";
    return "#" + [m[1], m[2], m[3]].map(v => parseInt(v).toString(16).padStart(2, "0")).join("");
}

export const disturbanceColors: Record<string, string> = {
    algae: "#16a34a", pollution: "#7c3aed",
    turbidity: "#d97706", temperature: "#dc2626",
};

export const disturbanceLabels: Record<string, string> = {
    algae: "Algae bloom",
    pollution: "Pollution",
    turbidity: "High turbidity",
    temperature: "Temp anomaly",
};

export const disturbanceDescriptions: Record<string, string> = {
    algae: "Algae bloom – caused by excess nutrients warming the water this time of year",
    pollution: "Pollution – likely from industrial discharge and urban runoff upstream",
    turbidity: "High turbidity – heavy rainfall has stirred up sediment reducing water clarity",
    temperature: "Temp anomaly – surface temperatures are above seasonal average by 2–3°C",
};

export type Disturbance = { id: number; type: string; };

/** Raw response from the Python FastAPI /analyze-water endpoint */
export type SatelliteData = {
    ndwi: number | null;
    ndci: number | null;
    turbidity: number | null;
    suspendent_sediment: number | null;
    water_detected: boolean;
    pollution_status: string;
    timestamp: string;
};

export type WaterSource = {
    id: number;
    longitude: number;
    latitude: number;
    disturbancePercentage: number;
    label: string;
    disturbances: Disturbance[];
    /** true while satellite analysis is in flight */
    pending?: boolean;
    /** lifecycle state of the satellite fetch */
    satelliteStatus?: "pending" | "done" | "error" | "unavailable";
    /** raw API response stored after a successful analysis */
    satelliteData?: SatelliteData;
};

export type Region = { center: [number, number]; zoom: number; waterSources: WaterSource[]; };

export const defaultRegions: Record<string, Region> = {
    "ohrid": {
        center: [20.802, 41.068], zoom: 11,
        waterSources: [{
            id: 1, longitude: 20.802, latitude: 41.068, disturbancePercentage: 75, label: "Ohrid Lake",
            disturbances: [
                { id: 1, type: "algae" },
                { id: 2, type: "turbidity" },
                { id: 3, type: "temperature" },
            ],
        }],
    },
    "ohridsko ezero": {
        center: [20.802, 41.068], zoom: 11,
        waterSources: [{
            id: 2, longitude: 20.802, latitude: 41.068, disturbancePercentage: 50, label: "Ohrid Lake",
            disturbances: [
                { id: 1, type: "algae" },
                { id: 2, type: "turbidity" },
            ],
        }],
    },
    "prespa": {
        center: [21.020, 40.900], zoom: 11,
        waterSources: [{
            id: 3, longitude: 21.020, latitude: 40.900, disturbancePercentage: 55, label: "Prespa Lake",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "dojran": {
        center: [22.690, 41.210], zoom: 12,
        waterSources: [{
            id: 4, longitude: 22.690, latitude: 41.210, disturbancePercentage: 80, label: "Dojran Lake",
            disturbances: [
                { id: 1, type: "temperature" },
                { id: 2, type: "pollution" },
                { id: 3, type: "turbidity" },
            ],
        }],
    },
    "skopje": {
        center: [21.432, 42.002], zoom: 12,
        waterSources: [{
            id: 5, longitude: 21.432, latitude: 42.002, disturbancePercentage: 85, label: "Vardar River – Skopje",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "turbidity" },
                { id: 3, type: "algae" },
            ],
        }],
    },
    "vardar": {
        center: [21.700, 41.600], zoom: 9,
        waterSources: [
            {
                id: 6, longitude: 21.432, latitude: 42.002, disturbancePercentage: 65, label: "Vardar – Skopje",
                disturbances: [
                    { id: 1, type: "pollution" },
                    { id: 2, type: "turbidity" },
                    { id: 3, type: "algae" },
                    { id: 4, type: "temperature" },
                ],
            },
            {
                id: 7, longitude: 21.900, latitude: 41.450, disturbancePercentage: 45, label: "Vardar – Veles",
                disturbances: [
                    { id: 3, type: "algae" },
                    { id: 4, type: "temperature" },
                ],
            },
        ],
    },
    "bitola": {
        center: [21.340, 41.031], zoom: 12,
        waterSources: [{
            id: 8, longitude: 21.340, latitude: 41.031, disturbancePercentage: 40, label: "Dragor River – Bitola",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "strumica": {
        center: [22.643, 41.438], zoom: 12,
        waterSources: [{
            id: 9, longitude: 22.643, latitude: 41.438, disturbancePercentage: 35, label: "Strumica River",
            disturbances: [
                { id: 1, type: "turbidity" },
                { id: 2, type: "temperature" },
            ],
        }],
    },
};

export const regions: Record<string, Region> = defaultRegions; // Kept for backwards compatibility if needed

export function getRegions(): Record<string, Region> {
    if (typeof window === "undefined") return defaultRegions;

    const stored = localStorage.getItem("custom_water_sources");
    if (!stored) return defaultRegions;

    try {
        const customSources: WaterSource[] = JSON.parse(stored);
        if (customSources.length === 0) return defaultRegions;

        // Calculate center based on the first custom source, or default to center of MK
        const centerLng = customSources[0].longitude;
        const centerLat = customSources[0].latitude;

        return {
            ...defaultRegions,
            "custom": {
                center: [centerLng, centerLat],
                zoom: 8,
                waterSources: customSources
            }
        };
    } catch (e) {
        return defaultRegions;
    }
}

/**
 * Creates a new custom water source in localStorage immediately with a
 * pending satellite state. Returns the new source's id so the caller
 * can track it during the async satellite fetch.
 */
export function addCustomWaterSource(
    label: string,
    longitude: number,
    latitude: number,
): number {
    if (typeof window === "undefined") return -1;

    const stored = localStorage.getItem("custom_water_sources");
    const customSources: WaterSource[] = stored ? JSON.parse(stored) : [];

    const id = Date.now();
    const newSource: WaterSource = {
        id,
        longitude,
        latitude,
        disturbancePercentage: 0,
        label,
        disturbances: [],
        pending: true,
        satelliteStatus: "pending",
    };

    customSources.push(newSource);
    localStorage.setItem("custom_water_sources", JSON.stringify(customSources));
    return id;
}

export function updateCustomWaterSource(id: number, label: string, longitude: number, latitude: number, selectedDisturbances: string[]) {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("custom_water_sources");
    const customSources: WaterSource[] = stored ? JSON.parse(stored) : [];
    
    const index = customSources.findIndex(s => s.id === id);
    if (index !== -1) {
        customSources[index] = {
            ...customSources[index],
            label,
            longitude,
            latitude,
            disturbances: selectedDisturbances.map((type, i) => ({ id: Date.now() + i, type }))
        };
        localStorage.setItem("custom_water_sources", JSON.stringify(customSources));
    }
}

export function deleteCustomWaterSource(id: number) {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("custom_water_sources");
    if (!stored) return;
    
    const customSources: WaterSource[] = JSON.parse(stored);
    const filtered = customSources.filter(s => s.id !== id);
    
    localStorage.setItem("custom_water_sources", JSON.stringify(filtered));
}

export function clearAllCustomWaterSources() {
    if (typeof window === "undefined") return;
    localStorage.removeItem("custom_water_sources");
    window.dispatchEvent(new Event("storage"));
}

export function getWaterSourceById(id: number): WaterSource | null {
    const currentRegions = getRegions();
    const allSources = Object.values(currentRegions).flatMap(r => r.waterSources);
    return allSources.find(s => s.id === id) || null;
}

export function getMockHistoricalData(id: number) {
    const data = [];
    const now = new Date();
    for (let i = 14; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - i);
        data.push({
            date: date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            score: Math.floor(20 + Math.random() * 60)
        });
    }
    return data;
}

export function getMockForecast(id: number) {
    return [
        { day: "Tomorrow", status: "Healthy", score: 15, color: "#22c55e" },
        { day: "In 2 Days", status: "Mediocre", score: 45, color: "#eab308" },
        { day: "In 3 Days", status: "Harmfull", score: 75, color: "#f97316" }
    ];
}

// ── Satellite integration utilities ────────────────────────────────────────────

/**
 * Infers disturbances from raw satellite data returned by the Python API.
 * This replaces the manual checkbox selection entirely.
 */
export function mapSatelliteToDisturbances(data: SatelliteData): Disturbance[] {
    const result: Disturbance[] = [];
    let id = 1;

    // Algae proxy: chlorophyll index above threshold
    if (data.ndci !== null && data.ndci > 0.05) {
        result.push({ id: id++, type: "algae" });
    }
    // Pollution: derived directly from the pollution classification
    if (data.pollution_status === "HIGH" || data.pollution_status === "MEDIUM") {
        result.push({ id: id++, type: "pollution" });
    }
    // Turbidity: negative turbidity signal or high suspended sediment
    const hasTurbidity =
        (data.turbidity !== null && data.turbidity < -0.05) ||
        (data.suspendent_sediment !== null && data.suspendent_sediment > 0.15);
    if (hasTurbidity) {
        result.push({ id: id++, type: "turbidity" });
    }

    return result;
}

/** Maps pollution_status string → disturbancePercentage number for marker colouring */
export function mapPollutionToPercentage(status: string): number {
    if (status === "HIGH") return 75;
    if (status === "MEDIUM") return 45;
    return 0;
}

/**
 * Updates a custom water source in localStorage with real satellite data.
 * Fires a storage event so any listening components re-render.
 */
export function enrichWaterSourceWithSatellite(
    id: number,
    data: SatelliteData,
): void {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("custom_water_sources");
    if (!stored) return;

    const customSources: WaterSource[] = JSON.parse(stored);
    const index = customSources.findIndex((s) => s.id === id);
    if (index === -1) return;

    const disturbances = mapSatelliteToDisturbances(data);
    const levelFromCount =
        disturbances.length >= 4 ? 100 :
        disturbances.length === 3 ? 75 :
        disturbances.length >= 1 ? 45 : 0;
    const disturbancePercentage = Math.max(
        mapPollutionToPercentage(data.pollution_status),
        levelFromCount,
    );

    customSources[index] = {
        ...customSources[index],
        pending: false,
        satelliteStatus: "done",
        satelliteData: data,
        disturbances,
        disturbancePercentage,
    };

    localStorage.setItem("custom_water_sources", JSON.stringify(customSources));
    
    // Send an email notification that the analysis has completed
    const disturbanceNames = disturbances.map(d => disturbanceDescriptions[d.type] || d.type);
    sendAnalysisCompleteEmail("ognen.mlad@gmail.com", customSources[index].label, disturbanceNames, data.pollution_status);

    // Notify OhridMap to re-render
    window.dispatchEvent(new Event("storage"));
}

/**
 * Marks a water source with a terminal satellite status (error / unavailable).
 * Also fires a storage event so the map re-renders the marker.
 */
export function markWaterSourceSatelliteStatus(
    id: number,
    status: "error" | "unavailable",
): void {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("custom_water_sources");
    if (!stored) return;

    const customSources: WaterSource[] = JSON.parse(stored);
    const index = customSources.findIndex((s) => s.id === id);
    if (index === -1) return;

    customSources[index] = {
        ...customSources[index],
        pending: false,
        satelliteStatus: status,
    };

    localStorage.setItem("custom_water_sources", JSON.stringify(customSources));
    window.dispatchEvent(new Event("storage"));
}

/**
 * Re-marks a source as pending so a retry analysis can be triggered.
 */
export function markWaterSourcePending(id: number): void {
    if (typeof window === "undefined") return;

    const stored = localStorage.getItem("custom_water_sources");
    if (!stored) return;

    const customSources: WaterSource[] = JSON.parse(stored);
    const index = customSources.findIndex((s) => s.id === id);
    if (index === -1) return;

    customSources[index] = {
        ...customSources[index],
        pending: true,
        satelliteStatus: "pending",
        satelliteData: undefined,
    };

    localStorage.setItem("custom_water_sources", JSON.stringify(customSources));
    window.dispatchEvent(new Event("storage"));
}
