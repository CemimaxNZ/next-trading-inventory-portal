"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { SubmitButton } from "@/components/forms/submit-button";
import type { ProductCategory, ProductRow } from "@/lib/database.types";
import { productCategories, productCategoryMeta } from "@/lib/products";

type ProductCategoryListProps = {
  category: ProductCategory;
  products: ProductRow[];
  isAdmin: boolean;
  updateProductAction: (formData: FormData) => void | Promise<void>;
  deleteProductAction: (formData: FormData) => void | Promise<void>;
};

function matchesQuery(product: ProductRow, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return true;
  }

  const haystack = [product.name, product.sku, product.category, String(product.current_stock), String(product.low_stock_warning_level)]
    .join(" ")
    .toLowerCase();

  return haystack.includes(normalizedQuery);
}

export function ProductCategoryList({
  category,
  products,
  isAdmin,
  updateProductAction,
  deleteProductAction,
}: ProductCategoryListProps) {
  const [query, setQuery] = useState("");

  const filteredProducts = useMemo(
    () => products.filter((product) => matchesQuery(product, query)),
    [products, query],
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative max-w-xl flex-1">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            aria-label={`Search ${productCategoryMeta[category].label}`}
            className="input-field pl-11"
            placeholder="Search by product name, SKU, stock or warning level"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            type="search"
          />
        </div>
        <p className="text-sm text-slate-500">
          Showing {filteredProducts.length} of {products.length}
        </p>
      </div>

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
            {filteredProducts.map((product) => {
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
                          <form action={updateProductAction} className="grid gap-4 md:grid-cols-5">
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
                              <label className="field-label" htmlFor={`stock-${product.id}`}>
                                Current Stock
                              </label>
                              <input
                                className="input-field"
                                defaultValue={product.current_stock}
                                id={`stock-${product.id}`}
                                min="0"
                                name="current_stock"
                                required
                                type="number"
                              />
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
                            <div className="md:col-span-5">
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
            {filteredProducts.length === 0 ? (
              <tr>
                <td className="py-6 text-sm text-slate-500" colSpan={6}>
                  No products match your search.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
