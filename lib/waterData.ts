export const disturbanceIntensityColors: [number, string][] = [
    [0, "#22c55e"],   // Healthy (Green)
    [45, "#eab308"],  // Moderate (Yellow)
    [75, "#f97316"],  // Severe (Orange)
    [100, "#ef4444"], // Critical (Red)
];

export function interpolateColor(c1: string, c2: string, t: number) {
    const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
    const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

export function getDisturbanceColor(percentage: number) {
    if (percentage === 0) return "#22c55e";
    if (percentage <= 45) return "#eab308";
    if (percentage <= 75) return "#f97316";
    return "#ef4444";
}

export function getDisturbanceLabel(percentage: number): string {
    if (percentage === 0) return "0% – Healthy";
    if (percentage <= 45) return "45% – Moderate";
    if (percentage <= 75) return "75% – Severe";
    return "100% – Critical";
}

export function colorToHex(color: string): string {
    if (color.startsWith("#")) return color;
    const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!m) return "#ffffff";
    return "#" + [m[1],m[2],m[3]].map(v => parseInt(v).toString(16).padStart(2,"0")).join("");
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
export type WaterSource  = { id: number; longitude: number; latitude: number; disturbancePercentage: number; label: string; disturbances: Disturbance[]; };
export type Region = { center: [number, number]; zoom: number; waterSources: WaterSource[]; };

export const regions: Record<string, Region> = {
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
            id: 1, longitude: 20.802, latitude: 41.068, disturbancePercentage: 50, label: "Ohrid Lake",
            disturbances: [
                { id: 1, type: "algae" },
                { id: 2, type: "turbidity" },
            ],
        }],
    },
    "prespa": {
        center: [21.020, 40.900], zoom: 11,
        waterSources: [{
            id: 1, longitude: 21.020, latitude: 40.900, disturbancePercentage: 55, label: "Prespa Lake",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "dojran": {
        center: [22.690, 41.210], zoom: 12,
        waterSources: [{
            id: 1, longitude: 22.690, latitude: 41.210, disturbancePercentage: 80, label: "Dojran Lake",
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
            id: 1, longitude: 21.432, latitude: 42.002, disturbancePercentage: 85, label: "Vardar River – Skopje",
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
                id: 1, longitude: 21.432, latitude: 42.002, disturbancePercentage: 65, label: "Vardar – Skopje",
                disturbances: [
                    { id: 1, type: "pollution" },
                    { id: 2, type: "turbidity" },
                ],
            },
            {
                id: 2, longitude: 21.900, latitude: 41.450, disturbancePercentage: 45, label: "Vardar – Veles",
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
            id: 1, longitude: 21.340, latitude: 41.031, disturbancePercentage: 40, label: "Dragor River – Bitola",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "strumica": {
        center: [22.643, 41.438], zoom: 12,
        waterSources: [{
            id: 1, longitude: 22.643, latitude: 41.438, disturbancePercentage: 35, label: "Strumica River",
            disturbances: [
                { id: 1, type: "turbidity" },
                { id: 2, type: "temperature" },
            ],
        }],
    },
};
