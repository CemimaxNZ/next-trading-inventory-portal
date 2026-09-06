import type { ProductRow, PurchaseOrderItemRow, PurchaseOrderRow } from "@/lib/database.types";
import {
  applyComputedInTransitToProducts,
  buildLegacyPurchaseOrderItems,
  buildProductInTransitMap,
  type LegacyPurchaseOrderLike,
  type PurchaseOrderItemLike,

} from "@/lib/purchase-orders";
import { buildReportFilename, csvDownloadResponse } from "@/lib/reports";
import { requirePortalUser } from "@/lib/session";
import { formatEnumLabel } from "@/lib/utils";

export async function GET() {
  const { supabase, profile } = await requirePortalUser();
  const [{ data: productsData }, { data: purchaseOrdersData }, { data: orderItemsData, error: orderItemsError }] =
    await Promise.all([
      supabase.from("products").select("*").order("category").order("name"),
      supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
      supabase.from("purchase_order_items").select("purchase_order_id, product_id, quantity"),
    ]);

  const products = (productsData ?? []) as ProductRow[];
  const purchaseOrders = (purchaseOrdersData ?? []) as LegacyPurchaseOrderLike[];
  const orderItems = (orderItemsData ?? []) as PurchaseOrderItemRow[];
  const fallbackItems: PurchaseOrderItemLike[] = orderItemsError
    ? purchaseOrders.flatMap((purchaseOrder) => buildLegacyPurchaseOrderItems(purchaseOrder))
    : orderItems;
  const inTransitByProductId = buildProductInTransitMap(
    purchaseOrders as Pick<PurchaseOrderRow, "id" | "status">[],
    fallbackItems,
  );
  const productsWithComputedInTransit = applyComputedInTransitToProducts(
    products,
    inTransitByProductId,
  );
  const isAdmin = profile.role === "admin";
  const header = [
    "Category",
    "SKU",
    "Product Name",
    "Current Stock",
    "In Transit",
    ...(isAdmin ? ["Low Stock Warning Level"] : []),
    "Status",
  ];
  const rows = productsWithComputedInTransit.map((product) => [
    formatEnumLabel(product.category),
    product.sku,
    product.name,
    product.current_stock,
    product.in_transit_stock,
    ...(isAdmin ? [product.low_stock_warning_level] : []),
    product.current_stock <= product.low_stock_warning_level ? "Low Stock" : "OK",
  ]);

  return csvDownloadResponse(buildReportFilename("current-stock"), [header, ...rows]);

}
