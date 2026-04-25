"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { roleDetailsMap } from "@/lib/roleData";
import { 
  User, 
  Mail, 
  MapPin, 
  Calendar, 
  Activity, 
  Bell, 
  ShieldCheck, 
  CreditCard,
  Briefcase
} from "lucide-react";

type IndicatorStatus = "healthy" | "warning" | "critical";

type ProfilePayload = {
  account: {
    name: string;
    email: string;
    region: string;
    memberSince: string;
  };
  summary: {
    overallStatus: IndicatorStatus;
    alertCount: number;
  };
};

const statusClasses: Record<IndicatorStatus, { badge: string; border: string; text: string }> = {
  healthy: { badge: "bg-emerald-100 text-emerald-800", border: "border-emerald-200", text: "text-emerald-700" },
  warning: { badge: "bg-amber-100 text-amber-800", border: "border-amber-200", text: "text-amber-700" },
  critical: { badge: "bg-red-100 text-red-800", border: "border-red-200", text: "text-red-700" },
};

export default function MyProfilePage() {
  const { user } = useAuth();
  const [data, setData] = useState<ProfilePayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      try {
        setLoading(true);
        const response = await fetch("/api/account?accountId=demo-1");
        if (!response.ok) {
          throw new Error("Failed to fetch profile data");
        }
        const payload = (await response.json()) as ProfilePayload;
        if (!cancelled) {
          setData(payload);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadProfile();
    return () => {
      cancelled = true;
    };
  }, []);

  const roleKey = user?.role || "farmer";
  const roleDetails = roleDetailsMap[roleKey];

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 pb-12 transition-colors">
        {/* Hero Header */}
        <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-white/10 px-4 py-12 sm:px-6 lg:px-8 transition-colors">
          <div className="mx-auto max-w-5xl flex items-center gap-6">
            <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-3xl font-bold text-white shadow-md ring-4 ring-white">
              {data?.account.name.charAt(0) || user?.name.charAt(0) || "U"}
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white flex items-center gap-3">
                {data?.account.name || user?.name}
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-100 dark:bg-blue-900/30 px-3 py-1 text-sm font-semibold text-blue-800 dark:text-blue-300 ring-1 ring-inset ring-blue-200 dark:ring-blue-800/50">
                  <Briefcase className="h-4 w-4" />
                  {roleDetails.label}
                </span>
              </h1>
              <div className="mt-2 flex items-center gap-4 text-sm text-slate-600 dark:text-slate-400">
                <div className="flex items-center gap-1.5">
                  <Mail className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                  {data?.account.email || user?.email}
                </div>
                {data && (
                  <>
                    <div className="flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      {data.account.region}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-4 w-4 text-slate-400 dark:text-slate-500" />
                      Joined {new Date(data.account.memberSince).toLocaleDateString()}
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {loading && (
            <div className="flex justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-blue-600"></div>
            </div>
          )}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-600">
              <p className="font-semibold">{error}</p>
            </div>
          )}

          {data && (
            <div className="grid gap-6 md:grid-cols-3">
              
              {/* Left Column: Role Details */}
              <div className="md:col-span-1 space-y-6">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-sm transition-colors">
                  <div className="flex items-center gap-2 mb-4">
                    <CreditCard className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Current Plan</h2>
                  </div>
                  <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-4 ring-1 ring-inset ring-slate-200 dark:ring-white/10">
                    <p className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{roleDetails.plan.split(" ")[0]}</p>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{roleDetails.plan.substring(roleDetails.plan.indexOf(" ") + 1)}</p>
                  </div>
                  <Link href="/billing" className="mt-4 flex justify-center w-full rounded-lg bg-white dark:bg-slate-900 px-4 py-2 text-sm font-semibold text-blue-600 dark:text-blue-400 ring-1 ring-inset ring-blue-200 dark:ring-blue-900 hover:bg-blue-50 dark:hover:bg-slate-800 transition-colors">
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

              {/* Right Column: Account & System Overview */}
              <div className="md:col-span-2 space-y-6">
                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 shadow-sm overflow-hidden transition-colors">
                  <div className="border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-slate-800/50 px-6 py-5">
                    <h2 className="text-lg font-semibold text-slate-900 dark:text-white">System Overview</h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Live data associated with your monitored regions.</p>
                  </div>
                  
                  <div className="grid sm:grid-cols-2 gap-px bg-slate-100 dark:bg-slate-700/50">
                    <div className="bg-white dark:bg-slate-800 p-6 transition-colors">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                        <Activity className="h-4 w-4" />
                        Overall Status
                      </div>
                      <div className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold border ${statusClasses[data.summary.overallStatus].badge} ${statusClasses[data.summary.overallStatus].border}`}>
                        <div className="h-2 w-2 rounded-full bg-current opacity-75 animate-pulse"></div>
                        {data.summary.overallStatus.toUpperCase()}
                      </div>
                    </div>

                    <div className="bg-white dark:bg-slate-800 p-6 transition-colors">
                      <div className="flex items-center gap-2 text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">
                        <Bell className="h-4 w-4" />
                        Active Alerts
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black tracking-tight text-slate-900 dark:text-white">{data.summary.alertCount}</span>
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">alerts needing attention</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-slate-800 p-6 shadow-sm transition-colors">
                   <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Account Details</h2>
                   <div className="divide-y divide-slate-100 dark:divide-white/5 border-t border-slate-100 dark:border-white/5">
                      <div className="py-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Full Name</span>
                        <span className="text-sm text-slate-900 dark:text-white">{data.account.name}</span>
                      </div>
                      <div className="py-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Email Address</span>
                        <span className="text-sm text-slate-900 dark:text-white">{data.account.email}</span>
                      </div>
                      <div className="py-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Primary Region</span>
                        <span className="text-sm text-slate-900 dark:text-white">{data.account.region}</span>
                      </div>
                      <div className="py-4 flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Member Since</span>
                        <span className="text-sm text-slate-900 dark:text-white">{new Date(data.account.memberSince).toLocaleDateString()}</span>
                      </div>
                   </div>
                </div>
              </div>

            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  );
}