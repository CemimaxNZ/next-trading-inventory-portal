"use client";

import Link from "next/link";
import {
  ArrowLeftRight,
  Boxes,
  ClipboardList,
  LayoutDashboard,
  SlidersHorizontal,
  Truck,
  Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import type { AppRole } from "@/lib/database.types";
import { portalNav } from "@/lib/constants";
import { cn } from "@/lib/utils";

type SidebarNavProps = {
  role: AppRole;
  mobile?: boolean;
};

const iconMap = {
  "/": LayoutDashboard,
  "/products": Boxes,
  "/purchase-orders": ClipboardList,
  "/shipments": Truck,
  "/transactions": ArrowLeftRight,
  "/adjustments": SlidersHorizontal,
  "/users": Users,
} as const;

export function SidebarNav({ role, mobile = false }: SidebarNavProps) {
  const pathname = usePathname();
  const items = portalNav.filter((item) => !item.roles || item.roles.includes(role));

  return (
    <nav className={cn("flex gap-2 overflow-x-auto", mobile ? "pb-1" : "md:flex-col")}>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        const Icon = iconMap[item.href as keyof typeof iconMap];

        return (
          <Link
            className={cn(
              mobile
                ? "min-w-[84px] flex-1 rounded-2xl px-3 py-2.5 text-center"
                : "rounded-2xl border px-4 py-3 text-sm",
              "font-medium transition",
              isActive
                ? "border-brand-300 bg-slate-950 text-white shadow-lg shadow-brand-500/15"
                : "border-transparent bg-white/70 text-slate-700 hover:border-brand-100 hover:bg-white hover:text-slate-950",
            )}
            href={item.href}
            key={item.href}
          >
            <span className={cn("flex items-center", mobile ? "flex-col gap-1.5" : "gap-3")}>
              {Icon ? <Icon className={mobile ? "h-4 w-4" : "h-4 w-4 shrink-0"} /> : null}
              <span className={mobile ? "text-[0.7rem] leading-tight" : ""}>{item.label}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
