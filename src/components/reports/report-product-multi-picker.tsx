"use client";


import { Search, X } from "lucide-react";
import { useMemo, useState } from "react";


type ProductOption = {
  id: string;
  name: string;
  sku: string;

};


type ReportProductMultiPickerProps = {
  products: ProductOption[];

};


function getProductLabel(product: ProductOption) {
  return `${product.sku} - ${product.name}`;

}


export function ReportProductMultiPicker({ products }: ReportProductMultiPickerProps) {
  const [query, setQuery] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);


  const selectedProducts = useMemo(
    () => selectedIds.map((id) => products.find((product) => product.id === id)).filter(Boolean) as ProductOption[],
    [products, selectedIds],
  );
  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const availableProducts = products.filter((product) => !selectedIds.includes(product.id));


    if (!normalizedQuery) {
      return availableProducts.slice(0, 8);

    }


    return availableProducts.filter((product) =>
      [product.name, product.sku, getProductLabel(product)].join(" ").toLowerCase().includes(normalizedQuery),
    );

  }, [products, query, selectedIds]);


  function addProduct(productId: string) {
    setSelectedIds((current) => (current.includes(productId) ? current : [...current, productId]));
    setQuery("");

  }


  function removeProduct(productId: string) {
    setSelectedIds((current) => current.filter((id) => id !== productId));

  }


  return (
    <div className="space-y-3">
      {selectedProducts.map((product) => (
        <input key={product.id} name="productId" type="hidden" value={product.id} />
      ))}


      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <label className="field-label mb-0" htmlFor="report-product-search">
          Select Specific Products
        </label>
        <span className="text-xs text-slate-500">Optional, choose as many as needed</span>
      </div>


      <div className="rounded-3xl border border-slate-200 bg-slate-50 p-3">
        {selectedProducts.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedProducts.map((product) => (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-white px-3 py-1.5 text-xs font-medium text-slate-700"
                key={product.id}
              >
                <span>{getProductLabel(product)}</span>
                <button
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-brand-50 hover:text-slate-700"
                  onClick={() => removeProduct(product.id)}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}


        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            autoComplete="off"
            className="input-field pl-11"
            id="report-product-search"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search product name or SKU, then choose"
            type="search"
            value={query}
          />
        </div>


        <div className="mt-3 max-h-56 space-y-2 overflow-y-auto">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => (
              <button
                className="flex w-full items-start justify-between gap-3 rounded-2xl bg-white px-3 py-2.5 text-left text-sm transition hover:bg-brand-50"
                key={product.id}
                onClick={() => addProduct(product.id)}
                type="button"
              >
                <span>
                  <span className="block font-medium text-slate-900">{product.name}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">{product.sku}</span>
                </span>
                <span className="shrink-0 rounded-full bg-brand-50 px-2 py-1 text-[11px] font-semibold text-brand-700">
                  Add
                </span>
              </button>
            ))
          ) : (
            <div className="rounded-2xl bg-white px-3 py-3 text-sm text-slate-500">
              No products found for this keyword.
            </div>
          )}
        </div>
      </div>


      <p className="text-xs text-slate-500">
        Leave this empty to include all products, or add several products for a focused report.
      </p>
    </div>
  );

}
