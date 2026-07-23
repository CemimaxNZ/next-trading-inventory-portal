import {
  createProductAction,
  deleteProductAction,
  updateProductAction,
} from "@/app/actions/products";
import { SubmitButton } from "@/components/forms/submit-button";
import { ProductCategoryNav } from "@/components/products/product-category-nav";
import { ProductCategoryList } from "@/components/products/product-category-list";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductCategory, ProductRow } from "@/lib/database.types";
import { canManageProducts } from "@/lib/permissions";
import { productCategoryMeta } from "@/lib/products";
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
          <form action={createProductAction} className="grid gap-4 md:grid-cols-5">
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
              <label className="field-label" htmlFor="current_stock">
                Current Stock
              </label>
              <input
                className="input-field"
                defaultValue="0"
                id="current_stock"
                min="0"
                name="current_stock"
                required
                type="number"
              />
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
            <div className="md:col-span-5">
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
        <ProductCategoryList
          category={category}
          deleteProductAction={deleteProductAction}
          isAdmin={isAdmin}
          products={products}
          updateProductAction={updateProductAction}
        />
      </SectionCard>
    </>
  );
}
