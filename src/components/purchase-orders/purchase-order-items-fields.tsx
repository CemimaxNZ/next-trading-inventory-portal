"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type PurchaseOrderItemValue = {
  product_id: string;
  quantity: number;
};

type PurchaseOrderItemsFieldsProps = {
  products: ProductOption[];
  inputPrefix: string;
  initialItems?: PurchaseOrderItemValue[];
};

type ItemRow = {
  key: number;
  product_id: string;
  quantity: string;
  query: string;
};

function getProductLabel(product: ProductOption) {
  return `${product.name} (${product.sku})`;
}

function resolveQueryToProductId(products: ProductOption[], query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return "";
  }

  const matchedProduct = products.find((product) => {
    const label = getProductLabel(product).toLowerCase();

    return (
      product.name.toLowerCase() === normalizedQuery
      || product.sku.toLowerCase() === normalizedQuery
      || label === normalizedQuery
    );
  });

  return matchedProduct?.id ?? "";
}

function buildInitialRows(products: ProductOption[], initialItems?: PurchaseOrderItemValue[]) {
  if (!initialItems || initialItems.length === 0) {
    return [{ key: 1, product_id: "", quantity: "1", query: "" }];
  }

  return initialItems.map((item, index) => ({
    key: index + 1,
    product_id: item.product_id,
    quantity: String(item.quantity),
    query: getProductLabel(
      products.find((product) => product.id === item.product_id) ?? {
        id: item.product_id,
        name: "Unknown product",
        sku: "No SKU",
      },
    ),
  }));
}

function SearchableProductPicker({
  inputPrefix,
  products,
  row,
  rowIndex,
  onProductSelect,
  onQueryChange,
}: {
  inputPrefix: string;
  products: ProductOption[];
  row: ItemRow;
  rowIndex: number;
  onProductSelect: (product: ProductOption) => void;
  onQueryChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const filteredProducts = useMemo(() => {
    const normalizedQuery = row.query.trim().toLowerCase();

    if (!normalizedQuery) {
      return products;
    }

    return products.filter((product) =>
      [product.name, product.sku, getProductLabel(product)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [products, row.query]);

  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor={`${inputPrefix}-product-search-${row.key}`}>
        Product {rowIndex + 1}
      </label>
      <input name="item_product_id" type="hidden" value={row.product_id} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
        <input
          autoComplete="off"
          className="input-field pl-11"
          id={`${inputPrefix}-product-search-${row.key}`}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            const value = event.target.value;
            onQueryChange(value);
            setIsOpen(Boolean(value.trim()));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredProducts.length > 0) {
              event.preventDefault();
              onProductSelect(filteredProducts[0]);
              setIsOpen(false);
            }
          }}
          onFocus={() => {
            if (row.query.trim()) {
              setIsOpen(true);
            }
          }}
          placeholder="Search product name or SKU, then tap a result"
          type="text"
          value={row.query}
        />
        {isOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const isSelected = product.id === row.product_id;

                return (
                  <button
                    className={`flex w-full items-start justify-between rounded-2xl px-3 py-2 text-left text-sm transition ${
                      isSelected ? "bg-brand-50 text-slate-950" : "text-slate-700 hover:bg-slate-50"
                    }`}
                    key={product.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      onProductSelect(product);
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
    </div>
  );
}

export function PurchaseOrderItemsFields({
  products,
  inputPrefix,
  initialItems,
}: PurchaseOrderItemsFieldsProps) {
  const [rows, setRows] = useState<ItemRow[]>(() => buildInitialRows(products, initialItems));

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: current.length === 0 ? 1 : Math.max(...current.map((row) => row.key)) + 1,
        product_id: "",
        quantity: "1",
        query: "",
      },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => {
      if (current.length === 1) {
        return [{ ...current[0], product_id: "", quantity: "1", query: "" }];
      }

      return current.filter((row) => row.key !== key);
    });
  }

  function updateRow(key: number, field: "product_id" | "quantity" | "query", value: string) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div
          className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[1.4fr_0.8fr_auto]"
          key={row.key}
        >
          <SearchableProductPicker
            inputPrefix={inputPrefix}
            onProductSelect={(product) => {
              setRows((current) =>
                current.map((item) =>
                  item.key === row.key
                    ? {
                        ...item,
                        product_id: product.id,
                        query: getProductLabel(product),
                      }
                    : item,
                ),
              );
            }}
            onQueryChange={(value) => {
              updateRow(row.key, "query", value);
              updateRow(row.key, "product_id", resolveQueryToProductId(products, value));
            }}
            products={products}
            row={row}
            rowIndex={index}
          />

          <div>
            <label className="field-label" htmlFor={`${inputPrefix}-quantity-${row.key}`}>
              Quantity
            </label>
            <input
              className="input-field"
              id={`${inputPrefix}-quantity-${row.key}`}
              min="1"
              name="item_quantity"
              onChange={(event) => updateRow(row.key, "quantity", event.target.value)}
              required
              type="number"
              value={row.quantity}
            />
          </div>

          <div className="flex items-end">
            <button
              className="btn-secondary w-full"
              onClick={() => removeRow(row.key)}
              type="button"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      <button className="btn-secondary" onClick={addRow} type="button">
        Add Product Line
      </button>
    </div>
  );
}
