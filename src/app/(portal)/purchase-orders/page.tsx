import {
  createPurchaseOrderAction,
  deletePurchaseOrderAction,
  updatePurchaseOrderAction,
  updatePurchaseOrderStatusAction,
} from "@/app/actions/purchase-orders";
import { PurchaseOrderItemsFields } from "@/components/purchase-orders/purchase-order-items-fields";
import { PurchaseOrderHighlight } from "@/components/purchase-orders/purchase-order-highlight";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { purchaseOrderStatuses } from "@/lib/constants";
import type { ProductRow, PurchaseOrderItemRow, PurchaseOrderRow } from "@/lib/database.types";
import { canManageOrders, canUpdateOperationalStatus } from "@/lib/permissions";
import {
  buildLegacyPurchaseOrderItems,
  normalizePurchaseOrderStatus,
} from "@/lib/purchase-orders";
import { requirePortalUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

type PurchaseOrdersPageProps = {
  searchParams?: Promise<{
    error?: string;
    highlight?: string;
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

  const isAdmin = canManageOrders(profile.role);
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const today = new Date().toISOString().slice(0, 10);

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

      {isAdmin ? (
        <SectionCard
          description="Create one purchase order with one or more product lines."
          title="Create Purchase Order"
        >
          <form action={createPurchaseOrderAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <label className="field-label" htmlFor="po_number">
                  PO Number
                </label>
                <input className="input-field" id="po_number" name="po_number" required type="text" />
              </div>
              <div>
                <label className="field-label" htmlFor="supplier">
                  Supplier
                </label>
                <input className="input-field" id="supplier" name="supplier" required type="text" />
              </div>
              <div>
                <label className="field-label" htmlFor="order_date">
                  Order Date
                </label>
                <input className="input-field" defaultValue={today} id="order_date" name="order_date" required type="date" />
              </div>
              <div>
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

      <SectionCard
        description="Change an order to Arrived to automatically increase current stock and log a transaction."
        title="Purchase Order List"
      >
        <div className="space-y-4 md:hidden">
          {purchaseOrders.map((purchaseOrder) => {
            const items = orderItemsMap.get(purchaseOrder.id) ?? [];
            const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

            return (
              <article
                className={`scroll-mt-24 space-y-4 rounded-3xl border p-4 shadow-sm transition ${
                  highlightedOrderId === purchaseOrder.id
                    ? "border-brand-300 bg-brand-50/50 ring-2 ring-brand-100"
                    : "border-slate-200 bg-white"
                }`}
                id={`po-${purchaseOrder.id}`}
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
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Total Quantity</p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {totalQuantityByOrder.get(purchaseOrder.id) ?? 0}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Products</p>
                  {items.length > 0 ? (
                    items.map((item) => {
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
                      No product lines saved yet.
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

                {isAdmin ? (
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
                            <input
                              className="input-field"
                              defaultValue={purchaseOrder.order_date}
                              id={`po-date-mobile-${purchaseOrder.id}`}
                              name="order_date"
                              required
                              type="date"
                            />
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

                      <form action={deletePurchaseOrderAction}>
                        <input name="id" type="hidden" value={purchaseOrder.id} />
                        <SubmitButton className="btn-danger w-full justify-center" pendingLabel="Deleting...">
                          Delete Purchase Order
                        </SubmitButton>
                      </form>
                    </div>
                  </details>
                ) : null}
              </article>
            );
          })}
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
                <th className="pb-3 pr-4 font-medium">PO Number</th>
                <th className="pb-3 pr-6 font-medium">Products</th>
                <th className="pb-3 px-2 text-center font-medium">Total Quantity</th>
                <th className="pb-3 px-3 text-center font-medium">Supplier</th>
                <th className="pb-3 px-3 text-center font-medium">Order Date</th>
                <th className="pb-3 pl-4 text-center font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((purchaseOrder) => {
                const items = orderItemsMap.get(purchaseOrder.id) ?? [];
                const displayStatus = normalizePurchaseOrderStatus(purchaseOrder.status);

                return (
                  <tr
                    className={`scroll-mt-24 border-b align-top last:border-b-0 ${
                      highlightedOrderId === purchaseOrder.id
                        ? "border-brand-200 bg-brand-50/40"
                        : "border-slate-100"
                    }`}
                    id={`po-${purchaseOrder.id}`}
                    key={purchaseOrder.id}
                  >
                    <td className="py-4 pr-4">
                      <p className="font-medium text-slate-950">{purchaseOrder.po_number}</p>
                      {isAdmin ? (
                        <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <summary className="cursor-pointer text-sm font-medium text-brand-700">
                            Edit purchase order
                          </summary>
                          <div className="mt-4 space-y-4">
                            <form action={updatePurchaseOrderAction} className="space-y-5">
                              <input name="id" type="hidden" value={purchaseOrder.id} />
                              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                                  <input
                                    className="input-field"
                                    defaultValue={purchaseOrder.order_date}
                                    id={`po-date-${purchaseOrder.id}`}
                                    name="order_date"
                                    required
                                    type="date"
                                  />
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

                              <div>
                                <SubmitButton className="btn-secondary" pendingLabel="Saving...">
                                  Save Changes
                                </SubmitButton>
                              </div>
                            </form>

                            <form action={deletePurchaseOrderAction}>
                              <input name="id" type="hidden" value={purchaseOrder.id} />
                              <SubmitButton className="btn-danger" pendingLabel="Deleting...">
                                Delete Purchase Order
                              </SubmitButton>
                            </form>
                          </div>
                        </details>
                      ) : null}
                    </td>
                    <td className="py-4 pr-6 text-slate-600">
                      <div className="space-y-2">
                        {items.length > 0 ? (
                          items.map((item) => {
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
                          <p className="text-sm text-slate-500">No product lines saved yet.</p>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-2 text-center text-slate-950">
                      {totalQuantityByOrder.get(purchaseOrder.id) ?? 0}
                    </td>
                    <td className="py-4 px-3 text-center text-slate-600">{purchaseOrder.supplier}</td>
                    <td className="py-4 px-3 text-center text-slate-600">{formatDate(purchaseOrder.order_date)}</td>
                    <td className="py-4 pl-4">
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
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
