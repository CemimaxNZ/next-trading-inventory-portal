"use client";

import { useState } from "react";

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
};

type StockAdjustmentItemsFieldsProps = {
  products: ProductOption[];
};

export function StockAdjustmentItemsFields({ products }: StockAdjustmentItemsFieldsProps) {
  const [rows, setRows] = useState<AdjustmentRow[]>([
    {
      key: 1,
      productId: "",
      adjustment: "add",
      quantity: "1",
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
      },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => {
      if (current.length === 1) {
        return [{ ...current[0], productId: "", adjustment: "add", quantity: "1" }];
      }

      return current.filter((row) => row.key !== key);
    });
  }

  function updateRow(
    key: number,
    field: "productId" | "adjustment" | "quantity",
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

          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <div>
              <label className="field-label" htmlFor={`adjustment-product-${row.key}`}>
                Product
              </label>
              <select
                className="input-field"
                id={`adjustment-product-${row.key}`}
                name="item_product_id"
                onChange={(event) => updateRow(row.key, "productId", event.target.value)}
                required
                value={row.productId}
              >
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
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
                className="input-field"
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
