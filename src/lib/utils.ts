import { format } from "date-fns";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(value: string | Date) {
  return format(new Date(value), "dd MMM yyyy");
}

export function formatEnumLabel(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function formatSignedQuantity(quantity: number) {
  return `${quantity > 0 ? "+" : ""}${quantity.toLocaleString()}`;
}

export function getStatusTone(value: string) {
  switch (value) {
    case "arrived":
    case "completed":
    case "paid":
      return "bg-emerald-100 text-emerald-800";
    case "scheduled":
    case "ready":
      return "bg-amber-100 text-amber-800";
    case "shipped":
    case "at_sea":
      return "bg-sky-100 text-sky-800";
    default:
      return "bg-slate-100 text-slate-700";
  }
}
