import type {
  ProductRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
} from "@/lib/database.types";

export type PurchaseOrderStatusValue = PurchaseOrderRow["status"];
export type PurchaseOrderDisplayStatus = Exclude<PurchaseOrderStatusValue, "ready">;

export type PurchaseOrderLike = Pick<PurchaseOrderRow, "id" | "status">;
export type PurchaseOrderItemLike = Pick<
  PurchaseOrderItemRow,
  "purchase_order_id" | "product_id" | "quantity"
>;
export type LegacyPurchaseOrderLike = PurchaseOrderLike & {
  product_id?: string | null;
  quantity?: number | null;
};

export function normalizePurchaseOrderStatus(
  status: PurchaseOrderStatusValue,
): PurchaseOrderDisplayStatus {
  return status === "ready" ? "paid" : status;
}

export function countsTowardInTransit(status: PurchaseOrderStatusValue) {
  const normalizedStatus = normalizePurchaseOrderStatus(status);

  return normalizedStatus === "paid" || normalizedStatus === "shipped";
}

export function countsTowardCurrentStock(status: PurchaseOrderStatusValue) {
  return normalizePurchaseOrderStatus(status) === "arrived";
}

export function buildLegacyPurchaseOrderItems(
  purchaseOrder: LegacyPurchaseOrderLike,
): PurchaseOrderItemLike[] {
  if (
    !purchaseOrder.product_id
    || typeof purchaseOrder.quantity !== "number"
    || purchaseOrder.quantity <= 0
  ) {
    return [];
  }

  return [
    {
      purchase_order_id: purchaseOrder.id,
      product_id: purchaseOrder.product_id,
      quantity: purchaseOrder.quantity,
    },
  ];
}

export function buildProductInTransitMap(
  purchaseOrders: PurchaseOrderLike[],
  orderItems: PurchaseOrderItemLike[],
) {
  const statusByOrderId = new Map(
    purchaseOrders.map((purchaseOrder) => [purchaseOrder.id, purchaseOrder.status]),
  );
  const quantitiesByProductId = new Map<string, number>();

  for (const item of orderItems) {
    const orderStatus = statusByOrderId.get(item.purchase_order_id);

    if (!orderStatus || !countsTowardInTransit(orderStatus)) {
      continue;
    }

    quantitiesByProductId.set(
      item.product_id,
      (quantitiesByProductId.get(item.product_id) ?? 0) + item.quantity,
    );
  }

  return quantitiesByProductId;
}

export function applyComputedInTransitToProducts(
  products: ProductRow[],
  inTransitByProductId: Map<string, number>,
) {
  return products.map((product) => ({
    ...product,
    in_transit_stock: inTransitByProductId.get(product.id) ?? 0,
  }));
}
