import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const IN_TRANSIT_STATUSES = new Set(["paid", "ready", "shipped"]);

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const entries = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}

function getShipmentOrderIds(shipment) {
  if (Array.isArray(shipment.linked_purchase_order_ids) && shipment.linked_purchase_order_ids.length > 0) {
    return shipment.linked_purchase_order_ids;
  }

  return shipment.linked_purchase_order_id ? [shipment.linked_purchase_order_id] : [];
}

function groupOrderItemsByPurchaseOrder(orderItems) {
  const grouped = new Map();

  for (const item of orderItems) {
    const existing = grouped.get(item.purchase_order_id) ?? [];
    existing.push(item);
    grouped.set(item.purchase_order_id, existing);
  }

  return grouped;
}

function buildExistingInTransitTotals({
  orderItems,
  statusByPurchaseOrderId,
  purchaseOrderId,
  productIds,
}) {
  const productIdSet = new Set(productIds);
  const totals = new Map();

  for (const item of orderItems) {
    if (item.purchase_order_id === purchaseOrderId || !productIdSet.has(item.product_id)) {
      continue;
    }

    const status = statusByPurchaseOrderId.get(item.purchase_order_id);

    if (!status || !IN_TRANSIT_STATUSES.has(status)) {
      continue;
    }

    totals.set(item.product_id, (totals.get(item.product_id) ?? 0) + item.quantity);
  }

  return totals;
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local was not found in the project root.");
  }

  const env = loadEnvFile(envPath);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing from .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: shipmentsData, error: shipmentsError } = await supabase
    .from("shipments")
    .select("id, container_number, arrival_status, linked_purchase_order_id, linked_purchase_order_ids")
    .in("arrival_status", ["arrived", "completed"]);

  if (shipmentsError) {
    throw new Error(`Could not load shipments: ${shipmentsError.message}`);
  }

  const shipments = shipmentsData ?? [];
  const linkedOrderIds = [...new Set(shipments.flatMap(getShipmentOrderIds))];

  if (linkedOrderIds.length === 0) {
    console.log("No arrived shipments with linked purchase orders were found.");
    return;
  }

  const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status")
    .in("id", linkedOrderIds);

  if (purchaseOrdersError) {
    throw new Error(`Could not load purchase orders: ${purchaseOrdersError.message}`);
  }

  const purchaseOrders = purchaseOrdersData ?? [];
  const notArrivedOrders = purchaseOrders.filter((purchaseOrder) => purchaseOrder.status !== "arrived");

  if (notArrivedOrders.length === 0) {
    console.log("All linked purchase orders are already marked as arrived.");
    return;
  }

  const repairableOrders = notArrivedOrders.filter((purchaseOrder) =>
    IN_TRANSIT_STATUSES.has(purchaseOrder.status),
  );

  if (repairableOrders.length === 0) {
    console.log("No linked purchase orders are in a repairable in-transit status.");
    return;
  }

  const { data: orderItemsData, error: orderItemsError } = await supabase
    .from("purchase_order_items")
    .select("purchase_order_id, product_id, quantity")
    .in("purchase_order_id", repairableOrders.map((purchaseOrder) => purchaseOrder.id));

  if (orderItemsError) {
    throw new Error(`Could not load purchase order items: ${orderItemsError.message}`);
  }

  const orderItems = orderItemsData ?? [];
  const itemsByPurchaseOrderId = groupOrderItemsByPurchaseOrder(orderItems);
  const productIds = [...new Set(orderItems.map((item) => item.product_id))];
  const purchaseOrderStatusById = new Map(
    purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder.status]),
  );

  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("id, name, current_stock, in_transit_stock")
    .in("id", productIds);

  if (productsError) {
    throw new Error(`Could not load products: ${productsError.message}`);
  }

  const { data: relatedOrderItemsData, error: relatedOrderItemsError } = await supabase
    .from("purchase_order_items")
    .select("purchase_order_id, product_id, quantity")
    .in("product_id", productIds);

  if (relatedOrderItemsError) {
    throw new Error(`Could not load related in-transit order items: ${relatedOrderItemsError.message}`);
  }

  const relatedOrderItems = relatedOrderItemsData ?? [];
  const relatedPurchaseOrderIds = [
    ...new Set(relatedOrderItems.map((item) => item.purchase_order_id).filter(Boolean)),
  ];

  if (relatedPurchaseOrderIds.length > 0) {
    const { data: relatedPurchaseOrdersData, error: relatedPurchaseOrdersError } = await supabase
      .from("purchase_orders")
      .select("id, status")
      .in("id", relatedPurchaseOrderIds);

    if (relatedPurchaseOrdersError) {
      throw new Error(`Could not load related purchase orders: ${relatedPurchaseOrdersError.message}`);
    }

    for (const purchaseOrder of relatedPurchaseOrdersData ?? []) {
      purchaseOrderStatusById.set(purchaseOrder.id, purchaseOrder.status);
    }
  }

  const productMap = new Map((productsData ?? []).map((product) => [product.id, { ...product }]));
  const updatedPoNumbers = [];

  for (const purchaseOrder of repairableOrders) {
    const items = itemsByPurchaseOrderId.get(purchaseOrder.id) ?? [];

    if (items.length === 0) {
      console.log(`Skipped ${purchaseOrder.po_number}: no purchase order items were found.`);
      continue;
    }

    const recalculatedInTransitTotals = buildExistingInTransitTotals({
      orderItems: relatedOrderItems,
      statusByPurchaseOrderId: purchaseOrderStatusById,
      purchaseOrderId: purchaseOrder.id,
      productIds: items.map((item) => item.product_id),
    });

    for (const item of items) {
      const product = productMap.get(item.product_id);

      if (!product) {
        throw new Error(`Could not find product ${item.product_id} for PO ${purchaseOrder.po_number}.`);
      }

      const nextCurrentStock = product.current_stock + item.quantity;
      const nextInTransitStock = recalculatedInTransitTotals.get(item.product_id) ?? 0;

      const { error: productUpdateError } = await supabase
        .from("products")
        .update({
          current_stock: nextCurrentStock,
          in_transit_stock: nextInTransitStock,
          updated_at: new Date().toISOString(),
        })
        .eq("id", product.id);

      if (productUpdateError) {
        throw new Error(`Could not update product ${product.name}: ${productUpdateError.message}`);
      }

      product.current_stock = nextCurrentStock;
      product.in_transit_stock = nextInTransitStock;
    }

    const { error: purchaseOrderUpdateError } = await supabase
      .from("purchase_orders")
      .update({
        status: "arrived",
        updated_at: new Date().toISOString(),
      })
      .eq("id", purchaseOrder.id);

    if (purchaseOrderUpdateError) {
      throw new Error(`Could not update PO ${purchaseOrder.po_number}: ${purchaseOrderUpdateError.message}`);
    }

    purchaseOrderStatusById.set(purchaseOrder.id, "arrived");

    const transactionRows = items.map((item) => ({
      product_id: item.product_id,
      quantity: item.quantity,
      type: "purchase_order_arrived",
      reason: `PO ${purchaseOrder.po_number} marked as arrived`,
      reference_table: "purchase_orders",
      reference_id: purchaseOrder.id,
      performed_by: null,
    }));

    const { error: transactionError } = await supabase
      .from("inventory_transactions")
      .insert(transactionRows);

    if (transactionError) {
      throw new Error(`Could not record transactions for PO ${purchaseOrder.po_number}: ${transactionError.message}`);
    }

    updatedPoNumbers.push(purchaseOrder.po_number);
  }

  console.log(`Updated ${updatedPoNumbers.length} purchase order(s) to Arrived.`);
  console.log(updatedPoNumbers.join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
