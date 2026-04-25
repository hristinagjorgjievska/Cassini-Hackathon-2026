"use client";

import { useEffect, useState } from "react";
import { getRegions, getDisturbanceColor, disturbanceColors, disturbanceDescriptions, getDisturbanceLabel, addCustomWaterSource, WaterSource } from "@/lib/waterData";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";

export default function MyWaterPage() {
  const { user } = useAuth();
  const [userRegionName, setUserRegionName] = useState<string | null>(null);

  const [waterSources, setWaterSources] = useState<WaterSource[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  
  // Form State
  const [label, setLabel] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [disturbance, setDisturbance] = useState("0");

  useEffect(() => {
    if (user?.id) {
      fetch(`/api/account?accountId=${user.id}`)
        .then(res => res.json())
        .then(data => {
           if (data?.account?.region) {
             setUserRegionName(data.account.region);
           }
        })
        .catch(console.error);
    }
  }, [user]);

  const loadData = () => {
    const currentRegions = getRegions();
    let targetSources = Object.values(currentRegions).flatMap(r => r.waterSources);

    if (userRegionName) {
      const matchedRegion = Object.entries(currentRegions).find(([key]) => 
         key.toLowerCase() === userRegionName.toLowerCase() || 
         key.toLowerCase().includes(userRegionName.toLowerCase()) ||
         userRegionName.toLowerCase().includes(key.toLowerCase())
      );
      if (matchedRegion) {
         targetSources = matchedRegion[1].waterSources;
      }
    }

    const uniqueWaterSources = Array.from(new Map(targetSources.map((ws) => [ws.label + (ws.id || ""), ws])).values());
    setWaterSources(uniqueWaterSources);
  };

  useEffect(() => {
    loadData();
  }, [userRegionName]);

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    const dist = parseInt(disturbance);
    
    if (isNaN(lng) || isNaN(lat)) {
      alert("Invalid coordinates");
      return;
    }
    
    addCustomWaterSource(label, lng, lat, isNaN(dist) ? 0 : dist);
    
    // Reset form
    setLabel("");
    setLongitude("");
    setLatitude("");
    setDisturbance("0");
    setShowAddForm(false);
    
    // Refresh data
    loadData();
  };

  return (
    <ProtectedRoute>
      <section className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-900 p-6 sm:p-8 transition-colors">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                {userRegionName ? `${userRegionName} Water Status` : "Water Status Dashboard"}
              </h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Real-time disturbance reports for {userRegionName ? "your" : "all"} monitored water viewing points.
              </p>
            </div>
            <button 
              onClick={() => setShowAddForm(!showAddForm)}
              className="rounded-md bg-[#0277bd] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#01579b]"
            >
              {showAddForm ? "Cancel" : "+ Add Tracked Point"}
            </button>
          </header>

          {showAddForm && (
            <div className="mb-8 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/10 transition-colors">
              <h2 className="mb-4 text-lg font-semibold text-slate-800 dark:text-slate-100">Add New Water Source</h2>
              <form onSubmit={handleAddSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="lg:col-span-2">
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Name / Label</label>
                  <input required type="text" value={label} onChange={e => setLabel(e.target.value)} placeholder="e.g. My Custom Point" className="w-full rounded-md border-0 py-2 px-3 text-slate-900 dark:text-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-[#0277bd] outline-none transition-colors text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Longitude</label>
                  <input required type="number" step="any" value={longitude} onChange={e => setLongitude(e.target.value)} placeholder="21.432" className="w-full rounded-md border-0 py-2 px-3 text-slate-900 dark:text-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-[#0277bd] outline-none transition-colors text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Latitude</label>
                  <input required type="number" step="any" value={latitude} onChange={e => setLatitude(e.target.value)} placeholder="42.002" className="w-full rounded-md border-0 py-2 px-3 text-slate-900 dark:text-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-[#0277bd] outline-none transition-colors text-sm" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Disturbance %</label>
                  <div className="flex gap-2">
                    <input required type="number" min="0" max="100" value={disturbance} onChange={e => setDisturbance(e.target.value)} className="w-full rounded-md border-0 py-2 px-3 text-slate-900 dark:text-slate-100 dark:bg-slate-700 ring-1 ring-inset ring-slate-300 dark:ring-slate-600 focus:ring-2 focus:ring-[#0277bd] outline-none transition-colors text-sm" />
                    <button type="submit" className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
                      Save
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {waterSources.map((source) => {
              const badgeColor = getDisturbanceColor(source.disturbancePercentage);
              return (
                <div
                  key={source.id + source.label}
                  className="group relative overflow-hidden rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/10 transition-all hover:shadow-md"
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100">{source.label}</h2>
                    <div
                      className="flex items-center justify-center rounded-full px-3 py-1 text-sm font-bold text-white shadow-sm"
                      style={{ backgroundColor: badgeColor }}
                    >
                      {getDisturbanceLabel(source.disturbancePercentage)}
                    </div>
                  </div>

                  {source.disturbances && source.disturbances.length > 0 ? (
                    <div className="flex flex-col gap-3">
                      <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Active Disturbances</h3>
                      <ul className="flex flex-col gap-3">
                        {source.disturbances.map((d) => (
                          <li key={d.id} className="flex items-start gap-3 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-3">
                            <div
                              className="mt-1 h-3 w-3 shrink-0 rounded-full shadow-sm"
                              style={{ backgroundColor: disturbanceColors[d.type] }}
                            />
                            <span className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                              {disturbanceDescriptions[d.type]}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 p-3 text-sm text-emerald-700 dark:text-emerald-400">
                      <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                      </svg>
                      Water source is clear of disturbances.
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </ProtectedRoute>
  );
}
