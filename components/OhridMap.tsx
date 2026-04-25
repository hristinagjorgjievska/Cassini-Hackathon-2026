"use client";

import { useState, useRef, useEffect } from "react";
import { Map, MapMarker, MarkerContent, MarkerPopup, useMap, type MapRef } from "@/components/ui/map";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

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
    getRegions,
    addCustomWaterSource
} from "@/lib/waterData";

// ── Geo circle drawn as a MapLibre layer (scales with zoom) ───
function GeoCircle({ source }: { source: WaterSource }) {
    const { map, isLoaded } = useMap();
    const sourceId = `geo-circle-src-${source.id}`;
    const fillId = `geo-circle-fill-${source.id}`;
    const strokeId = `geo-circle-stroke-${source.id}`;

    const color = getDisturbanceColor(source);
    const hex = colorToHex(color);

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
                source.latitude + dy * Math.sin(angle),
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
                if (map.getLayer(fillId)) map.removeLayer(fillId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch { /* ignore */ }
        };
    }, [map, isLoaded, source.id, source.longitude, source.latitude, hex, fillId, strokeId, sourceId]);

    return null;
}

// ── Centre dot + disturbance triangles, each as its own geo-anchored marker ───
function GeoCircleOverlay({ source }: { source: WaterSource }) {
    const color = getDisturbanceColor(source);
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
                <MarkerPopup closeButton>
                    <div className="p-2 min-w-[180px]">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{source.label}</h3>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 mb-3">{getDisturbanceLabel(source)}</p>
                        <Link
                            href={`/water-source/${source.id}`}
                            className="block text-center rounded-md bg-[#0277bd] py-2 text-xs font-semibold text-white hover:bg-[#01579b] transition-colors shadow-sm"
                        >
                            View Detailed Analysis →
                        </Link>
                    </div>
                </MarkerPopup>
            </MapMarker>

            {source.disturbances.map((d, i) => {
                const angle = (i / source.disturbances.length) * 2 * Math.PI - Math.PI / 2;
                const radiusDeg = 0.012;
                const lng = source.longitude + radiusDeg * Math.cos(angle) / Math.cos(source.latitude * Math.PI / 180);
                const lat = source.latitude + radiusDeg * Math.sin(angle);
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





// ── Map page ──────────────────────────────────────────────────
function MapPage({ region, regionName, onAddComplete }: { region: Region; regionName: string; onAddComplete: () => void }) {
    const mapRef = useRef<MapRef>(null);
    const waterSources = region.waterSources;

    const [draftPoint, setDraftPoint] = useState<{ lng: number; lat: number } | null>(null);
    const [label, setLabel] = useState("");
    const [selectedDisturbances, setSelectedDisturbances] = useState<string[]>([]);
    const [isPlacementMode, setIsPlacementMode] = useState(false);

    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const handleClick = (e: any) => {
            if (isPlacementMode) {
                setDraftPoint({ lng: e.lngLat.lng, lat: e.lngLat.lat });
                setIsPlacementMode(false);
            }
        };

        map.on("click", handleClick);

        return () => {
            map.off("click", handleClick);
        };
    }, [isPlacementMode]);

    const handleSavePoint = (e: React.FormEvent) => {
        e.preventDefault();
        if (!draftPoint || !label.trim()) return;

        addCustomWaterSource(label, draftPoint.lng, draftPoint.lat, selectedDisturbances);
        setDraftPoint(null);
        setLabel("");
        setSelectedDisturbances([]);
        onAddComplete();
    };

    const handleCheckbox = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        if (e.target.checked) {
            setSelectedDisturbances(prev => [...prev, val]);
        } else {
            setSelectedDisturbances(prev => prev.filter(d => d !== val));
        }
    };

    return (
        <div className="relative h-full w-full">
            <Map ref={mapRef} center={region.center} zoom={region.zoom} styles={{ light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" }} doubleClickZoom={false}>
                {waterSources.map((source) => (
                    <GeoCircle key={`circle-${source.id}`} source={source} />
                ))}
                {waterSources.map((source) => (
                    <GeoCircleOverlay key={`overlay-${source.id}`} source={source} />
                ))}

                {draftPoint && (
                    <MapMarker longitude={draftPoint.lng} latitude={draftPoint.lat}>
                        <MarkerContent>
                            <div className="relative h-4 w-4 rounded-full border-2 border-white bg-blue-500 shadow-lg animate-pulse" />
                        </MarkerContent>
                        <MarkerPopup closeButton>
                            <div className="min-w-[220px] p-1">
                                <h3 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">Add Tracked Point</h3>
                                <form onSubmit={handleSavePoint} className="flex flex-col gap-3">
                                    <div>
                                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Name / Label</label>
                                        <input required autoFocus type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. My Secret Spot" className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0277bd] focus:ring-1 focus:ring-[#0277bd] transition-all" />
                                    </div>
                                    <div className="flex gap-3 text-[10px] font-mono text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/30 px-2 py-1.5 rounded border border-slate-100 dark:border-slate-700/50">
                                        <div className="flex flex-col">
                                            <span className="text-[9px] uppercase tracking-tighter opacity-50">Longitude</span>
                                            <span>{draftPoint.lng.toFixed(5)}</span>
                                        </div>
                                        <div className="flex flex-col border-l border-slate-200 dark:border-slate-700 pl-3">
                                            <span className="text-[9px] uppercase tracking-tighter opacity-50">Latitude</span>
                                            <span>{draftPoint.lat.toFixed(5)}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <label className="mb-1.5 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbances</label>
                                        <div className="flex flex-col gap-2">
                                            {["algae", "pollution", "turbidity", "temperature"].map((dist) => (
                                                <label key={dist} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300 cursor-pointer">
                                                    <input type="checkbox" value={dist} checked={selectedDisturbances.includes(dist)} onChange={handleCheckbox} className="rounded border-slate-300 text-[#0277bd] focus:ring-[#0277bd]" />
                                                    <span className="capitalize">{dist}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="mt-2 flex gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                        <button type="button" onClick={() => setDraftPoint(null)} className="flex-1 rounded-md bg-slate-100 dark:bg-slate-700 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">Cancel</button>
                                        <button type="submit" className="flex-1 rounded-md bg-[#0277bd] py-1.5 text-xs font-semibold text-white hover:bg-[#01579b] transition-colors">Save</button>
                                    </div>
                                </form>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                )}
            </Map>



            {/* Region title */}
            <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded-lg bg-white/95 dark:bg-slate-800/95 px-5 py-2 text-sm font-semibold text-slate-900 dark:text-slate-100 shadow-sm backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                {regionName}
            </div>

            {/* Action Button */}
            <button
                onClick={() => setIsPlacementMode(!isPlacementMode)}
                className={cn(
                    "fixed bottom-6 right-24 z-50 flex h-12 items-center gap-2 rounded-full px-6 font-bold shadow-lg ring-1 transition-all hover:scale-105 active:scale-95",
                    isPlacementMode
                        ? "bg-red-500 text-white ring-red-600 animate-pulse"
                        : "bg-[#0277bd] text-white ring-[#01579b]"
                )}
            >
                <Plus className={cn("h-5 w-5 transition-transform", isPlacementMode && "rotate-45")} />
                {isPlacementMode ? "Click Map to Place" : "Add a Dot"}
            </button>

            {/* Info panel */}
            <div className="absolute right-4 top-4 z-10 flex min-w-[260px] max-w-[300px] flex-col gap-3 rounded-xl bg-white/95 dark:bg-slate-800/95 p-4 shadow-md backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-1">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Water Sources
                    </div>
                    <div className="rounded-sm border-2 border-blue-900 bg-blue-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-900 shadow-sm dark:border-blue-400 dark:bg-blue-950 dark:text-blue-300">
                        Last Updated: 13:00
                    </div>
                </div>
                {waterSources.map((source) => {
                    const color = getDisturbanceColor(source);
                    return (
                        <div key={source.id} className="flex flex-col gap-1.5 border-b border-slate-100 dark:border-slate-700 pb-2.5 last:border-0 last:pb-0">
                            <div className="text-xs font-semibold text-slate-900 dark:text-slate-100">{source.label}</div>
                            <div className="text-sm font-bold" style={{ color }}>{getDisturbanceLabel(source)}</div>
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
                <div className="flex flex-col gap-1.5">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbance Intensity</div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <div className="h-3 w-3 shrink-0 rounded-full bg-[#22c55e]" />
                        <span>0% - healthy (0 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <div className="h-3 w-3 shrink-0 rounded-full bg-[#eab308]" />
                        <span>45% - mediocre (1-2 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <div className="h-3 w-3 shrink-0 rounded-full bg-[#f97316]" />
                        <span>75% - harmfull (3 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                        <div className="h-3 w-3 shrink-0 rounded-full bg-[#ef4444]" />
                        <span>100% - critical (4+ disturbances)</span>
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
    const [region, setRegion] = useState<Region | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        const allRegions = getRegions();
        if (allRegions["custom"]) {
            setRegion(allRegions["custom"]);
        } else {
            // Default empty map focused on Macedonia if no custom points exist
            setRegion({
                center: [21.7, 41.6],
                zoom: 8,
                waterSources: []
            });
        }
    }, [refreshKey]);

    if (!region) return null;

    return <MapPage region={region} regionName="Custom Water Sources" onAddComplete={() => setRefreshKey(k => k + 1)} />;
}