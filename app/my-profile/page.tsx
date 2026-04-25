"use client";

import { useEffect, useState } from "react";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { useAuth } from "@/lib/AuthContext";

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

const statusClasses: Record<IndicatorStatus, string> = {
  healthy: "bg-emerald-100 text-emerald-800 border-emerald-200",
  warning: "bg-amber-100 text-amber-800 border-amber-200",
  critical: "bg-red-100 text-red-800 border-red-200",
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

  return (
    <ProtectedRoute>
    <section className="mx-auto w-full max-w-4xl px-4 py-10 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">My Profile</h1>
      <p className="mt-2 text-muted-foreground">
        Account data loaded from backend API.
      </p>

      {loading && <p className="mt-6 text-sm text-muted-foreground">Loading profile...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {data && (
        <div className="mt-8 rounded-xl border bg-card p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-medium">Profile Overview</h2>
            <span
              className={`rounded-md border px-3 py-1 text-xs font-semibold ${statusClasses[data.summary.overallStatus]}`}
            >
              {data.summary.overallStatus.toUpperCase()}
            </span>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="rounded-md border p-4">
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="mt-1 font-medium">{data.account.name}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="mt-1 font-medium">{data.account.email}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm text-muted-foreground">Member Since</p>
              <p className="mt-1 font-medium">{new Date(data.account.memberSince).toLocaleDateString()}</p>
            </div>
            <div className="rounded-md border p-4">
              <p className="text-sm text-muted-foreground">Region</p>
              <p className="mt-1 font-medium">{data.account.region}</p>
            </div>
          </div>

          <p className="mt-4 text-sm text-muted-foreground">
            Active alerts: <span className="font-medium text-foreground">{data.summary.alertCount}</span>
          </p>
        </div>
      )}
    </section>
    </ProtectedRoute>
  );
}