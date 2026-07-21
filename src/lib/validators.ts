import { z } from "zod";
import { appRoles, purchaseOrderStatuses, shipmentStatuses } from "@/lib/constants";
import { productCategories } from "@/lib/products";

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

export const productSchema = z.object({
  name: z.string().trim().min(2),
  sku: z.string().trim().min(2),
  category: z.enum(productCategories),
  low_stock_warning_level: z.coerce.number().int().min(0),
});

export const purchaseOrderSchema = z.object({
  po_number: z.string().trim().min(3),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  supplier: z.string().trim().min(2),
  order_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(purchaseOrderStatuses),
});

export const purchaseOrderStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(purchaseOrderStatuses),
});

export const shipmentSchema = z.object({
  container_number: z.string().trim().min(3),
  product_id: z.string().uuid(),
  quantity: z.coerce.number().int().positive(),
  eta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  arrival_status: z.enum(shipmentStatuses),
  linked_purchase_order_id: z.string().uuid().optional().or(z.literal("")),
});

export const shipmentStatusSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(shipmentStatuses),
});

export const stockAdjustmentSchema = z.object({
  product_id: z.string().uuid(),
  adjustment: z.enum(["add", "remove"]),
  quantity: z.coerce.number().int().positive(),
  reason: z.string().trim().min(4),
});

export const userCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  full_name: z.string().trim().min(2),
  role: z.enum(appRoles),
});

export const userRoleSchema = z.object({
  id: z.string().uuid(),
  role: z.enum(appRoles),
});
