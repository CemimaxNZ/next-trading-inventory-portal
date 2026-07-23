"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { rpcMutation, tableMutation } from "@/lib/supabase/mutations";
import { shipmentSchema, shipmentStatusSchema } from "@/lib/validators";

export async function createShipmentAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const shipments = tableMutation(supabase, "shipments");
  const parsed = shipmentSchema.parse({
    container_number: String(formData.get("container_number") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    quantity: formData.get("quantity"),
    eta: String(formData.get("eta") ?? ""),
    arrival_status: String(formData.get("arrival_status") ?? "scheduled"),
    linked_purchase_order_id: String(formData.get("linked_purchase_order_id") ?? ""),
  });

  const { error } = await shipments.insert({
    ...parsed,
    product_id: parsed.product_id ?? null,
    quantity: parsed.quantity ?? null,
    linked_purchase_order_id: parsed.linked_purchase_order_id || null,
    created_by: profile.id,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/shipments");
}

export async function updateShipmentAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const shipments = tableMutation(supabase, "shipments");
  const id = String(formData.get("id") ?? "");
  const parsed = shipmentSchema.parse({
    container_number: String(formData.get("container_number") ?? ""),
    product_id: String(formData.get("product_id") ?? ""),
    quantity: formData.get("quantity"),
    eta: String(formData.get("eta") ?? ""),
    arrival_status: String(formData.get("arrival_status") ?? "scheduled"),
    linked_purchase_order_id: String(formData.get("linked_purchase_order_id") ?? ""),
  });

  const { error } = await shipments.update({
    ...parsed,
    product_id: parsed.product_id ?? null,
    quantity: parsed.quantity ?? null,
    linked_purchase_order_id: parsed.linked_purchase_order_id || null,
  }).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/shipments");
}

export async function updateShipmentStatusAction(formData: FormData) {
  const { supabase } = await requirePortalUser("operator");
  const runRpc = rpcMutation(supabase);
  const parsed = shipmentStatusSchema.parse({
    id: String(formData.get("id") ?? ""),
    status: String(formData.get("status") ?? ""),
  });

  const { error } = await runRpc("update_shipment_status", {
    p_shipment_id: parsed.id,
    p_status: parsed.status,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/shipments");
}

export async function deleteShipmentAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const shipments = tableMutation(supabase, "shipments");
  const id = String(formData.get("id") ?? "");
  const { error } = await shipments.delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/shipments");
}
