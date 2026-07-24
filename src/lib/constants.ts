import type { AppRole, Database } from "@/lib/database.types";

type PortalNavItem = {
  href: string;
  label: string;
  roles?: readonly AppRole[];
};

export const portalNav: PortalNavItem[] = [
  { href: "/", label: "Dashboard" },
  { href: "/products", label: "Products" },
  { href: "/purchase-orders", label: "Purchase Orders" },
  { href: "/shipments", label: "Shipments" },
  { href: "/transactions", label: "Transactions" },
  { href: "/adjustments", label: "Stock Adjustments" },
  { href: "/users", label: "Users", roles: ["admin"] satisfies AppRole[] },
];

export const purchaseOrderStatuses = [
  "paid",
  "shipped",
  "arrived",
] as const satisfies readonly Database["public"]["Enums"]["purchase_order_status"][];

export const shipmentStatuses = [
  "scheduled",
  "at_sea",
  "arrived",
] as const satisfies readonly Database["public"]["Enums"]["shipment_status"][];

export const appRoles = ["admin", "operator", "viewer"] as const satisfies readonly AppRole[];
