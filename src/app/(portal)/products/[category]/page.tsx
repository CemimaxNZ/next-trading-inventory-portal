import { notFound } from "next/navigation";
import { ProductCategoryPage } from "@/components/products/product-category-page";
import { isProductCategory, productCategories } from "@/lib/products";

export function generateStaticParams() {
  return productCategories.map((category) => ({ category }));
}

export default async function ProductCategoryRoute({
  params,
  searchParams,
}: {
  params: Promise<{ category: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { category } = await params;
  const { error } = await searchParams;

  if (!isProductCategory(category)) {
    notFound();
  }

  return <ProductCategoryPage category={category} error={error} />;
}
