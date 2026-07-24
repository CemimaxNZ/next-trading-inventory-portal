import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  ProductRow,
  ShipmentRow,
} from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";

export default async function DashboardPage() {
  const { supabase, profile } = await requirePortalUser();

  const [
    { data: productsData },
    { data: shipmentsData },
  ] = await Promise.all([
    supabase.from("products").select("*").order("name"),
    supabase.from("shipments").select("*"),
  ]);

  const products = (productsData ?? []) as ProductRow[];
  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const lowStockProducts = products.filter(
    (product) => product.current_stock <= product.low_stock_warning_level,
  );

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
          {lowStockProducts.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No low-stock items right now.
            </div>
          ) : (
            lowStockProducts.map((product) => (
              <article
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                key={product.id}
              >
                <div>
                  <p className="text-base font-semibold text-slate-950">{product.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{product.sku}</p>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Current</p>
                    <p className="mt-1 font-semibold text-rose-700">{product.current_stock}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Warning Level</p>
                    <p className="mt-1 text-slate-700">{product.low_stock_warning_level}</p>
                  </div>
                </div>
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[62%]" />
              <col className="w-[16%]" />
              <col className="w-[10%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium text-left">Product</th>
                <th className="px-3 pb-3 font-medium text-center">SKU</th>
                <th className="px-3 pb-3 font-medium text-center">Current</th>
                <th className="px-3 pb-3 font-medium text-center">Warning Level</th>
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
                    <td className="px-3 py-4 text-center text-slate-600">{product.sku}</td>
                    <td className="px-3 py-4 text-center text-rose-700">{product.current_stock}</td>
                    <td className="px-3 py-4 text-center text-slate-600">{product.low_stock_warning_level}</td>
                  </tr>
                ))
              )}
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
