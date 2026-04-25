"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { label: "My Map", href: "/my-water", aliases: ["/", "/my-map"] },
  { label: "My Profile", href: "/my-profile", aliases: [] },
];

function isActive(pathname: string, href: string, aliases: string[]) {
  return pathname === href || aliases.includes(pathname);
}

export function TopNav() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/my-water" className="text-lg font-semibold tracking-tight">
          Water Monitor
        </Link>
        <nav className="flex items-center gap-2">
          {navItems.map((item) => {
            const active = isActive(pathname, item.href, item.aliases);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={[
                  "rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground",
                ].join(" ")}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}