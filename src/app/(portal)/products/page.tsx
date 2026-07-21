import Link from "next/link";
import { ProductCategoryNav } from "@/components/products/product-category-nav";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type { ProductRow } from "@/lib/database.types";
import { productCategories, productCategoryMeta } from "@/lib/products";
import { requirePortalUser } from "@/lib/session";

export default async function ProductsPage() {
  const { supabase } = await requirePortalUser();
  const { data } = await supabase.from("products").select("*").order("name");
  const products = (data ?? []) as ProductRow[];
  const productCountByCategory = new Map(
    productCategories.map((category) => [
      category,
      products.filter((product) => product.category === category),
    ]),
  );

  return (
    <>
      <PageHeader
        description="Choose a product group, then manage stock lines inside its dedicated catalog page."
        title="Products"
      >
        <ProductCategoryNav />
      </PageHeader>

      <SectionCard
        description="Open one of the two dedicated product pages below."
        title="Product Groups"
      >
        <div className="grid gap-4 md:grid-cols-2">
          {productCategories.map((category) => {
            const categoryProducts = productCountByCategory.get(category) ?? [];
            const lowStockCount = categoryProducts.filter(
              (product) => product.current_stock <= product.low_stock_warning_level,
            ).length;

            return (
              <Link
                className="rounded-[1.75rem] border border-brand-100 bg-white p-6 transition hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-card"
                href={`/products/${category}`}
                key={category}
              >
                <div className="h-2 w-14 rounded-full bg-brand-400" />
                <h3 className="mt-5 text-xl font-semibold text-slate-950">
                  {productCategoryMeta[category].label}
                </h3>
                <p className="mt-2 text-sm text-slate-600">
                  {productCategoryMeta[category].description}
                </p>

                <div className="mt-6 grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Products</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">
                      {categoryProducts.length}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Low Stock</p>
                    <p className="mt-2 text-2xl font-semibold text-slate-950">{lowStockCount}</p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </SectionCard>
    </>
  );
}
