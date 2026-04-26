"use client";

import { useState, useRef, useEffect } from "react";
import { Map, MapMarker, MarkerContent, MarkerPopup, useMap, type MapRef } from "@/components/ui/map";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useAuth } from "@/lib/AuthContext";

import {
    getDisturbanceColor,
    colorToHex,
    disturbanceColors,
    disturbanceLabels,
    disturbanceDescriptions,
    type Region,
    type WaterSource,
    getDisturbanceLabel,
    getRegions,
    addCustomWaterSource,
    enrichWaterSourceWithSatellite,
    markWaterSourceSatelliteStatus,
} from "@/lib/waterData";

import { checkApiHealth, analyzeWater } from "@/lib/satelliteApi";

function GeoCircle({ source }: { source: WaterSource }) {
    const { map, isLoaded } = useMap();
    const sourceId = `geo-circle-src-${source.id}`;
    const fillId = `geo-circle-fill-${source.id}`;
    const strokeId = `geo-circle-stroke-${source.id}`;

    const color = source.pending ? "#94a3b8" : getDisturbanceColor(source);
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
            id: fillId, type: "fill", source: sourceId,
            paint: { "fill-color": hex, "fill-opacity": source.pending ? 0.08 : 0.15 },
        });
        map.addLayer({
            id: strokeId, type: "line", source: sourceId,
            paint: { "line-color": hex, "line-width": source.pending ? 2 : 3, "line-opacity": 0.9, "line-dasharray": source.pending ? [4, 4] : [1] },
        });

        return () => {
            try {
                if (map.getLayer(strokeId)) map.removeLayer(strokeId);
                if (map.getLayer(fillId)) map.removeLayer(fillId);
                if (map.getSource(sourceId)) map.removeSource(sourceId);
            } catch {}
        };
    }, [map, isLoaded, source.id, source.longitude, source.latitude, hex,
        source.pending, fillId, strokeId, sourceId]);

    return null;
}

function GeoCircleOverlay({ source }: { source: WaterSource }) {
    const markerColor = source.pending ? "#94a3b8" : getDisturbanceColor(source);

    const popupContent = () => {
        if (source.pending) {
            return (
                <div className="p-3 min-w-[210px]">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-2">{source.label}</h3>
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <div className="h-3 w-3 shrink-0 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                        <span>🛰 Analyzing satellite imagery…</span>
                    </div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-2 leading-relaxed">
                        This takes 60–120 seconds. You can navigate freely.
                    </p>
                </div>
            );
        }

        if (source.satelliteStatus === "error") {
            return (
                <div className="p-3 min-w-[210px]">
                    <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100 mb-1">{source.label}</h3>
                    <p className="text-xs text-red-500 dark:text-red-400 mb-2">Satellite data could not be retrieved</p>
                    <Link
                        href={`/water-source/${source.id}`}
                        className="block text-center rounded-md bg-[#0277bd] py-1.5 text-xs font-semibold text-white hover:bg-[#01579b] transition-colors"
                    >
                        Retry Analysis →
                    </Link>
                </div>
            );
        }

        if (source.satelliteStatus === "unavailable") {
            return (
                <div className="p-3 min-w-[210px]">
                    <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{source.label}</h3>
                    <p className="text-sm text-amber-600 dark:text-amber-400 mb-2">Saved offline — no satellite data yet</p>
                    <Link
                        href={`/water-source/${source.id}`}
                        className="block text-center rounded-md bg-[#0277bd] py-2 text-sm font-semibold text-white hover:bg-[#01579b] transition-colors"
                    >
                        Analyze Now →
                    </Link>
                </div>
            );
        }

        return (
            <div className="p-3 min-w-[200px]">
                <h3 className="text-base font-bold text-slate-900 dark:text-slate-100 mb-1">{source.label}</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-3">{getDisturbanceLabel(source)}</p>
                <Link
                    href={`/water-source/${source.id}`}
                    className="block text-center rounded-md bg-[#0277bd] py-2 text-sm font-semibold text-white hover:bg-[#01579b] transition-colors shadow-sm"
                >
                    View Detailed Analysis →
                </Link>
            </div>
        );
    };

    return (
        <>
            <MapMarker longitude={source.longitude} latitude={source.latitude} anchor="center">
                <MarkerContent>
                    <div
                        style={{
                            width: 14, height: 14, borderRadius: "50%",
                            background: markerColor,
                            border: "2px solid white",
                            boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}
                        className={source.pending ? "animate-pulse" : ""}
                    />
                </MarkerContent>
                <MarkerPopup closeButton>
                    {popupContent()}
                </MarkerPopup>
            </MapMarker>

            {!source.pending && source.disturbances.map((d, i) => {
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

function MapPage({
    region,
    regionName,
    onAddComplete,
    apiOnline,
}: {
    region: Region;
    regionName: string;
    onAddComplete: () => void;
    apiOnline: boolean | null;
}) {
    const mapRef = useRef<MapRef>(null);
    const waterSources = region.waterSources;
    const { user } = useAuth();

    const [draftPoint, setDraftPoint] = useState<{ lng: number; lat: number } | null>(null);
    const [label, setLabel] = useState("");
    const [isPlacementMode, setIsPlacementMode] = useState(false);
    const [copied, setCopied] = useState(false);

    const SERVER_CMD = "uvicorn api:app --host 0.0.0.0 --port 8000 --reload";

    useEffect(() => {
        if (!mapRef.current) return;
        const map = mapRef.current;

        const handleClick = (e: any) => {
            if (isPlacementMode) {
                const wrapped = e.lngLat.wrap();
                setDraftPoint({ lng: wrapped.lng, lat: wrapped.lat });
                setIsPlacementMode(false);
            }
        };

        map.on("click", handleClick);
        return () => { map.off("click", handleClick); };
    }, [isPlacementMode]);

    const handleSavePoint = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!draftPoint || !label.trim()) return;

        const { lng, lat } = draftPoint;

        const id = addCustomWaterSource(label, lng, lat);

        setDraftPoint(null);
        setLabel("");
        onAddComplete();

        const online = await checkApiHealth();
        if (!online) {
            markWaterSourceSatelliteStatus(id, "unavailable");
            return;
        }

        analyzeWater(lat, lng)
            .then((data) => enrichWaterSourceWithSatellite(id, data))
            .catch((err) => {
                console.error("Satellite analysis failed for dot", label, err);
                markWaterSourceSatelliteStatus(id, "error");
            });
    };

    const handleCopyCmd = () => {
        navigator.clipboard.writeText(SERVER_CMD).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    return (
        <div className="relative h-full w-full">
            <Map
                ref={mapRef}
                center={region.center}
                zoom={region.zoom}
                styles={{ light: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json" }}
                doubleClickZoom={false}
            >
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
                                        <label className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-slate-500 dark:text-slate-400">
                                            Name / Label
                                        </label>
                                        <input
                                            required autoFocus
                                            type="text"
                                            value={label}
                                            onChange={(e) => setLabel(e.target.value)}
                                            placeholder="e.g. Ohrid North Shore"
                                            className="w-full rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-2.5 py-1.5 text-sm text-slate-800 dark:text-slate-100 outline-none focus:border-[#0277bd] focus:ring-1 focus:ring-[#0277bd] transition-all"
                                        />
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
                                    <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/40 px-2.5 py-2">
                                        <span className="text-sm">🛰</span>
                                        <p className="text-[10px] text-blue-700 dark:text-blue-300 leading-relaxed">
                                            Disturbances will be detected automatically from Sentinel-2 satellite imagery after saving.
                                        </p>
                                    </div>
                                    <div className="mt-1 flex gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setDraftPoint(null)}
                                            className="flex-1 rounded-md bg-slate-100 dark:bg-slate-700 py-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 rounded-md bg-[#0277bd] py-1.5 text-xs font-semibold text-white hover:bg-[#01579b] transition-colors"
                                        >
                                            Save &amp; Analyze
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </MarkerPopup>
                    </MapMarker>
                )}
            </Map>

            {apiOnline === false && (
                <div className="absolute top-16 left-1/2 z-20 -translate-x-1/2 w-full max-w-2xl px-4 pointer-events-none">
                    <div className="pointer-events-auto flex items-center gap-3 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50/95 dark:bg-amber-900/30 px-4 py-3 shadow-lg backdrop-blur">
                        <span className="text-lg shrink-0">⚠️</span>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-amber-800 dark:text-amber-300 mb-0.5">
                                Satellite API Offline — POIs will be saved without real data
                            </p>
                            <code className="text-[10px] text-amber-700 dark:text-amber-400 font-mono">
                                {SERVER_CMD}
                            </code>
                        </div>
                        <button
                            onClick={handleCopyCmd}
                            className="shrink-0 rounded-lg bg-amber-100 dark:bg-amber-800/40 px-3 py-1.5 text-xs font-semibold text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-700/50 transition-colors"
                        >
                            {copied ? "✓ Copied" : "📋 Copy"}
                        </button>
                    </div>
                </div>
            )}

            <button
                onClick={() => {
                    const rawRole = user?.role || "free";
                    const role = ["free", "premium", "pro"].includes(rawRole) ? rawRole : "free";
                    if (!isPlacementMode && role === "free" && waterSources.length >= 2) {
                        alert("Free trial limit reached! You can only place up to 2 dots. Please upgrade to a Premium plan to track more sources.");
                        return;
                    }
                    setIsPlacementMode(!isPlacementMode);
                }}
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

            <div className="absolute right-4 top-4 z-10 flex min-w-[280px] max-w-[320px] flex-col gap-3 rounded-xl bg-white/95 dark:bg-slate-800/95 p-5 shadow-md backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700 pb-3 mb-1">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Water Sources
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1.5">
                            {apiOnline === true && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                            {apiOnline === false && <span className="h-2 w-2 rounded-full bg-red-500" />}
                            {apiOnline === null && <span className="h-2 w-2 rounded-full bg-slate-400 animate-pulse" />}
                            <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500 uppercase tracking-wide">
                                {apiOnline === true ? "API Live" : apiOnline === false ? "API Off" : "Checking…"}
                            </span>
                        </div>
                    </div>
                </div>

                {waterSources.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500 text-center py-2">
                        No points yet. Click "Add a Dot" to get started.
                    </p>
                ) : (
                    <div className="flex flex-col gap-2.5">
                        {waterSources.map((source) => {
                            const color = source.pending ? "#94a3b8" : getDisturbanceColor(source);
                            const disturbanceCount = source.disturbances?.length || 0;
                            let percentage = "0%";
                            if (disturbanceCount >= 4) percentage = "100%";
                            else if (disturbanceCount >= 3) percentage = "75%";
                            else if (disturbanceCount >= 1) percentage = "45%";

                            return (
                                <div key={source.id} className="flex items-center justify-between border-b border-slate-100 dark:border-slate-700/50 pb-2.5 last:border-0 last:pb-0">
                                    <div className="flex items-center gap-2.5">
                                        <div className={cn("h-3 w-3 shrink-0 rounded-full", source.pending && "animate-pulse")} style={{ backgroundColor: color }} />
                                        <div className="text-sm font-semibold text-slate-800 dark:text-slate-200">{source.label}</div>
                                    </div>
                                    <div className="text-sm font-bold text-slate-500 dark:text-slate-400">
                                        {source.pending ? "—" : percentage}
                                    </div>
                                </div>
                            );
                        })}
                        <div className="mt-2 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between text-xs text-[#0277bd] dark:text-[#0288d1]">
                            <span className="uppercase tracking-wider font-semibold">Last Updated</span>
                            <span className="font-bold">13:00</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-start gap-6 rounded-xl bg-white/95 dark:bg-slate-800/95 px-5 py-4 shadow-md backdrop-blur border border-slate-200 dark:border-slate-700 transition-colors">
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbance Intensity</div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#22c55e]" />
                        <span>0% - Healthy (0 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#eab308]" />
                        <span>45% - Mediocre (1-2 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#f97316]" />
                        <span>75% - Harmful (3 disturbances)</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <div className="h-3.5 w-3.5 shrink-0 rounded-full bg-[#ef4444]" />
                        <span>100% - Severe (4+ disturbances)</span>
                    </div>
                </div>
                <div className="flex flex-col gap-2">
                    <div className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Disturbances</div>
                    {Object.entries(disturbanceLabels).map(([type, lbl]) => (
                        <div key={type} className="flex max-w-[240px] items-start gap-2 text-sm text-slate-700 dark:text-slate-300">
                            <div style={{
                                width: 0, height: 0,
                                borderLeft: "8px solid transparent",
                                borderRight: "8px solid transparent",
                                borderTop: `14px solid ${disturbanceColors[type]}`,
                                flexShrink: 0, marginTop: 4,
                            }} />
                            <span className="leading-snug">{lbl}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export function OhridMap() {
    const [region, setRegion] = useState<Region | null>(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [apiOnline, setApiOnline] = useState<boolean | null>(null);

    useEffect(() => {
        checkApiHealth().then(setApiOnline);
        const interval = setInterval(() => checkApiHealth().then(setApiOnline), 30_000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleStorage = () => setRefreshKey((k) => k + 1);
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, []);

    useEffect(() => {
        const allRegions = getRegions();
        if (allRegions["custom"]) {
            setRegion(allRegions["custom"]);
        } else {
            setRegion({
                center: [21.7, 41.6],
                zoom: 8,
                waterSources: [],
            });
        }
    }, [refreshKey]);

    if (!region) return null;

    return (
        <MapPage
            region={region}
            regionName="Custom Water Sources"
            onAddComplete={() => setRefreshKey((k) => k + 1)}
            apiOnline={apiOnline}
        />
    );
}