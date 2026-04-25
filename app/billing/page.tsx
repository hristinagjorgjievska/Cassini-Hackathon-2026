"use client";

import { useAuth } from "@/lib/AuthContext";
import { roleDetailsMap } from "@/lib/roleData";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { Check } from "lucide-react";
import Link from "next/link";

export default function BillingPage() {
  const { user, updateRole } = useAuth();
  const currentRole = user?.role || "farmer";

  // Order of tiers by price/power
  const tierOrder = ["farmer", "supermarket", "institution"];

  return (
    <ProtectedRoute>
      <div className="min-h-[calc(100vh-4rem)] bg-slate-50 dark:bg-slate-900 py-16 px-4 sm:px-6 lg:px-8 transition-colors">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <h2 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">Pricing Plans</h2>
            <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-400">
              Choose the right plan for your water management needs. Transparent pricing, no hidden fees.
            </p>
          </div>

          <div className="mt-16 grid gap-8 md:grid-cols-3 max-w-md mx-auto md:max-w-none">
            {tierOrder.map((key) => {
              const tier = roleDetailsMap[key];
              const isCurrent = currentRole === key;
              const [priceStr, ...rest] = tier.plan.split(" ");
              const description = rest.join(" ");

              return (
                <div
                  key={key}
                  className={`relative flex flex-col justify-between rounded-3xl p-8 xl:p-10 transition-all ${
                    isCurrent
                      ? "bg-white dark:bg-slate-800 ring-2 ring-blue-600 shadow-xl z-10"
                      : "bg-white/60 dark:bg-slate-800/60 ring-1 ring-slate-200 dark:ring-white/10 hover:bg-white dark:hover:bg-slate-800 hover:shadow-md"
                  }`}
                >
                  {isCurrent && (
                    <div className="absolute -top-4 left-0 right-0 flex justify-center">
                      <span className="rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold leading-5 text-white tracking-wide uppercase shadow-sm">
                        Current Plan
                      </span>
                    </div>
                  )}

                  <div>
                    <h3
                      className={`text-lg font-semibold leading-8 ${
                        isCurrent ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                      }`}
                    >
                      {tier.label}
                    </h3>
                    <p className="mt-4 text-sm leading-6 text-slate-600 dark:text-slate-400">{description}</p>
                    <p className="mt-6 flex items-baseline gap-x-1">
                      <span className="text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                        {priceStr}
                      </span>
                    </p>
                    <ul className="mt-8 space-y-3 text-sm leading-6 text-slate-600 dark:text-slate-400 xl:mt-10">
                      {tier.permissions.split(",").map((perm, idx) => (
                        <li key={idx} className="flex gap-x-3">
                          <Check className="h-6 w-5 flex-none text-blue-600 dark:text-blue-400" aria-hidden="true" />
                          {perm.trim()}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <button
                    disabled={isCurrent}
                    onClick={() => updateRole(key)}
                    className={`mt-8 block w-full rounded-md px-3 py-2 text-center text-sm font-semibold leading-6 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${
                      isCurrent
                        ? "bg-slate-100 dark:bg-slate-700/50 text-slate-400 dark:text-slate-500 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-500 focus-visible:outline-blue-600 shadow-sm transition-colors cursor-pointer"
                    }`}
                  >
                    {isCurrent ? "Active Plan" : "Switch to Plan"}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-12 text-center">
            <Link href="/my-profile" className="text-sm font-semibold text-blue-600 hover:text-blue-500">
              &larr; Back to Profile
            </Link>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  );
}
