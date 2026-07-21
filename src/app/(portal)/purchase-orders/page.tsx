import {
  createPurchaseOrderAction,
  deletePurchaseOrderAction,
  updatePurchaseOrderAction,
  updatePurchaseOrderStatusAction,
} from "@/app/actions/purchase-orders";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { purchaseOrderStatuses } from "@/lib/constants";
import type { ProductRow, PurchaseOrderRow } from "@/lib/database.types";
import { canManageOrders, canUpdateOperationalStatus } from "@/lib/permissions";
import { requirePortalUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function PurchaseOrdersPage() {
  const { supabase, profile } = await requirePortalUser();
  const [{ data: ordersData }, { data: productsData }] = await Promise.all([
    supabase.from("purchase_orders").select("*").order("order_date", { ascending: false }),
    supabase.from("products").select("*").order("name"),
  ]);

  const purchaseOrders = (ordersData ?? []) as PurchaseOrderRow[];
  const products = (productsData ?? []) as ProductRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const isAdmin = canManageOrders(profile.role);
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        description="Track supplier orders and move stock into inventory when goods arrive."
        title="Purchase Orders"
      />

      {isAdmin ? (
        <SectionCard
          description="Create a new purchase order record."
          title="Create Purchase Order"
        >
          <form action={createPurchaseOrderAction} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="po_number">
                PO Number
              </label>
              <input className="input-field" id="po_number" name="po_number" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="po-product">
                Product
              </label>
              <select className="input-field" id="po-product" name="product_id" required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="quantity">
                Quantity
              </label>
              <input className="input-field" id="quantity" min="1" name="quantity" required type="number" />
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
            <div className="md:col-span-3">
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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">PO Number</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Supplier</th>
                <th className="pb-3 font-medium">Order Date</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {purchaseOrders.map((purchaseOrder) => (
                <tr className="border-b border-slate-100 align-top last:border-b-0" key={purchaseOrder.id}>
                  <td className="py-4">
                    <p className="font-medium text-slate-950">{purchaseOrder.po_number}</p>
                    {isAdmin ? (
                      <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-brand-700">
                          Edit purchase order
                        </summary>
                        <div className="mt-4 space-y-4">
                          <form action={updatePurchaseOrderAction} className="grid gap-4 md:grid-cols-3">
                            <input name="id" type="hidden" value={purchaseOrder.id} />
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
                              <label className="field-label" htmlFor={`po-product-${purchaseOrder.id}`}>
                                Product
                              </label>
                              <select
                                className="input-field"
                                defaultValue={purchaseOrder.product_id}
                                id={`po-product-${purchaseOrder.id}`}
                                name="product_id"
                                required
                              >
                                {products.map((product) => (
                                  <option key={product.id} value={product.id}>
                                    {product.name} ({product.sku})
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`po-qty-${purchaseOrder.id}`}>
                                Quantity
                              </label>
                              <input
                                className="input-field"
                                defaultValue={purchaseOrder.quantity}
                                id={`po-qty-${purchaseOrder.id}`}
                                min="1"
                                name="quantity"
                                required
                                type="number"
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
                                defaultValue={purchaseOrder.status}
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
                            <div className="md:col-span-3">
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
                  <td className="py-4 text-slate-600">
                    {productMap.get(purchaseOrder.product_id)?.name ?? "Unknown product"}
                  </td>
                  <td className="py-4 text-slate-950">{purchaseOrder.quantity}</td>
                  <td className="py-4 text-slate-600">{purchaseOrder.supplier}</td>
                  <td className="py-4 text-slate-600">{formatDate(purchaseOrder.order_date)}</td>
                  <td className="py-4">
                    <div className="space-y-3">
                      <StatusBadge value={purchaseOrder.status} />
                      {canUpdateStatus ? (
                        <form action={updatePurchaseOrderStatusAction} className="flex gap-2">
                          <input name="id" type="hidden" value={purchaseOrder.id} />
                          <select className="input-field min-w-36 py-2" defaultValue={purchaseOrder.status} name="status">
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
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}

