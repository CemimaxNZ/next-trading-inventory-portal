import { notFound } from "next/navigation";
import { ProductCategoryPage } from "@/components/products/product-category-page";
import { isProductCategory, productCategories } from "@/lib/products";

export function generateStaticParams() {
  return productCategories.map((category) => ({ category }));
}

export default async function ProductCategoryRoute({
  params,
}: {
  params: Promise<{ category: string }>;
}) {
  const { category } = await params;

  if (!isProductCategory(category)) {
    notFound();
  }

  return <ProductCategoryPage category={category} />;
}
