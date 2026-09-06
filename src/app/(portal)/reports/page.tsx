import { Download, FileSpreadsheet } from "lucide-react";
import { ReportProductMultiPicker } from "@/components/reports/report-product-multi-picker";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductRow } from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";


export default async function ReportsPage() {
  const { supabase, profile } = await requirePortalUser();
  const { data: productsData } = await supabase.from("products").select("*").order("name");
  const products = (productsData ?? []) as ProductRow[];
  const isAdmin = profile.role === "admin";
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
  }));


  return (
    <>
      <PageHeader
        description="Download clean CSV reports for inventory review, month-end checks, and product movement history."
        title="Reports"
      />


      <div className="grid items-start gap-4 lg:grid-cols-2">
        <SectionCard
          description="Choose a product group, then download today's stock snapshot."
          title="Current Stock"
        >
          <form action="/reports/current-stock" className="space-y-5" method="get">
            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-5">
              <div className="flex items-start gap-4">
                <div className="rounded-2xl bg-brand-100 p-3 text-brand-800">
                  <FileSpreadsheet className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-950">Current Stock Report</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Download SKU, product name, current stock, and live in-transit quantity.
                  </p>
                </div>
              </div>
            </div>


            <div>
              <label className="field-label" htmlFor="category">
                Product Group
              </label>
              <select className="input-field" defaultValue="all" id="category" name="category">
                <option value="all">All</option>
                <option value="cemimax">Cemimax Products</option>
                <option value="accessories">Accessories</option>
              </select>
            </div>


            {isAdmin ? (
              <label className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700">
                <input
                  className="h-4 w-4 rounded border-slate-300 text-brand-500 focus:ring-brand-200"
                  defaultChecked
                  name="includeWarningLevel"
                  type="checkbox"
                  value="yes"
                />
                Show warning level in downloaded file
              </label>
            ) : null}


            <button className="btn-primary w-full gap-2 sm:w-fit" type="submit">
              <Download className="h-4 w-4" />
              Download Current Stock
            </button>
          </form>
        </SectionCard>


        <SectionCard
          description="Choose a date range, product keyword, or several specific products."
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
                Use keyword for a broad search, or choose exact products below.
              </p>
            </div>


            <ReportProductMultiPicker products={productOptions} />


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
