"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import type {
  InventoryTransactionRow,
  ProductRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
} from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { rpcMutation } from "@/lib/supabase/mutations";
import {
  purchaseOrderSchema,
  purchaseOrderStatusSchema,
} from "@/lib/validators";

type PurchaseOrderItemInput = {
  product_id: string;
  quantity: number;
};

type PurchaseOrderPayload = {
  po_number: string;
  supplier: string;
  order_date: string;
  status: PurchaseOrderRow["status"];
  items: PurchaseOrderItemInput[];
};

type LegacyPurchaseOrderRow = PurchaseOrderRow & {
  product_id?: string | null;
  quantity?: number | null;
};

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

function getPurchaseOrderErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const duplicateProductIssue = error.issues.find(
      (issue) => issue.message === "Each product can only appear once per PO.",
    );

    if (duplicateProductIssue) {
      return "Each product can only appear once in the same purchase order.";
    }

    return "Please complete every purchase order line before saving.";
  }

  if (error instanceof Error) {
    if (error.message.includes("Current stock cannot become negative")) {
      return "This purchase order cannot be reduced because some of the arrived stock has already been used. Please adjust stock first or create a new PO.";
    }

    if (
      error.message.includes("purchase_orders_po_number_key")
      || error.message.includes("duplicate key value violates unique constraint")
    ) {
      return "This PO number already exists. Please use a different PO number.";
    }

    if (error.message.includes("At least one purchase order item is required")) {
      return "A purchase order needs at least one product line.";
    }

    if (error.message.includes("Each product can only appear once per purchase order")) {
      return "Each product can only appear once in the same purchase order.";
    }

    if (error.message.includes("quantity greater than zero")) {
      return "Each purchase order line must have a quantity greater than zero.";
    }

    return error.message;
  }

  return "The purchase order could not be saved. Please try again.";
}

function redirectToPurchaseOrdersError(error: unknown) {
  const message = getPurchaseOrderErrorMessage(error);
  redirect(`/purchase-orders?error=${encodeURIComponent(message)}`);
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error && typeof error.message === "string") {
    return error.message;
  }

  return "";
}

function isMissingRpcFunction(error: unknown, functionName: string) {
  const message = getErrorMessage(error);

  return Boolean(
    message.includes(`Could not find the function public.${functionName}`)
    || (message.includes("schema cache") && message.includes(functionName)),
  );
}

function isMissingPurchaseOrderColumnError(error: unknown) {
  const message = getErrorMessage(error);

  return Boolean(
    message.includes('column "product_id" of relation "purchase_orders" does not exist')
    || message.includes('column "quantity" of relation "purchase_orders" does not exist'),
  );
}

function isMissingPurchaseOrderItemsTableError(error: unknown) {
  const message = getErrorMessage(error);

  return Boolean(
    message.includes("Could not find the table 'public.purchase_order_items' in the schema cache")
    || message.includes('relation "public.purchase_order_items" does not exist')
    || message.includes('relation "purchase_order_items" does not exist'),
  );
}

function buildArrivedItemsMap(status: PurchaseOrderRow["status"], items: PurchaseOrderItemInput[]) {
  const quantities = new Map<string, number>();

  if (status !== "arrived") {
    return quantities;
  }

  for (const item of items) {
    quantities.set(item.product_id, (quantities.get(item.product_id) ?? 0) + item.quantity);
  }

  return quantities;
}

function getLegacyPurchaseOrderValues(items: PurchaseOrderItemInput[]) {
  const firstItem = items[0];

  if (!firstItem) {
    throw new Error("At least one purchase order item is required");
  }

  return {
    product_id: firstItem.product_id,
    quantity: items.reduce((sum, item) => sum + item.quantity, 0),
  };
}

function getLegacyItemsFromPurchaseOrder(order: LegacyPurchaseOrderRow | null) {
  if (!order?.product_id || typeof order.quantity !== "number" || order.quantity <= 0) {
    return [] as PurchaseOrderItemInput[];
  }

  return [
    {
      product_id: order.product_id,
      quantity: order.quantity,
    },
  ];
}

async function loadPurchaseOrderItemsWithoutRpc({
  adminClient,
  purchaseOrder,
}: {
  adminClient: ReturnType<typeof createAdminSupabaseClient>;
  purchaseOrder: LegacyPurchaseOrderRow | null;
}) {
  if (!purchaseOrder) {
    return [] as PurchaseOrderItemInput[];
  }

  const { data, error } = await adminClient
    .from("purchase_order_items")
    .select("*")
    .eq("purchase_order_id", purchaseOrder.id);

  if (error) {
    if (isMissingPurchaseOrderItemsTableError(error)) {
      return getLegacyItemsFromPurchaseOrder(purchaseOrder);
    }

    throw new Error(error.message);
  }

  return ((data ?? []) as PurchaseOrderItemRow[]).map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
  }));
}

async function reconcilePurchaseOrderInventoryWithoutRpc({
  adminClient,
  purchaseOrderId,
  oldPoNumber,
  newPoNumber,
  oldStatus,
  newStatus,
  oldItems,
  newItems,
  performedBy,
}: {
  adminClient: ReturnType<typeof createAdminSupabaseClient>;
  purchaseOrderId: string;
  oldPoNumber: string | null;
  newPoNumber: string | null;
  oldStatus: PurchaseOrderRow["status"];
  newStatus: PurchaseOrderRow["status"];
  oldItems: PurchaseOrderItemInput[];
  newItems: PurchaseOrderItemInput[];
  performedBy: string;
}) {
  const oldQuantities = buildArrivedItemsMap(oldStatus, oldItems);
  const newQuantities = buildArrivedItemsMap(newStatus, newItems);
  const productIds = [...new Set([...oldQuantities.keys(), ...newQuantities.keys()])];

  if (productIds.length === 0) {
    return;
  }

  const deltas = productIds
    .map((productId) => ({
      productId,
      delta: (newQuantities.get(productId) ?? 0) - (oldQuantities.get(productId) ?? 0),
    }))
    .filter(({ delta }) => delta !== 0);

  if (deltas.length === 0) {
    return;
  }

  const { data: productsData, error: productsError } = await adminClient
    .from("products")
    .select("*")
    .in("id", deltas.map(({ productId }) => productId));

  if (productsError) {
    throw new Error(productsError.message);
  }

  const products = (productsData ?? []) as ProductRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const updatedAt = new Date().toISOString();

  for (const { productId, delta } of deltas) {
    const product = productMap.get(productId);

    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    const nextCurrentStock = product.current_stock + delta;

    if (nextCurrentStock < 0) {
      throw new Error(`Current stock cannot become negative for product ${productId}`);
    }

    const { error: productUpdateError } = await adminClient
      .from("products")
      .update({
        current_stock: nextCurrentStock,
        updated_at: updatedAt,
      })
      .eq("id", productId);

    if (productUpdateError) {
      throw new Error(productUpdateError.message);
    }
  }

  const transactionsToInsert = deltas.map(({ productId, delta }) => ({
    product_id: productId,
    quantity: delta,
    type: (delta > 0 ? "purchase_order_arrived" : "purchase_order_reversed") as InventoryTransactionRow["type"],
    reason:
      delta > 0
        ? `PO ${newPoNumber ?? oldPoNumber ?? purchaseOrderId} marked as arrived`
        : `PO ${oldPoNumber ?? newPoNumber ?? purchaseOrderId} arrival reversed`,
    reference_table: "purchase_orders",
    reference_id: purchaseOrderId,
    performed_by: performedBy,
  }));

  const { error: transactionInsertError } = await adminClient
    .from("inventory_transactions")
    .insert(transactionsToInsert);

  if (transactionInsertError) {
    throw new Error(transactionInsertError.message);
  }
}

async function insertPurchaseOrderRowWithoutRpc({
  adminClient,
  payload,
  createdBy,
}: {
  adminClient: ReturnType<typeof createAdminSupabaseClient>;
  payload: PurchaseOrderPayload;
  createdBy: string;
}) {
  const baseValues = {
    po_number: payload.po_number,
    supplier: payload.supplier,
    order_date: payload.order_date,
    status: payload.status,
    created_by: createdBy,
  };
  const legacyValues = getLegacyPurchaseOrderValues(payload.items);

  const purchaseOrdersTable = adminClient.from("purchase_orders") as unknown as {
    insert: (
      values: Record<string, unknown>,
    ) => {
      select: (columns: string) => {
        single: () => Promise<{ data: unknown; error: { message: string } | null }>;
      };
    };
  };

  const insertOrder = async (values: Record<string, unknown>) =>
    purchaseOrdersTable.insert(values).select("*").single();

  const initialInsert = await insertOrder({
    ...baseValues,
    ...legacyValues,
  });

  if (!initialInsert.error) {
    return initialInsert.data as PurchaseOrderRow;
  }

  if (!isMissingPurchaseOrderColumnError(initialInsert.error)) {
    throw new Error(initialInsert.error.message);
  }

  const legacyInsert = await insertOrder(baseValues);

  if (legacyInsert.error) {
    throw new Error(legacyInsert.error.message);
  }

  return legacyInsert.data as PurchaseOrderRow;
}

async function updatePurchaseOrderRowWithoutRpc({
  adminClient,
  purchaseOrderId,
  payload,
  updatedAt,
}: {
  adminClient: ReturnType<typeof createAdminSupabaseClient>;
  purchaseOrderId: string;
  payload: PurchaseOrderPayload;
  updatedAt: string;
}) {
  const baseValues = {
    po_number: payload.po_number,
    supplier: payload.supplier,
    order_date: payload.order_date,
    status: payload.status,
    updated_at: updatedAt,
  };

  const purchaseOrdersTable = adminClient.from("purchase_orders") as unknown as {
    update: (
      values: Record<string, unknown>,
    ) => {
      eq: (column: string, value: string) => {
        select: (columns: string) => {
          single: () => Promise<{ data: unknown; error: { message: string } | null }>;
        };
      };
    };
  };

  const updateOrder = async (values: Record<string, unknown>) =>
    purchaseOrdersTable.update(values).eq("id", purchaseOrderId).select("*").single();

  const legacyValues = getLegacyPurchaseOrderValues(payload.items);
  const legacyUpdate = await updateOrder({
    ...baseValues,
    ...legacyValues,
  });

  if (!legacyUpdate.error) {
    return legacyUpdate.data as PurchaseOrderRow;
  }

  if (!isMissingPurchaseOrderColumnError(legacyUpdate.error)) {
    throw new Error(legacyUpdate.error.message);
  }

  const fallbackUpdate = await updateOrder(baseValues);

  if (fallbackUpdate.error) {
    throw new Error(fallbackUpdate.error.message);
  }

  return fallbackUpdate.data as PurchaseOrderRow;
}

async function savePurchaseOrderWithoutRpc({
  purchaseOrderId,
  payload,
  createdBy,
  performedBy,
}: {
  purchaseOrderId?: string;
  payload: PurchaseOrderPayload;
  createdBy: string;
  performedBy: string;
}) {
  const adminClient = createAdminSupabaseClient();
  const updatedAt = new Date().toISOString();
  const incomingItems = payload.items.map((item) => ({
    product_id: item.product_id,
    quantity: item.quantity,
  }));
  let previousOrder: PurchaseOrderRow | null = null;
  let previousItems: PurchaseOrderItemInput[] = [];
  let savedOrder: PurchaseOrderRow | null = null;

  if (purchaseOrderId) {
    const { data: orderData, error: orderError } = await adminClient
      .from("purchase_orders")
      .select("*")
      .eq("id", purchaseOrderId)
      .maybeSingle();

    if (orderError) {
      throw new Error(orderError.message);
    }

    previousOrder = orderData as LegacyPurchaseOrderRow | null;

    if (!previousOrder) {
      throw new Error(`Purchase order ${purchaseOrderId} not found`);
    }

    previousItems = await loadPurchaseOrderItemsWithoutRpc({
      adminClient,
      purchaseOrder: previousOrder,
    });

    await reconcilePurchaseOrderInventoryWithoutRpc({
      adminClient,
      purchaseOrderId,
      oldPoNumber: previousOrder.po_number,
      newPoNumber: payload.po_number,
      oldStatus: previousOrder.status,
      newStatus: payload.status,
      oldItems: previousItems,
      newItems: incomingItems,
      performedBy,
    });

    savedOrder = await updatePurchaseOrderRowWithoutRpc({
      adminClient,
      purchaseOrderId,
      payload,
      updatedAt,
    });

    const { error: deleteItemsError } = await adminClient
      .from("purchase_order_items")
      .delete()
      .eq("purchase_order_id", savedOrder.id);

    if (deleteItemsError && !isMissingPurchaseOrderItemsTableError(deleteItemsError)) {
      throw new Error(deleteItemsError.message);
    }
  } else {
    savedOrder = await insertPurchaseOrderRowWithoutRpc({
      adminClient,
      payload,
      createdBy,
    });
  }

  if (!savedOrder) {
    throw new Error("Purchase order could not be saved.");
  }

  const { error: insertItemsError } = await adminClient
    .from("purchase_order_items")
    .insert(
      incomingItems.map((item) => ({
        purchase_order_id: savedOrder!.id,
        product_id: item.product_id,
        quantity: item.quantity,
      })),
    );

  if (insertItemsError && !isMissingPurchaseOrderItemsTableError(insertItemsError)) {
    throw new Error(insertItemsError.message);
  }

  if (!purchaseOrderId) {
    await reconcilePurchaseOrderInventoryWithoutRpc({
      adminClient,
      purchaseOrderId: savedOrder.id,
      oldPoNumber: null,
      newPoNumber: savedOrder.po_number,
      oldStatus: "paid",
      newStatus: savedOrder.status,
      oldItems: [],
      newItems: incomingItems,
      performedBy,
    });
  }

  return savedOrder;
}

async function deletePurchaseOrderWithoutRpc({
  purchaseOrderId,
  performedBy,
}: {
  purchaseOrderId: string;
  performedBy: string;
}) {
  const adminClient = createAdminSupabaseClient();

  const { data: orderData } = await adminClient
    .from("purchase_orders")
    .select("*")
    .eq("id", purchaseOrderId)
    .maybeSingle();

  const purchaseOrder = orderData as LegacyPurchaseOrderRow | null;

  if (!purchaseOrder) {
    throw new Error(`Purchase order ${purchaseOrderId} not found`);
  }

  const orderItems = await loadPurchaseOrderItemsWithoutRpc({
    adminClient,
    purchaseOrder,
  });

  await reconcilePurchaseOrderInventoryWithoutRpc({
    adminClient,
    purchaseOrderId: purchaseOrder.id,
    oldPoNumber: purchaseOrder.po_number,
    newPoNumber: null,
    oldStatus: purchaseOrder.status,
    newStatus: "paid",
    oldItems: orderItems,
    newItems: [],
    performedBy,
  });

  const { error: deleteError } = await adminClient
    .from("purchase_orders")
    .delete()
    .eq("id", purchaseOrder.id);

  if (deleteError) {
    throw new Error(deleteError.message);
  }
}

export async function createPurchaseOrderAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);

  try {
    const parsed = purchaseOrderSchema.parse({
      po_number: String(formData.get("po_number") ?? ""),
      supplier: String(formData.get("supplier") ?? ""),
      order_date: String(formData.get("order_date") ?? ""),
      status: String(formData.get("status") ?? "paid"),
      items: extractPurchaseOrderItems(formData),
    });

    try {
      const { error } = await runRpc("save_purchase_order", {
        p_po_number: parsed.po_number,
        p_supplier: parsed.supplier,
        p_order_date: parsed.order_date,
        p_status: parsed.status,
        p_items: parsed.items,
        p_created_by: profile.id,
      });

      if (isMissingRpcFunction(error, "save_purchase_order")) {
        await savePurchaseOrderWithoutRpc({
          payload: parsed,
          createdBy: profile.id,
          performedBy: profile.id,
        });
      } else if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      if (isMissingRpcFunction(error, "save_purchase_order")) {
        await savePurchaseOrderWithoutRpc({
          payload: parsed,
          createdBy: profile.id,
          performedBy: profile.id,
        });
      } else {
        throw error;
      }
    }

    revalidatePurchaseOrderPaths();
  } catch (error) {
    redirectToPurchaseOrdersError(error);
  }
}

export async function updatePurchaseOrderAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);

  try {
    const id = String(formData.get("id") ?? "");
    const parsed = purchaseOrderSchema.parse({
      po_number: String(formData.get("po_number") ?? ""),
      supplier: String(formData.get("supplier") ?? ""),
      order_date: String(formData.get("order_date") ?? ""),
      status: String(formData.get("status") ?? "paid"),
      items: extractPurchaseOrderItems(formData),
    });

    try {
      const { error } = await runRpc("save_purchase_order", {
        p_purchase_order_id: id,
        p_po_number: parsed.po_number,
        p_supplier: parsed.supplier,
        p_order_date: parsed.order_date,
        p_status: parsed.status,
        p_items: parsed.items,
      });

      if (isMissingRpcFunction(error, "save_purchase_order")) {
        await savePurchaseOrderWithoutRpc({
          purchaseOrderId: id,
          payload: parsed,
          createdBy: profile.id,
          performedBy: profile.id,
        });
      } else if (error) {
        throw new Error(error.message);
      }
    } catch (error) {
      if (isMissingRpcFunction(error, "save_purchase_order")) {
        await savePurchaseOrderWithoutRpc({
          purchaseOrderId: id,
          payload: parsed,
          createdBy: profile.id,
          performedBy: profile.id,
        });
      } else {
        throw error;
      }
    }

    revalidatePurchaseOrderPaths();
  } catch (error) {
    redirectToPurchaseOrdersError(error);
  }
}

export async function updatePurchaseOrderStatusAction(formData: FormData) {
  const { supabase } = await requirePortalUser("operator");
  const runRpc = rpcMutation(supabase);

  try {
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
  } catch (error) {
    redirectToPurchaseOrdersError(error);
  }
}

export async function deletePurchaseOrderAction(formData: FormData) {
  const { supabase, profile } = await requirePortalUser("admin");
  const runRpc = rpcMutation(supabase);

  try {
    const id = String(formData.get("id") ?? "");
    let rpcError: { message: string } | null = null;

    try {
      const result = await runRpc("delete_purchase_order", {
        p_purchase_order_id: id,
      });

      rpcError = result.error;
    } catch (error) {
      if (isMissingRpcFunction(error, "delete_purchase_order")) {
        await deletePurchaseOrderWithoutRpc({
          purchaseOrderId: id,
          performedBy: profile.id,
        });
        revalidatePurchaseOrderPaths();
        return;
      }

      throw error;
    }

    if (isMissingRpcFunction(rpcError, "delete_purchase_order")) {
      await deletePurchaseOrderWithoutRpc({
        purchaseOrderId: id,
        performedBy: profile.id,
      });
    } else if (rpcError) {
      throw new Error(rpcError.message);
    }

    revalidatePurchaseOrderPaths();
  } catch (error) {
    redirectToPurchaseOrdersError(error);
  }
}
