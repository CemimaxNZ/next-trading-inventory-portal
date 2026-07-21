"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/database.types";
import { portalNav } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  role: AppRole;
};

export function SidebarNav({ role }: SidebarNavProps) {
  const pathname = usePathname();
  const items = portalNav.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className="flex gap-2 overflow-x-auto md:flex-col">
      {items.map((item) => {
        const isActive = pathname === item.href;

        return (
          <Link
            className={cn(
              "rounded-2xl border px-4 py-3 text-sm font-medium transition",
              isActive
                ? "border-brand-300 bg-slate-950 text-white shadow-lg shadow-brand-500/15"
                : "border-transparent bg-white/70 text-slate-700 hover:border-brand-100 hover:bg-white hover:text-slate-950",
            )}
            href={item.href}
            key={item.href}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
