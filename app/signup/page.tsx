"use client";

import { useState } from "react";
import { useAuth } from "@/lib/AuthContext";
import Link from "next/link";
import { roleDetailsMap } from "@/lib/roleData";

export default function SignupPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("farmer");
  const [error, setError] = useState("");
  const { signup } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    try {
      await signup(name, email, password, role);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-slate-50 dark:bg-slate-900 px-4 py-12 sm:px-6 lg:px-8 transition-colors">
      <div className="w-full max-w-md space-y-8 rounded-2xl bg-white dark:bg-slate-800 p-8 shadow-xl ring-1 ring-slate-900/5 dark:ring-white/10 transition-colors">
        <div>
          <h2 className="mt-2 text-center text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Create an account
          </h2>
          <p className="mt-2 text-center text-sm text-slate-600 dark:text-slate-400">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#0277bd] hover:text-[#01579b]">
              Sign in
            </Link>
          </p>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="space-y-4 rounded-md shadow-sm">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Full name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-[#0277bd] sm:text-sm sm:leading-6"
                placeholder="John Doe"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-[#0277bd] sm:text-sm sm:leading-6"
                placeholder="john@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-[#0277bd] sm:text-sm sm:leading-6"
                placeholder="••••••••"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Account Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="relative block w-full rounded-md border-0 py-2.5 px-3 text-slate-900 dark:text-white bg-white dark:bg-slate-900 ring-1 ring-inset ring-slate-300 dark:ring-slate-700 focus:z-10 focus:ring-2 focus:ring-inset focus:ring-[#0277bd] sm:text-sm sm:leading-6"
              >
                <option value="farmer">Farmer</option>
                <option value="institution">Agriculture Institution</option>
                <option value="supermarket">Supermarket / Export</option>
              </select>
            </div>

            <div className="rounded-md bg-slate-50 dark:bg-slate-900/50 p-4 ring-1 ring-inset ring-slate-200 dark:ring-white/10">
              <div className="mb-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Payment Plan</span>
                <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">{roleDetailsMap[role].plan}</p>
              </div>
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Permissions</span>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{roleDetailsMap[role].permissions}</p>
              </div>
            </div>
          </div>

          {error && <div className="text-sm text-red-600 font-medium text-center">{error}</div>}

          <div>
            <button
              type="submit"
              className="group relative flex w-full justify-center rounded-md bg-[#0277bd] px-3 py-3 text-sm font-semibold text-white hover:bg-[#01579b] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0277bd] transition-colors"
            >
              Sign up
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
