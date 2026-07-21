import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/actions/products";
import { SubmitButton } from "@/components/forms/submit-button";
import { ProductCategoryNav } from "@/components/products/product-category-nav";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductCategory, ProductRow } from "@/lib/database.types";
import { canManageProducts } from "@/lib/permissions";
import { productCategoryMeta, productCategories } from "@/lib/products";
import { requirePortalUser } from "@/lib/session";

type ProductCategoryPageProps = {
  category: ProductCategory;
  error?: string;
};

export async function ProductCategoryPage({ category, error }: ProductCategoryPageProps) {
  const { supabase, profile } = await requirePortalUser();
  const { data } = await supabase
    .from("products")
    .select("*")
    .eq("category", category)
    .order("name");
  const products = (data ?? []) as ProductRow[];
  const isAdmin = canManageProducts(profile.role);
  const meta = productCategoryMeta[category];

  return (
    <>
      <PageHeader description={meta.description} title={meta.label}>
        <ProductCategoryNav activeCategory={category} />
      </PageHeader>

      {error ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
          {error}
        </div>
      ) : null}

      {isAdmin ? (
        <SectionCard
          description={`Add a new ${meta.label.toLowerCase()} record to the inventory catalog.`}
          title={`Create ${meta.label.slice(0, -1)}`}
        >
          <form action={createProductAction} className="grid gap-4 md:grid-cols-4">
            <input name="category" type="hidden" value={category} />
            <div>
              <label className="field-label" htmlFor="name">
                Product Name
              </label>
              <input className="input-field" id="name" name="name" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="sku">
                SKU
              </label>
              <input className="input-field" id="sku" name="sku" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="low_stock_warning_level">
                Low Stock Warning Level
              </label>
              <input
                className="input-field"
                id="low_stock_warning_level"
                min="0"
                name="low_stock_warning_level"
                required
                type="number"
              />
            </div>
            <div>
              <label className="field-label" htmlFor="category-display">
                Category
              </label>
              <input
                className="input-field bg-slate-50"
                id="category-display"
                readOnly
                type="text"
                value={meta.label}
              />
            </div>
            <div className="md:col-span-4">
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create Product
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        description={`Stock levels and warning bands for all ${meta.label.toLowerCase()}.`}
        title={meta.label}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">SKU</th>
                <th className="pb-3 font-medium">Current Stock</th>
                <th className="pb-3 font-medium">In Transit</th>
                <th className="pb-3 font-medium">Warning Level</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => {
                const low = product.current_stock <= product.low_stock_warning_level;

                return (
                  <tr className="border-b border-slate-100 align-top last:border-b-0" key={product.id}>
                    <td className="py-4">
                      <p className="font-medium text-slate-950">{product.name}</p>
                      {isAdmin ? (
                        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <summary className="cursor-pointer text-sm font-medium text-brand-700">
                            Edit product
                          </summary>
                          <div className="mt-4 space-y-4">
                            <form action={updateProductAction} className="grid gap-4 md:grid-cols-4">
                              <input name="id" type="hidden" value={product.id} />
                              <div>
                                <label className="field-label" htmlFor={`name-${product.id}`}>
                                  Product Name
                                </label>
                                <input
                                  className="input-field"
                                  defaultValue={product.name}
                                  id={`name-${product.id}`}
                                  name="name"
                                  required
                                  type="text"
                                />
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`sku-${product.id}`}>
                                  SKU
                                </label>
                                <input
                                  className="input-field"
                                  defaultValue={product.sku}
                                  id={`sku-${product.id}`}
                                  name="sku"
                                  required
                                  type="text"
                                />
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`category-${product.id}`}>
                                  Category
                                </label>
                                <select
                                  className="input-field"
                                  defaultValue={product.category}
                                  id={`category-${product.id}`}
                                  name="category"
                                >
                                  {productCategories.map((value) => (
                                    <option key={value} value={value}>
                                      {productCategoryMeta[value].label}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`warning-${product.id}`}>
                                  Low Stock Warning Level
                                </label>
                                <input
                                  className="input-field"
                                  defaultValue={product.low_stock_warning_level}
                                  id={`warning-${product.id}`}
                                  min="0"
                                  name="low_stock_warning_level"
                                  required
                                  type="number"
                                />
                              </div>
                              <div className="md:col-span-4">
                                <SubmitButton className="btn-secondary" pendingLabel="Saving...">
                                  Save Changes
                                </SubmitButton>
                              </div>
                            </form>

                            <form action={deleteProductAction}>
                              <input name="id" type="hidden" value={product.id} />
                              <SubmitButton className="btn-danger" pendingLabel="Deleting...">
                                Delete Product
                              </SubmitButton>
                            </form>
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-4 text-slate-600">{product.sku}</td>
                    <td className="py-4 text-slate-950">{product.current_stock}</td>
                    <td className="py-4 text-slate-600">{product.in_transit_stock}</td>
                    <td className="py-4 text-slate-600">{product.low_stock_warning_level}</td>
                    <td className="py-4">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                          low ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                        }`}
                      >
                        {low ? "Low stock" : "Healthy"}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 ? (
                <tr>
                  <td className="py-6 text-sm text-slate-500" colSpan={6}>
                    No products in this category yet.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
