import type {
  InventoryTransactionRow,
  ProductRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  ShipmentRow,
} from "@/lib/database.types";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  applyComputedInTransitToProducts,
  buildLegacyPurchaseOrderItems,
  buildProductInTransitMap,
  type LegacyPurchaseOrderLike,
  type PurchaseOrderItemLike,
} from "@/lib/purchase-orders";
import { formatDate, formatEnumLabel } from "@/lib/utils";

export type WeeklyReportData = {
  periodStart: string;
  periodEnd: string;
  products: ProductRow[];
  purchaseOrders: PurchaseOrderRow[];
  shipments: ShipmentRow[];
  transactions: InventoryTransactionRow[];
  inTransitProducts: ProductRow[];
  lowStockProducts: ProductRow[];
};

export type WeeklyReportSupabaseClient = Pick<SupabaseClient, "from">;

export function getWeeklyPeriod(endDate = new Date()) {
  const end = new Date(endDate);
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  return {
    start,
    end,
    periodStart: start.toISOString(),
    periodEnd: end.toISOString(),
  };
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function getEmailRecipients() {
  return process.env.WEEKLY_REPORT_RECIPIENTS?.split(",")
    .map((email) => email.trim())
    .filter(Boolean) ?? [];
}

export async function loadWeeklyReportData(
  supabase: WeeklyReportSupabaseClient,
  referenceDate = new Date(),
): Promise<WeeklyReportData> {
  const { periodStart, periodEnd } = getWeeklyPeriod(referenceDate);
  const [
    { data: productsData },
    { data: purchaseOrdersData },
    { data: shipmentsData },
    { data: transactionsData },
    { data: orderItemsData, error: orderItemsError },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
    supabase.from("shipments").select("*").order("eta", { ascending: false }),
    supabase
      .from("inventory_transactions")
      .select("*")
      .gte("created_at", periodStart)
      .lte("created_at", periodEnd)
      .order("created_at", { ascending: false }),
    supabase.from("purchase_order_items").select("purchase_order_id, product_id, quantity"),
  ]);

  const products = (productsData ?? []) as ProductRow[];
  const purchaseOrders = (purchaseOrdersData ?? []) as PurchaseOrderRow[];
  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const transactions = (transactionsData ?? []) as InventoryTransactionRow[];
  const orderItems = (orderItemsData ?? []) as PurchaseOrderItemRow[];
  const fallbackItems: PurchaseOrderItemLike[] = orderItemsError
    ? purchaseOrders.flatMap((purchaseOrder) =>
        buildLegacyPurchaseOrderItems(purchaseOrder as LegacyPurchaseOrderLike),
      )
    : orderItems;
  const inTransitByProductId = buildProductInTransitMap(
    purchaseOrders,
    fallbackItems,
  );
  const inTransitProducts = applyComputedInTransitToProducts(products, inTransitByProductId);
  const lowStockProducts = inTransitProducts.filter(
    (product) => product.current_stock <= product.low_stock_warning_level,
  );

  return {
    periodStart,
    periodEnd,
    products,
    purchaseOrders,
    shipments,
    transactions,
    inTransitProducts,
    lowStockProducts,
  };
}

export function buildWeeklyReportHtml(data: WeeklyReportData) {
  const arrivedPOs = data.purchaseOrders.filter(
    (purchaseOrder) =>
      purchaseOrder.status === "arrived"
      && purchaseOrder.updated_at >= data.periodStart
      && purchaseOrder.updated_at <= data.periodEnd,
  );
  const arrivedShipments = data.shipments.filter(
    (shipment) =>
      (shipment.arrival_status === "arrived" || shipment.arrival_status === "completed")
      && shipment.updated_at >= data.periodStart
      && shipment.updated_at <= data.periodEnd,
  );
  const inboundCount = data.transactions.filter((transaction) =>
    transaction.quantity > 0
      && (transaction.type === "purchase_order_arrived" || transaction.type === "shipment_arrived"),
  ).length;
  const outboundCount = data.transactions.filter((transaction) =>
    transaction.quantity < 0
      && (transaction.type === "manual_remove" || transaction.type === "purchase_order_reversed" || transaction.type === "shipment_reversed"),
  ).length;

  const lowStockList = data.lowStockProducts.slice(0, 5).map(
    (product) =>
      `<li>${escapeHtml(product.sku)} - ${escapeHtml(product.name)} (${product.current_stock})</li>`,
  ).join("");
  const arrivedPOList = arrivedPOs.map(
    (purchaseOrder) =>
      `<li><strong>${escapeHtml(purchaseOrder.po_number)}</strong> · ${escapeHtml(purchaseOrder.supplier)} · ${formatDate(purchaseOrder.updated_at)}</li>`,
  ).join("");
  const arrivedShipmentList = arrivedShipments.map(
    (shipment) =>
      `<li><strong>${escapeHtml(shipment.container_number)}</strong> · ${formatEnumLabel(shipment.arrival_status)} · ${formatDate(shipment.updated_at)}</li>`,
  ).join("");

  return `
    <div style="font-family:Arial,sans-serif;line-height:1.6;color:#0f172a">
      <h2 style="margin:0 0 12px">Weekly Inventory Report</h2>
      <p style="margin:0 0 20px">Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}</p>
      <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:20px">
        <div style="padding:12px 16px;border:1px solid #dbeafe;border-radius:14px"><strong>${arrivedPOs.length}</strong><br/>Arrived POs</div>
        <div style="padding:12px 16px;border:1px solid #dbeafe;border-radius:14px"><strong>${arrivedShipments.length}</strong><br/>Arrived Shipments</div>
        <div style="padding:12px 16px;border:1px solid #dbeafe;border-radius:14px"><strong>${inboundCount}</strong><br/>Inbound Moves</div>
        <div style="padding:12px 16px;border:1px solid #dbeafe;border-radius:14px"><strong>${outboundCount}</strong><br/>Outbound Moves</div>
        <div style="padding:12px 16px;border:1px solid #dbeafe;border-radius:14px"><strong>${data.lowStockProducts.length}</strong><br/>Low Stock Items</div>
      </div>
      <p style="margin:0 0 8px"><strong>Current stock:</strong> ${data.products.reduce((total, product) => total + product.current_stock, 0)}</p>
      <p style="margin:0 0 20px"><strong>In transit:</strong> ${data.inTransitProducts.reduce((total, product) => total + product.in_transit_stock, 0)}</p>
      <h3>Arrivals This Week</h3>
      <p style="margin:0 0 6px"><strong>Purchase Orders</strong></p>
      <ul>${arrivedPOList || "<li>No purchase orders arrived this week.</li>"}</ul>
      <p style="margin:16px 0 6px"><strong>Shipments</strong></p>
      <ul>${arrivedShipmentList || "<li>No shipments arrived this week.</li>"}</ul>
      <h3>Low Stock Watchlist</h3>
      <ul>${lowStockList || "<li>No low stock items this week.</li>"}</ul>
    </div>
  `;
}

export function buildWeeklyReportText(data: WeeklyReportData) {
  const arrivedPOs = data.purchaseOrders.filter(
    (purchaseOrder) =>
      purchaseOrder.status === "arrived"
      && purchaseOrder.updated_at >= data.periodStart
      && purchaseOrder.updated_at <= data.periodEnd,
  );
  const arrivedShipments = data.shipments.filter(
    (shipment) =>
      (shipment.arrival_status === "arrived" || shipment.arrival_status === "completed")
      && shipment.updated_at >= data.periodStart
      && shipment.updated_at <= data.periodEnd,
  );
  const inboundCount = data.transactions.filter((transaction) =>
    transaction.quantity > 0
      && (transaction.type === "purchase_order_arrived" || transaction.type === "shipment_arrived"),
  ).length;
  const outboundCount = data.transactions.filter((transaction) =>
    transaction.quantity < 0
      && (transaction.type === "manual_remove" || transaction.type === "purchase_order_reversed" || transaction.type === "shipment_reversed"),
  ).length;

  return [
    "Weekly Inventory Report",
    `Period: ${formatDate(data.periodStart)} - ${formatDate(data.periodEnd)}`,
    `Arrived POs: ${arrivedPOs.length}`,
    `Arrived Shipments: ${arrivedShipments.length}`,
    `Inbound Moves: ${inboundCount}`,
    `Outbound Moves: ${outboundCount}`,
    `Low Stock Items: ${data.lowStockProducts.length}`,
    `Current Stock: ${data.products.reduce((total, product) => total + product.current_stock, 0)}`,
    `In Transit: ${data.inTransitProducts.reduce((total, product) => total + product.in_transit_stock, 0)}`,
    "",
    "Arrivals This Week:",
    "Purchase Orders:",
    ...(
      arrivedPOs.length > 0
        ? arrivedPOs.map((purchaseOrder) =>
            `- ${purchaseOrder.po_number} - ${purchaseOrder.supplier} (${formatDate(purchaseOrder.updated_at)})`,
          )
        : ["- None"]
    ),
    "Shipments:",
    ...(
      arrivedShipments.length > 0
        ? arrivedShipments.map((shipment) =>
            `- ${shipment.container_number} - ${formatEnumLabel(shipment.arrival_status)} (${formatDate(shipment.updated_at)})`,
          )
        : ["- None"]
    ),
    "",
    "Top Low Stock Items:",
    ...data.lowStockProducts.slice(0, 5).map((product) => `- ${product.sku} - ${product.name} (${product.current_stock})`),
  ].join("\n");
}

export function getProductCategoryLabel(value: ProductRow["category"]) {
  return formatEnumLabel(value);
}
