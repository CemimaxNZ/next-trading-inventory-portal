"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";

type ProductOption = {
  id: string;
  name: string;
  sku: string;
};

type AdjustmentRow = {
  key: number;
  productId: string;
  adjustment: "add" | "remove";
  quantity: string;
  query: string;
};

type StockAdjustmentItemsFieldsProps = {
  products: ProductOption[];
};

export function StockAdjustmentItemsFields({ products }: StockAdjustmentItemsFieldsProps) {
  function getProductLabel(product: ProductOption) {
    return `${product.name} (${product.sku})`;
  }

  function resolveQueryToProductId(query: string) {
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

  const [rows, setRows] = useState<AdjustmentRow[]>([
    {
      key: 1,
      productId: "",
      adjustment: "add",
      quantity: "1",
      query: "",
    },
  ]);

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: current.length === 0 ? 1 : Math.max(...current.map((row) => row.key)) + 1,
        productId: "",
        adjustment: "add",
        quantity: "1",
        query: "",
      },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => {
      if (current.length === 1) {
        return [{ ...current[0], productId: "", adjustment: "add", quantity: "1", query: "" }];
      }

      return current.filter((row) => row.key !== key);
    });
  }

  function updateRow(
    key: number,
    field: "productId" | "adjustment" | "quantity" | "query",
    value: string,
  ) {
    setRows((current) =>
      current.map((row) =>
        row.key === key
          ? {
              ...row,
              [field]:
                field === "adjustment"
                  ? (value as AdjustmentRow["adjustment"])
                  : value,
            }
          : row,
      ),
    );
  }

  return (
    <div className="space-y-4">
      {rows.map((row, index) => (
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4" key={row.key}>
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-semibold text-slate-900">Adjustment Line {index + 1}</p>
            <button
              className="btn-secondary px-3 py-2 text-xs"
              onClick={() => removeRow(row.key)}
              type="button"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <div>
              <SearchableAdjustmentProductPicker
                onProductSelect={(product) => {
                  setRows((current) =>
                    current.map((item) =>
                      item.key === row.key
                        ? {
                            ...item,
                            productId: product.id,
                            query: getProductLabel(product),
                          }
                        : item,
                    ),
                  );
                }}
                onQueryChange={(value) => {
                  updateRow(row.key, "query", value);
                  updateRow(row.key, "productId", resolveQueryToProductId(value));
                }}
                products={products}
                row={row}
                rowIndex={index}
              />
            </div>

            <div>
              <label className="field-label" htmlFor={`adjustment-type-${row.key}`}>
                Adjustment Type
              </label>
              <select
                className="input-field"
                id={`adjustment-type-${row.key}`}
                name="item_adjustment"
                onChange={(event) => updateRow(row.key, "adjustment", event.target.value)}
                value={row.adjustment}
              >
                <option value="add">Add Stock</option>
                <option value="remove">Remove Stock</option>
              </select>
            </div>

            <div>
              <label className="field-label" htmlFor={`adjustment-quantity-${row.key}`}>
                Quantity
              </label>
              <input
                className="input-field input-field-number"
                id={`adjustment-quantity-${row.key}`}
                min="1"
                name="item_quantity"
                onChange={(event) => updateRow(row.key, "quantity", event.target.value)}
                required
                type="number"
                value={row.quantity}
              />
            </div>
          </div>
        </div>
      ))}

      <button className="btn-secondary" onClick={addRow} type="button">
        Add Product Line
      </button>
    </div>
  );
}

function SearchableAdjustmentProductPicker({
  products,
  row,
  rowIndex,
  onProductSelect,
  onQueryChange,
}: {
  products: ProductOption[];
  row: AdjustmentRow;
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
      [product.name, product.sku, `${product.name} (${product.sku})`]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [products, row.query]);
  const selectedProduct = products.find((product) => product.id === row.productId);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="field-label mb-0" htmlFor={`adjustment-product-search-${row.key}`}>
          Product {rowIndex + 1}
        </label>
        <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-medium text-brand-700">
          {selectedProduct ? selectedProduct.sku : "Select a product"}
        </span>
      </div>
      <input name="item_product_id" type="hidden" value={row.productId} />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-4 h-4 w-4 text-slate-400" />
        <input
          autoComplete="off"
          className="input-field pl-11"
          id={`adjustment-product-search-${row.key}`}
          onBlur={() => setIsOpen(false)}
          onChange={(event) => {
            const value = event.target.value;
            onQueryChange(value);
            setIsOpen(Boolean(value.trim()));
          }}
          onFocus={() => {
            if (row.query.trim()) {
              setIsOpen(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" && filteredProducts.length > 0) {
              event.preventDefault();
              onProductSelect(filteredProducts[0]);
              setIsOpen(false);
            }
          }}
          placeholder="Search product name or SKU, then choose one result"
          required
          type="text"
          value={row.query}
        />
        {isOpen ? (
          <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-52 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
            {filteredProducts.length > 0 ? (
              filteredProducts.map((product) => {
                const isSelected = product.id === row.productId;

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
