"use client";

import { useState } from "react";

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
};

function buildInitialRows(initialItems?: PurchaseOrderItemValue[]) {
  if (!initialItems || initialItems.length === 0) {
    return [{ key: 1, product_id: "", quantity: "1" }];
  }

  return initialItems.map((item, index) => ({
    key: index + 1,
    product_id: item.product_id,
    quantity: String(item.quantity),
  }));
}

export function PurchaseOrderItemsFields({
  products,
  inputPrefix,
  initialItems,
}: PurchaseOrderItemsFieldsProps) {
  const [rows, setRows] = useState<ItemRow[]>(() => buildInitialRows(initialItems));

  function addRow() {
    setRows((current) => [
      ...current,
      {
        key: current.length === 0 ? 1 : Math.max(...current.map((row) => row.key)) + 1,
        product_id: "",
        quantity: "1",
      },
    ]);
  }

  function removeRow(key: number) {
    setRows((current) => {
      if (current.length === 1) {
        return [{ ...current[0], product_id: "", quantity: "1" }];
      }

      return current.filter((row) => row.key !== key);
    });
  }

  function updateRow(key: number, field: "product_id" | "quantity", value: string) {
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
          <div>
            <label className="field-label" htmlFor={`${inputPrefix}-product-${row.key}`}>
              Product {index + 1}
            </label>
            <select
              className="input-field"
              id={`${inputPrefix}-product-${row.key}`}
              name="item_product_id"
              onChange={(event) => updateRow(row.key, "product_id", event.target.value)}
              required
              value={row.product_id}
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
