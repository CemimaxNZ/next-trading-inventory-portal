import Link from "next/link";
import { Search } from "lucide-react";
import { updatePurchaseOrderStatusAction } from "@/app/actions/purchase-orders";
import { PurchaseOrderHighlight } from "@/components/purchase-orders/purchase-order-highlight";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { purchaseOrderStatuses } from "@/lib/constants";
import type { ProductRow, PurchaseOrderItemRow, PurchaseOrderRow } from "@/lib/database.types";
import { canUpdateOperationalStatus } from "@/lib/permissions";
import {
  buildLegacyPurchaseOrderItems,
  normalizePurchaseOrderStatus,
} from "@/lib/purchase-orders";
import { requirePortalUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

type PurchaseOrderHistoryPageProps = {
  searchParams?: Promise<{
    highlight?: string;
    query?: string;
  }>;
};

type LegacyPurchaseOrderRow = PurchaseOrderRow & {
  product_id?: string | null;
  quantity?: number | null;
};

type PurchaseOrderDisplayItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
};

function matchesPurchaseOrderItemQuery(
  item: PurchaseOrderDisplayItem,
  query: string,
  productMap: Map<string, ProductRow>,
) {
  if (!query) {
    return true;
  }

  const product = productMap.get(item.product_id);
  const searchText = [product?.name ?? "", product?.sku ?? ""].join(" ").toLowerCase();

  return searchText.includes(query);
}

function isMissingPurchaseOrderItemsTableError(message: string | undefined) {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not find the table 'public.purchase_order_items' in the schema cache")
    || message.includes('relation "public.purchase_order_items" does not exist')
    || message.includes('relation "purchase_order_items" does not exist')
  );
}

export default async function PurchaseOrderHistoryPage({
  searchParams,
}: PurchaseOrderHistoryPageProps) {
  const { supabase, profile } = await requirePortalUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const highlightedOrderId = resolvedSearchParams?.highlight;
  const query = resolvedSearchParams?.query?.trim().toLowerCase() ?? "";
  const [{ data: ordersData }, { data: productsData }, { data: orderItemsData, error: orderItemsError }] = await Promise.all([
    supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
    supabase.from("products").select("*").order("name"),
    supabase.from("purchase_order_items").select("*"),
  ]);

  const purchaseOrders = (ordersData ?? []) as LegacyPurchaseOrderRow[];
  const products = (productsData ?? []) as ProductRow[];
  const orderItems = (orderItemsData ?? []) as PurchaseOrderItemRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderItemsMap = new Map<string, PurchaseOrderDisplayItem[]>();
  const totalQuantityByOrder = new Map<string, number>();
  const useLegacyItems = isMissingPurchaseOrderItemsTableError(orderItemsError?.message);

  if (useLegacyItems) {
    for (const purchaseOrder of purchaseOrders) {
      const items = buildLegacyPurchaseOrderItems(purchaseOrder).map((item) => ({
        ...item,
        id: `legacy-${purchaseOrder.id}`,
      }));
      orderItemsMap.set(purchaseOrder.id, items);
      totalQuantityByOrder.set(
        purchaseOrder.id,
        items.reduce((sum, item) => sum + item.quantity, 0),
      );
    }
  } else {
    for (const item of orderItems) {
      const existingItems = orderItemsMap.get(item.purchase_order_id) ?? [];
      existingItems.push(item);
      orderItemsMap.set(item.purchase_order_id, existingItems);
      totalQuantityByOrder.set(
        item.purchase_order_id,
        (totalQuantityByOrder.get(item.purchase_order_id) ?? 0) + item.quantity,
      );
    }
  }

  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const historyPurchaseOrders = purchaseOrders
    .filter((purchaseOrder) => normalizePurchaseOrderStatus(purchaseOrder.status) === "arrived")
    .filter((purchaseOrder) => {
      if (!query) {
        return true;
      }

      const items = orderItemsMap.get(purchaseOrder.id) ?? [];

      return items.some((item) => matchesPurchaseOrderItemQuery(item, query, productMap));
    });

  return (
    <>
      <PurchaseOrderHighlight orderId={highlightedOrderId} />

      <PageHeader
        description="View all arrived purchase orders in one separate history page."
        title="Purchase Order History"
      />

      <SectionCard
        description="Arrived purchase orders are stored here so the main list stays shorter."
        headerAside={(
          <Link className="btn-secondary whitespace-nowrap" href="/purchase-orders">
            Back to PO List
          </Link>
        )}
        title="History"
      >
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <form className="relative max-w-xl flex-1" method="get">
            {highlightedOrderId ? <input name="highlight" type="hidden" value={highlightedOrderId} /> : null}
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              aria-label="Search purchase order history by product or SKU"
              className="input-field pl-11"
              defaultValue={resolvedSearchParams?.query ?? ""}
              name="query"
              placeholder="Search history by product or SKU"
              type="search"
            />
          </form>
          <p className="text-sm text-slate-500 lg:text-right">
            Arrived purchase orders: {historyPurchaseOrders.length}
          </p>
        </div>

        <div className="space-y-3">
          {historyPurchaseOrders.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              {query ? "No arrived purchase orders match that product or SKU." : "No arrived purchase orders yet."}
            </div>
          ) : (
            historyPurchaseOrders.map((purchaseOrder) => {
              const items = orderItemsMap.get(purchaseOrder.id) ?? [];
              const visibleItems = items.filter((item) =>
                matchesPurchaseOrderItemQuery(item, query, productMap),
              );
              const quantity = query
                ? visibleItems.reduce((sum, item) => sum + item.quantity, 0)
                : (totalQuantityByOrder.get(purchaseOrder.id) ?? 0);
              const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

              return (
                <article
                  className={`scroll-mt-24 rounded-3xl border p-4 shadow-sm transition ${
                    highlightedOrderId === purchaseOrder.id
                      ? "border-brand-300 bg-brand-50/50 ring-2 ring-brand-100"
                      : "border-slate-200 bg-white"
                  }`}
                  data-po-anchor={purchaseOrder.id}
                  key={purchaseOrder.id}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{purchaseOrder.po_number}</p>
                      <p className="mt-1 text-xs text-slate-500">
                        {purchaseOrder.supplier} • {formatDate(purchaseOrder.order_date)}
                      </p>
                    </div>
                    <StatusBadge value={displayStatus} />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Quantity</p>
                      <p className="mt-1 text-sm font-semibold text-slate-950">{quantity}</p>
                    </div>
                    <div className="rounded-2xl bg-slate-50 px-3 py-3">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Products</p>
                      <div className="mt-1 space-y-1 text-sm text-slate-700">
                        {(visibleItems.length > 0 ? visibleItems : items.slice(0, 3)).map((item) => {
                          const product = productMap.get(item.product_id);

                          return (
                            <p key={item.id}>
                              {product?.name ?? "Unknown product"} • Qty {item.quantity}
                            </p>
                          );
                        })}
                        {(query ? visibleItems.length : items.length) === 0 ? (
                          <p className="text-slate-500">No product lines saved yet.</p>
                        ) : null}
                      </div>
                    </div>
                  </div>

                  {canUpdateStatus ? (
                    <form action={updatePurchaseOrderStatusAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                      <input name="id" type="hidden" value={purchaseOrder.id} />
                      <select className="input-field min-w-0 flex-1 py-2" defaultValue={displayStatus} name="status">
                        {purchaseOrderStatuses.map((status) => (
                          <option key={status} value={status}>
                            {status.replace("_", " ").toUpperCase()}
                          </option>
                        ))}
                      </select>
                      <SubmitButton className="btn-secondary justify-center" pendingLabel="Saving...">
                        Update
                      </SubmitButton>
                    </form>
                  ) : null}
                </article>
              );
            })
          )}
        </div>
      </SectionCard>
    </>
  );
}
