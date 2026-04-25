"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthContext";

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
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-semibold tracking-tight">
          Water Monitor
        </Link>
        <nav className="flex items-center gap-2">
          {!user ? (
            <>
              <Link href="/login" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
                Log In
              </Link>
              <Link href="/signup" className="rounded-md bg-[#0277bd] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#01579b]">
                Sign Up
              </Link>
            </>
          ) : (
            <>
              {navItems.map((item) => {
                const active = isActive(pathname, item.href, item.aliases);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={[
                      "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-[#0277bd] text-white"
                        : "text-slate-600 hover:bg-slate-100 hover:text-slate-900",
                    ].join(" ")}
                  >
                    {item.label}
                  </Link>
                );
              })}
              <button 
                onClick={logout}
                className="ml-2 rounded-md px-3 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50"
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