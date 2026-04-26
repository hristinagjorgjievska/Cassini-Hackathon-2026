"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getRegions, getDisturbanceColor, disturbanceColors, disturbanceDescriptions, getDisturbanceLabel, addCustomWaterSource, updateCustomWaterSource, deleteCustomWaterSource, clearAllCustomWaterSources, type WaterSource } from "@/lib/waterData";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AlertModal } from "@/components/AlertModal";
import { useAuth } from "@/lib/AuthContext";

export default function MyWaterPage() {
  const [waterSources, setWaterSources] = useState<WaterSource[]>([]);
  
  const [label, setLabel] = useState("");
  const [longitude, setLongitude] = useState("");
  const [latitude, setLatitude] = useState("");
  const [selectedDisturbances, setSelectedDisturbances] = useState<string[]>([]);
  const [editingSourceId, setEditingSourceId] = useState<number | null>(null);

  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, title: string, message: string, type: "error" | "info" | "warning" | "success", onConfirm?: () => void, confirmText?: string}>({isOpen: false, title: "", message: "", type: "info"});

  const showAlert = (title: string, message: string, type: "error" | "info" | "warning" | "success" = "info", onConfirm?: () => void, confirmText?: string) => {
    setModalConfig({ isOpen: true, title, message, type, onConfirm, confirmText });
  };

  const loadData = () => {
    const currentRegions = getRegions();
    let targetSources: WaterSource[] = [];

    if (currentRegions["custom"]) {
       targetSources = currentRegions["custom"].waterSources;
    }

    const uniqueWaterSources = Array.from(new Map(targetSources.map((ws) => [ws.label + (ws.id || ""), ws])).values());
    setWaterSources(uniqueWaterSources);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const lng = parseFloat(longitude);
    const lat = parseFloat(latitude);
    
    if (isNaN(lng) || isNaN(lat)) {
      showAlert("Invalid Input", "Please enter valid numeric coordinates.", "error");
      return;
    }
    
    if (editingSourceId) {
      updateCustomWaterSource(editingSourceId, label, lng, lat, selectedDisturbances);
    }
    
    setLabel("");
    setLongitude("");
    setLatitude("");
    setSelectedDisturbances([]);
    setEditingSourceId(null);
    
    loadData();
  };

  const handleEdit = (source: WaterSource) => {
    setLabel(source.label);
    setLongitude(source.longitude.toString());
    setLatitude(source.latitude.toString());
    setSelectedDisturbances(source.disturbances.map(d => d.type));
    setEditingSourceId(source.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = (id: number) => {
    showAlert(
      "Delete Water Source", 
      "Are you sure you want to delete this tracked point? This cannot be undone.", 
      "warning", 
      () => {
        deleteCustomWaterSource(id);
        loadData();
      }, 
      "Delete"
    );
  };

  const handleClearAll = () => {
    showAlert(
      "Clear All Points", 
      `Remove all ${waterSources.length} tracked point${waterSources.length !== 1 ? "s" : ""}? This cannot be undone.`, 
      "error", 
      () => {
        clearAllCustomWaterSources();
        loadData();
      }, 
      "Clear All"
    );
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
    <ProtectedRoute>
      <AlertModal 
        isOpen={modalConfig.isOpen} 
        onClose={() => setModalConfig(prev => ({ ...prev, isOpen: false }))} 
        title={modalConfig.title} 
        message={modalConfig.message} 
        type={modalConfig.type} 
        onConfirm={modalConfig.onConfirm}
        confirmText={modalConfig.confirmText}
      />
      <section className="min-h-[calc(100vh-4rem)] w-full bg-slate-50 dark:bg-slate-900 p-6 sm:p-8 transition-colors">
        <div className="mx-auto max-w-6xl">
          <header className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800 dark:text-slate-100">
                Water Status Dashboard
              </h1>
              <p className="mt-2 text-slate-500 dark:text-slate-400">
                Real-time disturbance reports for your manually tracked water sources.
              </p>
            </div>
            {waterSources.length > 0 && (
              <button
                onClick={handleClearAll}
                className="flex items-center gap-2 rounded-xl border border-red-200 dark:border-red-800/50 bg-red-50 dark:bg-red-900/20 px-4 py-2.5 text-sm font-semibold text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/40 transition-all hover:scale-105 active:scale-95 shrink-0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear All Dots
              </button>
            )}
          </header>

          {editingSourceId !== null && (
            <div className="mb-8 rounded-2xl bg-white dark:bg-slate-800 p-6 shadow-sm ring-1 ring-slate-200 dark:ring-white/10 transition-colors">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                  Edit Water Source
                </h2>
                <button 
                  onClick={() => setEditingSourceId(null)}
                  className="text-sm font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Cancel
                </button>
              </div>
              <form onSubmit={handleUpdateSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
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
                <div className="lg:col-span-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2 border-t border-slate-100 dark:border-slate-700 pt-4">
                  <div className="flex gap-4 flex-wrap">
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" value="algae" checked={selectedDisturbances.includes("algae")} onChange={handleCheckbox} className="rounded border-slate-300 text-[#0277bd] focus:ring-[#0277bd]" /> Algae
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" value="pollution" checked={selectedDisturbances.includes("pollution")} onChange={handleCheckbox} className="rounded border-slate-300 text-[#0277bd] focus:ring-[#0277bd]" /> Pollution
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" value="turbidity" checked={selectedDisturbances.includes("turbidity")} onChange={handleCheckbox} className="rounded border-slate-300 text-[#0277bd] focus:ring-[#0277bd]" /> Turbidity
                    </label>
                    <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                      <input type="checkbox" value="temperature" checked={selectedDisturbances.includes("temperature")} onChange={handleCheckbox} className="rounded border-slate-300 text-[#0277bd] focus:ring-[#0277bd]" /> Temperature
                    </label>
                  </div>
                  <button type="submit" className="shrink-0 rounded-md bg-emerald-600 px-6 py-2 text-sm font-semibold text-white transition-colors hover:bg-emerald-500">
                    Update Point
                  </button>
                </div>
              </form>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {waterSources.map((source) => {
              const badgeColor = getDisturbanceColor(source);
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
                      {getDisturbanceLabel(source)}
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
                  
                  <div className="mt-5 flex flex-col gap-2 border-t border-slate-100 dark:border-slate-700/50 pt-4">
                    <Link 
                        href={`/water-source/${source.id}`}
                        className="flex-1 rounded-md bg-[#0277bd] px-3 py-2 text-xs font-bold text-white text-center transition-colors hover:bg-[#01579b] shadow-sm"
                    >
                        View Detailed Analysis →
                    </Link>
                    <div className="flex gap-3">
                      <button 
                        onClick={() => handleEdit(source)}
                        className="flex-1 rounded-md bg-slate-100 dark:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-200 dark:hover:bg-slate-600"
                      >
                        Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(source.id)}
                        className="flex-1 rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-xs font-semibold text-red-600 dark:text-red-400 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    </ProtectedRoute>
  );
}
