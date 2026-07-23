"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { rpcMutation, tableMutation } from "@/lib/supabase/mutations";
import type { ShipmentRow } from "@/lib/database.types";
import { shipmentSchema, shipmentStatusSchema } from "@/lib/validators";

type PortalSupabaseClient = Awaited<ReturnType<typeof requirePortalUser>>["supabase"];
type ShipmentLinkRecord = Pick<
  ShipmentRow,
  "id" | "linked_purchase_order_id" | "linked_purchase_order_ids"
>;

function getShipmentOrderIds(shipment: ShipmentLinkRecord) {
  if (shipment.linked_purchase_order_ids.length > 0) {
    return shipment.linked_purchase_order_ids;
  }

  return shipment.linked_purchase_order_id ? [shipment.linked_purchase_order_id] : [];
}

async function ensurePurchaseOrdersAvailable(
  supabase: PortalSupabaseClient,
  linkedPurchaseOrderIds: string[],
  currentShipmentId?: string,
) {
  if (linkedPurchaseOrderIds.length === 0) {
    return;
  }

  const { data, error } = await supabase
    .from("shipments")
    .select("id, linked_purchase_order_id, linked_purchase_order_ids");

  if (error) {
    throw new Error(error.message);
  }

  const selectedIds = new Set(linkedPurchaseOrderIds);
  const conflictingShipment = ((data ?? []) as ShipmentLinkRecord[]).find((shipment) => {
    if (shipment.id === currentShipmentId) {
      return false;
    }

    return getShipmentOrderIds(shipment).some((orderId) => selectedIds.has(orderId));
  });

  if (conflictingShipment) {
    throw new Error("One or more selected purchase orders are already linked to another shipment.");
  }
}

export async function createShipmentAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const shipments = tableMutation(supabase, "shipments");
  const parsed = shipmentSchema.parse({
    container_number: String(formData.get("container_number") ?? ""),
    etd: String(formData.get("etd") ?? ""),
    eta: String(formData.get("eta") ?? ""),
    arrival_status: String(formData.get("arrival_status") ?? "scheduled"),
    linked_purchase_order_ids: formData
      .getAll("linked_purchase_order_ids")
      .map((value) => String(value).trim())
      .filter(Boolean),
  });

  await ensurePurchaseOrdersAvailable(supabase, parsed.linked_purchase_order_ids);

  const { error } = await shipments.insert({
    container_number: parsed.container_number,
    etd: parsed.etd || null,
    eta: parsed.eta,
    arrival_status: parsed.arrival_status,
    linked_purchase_order_id: parsed.linked_purchase_order_ids[0] ?? null,
    linked_purchase_order_ids: parsed.linked_purchase_order_ids,
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
    etd: String(formData.get("etd") ?? ""),
    eta: String(formData.get("eta") ?? ""),
    arrival_status: String(formData.get("arrival_status") ?? "scheduled"),
    linked_purchase_order_ids: formData
      .getAll("linked_purchase_order_ids")
      .map((value) => String(value).trim())
      .filter(Boolean),
  });

  await ensurePurchaseOrdersAvailable(supabase, parsed.linked_purchase_order_ids, id);

  const { error } = await shipments
    .update({
      container_number: parsed.container_number,
      etd: parsed.etd || null,
      eta: parsed.eta,
      arrival_status: parsed.arrival_status,
      linked_purchase_order_id: parsed.linked_purchase_order_ids[0] ?? null,
      linked_purchase_order_ids: parsed.linked_purchase_order_ids,
    })
    .eq("id", id);

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
