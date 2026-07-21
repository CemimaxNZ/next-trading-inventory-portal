"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { rpcMutation } from "@/lib/supabase/mutations";
import {
  purchaseOrderSchema,
  purchaseOrderStatusSchema,
} from "@/lib/validators";

function revalidatePurchaseOrderPaths() {
  revalidatePath("/");
  revalidatePath("/purchase-orders");
  revalidatePath("/shipments");
}

function extractPurchaseOrderItems(formData: FormData) {
  const productIds = formData.getAll("item_product_id").map((value) => String(value ?? "").trim());
  const quantities = formData.getAll("item_quantity").map((value) => String(value ?? "").trim());
  const rowCount = Math.max(productIds.length, quantities.length);
  const items: { product_id: string; quantity: string }[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const productId = productIds[index] ?? "";
    const quantity = quantities[index] ?? "";

    if (!productId && !quantity) {
      continue;
    }

    items.push({ product_id: productId, quantity });
  }

  return items;
}

export async function createPurchaseOrderAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);
  const parsed = purchaseOrderSchema.parse({
    po_number: String(formData.get("po_number") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    order_date: String(formData.get("order_date") ?? ""),
    status: String(formData.get("status") ?? "paid"),
    items: extractPurchaseOrderItems(formData),
  });

  const { error } = await runRpc("save_purchase_order", {
    p_po_number: parsed.po_number,
    p_supplier: parsed.supplier,
    p_order_date: parsed.order_date,
    p_status: parsed.status,
    p_items: parsed.items,
    p_created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePurchaseOrderPaths();
}

export async function updatePurchaseOrderAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);
  const id = String(formData.get("id") ?? "");
  const parsed = purchaseOrderSchema.parse({
    po_number: String(formData.get("po_number") ?? ""),
    supplier: String(formData.get("supplier") ?? ""),
    order_date: String(formData.get("order_date") ?? ""),
    status: String(formData.get("status") ?? "paid"),
    items: extractPurchaseOrderItems(formData),
  });

  const { error } = await runRpc("save_purchase_order", {
    p_purchase_order_id: id,
    p_po_number: parsed.po_number,
    p_supplier: parsed.supplier,
    p_order_date: parsed.order_date,
    p_status: parsed.status,
    p_items: parsed.items,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePurchaseOrderPaths();
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

  revalidatePurchaseOrderPaths();
}

export async function deletePurchaseOrderAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);
  const id = String(formData.get("id") ?? "");
  const { error } = await runRpc("delete_purchase_order", {
    p_purchase_order_id: id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePurchaseOrderPaths();
}
