"use client";

import { Search, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";

type ShipmentPurchaseOrderOption = {
  id: string;
  po_number: string;
  supplier: string;
};

type ShipmentPurchaseOrderPickerProps = {
  inputName: string;
  inputPrefix: string;
  label: string;
  orders: ShipmentPurchaseOrderOption[];
  initialSelectedIds?: string[];
  helperText?: string;
};

function getOrderLabel(order: ShipmentPurchaseOrderOption) {
  return `${order.po_number} · ${order.supplier}`;
}

export function ShipmentPurchaseOrderPicker({
  inputName,
  inputPrefix,
  label,
  orders,
  initialSelectedIds = [],
  helperText = "Search PO number or supplier, then choose one or more results.",
}: ShipmentPurchaseOrderPickerProps) {
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelectedIds);
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const selectedOrders = useMemo(
    () =>
      selectedIds
        .map((id) => orders.find((order) => order.id === id))
        .filter(Boolean) as ShipmentPurchaseOrderOption[],
    [orders, selectedIds],
  );

  const filteredOrders = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const availableOrders = orders.filter((order) => !selectedIds.includes(order.id));

    if (!normalizedQuery) {
      return availableOrders.slice(0, 8);
    }

    return availableOrders.filter((order) =>
      [order.po_number, order.supplier, getOrderLabel(order)]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery),
    );
  }, [orders, query, selectedIds]);

  function addOrder(orderId: string) {
    setSelectedIds((current) => (current.includes(orderId) ? current : [...current, orderId]));
    setQuery("");
    setIsOpen(false);
  }

  function removeOrder(orderId: string) {
    setSelectedIds((current) => current.filter((id) => id !== orderId));
  }

  const selectionSummary =
    selectedOrders.length === 0
      ? "No purchase orders linked yet"
      : `${selectedOrders.length} purchase order${selectedOrders.length === 1 ? "" : "s"} linked`;

  return (
    <div className="space-y-2">
      <label className="field-label" htmlFor={`${inputPrefix}-po-search`}>
        {label}
      </label>

      {selectedIds.map((orderId) => (
        <input key={orderId} name={inputName} type="hidden" value={orderId} />
      ))}

      <div className="rounded-[1.75rem] border border-slate-200 bg-white p-3 shadow-sm transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-100">
        <div className="mb-3 flex items-center justify-between gap-3 rounded-2xl bg-slate-50 px-3 py-2.5 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-brand-600" />
            <span className="font-medium text-slate-700">{selectionSummary}</span>
          </div>
          {selectedOrders.length > 0 ? (
            <button
              className="rounded-full px-2 py-1 text-slate-400 transition hover:bg-white hover:text-slate-700"
              onClick={() => setSelectedIds([])}
              type="button"
            >
              Clear
            </button>
          ) : null}
        </div>

        {selectedOrders.length > 0 ? (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedOrders.map((order) => (
              <span
                className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                key={order.id}
              >
                <span>{order.po_number}</span>
                <button
                  className="rounded-full p-0.5 text-slate-400 transition hover:bg-brand-100 hover:text-slate-700"
                  onClick={() => removeOrder(order.id)}
                  type="button"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            ))}
          </div>
        ) : null}

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-slate-400" />
          <input
            autoComplete="off"
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-10 py-3 text-sm text-slate-900 outline-none transition focus:border-brand-400 focus:bg-white"
            id={`${inputPrefix}-po-search`}
            onBlur={() => {
              window.setTimeout(() => setIsOpen(false), 120);
            }}
            onChange={(event) => {
              const value = event.target.value;
              setQuery(value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && filteredOrders.length > 0) {
                event.preventDefault();
                addOrder(filteredOrders[0].id);
              }
            }}
            placeholder="Search purchase order number or supplier"
            type="text"
            value={query}
          />

          {isOpen ? (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-2 shadow-lg">
              {filteredOrders.length > 0 ? (
                filteredOrders.slice(0, 10).map((order) => (
                  <button
                    className="flex w-full items-start justify-between rounded-2xl px-3 py-2.5 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    key={order.id}
                    onMouseDown={(event) => {
                      event.preventDefault();
                      addOrder(order.id);
                    }}
                    type="button"
                  >
                    <span>
                      <span className="block font-medium text-slate-900">{order.po_number}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{order.supplier}</span>
                    </span>
                    <span className="ml-4 rounded-full bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-500">
                      Add
                    </span>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl px-3 py-3 text-sm text-slate-500">
                  No purchase orders found for this keyword.
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <p className="text-xs text-slate-500">{helperText}</p>
    </div>
  );
}
