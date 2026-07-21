import type { ProductCategory } from "@/lib/database.types";

export const productCategories = ["cemimax", "accessories"] as const satisfies readonly ProductCategory[];

export const productCategoryMeta: Record<
  ProductCategory,
  {
    label: string;
    description: string;
  }
> = {
  cemimax: {
    label: "Cemimax Products",
    description: "Core Cemimax inventory items and primary stock lines.",
  },
  accessories: {
    label: "Accessories",
    description: "Support items, add-ons, and accessory stock lines.",
  },
};

export function isProductCategory(value: string): value is ProductCategory {
  return productCategories.includes(value as ProductCategory);
}
