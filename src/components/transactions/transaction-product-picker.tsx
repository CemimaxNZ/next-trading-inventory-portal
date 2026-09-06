"use client";

import { Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type TransactionProductPickerProps = {
  products: ProductOption[];
  selectedProductId?: string;
};

function getProductLabel(product: ProductOption) {
  return `${product.name} (${product.sku})`;
}

export function TransactionProductPicker({
  products,
  selectedProductId,
}: TransactionProductPickerProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const selectedProduct = products.find((product) => product.id === selectedProductId);
  const selectedProductLabel = selectedProduct ? getProductLabel(selectedProduct) : "";
  const [query, setQuery] = useState(selectedProductLabel);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selectedProductLabel);
  }, [selectedProductLabel]);

  const filteredProducts = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    if (!normalizedQuery) {
      return products.slice(0, 10);
    }

    return products.filter((product) =>
      [product.name, product.sku, getProductLabel(product)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [products, query]);

  function updateSelectedProduct(productId?: string) {
    const params = new URLSearchParams(searchParams.toString());

    if (productId) {
      params.set("productId", productId);
    } else {
      params.delete("productId");
    }

    const nextUrl = params.toString() ? `${pathname}?${params.toString()}` : pathname;
    router.replace(nextUrl, { scroll: false });
  }

  return (
    <div className="relative w-full md:w-[360px]">
      {selectedProductId ? (
        <button
          className="absolute right-12 top-1/2 z-10 -translate-y-1/2 rounded-full px-3 py-1 text-xs font-semibold text-brand-700 hover:bg-brand-50"
          onClick={() => {
            setQuery("");
            updateSelectedProduct(undefined);
            setIsOpen(false);
          }}
          type="button"
        >
          Clear
        </button>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          autoComplete="off"
          className="input-field min-h-12 pl-11 pr-20"
          onBlur={() => {
            window.setTimeout(() => setIsOpen(false), 120);
          }}
          onChange={(event) => {
            setQuery(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredProducts.length > 0) {
              event.preventDefault();
              const [firstMatch] = filteredProducts;
              if (firstMatch) {
                updateSelectedProduct(firstMatch.id);
                setQuery(getProductLabel(firstMatch));
                setIsOpen(false);
              }
            }
          }}
          placeholder="Search product name or SKU"
          type="search"
          value={query}
        />
      </div>

      {isOpen ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
          {filteredProducts.length > 0 ? (
            filteredProducts.map((product) => {
              const isSelected = product.id === selectedProductId;

              return (
                <button
                  className={`flex w-full items-start justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                    isSelected ? "bg-brand-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"
                  }`}
                  key={product.id}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    setQuery(getProductLabel(product));
                    updateSelectedProduct(product.id);
                    setIsOpen(false);
                  }}
                  type="button"
                >
                  <span className="font-medium">{product.name}</span>
                  <span className="ml-4 shrink-0 text-xs text-slate-400">{product.sku}</span>
                </button>
              );
            })
          ) : (
            <div className="rounded-2xl px-3 py-3 text-sm text-slate-500">
              No products found for this keyword.
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
