import { Download, FileSpreadsheet } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductRow } from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";

export default async function ReportsPage() {
  const { supabase } = await requirePortalUser();
  const { data: productsData } = await supabase.from("products").select("*").order("name");
  const products = (productsData ?? []) as ProductRow[];

  return (
    <>
      <PageHeader
        description="Download clean CSV reports for inventory review, month-end checks, and product movement history."
        title="Reports"
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionCard
          description="A complete snapshot of SKU, product name, current stock, and in-transit quantity."
          title="Current Stock"
        >
          <div className="flex h-full flex-col justify-between gap-6 rounded-3xl border border-slate-100 bg-slate-50 p-5">
            <div className="flex items-start gap-4">
              <div className="rounded-2xl bg-brand-100 p-3 text-brand-800">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-950">Current Stock Report</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Use this when you need today’s stock list. In Transit is calculated from active Paid and Shipped purchase orders, so it matches the portal pages.
                </p>
              </div>
            </div>
            <a className="btn-primary w-full gap-2 sm:w-fit" href="/reports/current-stock">
              <Download className="h-4 w-4" />
              Download Current Stock
            </a>
          </div>
        </SectionCard>

        <SectionCard
          description="Choose a date range and optionally filter by one product or a product keyword."
          title="Transaction Report"
        >
          <form action="/reports/transactions" className="space-y-5" method="get">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="field-label" htmlFor="start">
                  Start Date
                </label>
                <div className="date-input-wrap">
                  <input className="input-field" id="start" name="start" type="date" />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="end">
                  End Date
                </label>
                <div className="date-input-wrap">
                  <input className="input-field" id="end" name="end" type="date" />
                </div>
              </div>
            </div>

            <div>
              <label className="field-label" htmlFor="productId">
                Product
              </label>
              <select className="input-field" id="productId" name="productId">
                <option value="">All products</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} - {product.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor="query">
                Product Keyword or SKU
              </label>
              <input
                className="input-field"
                id="query"
                list="report-products"
                name="query"
                placeholder="Type product name or SKU"
                type="search"
              />
              <datalist id="report-products">
                {products.map((product) => (
                  <option key={product.id} value={`${product.sku} ${product.name}`} />
                ))}
              </datalist>
              <p className="mt-2 text-xs text-slate-500">
                Leave Product and Keyword empty to download all transaction records in the selected date range.
              </p>
            </div>

            <button className="btn-primary w-full gap-2 sm:w-fit" type="submit">
              <Download className="h-4 w-4" />
              Download Transaction Report
            </button>
          </form>
        </SectionCard>
      </div>
    </>
  );

}
