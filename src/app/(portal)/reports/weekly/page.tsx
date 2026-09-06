import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { requirePortalUser } from "@/lib/session";
import { loadWeeklyReportData } from "@/lib/weekly-report";

export default async function WeeklyReportPreviewPage() {
  const { supabase } = await requirePortalUser("admin");
  const report = await loadWeeklyReportData(supabase);

  return (
    <>
      <PageHeader
        description="Preview the weekly summary that can be sent automatically every Monday at 2:00 AM."
        title="Weekly Inventory Report"
      >
        <Link className="btn-secondary whitespace-nowrap" href="/reports">
          Back to Reports
        </Link>
      </PageHeader>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard title="Summary">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Low Stock</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{report.lowStockProducts.length}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Products</p>
              <p className="mt-2 text-2xl font-semibold text-slate-950">{report.products.length}</p>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Top Low Stock Items">
          <div className="space-y-3">
            {report.lowStockProducts.slice(0, 5).map((product) => (
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3" key={product.id}>
                <p className="font-medium text-slate-950">{product.name}</p>
                <p className="text-sm text-slate-500">
                  {product.sku} · Current {product.current_stock} · In Transit {product.in_transit_stock}
                </p>
              </div>
            ))}
            {report.lowStockProducts.length === 0 ? (
              <p className="text-sm text-slate-500">No low stock items this week.</p>
            ) : null}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
