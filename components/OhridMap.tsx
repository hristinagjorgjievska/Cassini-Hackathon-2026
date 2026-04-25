"use client";

import { useState, useRef, useEffect } from "react";
import { Map, MapMarker, MarkerContent, useMap, type MapRef } from "@/components/ui/map";

import {
    getDisturbanceColor,
    colorToHex,
    disturbanceColors,
    disturbanceLabels,
    disturbanceDescriptions,
    regions,
    type Region,
    type WaterSource
} from "@/lib/waterData";

// ── Geo circle drawn as a MapLibre layer (scales with zoom) ───
function GeoCircle({ source }: { source: WaterSource }) {
    const { map, isLoaded } = useMap();
    const sourceId = `geo-circle-src-${source.id}`;
    const fillId   = `geo-circle-fill-${source.id}`;
    const strokeId = `geo-circle-stroke-${source.id}`;

    const color = getDisturbanceColor(source.disturbancePercentage);
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
    const color = getDisturbanceColor(source.disturbancePercentage);
    return (
        <>
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
            width: "100%", height: "100%", display: "flex", flexDirection: "column",
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
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
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

            {/* Info panel */}
            <div style={{
                position: "absolute", top: 16, right: 16, zIndex: 10,
                background: "rgba(255,255,255,0.95)", borderRadius: 12,
                padding: "14px 16px", display: "flex", flexDirection: "column",
                gap: 10, minWidth: 260, maxWidth: 300, boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
            }}>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>
                    Water Sources
                </div>
                {waterSources.map((source) => {
                    const color = getDisturbanceColor(source.disturbancePercentage);
                    return (
                        <div key={source.id} style={{
                            display: "flex", flexDirection: "column", gap: 6,
                            paddingBottom: 10, borderBottom: "1px solid #eee",
                        }}>
                            <div style={{ fontSize: 12, fontWeight: 600, color: "#1a1a2e" }}>{source.label}</div>
                            <div style={{ fontSize: 13, fontWeight: 700, color }}>{source.disturbancePercentage}% Disturbance</div>
                            {source.disturbances.length > 0 && (
                                <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 2 }}>
                                    {source.disturbances.map((d) => (
                                        <div key={d.id} style={{ display: "flex", alignItems: "flex-start", gap: 6, fontSize: 11, color: "#555" }}>
                                            <div style={{
                                                width: 0, height: 0,
                                                borderLeft: "5px solid transparent",
                                                borderRight: "5px solid transparent",
                                                borderTop: `9px solid ${disturbanceColors[d.type]}`,
                                                flexShrink: 0,
                                                marginTop: 3,
                                            }} />
                                            <span style={{ lineHeight: 1.4 }}>{disturbanceDescriptions[d.type]}</span>
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
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>Disturbance Intensity</div>
                    <div style={{
                        height: 12, width: 180, borderRadius: 4,
                        background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)",
                    }} />
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#888", width: 180 }}>
                        <span>0% (Healthy)</span><span>100% (Critical)</span>
                    </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <div style={{ fontSize: 11, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", color: "#666" }}>Disturbances</div>
                    {Object.entries(disturbanceLabels).map(([type, label]) => (
                        <div key={type} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12, color: "#333", maxWidth: 220 }}>
                            <div style={{
                                width: 0, height: 0,
                                borderLeft: "7px solid transparent",
                                borderRight: "7px solid transparent",
                                borderTop: `13px solid ${disturbanceColors[type]}`,
                                flexShrink: 0,
                                marginTop: 3,
                            }} />
                            <span style={{ lineHeight: 1.4 }}>{label}</span>
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