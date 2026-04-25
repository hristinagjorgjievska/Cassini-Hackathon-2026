"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";
import { cn } from "@/lib/utils";

const navItems = [
  { label: "My Map", href: "/my-map", aliases: ["/"] },
  { label: "My Water", href: "/my-water", aliases: [] },
  { label: "My Profile", href: "/my-profile", aliases: [] },
];

function isActive(pathname: string, href: string, aliases: string[]) {
  return pathname === href || aliases.includes(pathname);
}

export function TopNav() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/80 dark:border-slate-800 dark:bg-slate-950/80 backdrop-blur-md transition-colors">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
          AgroWater
        </Link>
        <nav className="flex items-center gap-6">
          {!user ? (
            <div className="flex gap-3">
              <Link href="/login" className="px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                Log In
              </Link>
              <Link href="/signup" className="rounded-md bg-[#0277bd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#01579b] shadow-sm">
                Sign Up
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-6">
                {navItems.map((item) => {
                  const active = isActive(pathname, item.href, item.aliases);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "relative py-5 text-sm font-medium transition-colors",
                        active
                          ? "text-[#0277bd] dark:text-[#29b6f6]"
                          : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                      )}
                    >
                      {item.label}
                      {active && (
                        <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#0277bd] dark:bg-[#29b6f6]" />
                      )}
                    </Link>
                  );
                })}
              </div>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800 mx-2" />
              <button
                onClick={logout}
                className="text-sm font-medium text-slate-500 transition-colors hover:text-red-600 dark:text-slate-400 dark:hover:text-red-400"
              >
                Logout
              </button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}