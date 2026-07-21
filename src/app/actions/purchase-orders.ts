"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { rpcMutation, tableMutation } from "@/lib/supabase/mutations";
import {
  purchaseOrderSchema,
  purchaseOrderStatusSchema,
} from "@/lib/validators";

export async function createPurchaseOrderAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const purchaseOrders = tableMutation(supabase, "purchase_orders");
  const parsed = purchaseOrderSchema.parse({
    po_number: String(formData.get("po_number") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    quantity: formData.get("quantity"),
    supplier: String(formData.get("supplier") ?? ""),
    order_date: String(formData.get("order_date") ?? ""),
    status: String(formData.get("status") ?? "paid"),
  });

  const { error } = await purchaseOrders.insert({ ...parsed, created_by: profile.id });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/purchase-orders");
}

export async function updatePurchaseOrderAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const purchaseOrders = tableMutation(supabase, "purchase_orders");
  const id = String(formData.get("id") ?? "");
  const parsed = purchaseOrderSchema.parse({
    po_number: String(formData.get("po_number") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    quantity: formData.get("quantity"),
    supplier: String(formData.get("supplier") ?? ""),
    order_date: String(formData.get("order_date") ?? ""),
    status: String(formData.get("status") ?? "paid"),
  });

  const { error } = await purchaseOrders.update(parsed).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/purchase-orders");
}

export async function updatePurchaseOrderStatusAction(formData: FormData) {
  const { supabase } = await requirePortalUser("operator");
  const runRpc = rpcMutation(supabase);
  const parsed = purchaseOrderStatusSchema.parse({
    id: String(formData.get("id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  const { error } = await runRpc("update_purchase_order_status", {
    p_purchase_order_id: parsed.id,
    p_status: parsed.status,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/purchase-orders");
}

export async function deletePurchaseOrderAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const purchaseOrders = tableMutation(supabase, "purchase_orders");
  const id = String(formData.get("id") ?? "");
  const { error } = await purchaseOrders.delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/purchase-orders");
}
