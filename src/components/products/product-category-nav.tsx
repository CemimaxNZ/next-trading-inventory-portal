import Link from "next/link";
import type { ProductCategory } from "@/lib/database.types";
import { productCategories, productCategoryMeta } from "@/lib/products";
import { cn } from "@/lib/utils";

type ProductCategoryNavProps = {
  activeCategory?: ProductCategory;
};

export function ProductCategoryNav({ activeCategory }: ProductCategoryNavProps) {
  return (
    <div className="flex flex-wrap gap-3">
      {productCategories.map((category) => {
        const isActive = activeCategory === category;

        return (
          <Link
            className={cn(
              "rounded-full border px-4 py-2 text-sm font-medium transition",
              isActive
                ? "border-slate-950 bg-slate-950 text-white"
                : "border-brand-200 bg-white text-slate-700 hover:border-brand-300 hover:text-slate-950",
            )}
            href={`/products/${category}`}
            key={category}
          >
            {productCategoryMeta[category].label}
          </Link>
        );
      })}
    </div>
  );
}
