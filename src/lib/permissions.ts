import type { AppRole } from "@/lib/database.types";

const roleRank: Record<AppRole, number> = {
  viewer: 0,
  operator: 1,
  admin: 2,
};

export function hasAtLeastRole(role: AppRole, minimum: AppRole) {
  return roleRank[role] >= roleRank[minimum];
}

export function canManageUsers(role: AppRole) {
  return role === "admin";
}

export function canManageProducts(role: AppRole) {
  return role === "admin";
}

export function canDeleteProducts(role: AppRole) {
  return role === "admin";
}

export function canManageOrders(role: AppRole) {
  return role === "admin";
}

export function canUpdateOperationalStatus(role: AppRole) {
  return hasAtLeastRole(role, "operator");
}

export function canAdjustStock(role: AppRole) {
  return hasAtLeastRole(role, "operator");
}

