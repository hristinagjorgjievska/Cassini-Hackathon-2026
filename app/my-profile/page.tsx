"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { roleDetailsMap } from "@/lib/roleData";
import { getRegions, type WaterSource, getDisturbanceLabel, disturbanceLabels } from "@/lib/waterData";
import {
  User,
  Mail,
  CreditCard,
  ShieldCheck,
  MapPin,
  Activity,
  AlertTriangle,
  CheckCircle2,
  Satellite,
  Droplets,
  Waves,
  TrendingUp,
} from "lucide-react";

export default function MyProfilePage() {
  const { user } = useAuth();
  const [dots, setDots] = useState<WaterSource[]>([]);

  useEffect(() => {
    const regions = getRegions();
    const customSources = regions["custom"]?.waterSources ?? [];
    setDots(customSources);
  }, []);

  let roleKey = user?.role || "free";
  if (!roleDetailsMap[roleKey]) roleKey = "free";
  const roleDetails = roleDetailsMap[roleKey];

  // ── Derived dot stats ──────────────────────────────────────────────────────
  const totalDots = dots.length;
  const analyzedDots = dots.filter((d) => d.satelliteStatus === "done").length;
  const pendingDots = dots.filter((d) => d.pending || d.satelliteStatus === "pending").length;
  const errorDots = dots.filter((d) => d.satelliteStatus === "error").length;
  const healthyDots = dots.filter((d) => !d.pending && (d.disturbances?.length ?? 0) === 0).length;
  const disturbedDots = dots.filter((d) => !d.pending && (d.disturbances?.length ?? 0) > 0).length;

  // Count total disturbances across all dots
  const totalDisturbances = dots.reduce((sum, d) => sum + (d.disturbances?.length ?? 0), 0);

  // Most common disturbance type
  const disturbanceCounts: Record<string, number> = {};
  dots.forEach((d) => {
    d.disturbances?.forEach((dist) => {
      disturbanceCounts[dist.type] = (disturbanceCounts[dist.type] ?? 0) + 1;
    });
  });
  const topDisturbance = Object.entries(disturbanceCounts).sort((a, b) => b[1] - a[1])[0];

  // Average NDWI across analyzed dots
  const ndwiValues = dots
    .map((d) => d.satelliteData?.ndwi)
    .filter((v): v is number => v !== null && v !== undefined);
  const avgNdwi = ndwiValues.length > 0
    ? (ndwiValues.reduce((a, b) => a + b, 0) / ndwiValues.length).toFixed(3)
    : null;

  const dotLimit = roleKey === "free" ? 2 : roleKey === "premium" ? 50 : "∞";

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 pb-16 transition-colors">

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-white/10 px-4 py-12 sm:px-6 lg:px-8 transition-colors">
          <div className="mx-auto max-w-5xl flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-3xl font-bold text-white shadow-md ring-4 ring-white dark:ring-slate-700">
              {user?.name?.charAt(0) ?? "U"}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
                {user?.name}
              </h1>
              <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
                <span className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> {user?.email}
                </span>
                <span className="flex items-center gap-1.5">
                  <CreditCard className="h-4 w-4" />
                  <span className="font-semibold text-blue-600 dark:text-blue-400">{roleDetails.label}</span>
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">

          {/* ── Quick-stat tiles ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              {
                label: "Total Dots",
                value: `${totalDots} / ${dotLimit}`,
                icon: MapPin,
                color: "text-blue-600 dark:text-blue-400",
                bg: "bg-blue-50 dark:bg-blue-900/20",
              },
              {
                label: "Analyzed",
                value: analyzedDots,
                icon: Satellite,
                color: "text-emerald-600 dark:text-emerald-400",
                bg: "bg-emerald-50 dark:bg-emerald-900/20",
              },
              {
                label: "Healthy",
                value: healthyDots,
                icon: CheckCircle2,
                color: "text-green-600 dark:text-green-400",
                bg: "bg-green-50 dark:bg-green-900/20",
              },
              {
                label: "Disturbed",
                value: disturbedDots,
                icon: AlertTriangle,
                color: "text-red-500 dark:text-red-400",
                bg: "bg-red-50 dark:bg-red-900/20",
              },
            ].map(({ label, value, icon: Icon, color, bg }) => (
              <div key={label} className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-5 shadow-sm transition-colors">
                <div className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${bg}`}>
                  <Icon className={`h-5 w-5 ${color}`} />
                </div>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-white">{value}</p>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Main grid ─────────────────────────────────────────────────── */}
          <div className="grid gap-6 md:grid-cols-3">

            {/* LEFT: Subscription ─────────────────────────────────────────── */}
            <div className="md:col-span-1 space-y-6">
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-sm transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current Plan</h2>
                </div>
                <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 ring-1 ring-inset ring-slate-200 dark:ring-white/10">
                  <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{roleDetails.label}</p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{roleDetails.plan}</p>
                </div>
                <Link
                  href="/billing"
                  className="mt-4 flex justify-center w-full rounded-lg bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-200 dark:ring-blue-900 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors"
                >
                  Manage Billing
                </Link>
              </div>

              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-sm transition-colors">
                <div className="flex items-center gap-2 mb-4">
                  <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Permissions</h2>
                </div>
                <ul className="space-y-3">
                  {roleDetails.permissions.split(",").map((perm, idx) => (
                    <li key={idx} className="flex items-start gap-3 text-sm text-slate-700 dark:text-slate-300">
                      <div className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400">
                        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="leading-relaxed">{perm.trim()}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* RIGHT: Dot stats ─────────────────────────────────────────────── */}
            <div className="md:col-span-2 space-y-6">

              {/* Satellite summary strip */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="border-b border-slate-100 dark:border-white/5 px-6 py-5">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Satellite Overview</h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400">Live metrics from your monitored water sources.</p>
                </div>
                <div className="grid sm:grid-cols-3 gap-px bg-slate-100 dark:bg-slate-700/50">
                  {[
                    {
                      label: "Avg NDWI",
                      value: avgNdwi ?? "—",
                      icon: Waves,
                      sub: "Water index",
                    },
                    {
                      label: "Total Disturbances",
                      value: totalDisturbances,
                      icon: Activity,
                      sub: "Across all dots",
                    },
                    {
                      label: "Top Threat",
                      value: topDisturbance ? disturbanceLabels[topDisturbance[0]] : "—",
                      icon: TrendingUp,
                      sub: topDisturbance ? `${topDisturbance[1]} occurrence${topDisturbance[1] > 1 ? "s" : ""}` : "No data yet",
                    },
                  ].map(({ label, value, icon: Icon, sub }) => (
                    <div key={label} className="bg-white dark:bg-slate-800 p-6 transition-colors">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
                        <Icon className="h-4 w-4" />
                        {label}
                      </div>
                      <p className="text-2xl font-black text-slate-900 dark:text-white truncate">{value}</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">{sub}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Dot list */}
              <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm overflow-hidden transition-colors">
                <div className="border-b border-slate-100 dark:border-white/5 px-6 py-5 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">My Water Sources</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">{totalDots} dot{totalDots !== 1 ? "s" : ""} placed</p>
                  </div>
                  <Link href="/my-map" className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline">
                    Open Map →
                  </Link>
                </div>

                {totalDots === 0 ? (
                  <div className="flex flex-col items-center justify-center py-14 text-center px-6">
                    <Droplets className="h-10 w-10 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">No dots placed yet</p>
                    <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">Go to My Map and add your first water source.</p>
                    <Link href="/my-map" className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 transition-colors">
                      Add a Dot
                    </Link>
                  </div>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-white/5">
                    {dots.map((dot) => {
                      const distCount = dot.disturbances?.length ?? 0;
                      const statusLabel = dot.pending
                        ? "Analyzing…"
                        : dot.satelliteStatus === "error"
                        ? "Error"
                        : dot.satelliteStatus === "unavailable"
                        ? "Offline"
                        : getDisturbanceLabel(dot);

                      const statusColor =
                        dot.pending || dot.satelliteStatus === "pending"
                          ? "text-blue-500 dark:text-blue-400"
                          : dot.satelliteStatus === "error"
                          ? "text-red-500"
                          : distCount === 0
                          ? "text-emerald-600 dark:text-emerald-400"
                          : distCount <= 2
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-red-500 dark:text-red-400";

                      const dotColor =
                        dot.pending
                          ? "#94a3b8"
                          : distCount === 0
                          ? "#22c55e"
                          : distCount <= 2
                          ? "#eab308"
                          : distCount === 3
                          ? "#f97316"
                          : "#ef4444";

                      return (
                        <li key={dot.id} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div
                              className={`h-3 w-3 shrink-0 rounded-full ${dot.pending ? "animate-pulse" : ""}`}
                              style={{ backgroundColor: dotColor }}
                            />
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{dot.label}</p>
                              <p className="text-xs text-slate-400 dark:text-slate-500">
                                {dot.longitude.toFixed(4)}, {dot.latitude.toFixed(4)}
                              </p>
                            </div>
                          </div>
                          <div className="ml-4 flex shrink-0 items-center gap-4">
                            <span className={`text-xs font-semibold ${statusColor}`}>{statusLabel}</span>
                            <Link
                              href={`/water-source/${dot.id}`}
                              className="rounded-md bg-slate-100 dark:bg-slate-700 px-3 py-1 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors"
                            >
                              View →
                            </Link>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>

              {/* Analysis status breakdown */}
              {totalDots > 0 && (
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-sm transition-colors">
                  <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-5">Analysis Status</h2>
                  <div className="grid grid-cols-3 gap-4 text-center">
                    {[
                      { label: "Done", count: analyzedDots, color: "bg-emerald-500" },
                      { label: "Pending", count: pendingDots, color: "bg-blue-500 animate-pulse" },
                      { label: "Failed", count: errorDots, color: "bg-red-500" },
                    ].map(({ label, count, color }) => (
                      <div key={label} className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4">
                        <div className={`mx-auto h-2.5 w-2.5 rounded-full ${color} mb-2`} />
                        <p className="text-2xl font-black text-slate-900 dark:text-white">{count}</p>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wide mt-0.5">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}