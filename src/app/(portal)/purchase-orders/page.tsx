import {
  createPurchaseOrderAction,
  deletePurchaseOrderAction,
  updatePurchaseOrderAction,
  updatePurchaseOrderStatusAction,
} from "@/app/actions/purchase-orders";
import { Search } from "lucide-react";
import { PurchaseOrderItemsFields } from "@/components/purchase-orders/purchase-order-items-fields";
import { PurchaseOrderHighlight } from "@/components/purchase-orders/purchase-order-highlight";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { purchaseOrderStatuses } from "@/lib/constants";
import type { ProductRow, PurchaseOrderItemRow, PurchaseOrderRow } from "@/lib/database.types";
import {
  canCreateOrders,
  canEditOrders,
  canManageOrders,
  canUpdateOperationalStatus,
} from "@/lib/permissions";
import {
  buildLegacyPurchaseOrderItems,
  normalizePurchaseOrderStatus,
} from "@/lib/purchase-orders";
import { requirePortalUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";
import { Fragment } from "react";

type PurchaseOrdersPageProps = {
  searchParams?: Promise<{
    error?: string;
    highlight?: string;
    query?: string;
  }>;
};

type LegacyPurchaseOrderRow = PurchaseOrderRow & {
  product_id?: string | null;
  quantity?: number | null;
};

type PurchaseOrderDisplayItem = {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
};

function matchesPurchaseOrderItemQuery(
  item: PurchaseOrderDisplayItem,
  query: string,
  productMap: Map<string, ProductRow>,
) {
  if (!query) {
    return true;
  }

  const product = productMap.get(item.product_id);
  const searchText = [product?.name ?? "", product?.sku ?? ""].join(" ").toLowerCase();

  return searchText.includes(query);
}

function isMissingPurchaseOrderItemsTableError(message: string | undefined) {
  if (!message) {
    return false;
  }

  return (
    message.includes("Could not find the table 'public.purchase_order_items' in the schema cache")
    || message.includes('relation "public.purchase_order_items" does not exist')
    || message.includes('relation "purchase_order_items" does not exist')
  );
}

export default async function PurchaseOrdersPage({ searchParams }: PurchaseOrdersPageProps) {
  const { supabase, profile } = await requirePortalUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error;
  const highlightedOrderId = resolvedSearchParams?.highlight;
  const query = resolvedSearchParams?.query?.trim().toLowerCase() ?? "";
  const [{ data: ordersData }, { data: productsData }, { data: orderItemsData, error: orderItemsError }] = await Promise.all([
    supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
    supabase.from("products").select("*").order("name"),
    supabase.from("purchase_order_items").select("*"),
  ]);

  const purchaseOrders = (ordersData ?? []) as LegacyPurchaseOrderRow[];
  const products = (productsData ?? []) as ProductRow[];
  const orderItems = (orderItemsData ?? []) as PurchaseOrderItemRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
  }));
  const orderItemsMap = new Map<string, PurchaseOrderDisplayItem[]>();
  const totalQuantityByOrder = new Map<string, number>();
  const useLegacyItems = isMissingPurchaseOrderItemsTableError(orderItemsError?.message);

  if (useLegacyItems) {
    for (const purchaseOrder of purchaseOrders) {
      const items = buildLegacyPurchaseOrderItems(purchaseOrder).map((item) => ({
        ...item,
        id: `legacy-${purchaseOrder.id}`,
      }));
      orderItemsMap.set(purchaseOrder.id, items);
      totalQuantityByOrder.set(
        purchaseOrder.id,
        items.reduce((sum, item) => sum + item.quantity, 0),
      );
    }
  } else {
    for (const item of orderItems) {
      const existingItems = orderItemsMap.get(item.purchase_order_id) ?? [];
      existingItems.push(item);
      orderItemsMap.set(item.purchase_order_id, existingItems);
      totalQuantityByOrder.set(
        item.purchase_order_id,
        (totalQuantityByOrder.get(item.purchase_order_id) ?? 0) + item.quantity,
      );
    }
  }

  const canCreate = canCreateOrders(profile.role);
  const canEdit = canEditOrders(profile.role);
  const isAdmin = canManageOrders(profile.role);
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const today = new Date().toISOString().slice(0, 10);
  const filteredPurchaseOrders = purchaseOrders.filter((purchaseOrder) => {
    if (!query) {
      return true;
    }

    const items = orderItemsMap.get(purchaseOrder.id) ?? [];

    return items.some((item) => matchesPurchaseOrderItemQuery(item, query, productMap));
  });
  const activePurchaseOrders = filteredPurchaseOrders.filter(
    (purchaseOrder) => normalizePurchaseOrderStatus(purchaseOrder.status) !== "arrived",
  );
  const historyPurchaseOrders = filteredPurchaseOrders.filter(
    (purchaseOrder) => normalizePurchaseOrderStatus(purchaseOrder.status) === "arrived",
  );

  return (
    <>
      <PurchaseOrderHighlight orderId={highlightedOrderId} />

      <PageHeader
        description="Track supplier orders and move stock into inventory when goods arrive."
        title="Purchase Orders"
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {canCreate ? (
        <SectionCard
          description="Create one purchase order with one or more product lines."
          title="Create Purchase Order"
        >
          <form action={createPurchaseOrderAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="po_number">
                  PO Number
                </label>
                <input className="input-field" id="po_number" name="po_number" required type="text" />
              </div>
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="supplier">
                  Supplier
                </label>
                <input className="input-field" id="supplier" name="supplier" required type="text" />
              </div>
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="order_date">
                  Order Date
                </label>
                <div className="date-input-wrap">
                  <input
                    className="input-field"
                    defaultValue={today}
                    id="order_date"
                    name="order_date"
                    required
                    type="date"
                  />
                </div>
              </div>
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="po-status">
                  Status
                </label>
                <select className="input-field" defaultValue="paid" id="po-status" name="status">
                  {purchaseOrderStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status.replace("_", " ").toUpperCase()}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="mb-3 h-1.5 w-12 rounded-full bg-brand-400" />
              <h3 className="text-base font-semibold text-slate-950">PO Item Lines</h3>
              <p className="mt-1 text-sm text-slate-600">
                Add all products that belong to this purchase order.
              </p>
            </div>

            <PurchaseOrderItemsFields inputPrefix="create-po" products={productOptions} />

            <div>
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create Purchase Order
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)]">
        <SectionCard
          description="Change an order to Arrived to automatically increase current stock and log a transaction."
          title="Purchase Order List"
        >
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <form className="relative max-w-xl flex-1" method="get">
              {highlightedOrderId ? <input name="highlight" type="hidden" value={highlightedOrderId} /> : null}
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                aria-label="Search purchase orders by product or SKU"
                className="input-field pl-11"
                defaultValue={resolvedSearchParams?.query ?? ""}
                name="query"
                placeholder="Search by product or SKU"
                type="search"
              />
            </form>
            <p className="text-sm text-slate-500 lg:text-right">
              Active {activePurchaseOrders.length} • History {historyPurchaseOrders.length}
            </p>
          </div>

          <div className="space-y-4 md:hidden">
            {activePurchaseOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {query ? "No active purchase orders match that product or SKU." : "No active purchase orders right now."}
              </div>
            ) : (
              activePurchaseOrders.map((purchaseOrder) => {
                const items = orderItemsMap.get(purchaseOrder.id) ?? [];
                const visibleItems = items.filter((item) =>
                  matchesPurchaseOrderItemQuery(item, query, productMap),
                );
                const visibleQuantity = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
                const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

                return (
                  <article
                    className={`scroll-mt-24 space-y-4 rounded-3xl border p-4 shadow-sm transition ${
                      highlightedOrderId === purchaseOrder.id
                        ? "border-brand-300 bg-brand-50/50 ring-2 ring-brand-100"
                        : "border-slate-200 bg-white"
                    }`}
                    data-po-anchor={purchaseOrder.id}
                    key={purchaseOrder.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                          PO Number
                        </p>
                        <p className="mt-1 text-base font-semibold text-slate-950">{purchaseOrder.po_number}</p>
                      </div>
                      <StatusBadge value={displayStatus} />
                    </div>

                    <div className="grid gap-3 text-sm sm:grid-cols-2">
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Supplier</p>
                        <p className="mt-1 text-slate-700">{purchaseOrder.supplier}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Order Date</p>
                        <p className="mt-1 text-slate-700">{formatDate(purchaseOrder.order_date)}</p>
                      </div>
                      <div>
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          {query ? "Matched Quantity" : "Total Quantity"}
                        </p>
                        <p className="mt-1 font-semibold text-slate-950">
                          {query ? visibleQuantity : (totalQuantityByOrder.get(purchaseOrder.id) ?? 0)}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Products</p>
                      {visibleItems.length > 0 ? (
                        visibleItems.map((item) => {
                          const product = productMap.get(item.product_id);

                          return (
                            <div className="rounded-2xl bg-slate-50 px-3 py-3" key={item.id}>
                              <p className="font-medium text-slate-900">{product?.name ?? "Unknown product"}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {product?.sku ?? "No SKU"} • Qty {item.quantity}
                              </p>
                            </div>
                          );
                        })
                      ) : (
                        <p className="rounded-2xl bg-slate-50 px-3 py-3 text-sm text-slate-500">
                          {query ? "No matching product lines in this purchase order." : "No product lines saved yet."}
                        </p>
                      )}
                    </div>

                    {canUpdateStatus ? (
                      <form action={updatePurchaseOrderStatusAction} className="flex flex-col gap-2">
                        <input name="id" type="hidden" value={purchaseOrder.id} />
                        <select className="input-field py-2" defaultValue={displayStatus} name="status">
                          {purchaseOrderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ").toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                          Update Status
                        </SubmitButton>
                      </form>
                    ) : null}

                    {canEdit ? (
                      <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-brand-700">
                          Edit purchase order
                        </summary>
                        <div className="mt-4 space-y-4">
                          <form action={updatePurchaseOrderAction} className="space-y-5">
                            <input name="id" type="hidden" value={purchaseOrder.id} />
                            <div className="grid gap-4 sm:grid-cols-2">
                              <div>
                                <label className="field-label" htmlFor={`po-number-mobile-${purchaseOrder.id}`}>
                                  PO Number
                                </label>
                                <input
                                  className="input-field"
                                  defaultValue={purchaseOrder.po_number}
                                  id={`po-number-mobile-${purchaseOrder.id}`}
                                  name="po_number"
                                  required
                                  type="text"
                                />
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`po-supplier-mobile-${purchaseOrder.id}`}>
                                  Supplier
                                </label>
                                <input
                                  className="input-field"
                                  defaultValue={purchaseOrder.supplier}
                                  id={`po-supplier-mobile-${purchaseOrder.id}`}
                                  name="supplier"
                                  required
                                  type="text"
                                />
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`po-date-mobile-${purchaseOrder.id}`}>
                                  Order Date
                                </label>
                                <div className="date-input-wrap">
                                  <input
                                    className="input-field"
                                    defaultValue={purchaseOrder.order_date}
                                    id={`po-date-mobile-${purchaseOrder.id}`}
                                    name="order_date"
                                    required
                                    type="date"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`po-status-mobile-${purchaseOrder.id}`}>
                                  Status
                                </label>
                                <select
                                  className="input-field"
                                  defaultValue={displayStatus}
                                  id={`po-status-mobile-${purchaseOrder.id}`}
                                  name="status"
                                >
                                  {purchaseOrderStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status.replace("_", " ").toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            <PurchaseOrderItemsFields
                              initialItems={items.map((item) => ({
                                product_id: item.product_id,
                                quantity: item.quantity,
                              }))}
                              inputPrefix={`po-mobile-${purchaseOrder.id}`}
                              products={productOptions}
                            />

                            <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                              Save Changes
                            </SubmitButton>
                          </form>

                          {isAdmin ? (
                            <form action={deletePurchaseOrderAction}>
                              <input name="id" type="hidden" value={purchaseOrder.id} />
                              <SubmitButton className="btn-danger w-full justify-center" pendingLabel="Deleting...">
                                Delete Purchase Order
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </details>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="min-w-full table-fixed text-left text-sm">
              <colgroup>
                <col className="w-[16%]" />
                <col className="w-[36%]" />
                <col className="w-[12%]" />
                <col className="w-[13%]" />
                <col className="w-[11%]" />
                <col className="w-[12%]" />
              </colgroup>
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="pb-3 pr-4 font-medium text-left">PO Number</th>
                  <th className="pb-3 pr-6 font-medium text-left">Products</th>
                  <th className="pb-3 px-2 text-center font-medium">Total Quantity</th>
                  <th className="pb-3 px-3 text-center font-medium">Supplier</th>
                  <th className="pb-3 px-3 text-center font-medium">Order Date</th>
                  <th className="px-3 pb-3 text-center font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {activePurchaseOrders.map((purchaseOrder) => {
                  const items = orderItemsMap.get(purchaseOrder.id) ?? [];
                  const visibleItems = items.filter((item) =>
                    matchesPurchaseOrderItemQuery(item, query, productMap),
                  );
                  const visibleQuantity = visibleItems.reduce((sum, item) => sum + item.quantity, 0);
                  const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

                  return (
                    <Fragment key={purchaseOrder.id}>
                      <tr
                        className={`scroll-mt-24 align-top ${
                          highlightedOrderId === purchaseOrder.id
                            ? "bg-brand-50/40"
                            : "bg-transparent"
                        } ${canEdit ? "border-b-0" : "border-b"} border-slate-100 last:border-b-0`}
                        data-po-anchor={purchaseOrder.id}
                      >
                        <td className="py-4 pr-4">
                          <p className="font-medium text-slate-950">{purchaseOrder.po_number}</p>
                        </td>
                        <td className="py-4 pr-6 text-slate-600">
                          <div className="space-y-2">
                            {visibleItems.length > 0 ? (
                              visibleItems.map((item) => {
                                const product = productMap.get(item.product_id);

                                return (
                                  <div className="rounded-xl bg-slate-50 px-3 py-2" key={item.id}>
                                    <p className="font-medium text-slate-900">
                                      {product?.name ?? "Unknown product"}
                                    </p>
                                    <p className="text-xs text-slate-500">
                                      {product?.sku ?? "No SKU"} • Qty {item.quantity}
                                    </p>
                                  </div>
                                );
                              })
                            ) : (
                              <p className="text-sm text-slate-500">
                                {query ? "No matching product lines in this purchase order." : "No product lines saved yet."}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-2 text-center text-slate-950">
                          {query ? visibleQuantity : (totalQuantityByOrder.get(purchaseOrder.id) ?? 0)}
                        </td>
                        <td className="py-4 px-3 text-center text-slate-600">{purchaseOrder.supplier}</td>
                        <td className="py-4 px-3 text-center text-slate-600">{formatDate(purchaseOrder.order_date)}</td>
                        <td className="px-3 py-4">
                          <div className="space-y-3 text-center">
                            <div className="flex justify-center">
                              <StatusBadge value={displayStatus} />
                            </div>
                            {canUpdateStatus ? (
                              <form action={updatePurchaseOrderStatusAction} className="flex flex-col gap-2 xl:flex-row">
                                <input name="id" type="hidden" value={purchaseOrder.id} />
                                <select
                                  className="input-field min-w-0 flex-1 py-2"
                                  defaultValue={displayStatus}
                                  name="status"
                                >
                                  {purchaseOrderStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status.replace("_", " ").toUpperCase()}
                                    </option>
                                  ))}
                                </select>
                                <SubmitButton className="btn-secondary" pendingLabel="Saving...">
                                  Update
                                </SubmitButton>
                              </form>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                      {canEdit ? (
                        <tr
                          className={`border-b border-slate-100 ${
                            highlightedOrderId === purchaseOrder.id ? "bg-brand-50/20" : "bg-transparent"
                          }`}
                        >
                          <td className="pb-4 pt-0" colSpan={6}>
                            <details className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                              <summary className="cursor-pointer text-sm font-medium text-brand-700">
                                Edit purchase order
                              </summary>
                              <div className="mt-5 space-y-5">
                                <form action={updatePurchaseOrderAction} className="space-y-5">
                                  <input name="id" type="hidden" value={purchaseOrder.id} />
                                  <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-4">
                                    <div>
                                      <label className="field-label" htmlFor={`po-number-${purchaseOrder.id}`}>
                                        PO Number
                                      </label>
                                      <input
                                        className="input-field"
                                        defaultValue={purchaseOrder.po_number}
                                        id={`po-number-${purchaseOrder.id}`}
                                        name="po_number"
                                        required
                                        type="text"
                                      />
                                    </div>
                                    <div>
                                      <label className="field-label" htmlFor={`po-supplier-${purchaseOrder.id}`}>
                                        Supplier
                                      </label>
                                      <input
                                        className="input-field"
                                        defaultValue={purchaseOrder.supplier}
                                        id={`po-supplier-${purchaseOrder.id}`}
                                        name="supplier"
                                        required
                                        type="text"
                                      />
                                    </div>
                                    <div>
                                      <label className="field-label" htmlFor={`po-date-${purchaseOrder.id}`}>
                                        Order Date
                                      </label>
                                      <div className="date-input-wrap">
                                        <input
                                          className="input-field"
                                          defaultValue={purchaseOrder.order_date}
                                          id={`po-date-${purchaseOrder.id}`}
                                          name="order_date"
                                          required
                                          type="date"
                                        />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="field-label" htmlFor={`po-status-edit-${purchaseOrder.id}`}>
                                        Status
                                      </label>
                                      <select
                                        className="input-field"
                                        defaultValue={displayStatus}
                                        id={`po-status-edit-${purchaseOrder.id}`}
                                        name="status"
                                      >
                                        {purchaseOrderStatuses.map((status) => (
                                          <option key={status} value={status}>
                                            {status.replace("_", " ").toUpperCase()}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  </div>

                                  <PurchaseOrderItemsFields
                                    initialItems={items.map((item) => ({
                                      product_id: item.product_id,
                                      quantity: item.quantity,
                                    }))}
                                    inputPrefix={`po-${purchaseOrder.id}`}
                                    products={productOptions}
                                  />

                                  <div className="flex flex-wrap gap-3">
                                    <SubmitButton className="btn-secondary min-w-40" pendingLabel="Saving...">
                                      Save Changes
                                    </SubmitButton>
                                  </div>
                                </form>

                                {isAdmin ? (
                                  <form action={deletePurchaseOrderAction}>
                                    <input name="id" type="hidden" value={purchaseOrder.id} />
                                    <SubmitButton className="btn-danger min-w-48" pendingLabel="Deleting...">
                                      Delete Purchase Order
                                    </SubmitButton>
                                  </form>
                                ) : null}
                              </div>
                            </details>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
                {activePurchaseOrders.length === 0 ? (
                  <tr>
                    <td className="py-6 text-sm text-slate-500" colSpan={6}>
                      {query ? "No active purchase orders match that product or SKU." : "No active purchase orders right now."}
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          description="Arrived purchase orders are archived here so your active list stays shorter."
          title="History"
        >
          <div className="mb-4 text-sm text-slate-500">Arrived purchase orders: {historyPurchaseOrders.length}</div>

          <div className="space-y-3">
            {historyPurchaseOrders.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                {query ? "No arrived purchase orders match that product or SKU." : "No arrived purchase orders yet."}
              </div>
            ) : (
              historyPurchaseOrders.map((purchaseOrder) => {
                const items = orderItemsMap.get(purchaseOrder.id) ?? [];
                const visibleItems = items.filter((item) =>
                  matchesPurchaseOrderItemQuery(item, query, productMap),
                );
                const quantity = query
                  ? visibleItems.reduce((sum, item) => sum + item.quantity, 0)
                  : (totalQuantityByOrder.get(purchaseOrder.id) ?? 0);
                const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

                return (
                  <article
                    className={`scroll-mt-24 rounded-3xl border p-4 shadow-sm transition ${
                      highlightedOrderId === purchaseOrder.id
                        ? "border-brand-300 bg-brand-50/50 ring-2 ring-brand-100"
                        : "border-slate-200 bg-white"
                    }`}
                    data-po-anchor={purchaseOrder.id}
                    key={purchaseOrder.id}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{purchaseOrder.po_number}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {purchaseOrder.supplier} • {formatDate(purchaseOrder.order_date)}
                        </p>
                      </div>
                      <StatusBadge value={displayStatus} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Quantity</p>
                        <p className="mt-1 text-sm font-semibold text-slate-950">{quantity}</p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Products</p>
                        <div className="mt-1 space-y-1 text-sm text-slate-700">
                          {(visibleItems.length > 0 ? visibleItems : items.slice(0, 3)).map((item) => {
                            const product = productMap.get(item.product_id);

                            return (
                              <p key={item.id}>
                                {product?.name ?? "Unknown product"} • Qty {item.quantity}
                              </p>
                            );
                          })}
                          {(query ? visibleItems.length : items.length) === 0 ? (
                            <p className="text-slate-500">No product lines saved yet.</p>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {canUpdateStatus ? (
                      <form action={updatePurchaseOrderStatusAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input name="id" type="hidden" value={purchaseOrder.id} />
                        <select className="input-field min-w-0 flex-1 py-2" defaultValue={displayStatus} name="status">
                          {purchaseOrderStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ").toUpperCase()}
                            </option>
                          ))}
                        </select>
                        <SubmitButton className="btn-secondary justify-center" pendingLabel="Saving...">
                          Update
                        </SubmitButton>
                      </form>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
