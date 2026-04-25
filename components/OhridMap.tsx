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
    type WaterSource,
    getDisturbanceLabel,
    getRegions
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
    const suggestions = ["Ohrid", "Prespa", "Dojran", "Skopje", "Vardar", "Bitola", "Strumica", "Custom"];

    const handleSubmit = () => {
        const key = query.trim().toLowerCase();
        const allRegions = getRegions();
        const region = allRegions[key];
        if (region) { setError(""); onSearch(region, query.trim()); }
        else setError(`No data found for "${query}". Try: ${suggestions.join(", ")}`);
    };

    return (
        <div className="flex h-full w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-900 transition-colors">
            <div className="flex min-w-[360px] flex-col items-center gap-5 rounded-2xl bg-white dark:bg-slate-800 p-10 sm:px-12 shadow-xl ring-1 ring-slate-900/5 dark:ring-slate-100/5 transition-colors">
                <div className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">💧 Water Monitor</div>
                <div className="text-center text-sm text-slate-600 dark:text-slate-400">
                    Enter a Macedonian town, lake, or river to view water quality data
                </div>
                <input
                    type="text" value={query}
                    onChange={(e) => { setQuery(e.target.value); setError(""); }}
                    onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
                    placeholder="e.g. Ohrid, Vardar, Skopje..."
                    className="w-full rounded-md border-0 py-2.5 px-3.5 text-slate-900 dark:text-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[#0277bd] sm:text-sm outline-none transition-colors"
                    autoFocus
                />
                {error && <div className="text-center text-xs font-medium text-red-600 dark:text-red-400">{error}</div>}
                <button onClick={handleSubmit} className="w-full rounded-md bg-[#0277bd] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#01579b]">
                    View Water Data →
                </button>
                <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {suggestions.map((s) => (
                        <button key={s} onClick={() => { setQuery(s); setError(""); }} className="rounded-full border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 px-3 py-1 text-xs font-medium text-slate-600 dark:text-slate-300 transition-colors hover:bg-slate-100 dark:hover:bg-slate-600">
                            {s}
                        </button>
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
        <div className="relative h-full w-full">
            <Map ref={mapRef} center={region.center} zoom={region.zoom}>
                {waterSources.map((source) => (
                    <GeoCircle key={`circle-${source.id}`} source={source} />
                ))}
                {waterSources.map((source) => (
                    <GeoCircleOverlay key={`overlay-${source.id}`} source={source} />
                ))}
            </Map>

            {/* Back button */}
            <button onClick={onBack} className="absolute left-4 top-4 z-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-800/95 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 shadow-sm backdrop-blur transition-colors hover:bg-slate-50 dark:hover:bg-slate-700">
                ← Back
            </button>

            {/* Region title */}
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg bg-white/95 dark:bg-slate-800/95 px-5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                {regionName}
            </div>

            {/* Info panel */}
            <div className="absolute right-4 top-4 z-10 flex min-w-[260px] max-w-[300px] flex-col gap-3 rounded-xl bg-white/95 dark:bg-slate-800/95 p-4 shadow-md backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Water Sources
                </div>
                {waterSources.map((source) => {
                    const color = getDisturbanceColor(source.disturbancePercentage);
                    return (
                        <div key={source.id} className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-700 pb-2.5 last:border-0 last:pb-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{source.label}</div>
                            <div className="text-sm font-bold" style={{ color }}>{source.disturbancePercentage}% Disturbance</div>
                            {source.disturbances.length > 0 && (
                                <div className="mt-0.5 flex flex-col gap-1.5">
                                    {source.disturbances.map((d) => (
                                        <div key={d.id} className="flex items-start gap-1.5 text-[11px] text-slate-600 dark:text-slate-400">
                                            <div style={{
                                                width: 0, height: 0,
                                                borderLeft: "5px solid transparent",
                                                borderRight: "5px solid transparent",
                                                borderTop: `9px solid ${disturbanceColors[d.type]}`,
                                                flexShrink: 0,
                                                marginTop: 3,
                                            }} />
                                            <span className="leading-snug">{disturbanceDescriptions[d.type]}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Legend */}
            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-start gap-6 rounded-xl bg-white/95 dark:bg-slate-800/95 px-4 py-3 shadow-md backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex flex-col gap-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbance Intensity</div>
                    <div className="h-3 w-44 rounded" style={{ background: "linear-gradient(to right, #22c55e, #eab308, #f97316, #ef4444)" }} />
                    <div className="flex w-44 justify-between text-[10px] text-slate-500 dark:text-slate-400">
                        <span>0% (Healthy)</span><span>100% (Critical)</span>
                    </div>
                </div>
                <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbances</div>
                    {Object.entries(disturbanceLabels).map(([type, label]) => (
                        <div key={type} className="flex max-w-[220px] items-start gap-2 text-xs text-slate-700 dark:text-slate-300">
                            <div style={{
                                width: 0, height: 0,
                                borderLeft: "7px solid transparent",
                                borderRight: "7px solid transparent",
                                borderTop: `13px solid ${disturbanceColors[type]}`,
                                flexShrink: 0,
                                marginTop: 3,
                            }} />
                            <span className="leading-snug">{label}</span>
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