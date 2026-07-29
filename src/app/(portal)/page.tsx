import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  ProductRow,
  PurchaseOrderItemRow,
  PurchaseOrderRow,
  ShipmentRow,
} from "@/lib/database.types";
import {
  applyComputedInTransitToProducts,
  buildLegacyPurchaseOrderItems,
  buildProductInTransitMap,
  type LegacyPurchaseOrderLike,
  type PurchaseOrderItemLike,
} from "@/lib/purchase-orders";
import { requirePortalUser } from "@/lib/session";

export default async function DashboardPage() {
  const { supabase, profile } = await requirePortalUser();

  const [
    { data: productsData },
    { data: shipmentsData },
    { data: purchaseOrdersData },
    { data: orderItemsData, error: orderItemsError },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("shipments").select("*"),
    supabase.from("purchase_orders").select("id, status"),
    supabase.from("purchase_order_items").select("purchase_order_id, product_id, quantity"),
  ]);

  const products = (productsData ?? []) as ProductRow[];
  const shipments = (shipmentsData ?? []) as ShipmentRow[];
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
  const lowStockProducts = productsWithComputedInTransit.filter(
    (product) => product.current_stock <= product.low_stock_warning_level,
  );
  const visibleLowStockProducts = lowStockProducts.slice(0, 5);
  const extraLowStockProducts = lowStockProducts.slice(5);

  return (
    <>
      <PageHeader
        description={`Welcome back, ${profile.full_name}. Here’s today’s inventory snapshot for the internal team.`}
        title="Dashboard"
      />

      <SectionCard
        description="Products that may need replenishment soon."
        title="Low Stock Watchlist"
      >
        <div className="space-y-4 md:hidden">
          {visibleLowStockProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No low-stock items right now.
            </div>
          ) : (
            visibleLowStockProducts.map((product) => (
              <article
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                key={product.id}
              >
                <div>
                  <p className="text-base font-semibold text-slate-950">{product.name}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Current</p>
                    <p className="mt-1 font-semibold text-rose-700">{product.current_stock}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">In Transit</p>
                    <p className="mt-1 text-slate-700">{product.in_transit_stock}</p>
                  </div>
                </div>
              </article>
            ))
          )}

          {extraLowStockProducts.length > 0 ? (
            <details className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                Show {extraLowStockProducts.length} more items
              </summary>
              <div className="mt-4 space-y-4">
                {extraLowStockProducts.map((product) => (
                  <article
                    className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4"
                    key={product.id}
                  >
                    <div>
                      <p className="text-base font-semibold text-slate-950">{product.name}</p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Current</p>
                        <p className="mt-1 font-semibold text-rose-700">{product.current_stock}</p>
                      </div>
                      <div className="rounded-2xl bg-white px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">In Transit</p>
                        <p className="mt-1 text-slate-700">{product.in_transit_stock}</p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[62%]" />
              <col className="w-[19%]" />
              <col className="w-[19%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium text-left">Product</th>
                <th className="px-3 pb-3 font-medium text-center">Current</th>
                <th className="px-3 pb-3 font-medium text-center">In Transit</th>
              </tr>
            </thead>
            <tbody>
              {visibleLowStockProducts.length === 0 ? (
                <tr>
                  <td className="pt-4 text-slate-500" colSpan={3}>
                    No low-stock items right now.
                  </td>
                </tr>
              ) : (
                visibleLowStockProducts.map((product) => (
                  <tr className="border-b border-slate-100 last:border-b-0" key={product.id}>
                    <td className="py-4 font-medium text-slate-900">{product.name}</td>
                    <td className="px-3 py-4 text-center text-rose-700">{product.current_stock}</td>
                    <td className="px-3 py-4 text-center text-slate-600">{product.in_transit_stock}</td>
                  </tr>
                ))
              )}
              {extraLowStockProducts.length > 0 ? (
                <tr>
                  <td className="pt-4" colSpan={3}>
                    <details className="rounded-2xl border border-slate-200 bg-white p-4">
                      <summary className="cursor-pointer text-sm font-medium text-brand-700">
                        Show {extraLowStockProducts.length} more items
                      </summary>
                      <div className="mt-4 overflow-x-auto">
                        <table className="min-w-full table-fixed text-left text-sm">
                          <colgroup>
                            <col className="w-[62%]" />
                            <col className="w-[19%]" />
                            <col className="w-[19%]" />
                          </colgroup>
                          <tbody>
                            {extraLowStockProducts.map((product) => (
                              <tr className="border-b border-slate-100 last:border-b-0" key={product.id}>
                                <td className="py-3 pr-4 font-medium text-slate-900">{product.name}</td>
                                <td className="px-3 py-3 text-center text-rose-700">{product.current_stock}</td>
                                <td className="px-3 py-3 text-center text-slate-600">{product.in_transit_stock}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </details>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>

      <SectionCard
        description="Shipment arrivals directly affect in-transit and on-hand counts."
        title="Shipment Overview"
      >
        <div className="grid gap-4 md:grid-cols-3">
          {(["scheduled", "at_sea", "arrived"] as ShipmentRow["arrival_status"][]).map((status) => {
            const count = shipments.filter((shipment) =>
              status === "arrived"
                ? shipment.arrival_status === "arrived" || shipment.arrival_status === "completed"
                : shipment.arrival_status === status,
            ).length;

            return (
              <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4" key={status}>
                <div className="flex items-center justify-between">
                  <p className="font-medium text-slate-900">{status.replace("_", " ").toUpperCase()}</p>
                  <StatusBadge value={status} />
                </div>
                <p className="mt-4 text-3xl font-semibold text-slate-950">{count}</p>
              </div>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}
