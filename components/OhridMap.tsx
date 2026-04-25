"use client";

import { useState, useRef, useEffect } from "react";
import { Map, MapMarker, MarkerContent, useMap, type MapRef } from "@/components/ui/map";
import maplibregl from "maplibre-gl";

const phColors: [number, string][] = [
    [0, "#d32f2f"], [1, "#e64a19"], [2, "#f57c00"], [3, "#f9a825"],
    [4, "#afb42b"], [5, "#558b2f"], [6, "#2e7d32"], [7, "#00695c"],
    [8, "#00838f"], [9, "#0277bd"], [10, "#1565c0"], [11, "#283593"],
    [12, "#4a148c"], [13, "#880e4f"], [14, "#b71c1c"],
];

function interpolateColor(c1: string, c2: string, t: number) {
    const r1 = parseInt(c1.slice(1,3),16), g1 = parseInt(c1.slice(3,5),16), b1 = parseInt(c1.slice(5,7),16);
    const r2 = parseInt(c2.slice(1,3),16), g2 = parseInt(c2.slice(3,5),16), b2 = parseInt(c2.slice(5,7),16);
    return `rgb(${Math.round(r1+(r2-r1)*t)},${Math.round(g1+(g2-g1)*t)},${Math.round(b1+(b2-b1)*t)})`;
}

function getPhColor(ph: number) {
    ph = Math.max(0, Math.min(14, ph));
    for (let i = 0; i < phColors.length - 1; i++) {
        if (ph >= phColors[i][0] && ph <= phColors[i+1][0])
            return interpolateColor(phColors[i][1], phColors[i+1][1], ph - phColors[i][0]);
    }
    return phColors[phColors.length-1][1];
}

function colorToHex(color: string): string {
    if (color.startsWith("#")) return color;
    const m = color.match(/rgb\((\d+),(\d+),(\d+)\)/);
    if (!m) return "#ffffff";
    return "#" + [m[1],m[2],m[3]].map(v => parseInt(v).toString(16).padStart(2,"0")).join("");
}

const disturbanceColors: Record<string, string> = {
    algae: "#16a34a", pollution: "#7c3aed",
    turbidity: "#d97706", temperature: "#dc2626",
};
const disturbanceLabels: Record<string, string> = {
    algae: "Algae bloom", pollution: "Pollution",
    turbidity: "High turbidity", temperature: "Temp anomaly",
};

type Disturbance = { id: number; type: string; };
type WaterSource  = { id: number; longitude: number; latitude: number; ph: number; label: string; disturbances: Disturbance[]; };
type Region = { center: [number, number]; zoom: number; waterSources: WaterSource[]; };

// ── Geo circle drawn as a MapLibre layer (scales with zoom) ───
function GeoCircle({ source }: { source: WaterSource }) {
    const { map, isLoaded } = useMap();
    const sourceId = `geo-circle-src-${source.id}`;
    const fillId   = `geo-circle-fill-${source.id}`;
    const strokeId = `geo-circle-stroke-${source.id}`;

    const color = getPhColor(source.ph);
    const hex   = colorToHex(color);

    useEffect(() => {
        if (!map || !isLoaded) return;

        const radiusKm = 2.5;
        const steps = 64;
        const coords: [number, number][] = [];
        for (let i = 0; i <= steps; i++) {
            const angle = (i / steps) * 2 * Math.PI;
            const dx = (radiusKm / 111.32) / Math.cos(source.latitude * Math.PI / 180);
            const dy = radiusKm / 110.574;
            coords.push([
                source.longitude + dx * Math.cos(angle),
                source.latitude  + dy * Math.sin(angle),
            ]);
        }

        const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
            type: "Feature",
            properties: {},
            geometry: { type: "Polygon", coordinates: [coords] },
        };

        map.addSource(sourceId, { type: "geojson", data: geojson });

        map.addLayer({
            id: fillId,
            type: "fill",
            source: sourceId,
            paint: {
                "fill-color": hex,
                "fill-opacity": 0.15,
            },
        });

        map.addLayer({
            id: strokeId,
            type: "line",
            source: sourceId,
            paint: {
                "line-color": hex,
                "line-width": 3,
                "line-opacity": 0.9,
            },
        });

        return () => {
            try {
                if (map.getLayer(strokeId)) map.removeLayer(strokeId);
                if (map.getLayer(fillId))   map.removeLayer(fillId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch { /* ignore */ }
        };
    }, [map, isLoaded, source.id, source.longitude, source.latitude, hex, fillId, strokeId, sourceId]);

    return null;
}

// ── Centre dot + disturbance triangles, each as its own geo-anchored marker ───
function GeoCircleOverlay({ source }: { source: WaterSource }) {
    const color = getPhColor(source.ph);
    return (
        <>
            {/* Centre dot anchored exactly to the coordinate */}
            <MapMarker longitude={source.longitude} latitude={source.latitude} anchor="center">
                <MarkerContent>
                    <div style={{
                        width: 14, height: 14, borderRadius: "50%",
                        background: color,
                        border: "2px solid white",
                        boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                    }} />
                </MarkerContent>
            </MapMarker>

            {/* Each disturbance triangle gets its own geo-anchored marker */}
            {source.disturbances.map((d, i) => {
                const angle = (i / source.disturbances.length) * 2 * Math.PI - Math.PI / 2;
                const radiusDeg = 0.012;
                const lng = source.longitude + radiusDeg * Math.cos(angle) / Math.cos(source.latitude * Math.PI / 180);
                const lat = source.latitude  + radiusDeg * Math.sin(angle);
                return (
                    <MapMarker key={d.id} longitude={lng} latitude={lat} anchor="center">
                        <MarkerContent>
                            <div style={{
                                width: 0, height: 0,
                                borderLeft: "8px solid transparent",
                                borderRight: "8px solid transparent",
                                borderTop: `14px solid ${disturbanceColors[d.type]}`,
                            }} />
                        </MarkerContent>
                    </MapMarker>
                );
            })}
        </>
    );
}

// ── Region data ───────────────────────────────────────────────
const regions: Record<string, Region> = {
    "ohrid": {
        center: [20.802, 41.068], zoom: 11,
        waterSources: [{
            id: 1, longitude: 20.802, latitude: 41.068, ph: 7.8, label: "Ohrid Lake",
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
            id: 1, longitude: 20.802, latitude: 41.068, ph: 7.8, label: "Ohrid Lake",
            disturbances: [
                { id: 1, type: "algae" },
                { id: 2, type: "turbidity" },
            ],
        }],
    },
    "prespa": {
        center: [21.020, 40.900], zoom: 11,
        waterSources: [{
            id: 1, longitude: 21.020, latitude: 40.900, ph: 6.9, label: "Prespa Lake",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "dojran": {
        center: [22.690, 41.210], zoom: 12,
        waterSources: [{
            id: 1, longitude: 22.690, latitude: 41.210, ph: 8.2, label: "Dojran Lake",
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
            id: 1, longitude: 21.432, latitude: 42.002, ph: 7.1, label: "Vardar River – Skopje",
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
                id: 1, longitude: 21.432, latitude: 42.002, ph: 7.1, label: "Vardar – Skopje",
                disturbances: [
                    { id: 1, type: "pollution" },
                    { id: 2, type: "turbidity" },
                ],
            },
            {
                id: 2, longitude: 21.900, latitude: 41.450, ph: 6.8, label: "Vardar – Veles",
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
            id: 1, longitude: 21.340, latitude: 41.031, ph: 7.3, label: "Dragor River – Bitola",
            disturbances: [
                { id: 1, type: "pollution" },
                { id: 2, type: "algae" },
            ],
        }],
    },
    "strumica": {
        center: [22.643, 41.438], zoom: 12,
        waterSources: [{
            id: 1, longitude: 22.643, latitude: 41.438, ph: 7.0, label: "Strumica River",
            disturbances: [
                { id: 1, type: "turbidity" },
                { id: 2, type: "temperature" },
            ],
        }],
    },
};

// ── Search page ───────────────────────────────────────────────
function SearchPage({ onSearch }: { onSearch: (region: Region, name: string) => void }) {
    const [query, setQuery] = useState("");
    const [error, setError] = useState("");
    const suggestions = ["Ohrid", "Prespa", "Dojran", "Skopje", "Vardar", "Bitola", "Strumica"];

    const handleSubmit = () => {
        const key = query.trim().toLowerCase();
        const region = regions[key];
        if (region) { setError(""); onSearch(region, query.trim()); }
        else setError(`No data found for "${query}". Try: ${suggestions.join(", ")}`);
    };

    return (
        <div style={{
            width: "100vw", height: "100vh", display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "#f0f4f8",
        }}>
            <div style={{
                background: "white", borderRadius: 16, padding: "40px 48px",
                boxShadow: "0 4px 24px rgba(0,0,0,0.10)", display: "flex",
                flexDirection: "column", alignItems: "center", gap: 20, minWidth: 360,
            }}>
                <div style={{ fontSize: 28, fontWeight: 600, color: "#1a1a2e" }}>💧 Water Monitor</div>
                <div style={{ fontSize: 14, color: "#666", textAlign: "center" }}>
                    Enter a Macedonian town, lake, or river to view water quality data
                </div>
                <input
                    type="text" value={query}
                    onChange={(e) => { setQuery(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="e.g. Ohrid, Vardar, Skopje..."
                    style={{ width: "100%", padding: "10px 14px", fontSize: 15, borderRadius: 8, border: "1.5px solid #ddd", outline: "none" }}
                    autoFocus
                />
                {error && <div style={{ fontSize: 12, color: "#dc2626", textAlign: "center" }}>{error}</div>}
                <button onClick={handleSubmit} style={{
                    width: "100%", padding: "10px 0", fontSize: 14, fontWeight: 600,
                    borderRadius: 8, border: "none", background: "#0277bd", color: "white", cursor: "pointer",
                }}>
                    View Water Data →
                </button>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                    {suggestions.map((s) => (
                        <button key={s} onClick={() => { setQuery(s); setError(""); }} style={{
                            fontSize: 12, padding: "4px 10px", borderRadius: 20,
                            border: "1px solid #ddd", background: "#f5f5f5", cursor: "pointer", color: "#444",
                        }}>{s}</button>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Map page ──────────────────────────────────────────────────
function MapPage({ region, regionName, onBack }: { region: Region; regionName: string; onBack: () => void; }) {
    const mapRef = useRef<MapRef>(null);
    const waterSources = region.waterSources;

    return (
        <div style={{ position: "relative", width: "100vw", height: "100vh" }}>
            <Map ref={mapRef} center={region.center} zoom={region.zoom}>
                {waterSources.map((source) => (
                    <GeoCircle key={`circle-${source.id}`} source={source} />
                ))}
                {waterSources.map((source) => (
                    <GeoCircleOverlay key={`overlay-${source.id}`} source={source} />
                ))}
            </Map>

            {/* Back button */}
            <button onClick={onBack} style={{
                position: "absolute", top: 16, left: 16, zIndex: 10,
                fontSize: 13, padding: "8px 14px", borderRadius: 8,
                background: "rgba(255,255,255,0.95)", border: "1px solid #ddd",
                cursor: "pointer", color: "#333", boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}>← Back</button>

            {/* Region title */}
            <div style={{
                position: "absolute", top: 16, left: "50%", transform: "translateX(-50%)",
                zIndex: 10, background: "rgba(255,255,255,0.95)", borderRadius: 10,
                padding: "8px 18px", fontSize: 14, fontWeight: 600, color: "#1a1a2e",
                boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
            }}>{regionName}</div>

            {/* Info panel — pH + disturbances only */}
            <div style={{
                position: "absolute", top: 16, right: 16, zIndex: 10,
                background: "rgba(255,255,255,0.95)", borderRadius: 12,
                padding: "14px 16px", display: "flex", flexDirection: "column",
                gap: 10, minWidth: 220, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
                    Water Sources
                </div>
                {waterSources.map((source) => {
                    const color = getPhColor(source.ph);
                    return (
                        <div key={source.id} style={{
                            display: "flex", flexDirection: "column", gap: 5,
                            paddingBottom: 10, borderBottom: "1px solid #eee",
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>{source.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color }}>pH {source.ph.toFixed(1)}</div>
                            {source.disturbances.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 4, marginTop: 2 }}>
                                    {source.disturbances.map((d) => (
                                        <div key={d.id} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "#555" }}>
                                            <div style={{
                                                width: 0, height: 0,
                                                borderLeft: "5px solid transparent",
                                                borderRight: "5px solid transparent",
                                                borderTop: `9px solid ${disturbanceColors[d.type]}`,
                                                flexShrink: 0,
                                            }} />
                                            {disturbanceLabels[d.type]}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div style={{
                position: "absolute", bottom: 16, left: "50%", transform: "translateX(-50%)",
                zIndex: 10, background: "rgba(255,255,255,0.95)", borderRadius: 12,
                padding: "12px 16px", display: "flex", gap: 24, alignItems: "flex-start",
                boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>pH scale</div>
                    <div style={{
                        height: 12, width: 180, borderRadius: 4,
                        background: "linear-gradient(to right,#d32f2f,#e64a19,#f57c00,#f9a825,#afb42b,#558b2f,#2e7d32,#00695c,#00838f,#0277bd,#1565c0,#283593,#4a148c)",
                    }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", width: 180 }}>
                        <span>0 acid</span><span>7 neutral</span><span>14 base</span>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>Disturbances</div>
                    {Object.entries(disturbanceLabels).map(([type, label]) => (
                        <div key={type} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#333" }}>
                            <div style={{
                                width: 0, height: 0,
                                borderLeft: "7px solid transparent",
                                borderRight: "7px solid transparent",
                                borderTop: `13px solid ${disturbanceColors[type]}`,
                                flexShrink: 0,
                            }} />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Root ──────────────────────────────────────────────────────
export function OhridMap() {
    const [activeRegion, setActiveRegion] = useState<Region | null>(null);
    const [regionName, setRegionName] = useState("");

    if (!activeRegion) {
        return <SearchPage onSearch={(region, name) => { setActiveRegion(region); setRegionName(name); }} />;
    }

    return <MapPage region={activeRegion} regionName={regionName} onBack={() => setActiveRegion(null)} />;
}