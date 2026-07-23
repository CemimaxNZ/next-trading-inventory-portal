import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { SummaryCard } from "@/components/ui/summary-card";
import type {
  InventoryTransactionRow,
  ProductRow,
  ProfileRow,
  PurchaseOrderRow,
  ShipmentRow,
} from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatSignedQuantity } from "@/lib/utils";

export default async function DashboardPage() {
  const { supabase, profile } = await requirePortalUser();

  const [
    { data: productsData },
    { data: purchaseOrdersData },
    { data: shipmentsData },
    { data: transactionsData },
    { data: profilesData },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("purchase_orders").select("*"),
    supabase.from("shipments").select("*"),
    supabase.from("inventory_transactions").select("*").order("created_at", { ascending: false }).limit(6),
    supabase.from("profiles").select("*"),
  ]);

  const products = (productsData ?? []) as ProductRow[];
  const purchaseOrders = (purchaseOrdersData ?? []) as PurchaseOrderRow[];
  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const transactions = (transactionsData ?? []) as InventoryTransactionRow[];
  const profiles = (profilesData ?? []) as ProfileRow[];

  const productMap = new Map(products.map((product) => [product.id, product]));
  const profileMap = new Map(profiles.map((entry) => [entry.id, entry]));
  const lowStockProducts = products.filter(
    (product) => product.current_stock <= product.low_stock_warning_level,
  );
  const inventoryTotal = products.reduce((sum, product) => sum + product.current_stock, 0);
  const inTransitTotal = products.reduce((sum, product) => sum + product.in_transit_stock, 0);

  return (
    <>
      <PageHeader
        description={`Welcome back, ${profile.full_name}. Here’s today’s inventory snapshot for the internal team.`}
        title="Dashboard"
      />

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <SummaryCard caption="Active SKUs in the system" label="Total Products" value={products.length} />
        <SummaryCard caption="Units currently available" label="Current Inventory Quantity" value={inventoryTotal.toLocaleString()} />
        <SummaryCard caption="Units still inbound" label="Products In Transit" value={inTransitTotal.toLocaleString()} />
        <SummaryCard caption="Open and completed PO records" label="Purchase Orders" value={purchaseOrders.length} />
        <SummaryCard caption="Items at or below warning levels" label="Low Stock Products" value={lowStockProducts.length} />
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionCard
          description="Products that may need replenishment soon."
          title="Low Stock Watchlist"
        >
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 font-medium">Product</th>
                  <th className="pb-3 font-medium">SKU</th>
                  <th className="pb-3 font-medium">Current</th>
                  <th className="pb-3 font-medium">Warning Level</th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.length === 0 ? (
                  <tr>
                    <td className="pt-4 text-slate-500" colSpan={4}>
                      No low-stock items right now.
                    </td>
                  </tr>
                ) : (
                  lowStockProducts.map((product) => (
                    <tr className="border-b border-slate-100 last:border-b-0" key={product.id}>
                      <td className="py-4 font-medium text-slate-900">{product.name}</td>
                      <td className="py-4 text-slate-600">{product.sku}</td>
                      <td className="py-4 text-rose-700">{product.current_stock}</td>
                      <td className="py-4 text-slate-600">{product.low_stock_warning_level}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          description="The latest stock movements recorded in the system."
          title="Recent Inventory Transactions"
        >
          <div className="space-y-3">
            {transactions.length === 0 ? (
              <p className="text-sm text-slate-500">No inventory movements recorded yet.</p>
            ) : (
              transactions.map((transaction) => {
                const product = productMap.get(transaction.product_id);
                const entryUser = transaction.performed_by
                  ? profileMap.get(transaction.performed_by)
                  : null;

                return (
                  <div
                    className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                    key={transaction.id}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <p className="font-medium text-slate-950">
                          {product?.name ?? "Unknown product"}
                        </p>
                        <p className="mt-1 text-sm text-slate-500">{transaction.reason}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          {formatDate(transaction.created_at)} • {entryUser?.full_name ?? "System"}
                        </p>
                      </div>
                      <div className="flex flex-wrap items-center gap-3">
                        <StatusBadge value={transaction.type} />
                        <p
                          className={`text-sm font-semibold ${
                            transaction.quantity > 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatSignedQuantity(transaction.quantity)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>

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
