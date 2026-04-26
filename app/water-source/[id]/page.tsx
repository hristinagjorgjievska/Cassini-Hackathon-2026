"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getWaterSourceById,
  getDisturbanceColor,
  getDisturbanceLabel,
  getMockHistoricalData,
  getMockForecast,
  enrichWaterSourceWithSatellite,
  markWaterSourceSatelliteStatus,
  markWaterSourcePending,
  type WaterSource,
  disturbanceColors,
  disturbanceDescriptions,
} from "@/lib/waterData";
import { analyzeWater, checkApiHealth } from "@/lib/satelliteApi";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { ArrowLeft, MapPin, TrendingUp, Droplets, Satellite, RefreshCw } from "lucide-react";
import Link from "next/link";

export default function WaterSourceDetailsPage() {
  const params = useParams();
  const id = parseInt(params.id as string);
  const [source, setSource] = useState<WaterSource | null>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [forecast, setForecast] = useState<any[]>([]);
  const [retrying, setRetrying] = useState(false);

  const reload = () => {
    const data = getWaterSourceById(id);
    if (data) {
      setSource(data);
      setHistory(getMockHistoricalData(id));
      setForecast(getMockForecast(id));
    }
  };

  useEffect(() => {
    if (id) reload();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const handleStorage = () => reload();
    window.addEventListener("storage", handleStorage);
    return () => window.removeEventListener("storage", handleStorage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRetryAnalysis = async () => {
    if (!source || retrying) return;
    const online = await checkApiHealth();
    if (!online) {
      alert("Satellite API is offline. Start it with:\nuvicorn api:app --host 0.0.0.0 --port 8000 --reload");
      return;
    }
    setRetrying(true);
    markWaterSourcePending(source.id);
    reload();
    analyzeWater(source.latitude, source.longitude)
      .then((data) => {
        enrichWaterSourceWithSatellite(source.id, data);
        reload();
      })
      .catch(() => {
        markWaterSourceSatelliteStatus(source.id, "error");
        reload();
      })
      .finally(() => setRetrying(false));
  };

  if (!source) {
    return (
      <ProtectedRoute>
        <div className="flex min-h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
           <div className="text-center">
             <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100 mb-2">Water Source Not Found</h2>
             <Link href="/my-water" className="text-[#0277bd] hover:underline font-medium">Return to Dashboard</Link>
           </div>
        </div>
      </ProtectedRoute>
    );
  }

  const badgeColor = getDisturbanceColor(source);

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 transition-colors pb-12">
        <div className="mx-auto max-w-6xl p-6 sm:p-8">
          <Link href="/my-water" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-[#0277bd] transition-colors mb-6">
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 mb-4">
                <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">{source.label}</h1>
                {source.pending ? (
                  <div className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 dark:bg-slate-700 px-4 py-1 text-sm font-bold text-slate-500 dark:text-slate-300">
                    <div className="h-3 w-3 rounded-full border-2 border-blue-400 border-t-transparent animate-spin" />
                    Analyzing…
                  </div>
                ) : (
                  <div className="inline-flex w-fit rounded-full px-4 py-1 text-sm font-bold text-white shadow-sm" style={{ backgroundColor: badgeColor }}>
                    {getDisturbanceLabel(source)}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap gap-4 text-slate-500 dark:text-slate-400">
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-full text-xs font-mono border border-slate-100 dark:border-slate-700">
                  <MapPin className="h-3.5 w-3.5" />
                  Lng: {source.longitude.toFixed(5)}
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-full text-xs font-mono border border-slate-100 dark:border-slate-700">
                  <MapPin className="h-3.5 w-3.5" />
                  Lat: {source.latitude.toFixed(5)}
                </div>
                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-900/50 px-3 py-1 rounded-full text-xs border border-slate-100 dark:border-slate-700 font-medium">
                  SOURCE ID: {source.id}
                </div>
              </div>
            </div>
            <div className="flex gap-4">
              <Link href="/my-map" className="rounded-xl bg-[#0277bd] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-all hover:bg-[#01579b] hover:scale-105 active:scale-95 text-center">
                View on Map
              </Link>
            </div>
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                <div className="flex items-center justify-between mb-8">
                  <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                    <TrendingUp className="h-5 w-5 text-[#0277bd]" />
                    Historical Water Quality Trend
                  </h2>
                  <div className="text-[10px] text-slate-400 uppercase tracking-widest font-bold bg-slate-50 dark:bg-slate-900 px-2 py-1 rounded">Last 14 Days</div>
                </div>
                <div className="h-[350px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={history}>
                      <defs>
                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0277bd" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0277bd" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} dy={10} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} domain={[0, 100]} />
                      <Tooltip 
                        contentStyle={{ 
                          borderRadius: '16px', 
                          border: 'none', 
                          boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          backgroundColor: 'rgba(255, 255, 255, 0.95)',
                          padding: '12px'
                        }}
                        labelStyle={{ fontWeight: 'bold', marginBottom: '4px', color: '#1e293b' }}
                      />
                      <Area type="monotone" dataKey="score" stroke="#0277bd" strokeWidth={3} fillOpacity={1} fill="url(#colorScore)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100">
                  <Droplets className="h-5 w-5 text-[#0277bd]" />
                  Active Disturbances
                </h2>
                {source.disturbances.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {source.disturbances.map((d) => (
                      <div key={d.id} className="flex items-start gap-4 p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 transition-colors">
                        <div className="mt-1.5 h-4 w-4 shrink-0 rounded-full shadow-sm" style={{ backgroundColor: disturbanceColors[d.type] }} />
                        <div>
                          <div className="font-bold text-slate-900 dark:text-slate-100 capitalize">{d.type}</div>
                          <div className="text-sm text-slate-500 dark:text-slate-400 mt-1 leading-relaxed">{disturbanceDescriptions[d.type]}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-emerald-600 dark:text-emerald-400 font-medium p-6 rounded-2xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800/50 flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    Water source is currently healthy and clear of disturbances.
                  </div>
                )}
              </section>
            </div>

            <div className="space-y-8">
              {source.pending ? (
                <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100">
                    <Satellite className="h-5 w-5 text-[#0277bd]" />
                    Satellite Metrics
                  </h2>
                  <div className="flex flex-col items-center gap-3 py-6">
                    <div className="h-8 w-8 rounded-full border-4 border-blue-400 border-t-transparent animate-spin" />
                    <p className="text-sm text-slate-500 dark:text-slate-400">Satellite analysis in progress…</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">This takes 60–120 seconds</p>
                  </div>
                </section>
              ) : source.satelliteData ? (
                <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold flex items-center gap-2 text-slate-800 dark:text-slate-100">
                      <Satellite className="h-5 w-5 text-[#0277bd]" />
                      Satellite Metrics
                    </h2>
                    <span className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded">Live Data</span>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { label: "NDWI", value: source.satelliteData.ndwi?.toFixed(4) ?? "N/A", hint: "Water index", explanation: "Normalized Difference Water Index. Values > 0 indicate water presence. Negative values indicate soil/vegetation." },
                      { label: "NDCI", value: source.satelliteData.ndci?.toFixed(4) ?? "N/A", hint: "Chlorophyll", explanation: "Values > 0.05 indicate high algae or chlorophyll presence, which is often a sign of pollution or blooming." },
                      { label: "Turbidity", value: source.satelliteData.turbidity?.toFixed(4) ?? "N/A", hint: "Water clarity", explanation: "Measures cloudiness. Lower or negative values mean clearer water. Higher values mean reduced clarity." },
                      { label: "Sed. Load", value: source.satelliteData.suspendent_sediment?.toFixed(4) ?? "N/A", hint: "Suspended sediment", explanation: "Estimates solid particles suspended in the water. High values indicate murky or heavily disturbed water." },
                    ].map(({ label, value, hint, explanation }) => (
                      <div key={label} className="group relative flex flex-col gap-0.5 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-help">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</span>
                        <span className="text-2xl font-black text-slate-900 dark:text-slate-100 font-mono">{value}</span>
                        <span className="text-xs text-slate-400">{hint}</span>
                        
                        <div className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-2 w-56 -translate-x-1/2 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                          <div className="rounded-lg bg-slate-900 dark:bg-white p-3 text-xs leading-relaxed text-slate-100 dark:text-slate-800 shadow-xl text-center ring-1 ring-black/5 dark:ring-white/10">
                            {explanation}
                            <div className="absolute left-1/2 top-full h-0 w-0 -translate-x-1/2 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-900 dark:border-t-white" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Water Detected</span>
                    <span className={`text-sm font-bold ${source.satelliteData.water_detected ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                      {source.satelliteData.water_detected ? "✅ Yes" : "❌ No"}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between p-3 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700">
                    <span className="text-xs text-slate-500 dark:text-slate-400">Pollution Status</span>
                    <span className={`text-sm font-bold ${
                      source.satelliteData.pollution_status === "HIGH" ? "text-red-500" :
                      source.satelliteData.pollution_status === "MEDIUM" ? "text-amber-500" : "text-emerald-600"
                    }`}>{source.satelliteData.pollution_status}</span>
                  </div>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500 mt-3 text-right">
                    Analyzed: {new Date(source.satelliteData.timestamp).toLocaleString()}
                  </p>
                </section>
              ) : (
                <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                  <h2 className="text-xl font-bold flex items-center gap-2 mb-4 text-slate-800 dark:text-slate-100">
                    <Satellite className="h-5 w-5 text-slate-400" />
                    Satellite Metrics
                  </h2>
                  <div className="flex flex-col items-center gap-4 py-4 text-center">
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {source.satelliteStatus === "error"
                        ? "Satellite analysis failed."
                        : "No satellite data — this point was added while the API was offline."}
                    </p>
                    <button
                      onClick={handleRetryAnalysis}
                      disabled={retrying}
                      className="flex items-center gap-2 rounded-xl bg-[#0277bd] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#01579b] transition-all hover:scale-105 active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      <RefreshCw className={`h-4 w-4 ${retrying ? "animate-spin" : ""}`} />
                      {retrying ? "Analyzing…" : "Run Satellite Analysis"}
                    </button>
                  </div>
                </section>
              )}

              <section className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-sm border border-slate-200 dark:border-white/10">
                <h2 className="text-xl font-bold flex items-center gap-2 mb-6 text-slate-800 dark:text-slate-100">
                  <TrendingUp className="h-5 w-5 text-[#0277bd]" />
                  3-Day Forecast
                </h2>
                <div className="space-y-4">
                  {forecast.map((f, i) => (
                    <div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 transition-all hover:bg-white dark:hover:bg-slate-800 hover:shadow-md hover:-translate-y-1">
                      <div>
                        <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">{f.day}</div>
                        <div className="text-lg font-bold text-slate-900 dark:text-slate-100">{f.status}</div>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-2xl font-black" style={{ color: f.color }}>{f.score}%</div>
                        <div className="h-2.5 w-12 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
                           <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${f.score}%`, backgroundColor: f.color }} />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-8 p-5 rounded-2xl bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/50 text-xs text-blue-700 dark:text-blue-300 leading-relaxed">
                  <div className="font-bold mb-1 flex items-center gap-1.5 uppercase tracking-wider">
                    <TrendingUp className="h-3.5 w-3.5" />
                    AI Predictive Model
                  </div>
                  Forecast based on seasonal patterns and recent disturbance trends. Precision increases with more tracking data.
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
