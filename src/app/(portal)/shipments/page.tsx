import {
  createShipmentAction,
  deleteShipmentAction,
  updateShipmentAction,
  updateShipmentStatusAction,
} from "@/app/actions/shipments";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { shipmentStatuses } from "@/lib/constants";
import type { ProductRow, PurchaseOrderRow, ShipmentRow } from "@/lib/database.types";
import { canManageOrders, canUpdateOperationalStatus } from "@/lib/permissions";
import { requirePortalUser } from "@/lib/session";
import { formatDate } from "@/lib/utils";

export default async function ShipmentsPage() {
  const { supabase, profile } = await requirePortalUser();
  const [{ data: shipmentsData }, { data: productsData }, { data: ordersData }] = await Promise.all([
    supabase.from("shipments").select("*").order("eta"),
    supabase.from("products").select("*").order("name"),
    supabase.from("purchase_orders").select("*").order("po_number"),
  ]);

  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const products = (productsData ?? []) as ProductRow[];
  const orders = (ordersData ?? []) as PurchaseOrderRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const isAdmin = canManageOrders(profile.role);
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        description="Monitor inbound containers and move units into stock when they arrive."
        title="Shipments"
      />

      {isAdmin ? (
        <SectionCard
          description="Create a shipment record tied to a product and optional purchase order."
          title="Create Shipment"
        >
          <form action={createShipmentAction} className="grid gap-4 md:grid-cols-3">
            <div>
              <label className="field-label" htmlFor="container_number">
                Container Number
              </label>
              <input className="input-field" id="container_number" name="container_number" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="shipment-product">
                Product
              </label>
              <select className="input-field" id="shipment-product" name="product_id" required>
                <option value="">Select product</option>
                {products.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="shipment-quantity">
                Quantity
              </label>
              <input className="input-field" id="shipment-quantity" min="1" name="quantity" required type="number" />
            </div>
            <div>
              <label className="field-label" htmlFor="eta">
                ETA
              </label>
              <input className="input-field" defaultValue={today} id="eta" name="eta" required type="date" />
            </div>
            <div>
              <label className="field-label" htmlFor="shipment-status">
                Arrival Status
              </label>
              <select className="input-field" defaultValue="at_sea" id="shipment-status" name="arrival_status">
                {shipmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {status.replace("_", " ").toUpperCase()}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="linked_purchase_order_id">
                Linked Purchase Order
              </label>
              <select className="input-field" id="linked_purchase_order_id" name="linked_purchase_order_id">
                <option value="">Optional</option>
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.po_number}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-3">
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create Shipment
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <SectionCard
        description="Changing a shipment to Arrived automatically moves units from in-transit stock into current stock."
        title="Shipment List"
      >
        <div className="space-y-4 md:hidden">
          {shipments.map((shipment) => (
            <article
              className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              key={shipment.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Container</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{shipment.container_number}</p>
                </div>
                <StatusBadge value={shipment.arrival_status} />
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Product</p>
                  <p className="mt-1 text-slate-700">
                    {productMap.get(shipment.product_id)?.name ?? "Unknown product"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Quantity</p>
                  <p className="mt-1 font-semibold text-slate-950">{shipment.quantity}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETA</p>
                  <p className="mt-1 text-slate-700">{formatDate(shipment.eta)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Linked PO</p>
                  <p className="mt-1 text-slate-700">
                    {shipment.linked_purchase_order_id
                      ? orderMap.get(shipment.linked_purchase_order_id)?.po_number ?? "Unknown PO"
                      : "None"}
                  </p>
                </div>
              </div>

              {canUpdateStatus ? (
                <form action={updateShipmentStatusAction} className="flex flex-col gap-2">
                  <input name="id" type="hidden" value={shipment.id} />
                  <select className="input-field py-2" defaultValue={shipment.arrival_status} name="status">
                    {shipmentStatuses.map((status) => (
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
                    Edit shipment
                  </summary>
                  <div className="mt-4 space-y-4">
                    <form action={updateShipmentAction} className="grid gap-4 sm:grid-cols-2">
                      <input name="id" type="hidden" value={shipment.id} />
                      <div>
                        <label className="field-label" htmlFor={`container-mobile-${shipment.id}`}>
                          Container Number
                        </label>
                        <input
                          className="input-field"
                          defaultValue={shipment.container_number}
                          id={`container-mobile-${shipment.id}`}
                          name="container_number"
                          required
                          type="text"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`product-mobile-${shipment.id}`}>
                          Product
                        </label>
                        <select
                          className="input-field"
                          defaultValue={shipment.product_id}
                          id={`product-mobile-${shipment.id}`}
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
                        <label className="field-label" htmlFor={`quantity-mobile-${shipment.id}`}>
                          Quantity
                        </label>
                        <input
                          className="input-field"
                          defaultValue={shipment.quantity}
                          id={`quantity-mobile-${shipment.id}`}
                          min="1"
                          name="quantity"
                          required
                          type="number"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`eta-mobile-${shipment.id}`}>
                          ETA
                        </label>
                        <input
                          className="input-field"
                          defaultValue={shipment.eta}
                          id={`eta-mobile-${shipment.id}`}
                          name="eta"
                          required
                          type="date"
                        />
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`status-mobile-${shipment.id}`}>
                          Arrival Status
                        </label>
                        <select
                          className="input-field"
                          defaultValue={shipment.arrival_status}
                          id={`status-mobile-${shipment.id}`}
                          name="arrival_status"
                        >
                          {shipmentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {status.replace("_", " ").toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`linked-po-mobile-${shipment.id}`}>
                          Linked Purchase Order
                        </label>
                        <select
                          className="input-field"
                          defaultValue={shipment.linked_purchase_order_id ?? ""}
                          id={`linked-po-mobile-${shipment.id}`}
                          name="linked_purchase_order_id"
                        >
                          <option value="">Optional</option>
                          {orders.map((order) => (
                            <option key={order.id} value={order.id}>
                              {order.po_number}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="sm:col-span-2">
                        <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                          Save Changes
                        </SubmitButton>
                      </div>
                    </form>

                    <form action={deleteShipmentAction}>
                      <input name="id" type="hidden" value={shipment.id} />
                      <SubmitButton className="btn-danger w-full justify-center" pendingLabel="Deleting...">
                        Delete Shipment
                      </SubmitButton>
                    </form>
                  </div>
                </details>
              ) : null}
            </article>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Container</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">ETA</th>
                <th className="pb-3 font-medium">Linked PO</th>
                <th className="pb-3 font-medium">Arrival Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => (
                <tr className="border-b border-slate-100 align-top last:border-b-0" key={shipment.id}>
                  <td className="py-4">
                    <p className="font-medium text-slate-950">{shipment.container_number}</p>
                    {isAdmin ? (
                      <details className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                        <summary className="cursor-pointer text-sm font-medium text-brand-700">
                          Edit shipment
                        </summary>
                        <div className="mt-4 space-y-4">
                          <form action={updateShipmentAction} className="grid gap-4 md:grid-cols-3">
                            <input name="id" type="hidden" value={shipment.id} />
                            <div>
                              <label className="field-label" htmlFor={`container-${shipment.id}`}>
                                Container Number
                              </label>
                              <input
                                className="input-field"
                                defaultValue={shipment.container_number}
                                id={`container-${shipment.id}`}
                                name="container_number"
                                required
                                type="text"
                              />
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`product-${shipment.id}`}>
                                Product
                              </label>
                              <select
                                className="input-field"
                                defaultValue={shipment.product_id}
                                id={`product-${shipment.id}`}
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
                              <label className="field-label" htmlFor={`quantity-${shipment.id}`}>
                                Quantity
                              </label>
                              <input
                                className="input-field"
                                defaultValue={shipment.quantity}
                                id={`quantity-${shipment.id}`}
                                min="1"
                                name="quantity"
                                required
                                type="number"
                              />
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`eta-${shipment.id}`}>
                                ETA
                              </label>
                              <input
                                className="input-field"
                                defaultValue={shipment.eta}
                                id={`eta-${shipment.id}`}
                                name="eta"
                                required
                                type="date"
                              />
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`status-${shipment.id}`}>
                                Arrival Status
                              </label>
                              <select
                                className="input-field"
                                defaultValue={shipment.arrival_status}
                                id={`status-${shipment.id}`}
                                name="arrival_status"
                              >
                                {shipmentStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {status.replace("_", " ").toUpperCase()}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`linked-po-${shipment.id}`}>
                                Linked Purchase Order
                              </label>
                              <select
                                className="input-field"
                                defaultValue={shipment.linked_purchase_order_id ?? ""}
                                id={`linked-po-${shipment.id}`}
                                name="linked_purchase_order_id"
                              >
                                <option value="">Optional</option>
                                {orders.map((order) => (
                                  <option key={order.id} value={order.id}>
                                    {order.po_number}
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

                          <form action={deleteShipmentAction}>
                            <input name="id" type="hidden" value={shipment.id} />
                            <SubmitButton className="btn-danger" pendingLabel="Deleting...">
                              Delete Shipment
                            </SubmitButton>
                          </form>
                        </div>
                      </details>
                    ) : null}
                  </td>
                  <td className="py-4 text-slate-600">
                    {productMap.get(shipment.product_id)?.name ?? "Unknown product"}
                  </td>
                  <td className="py-4 text-slate-950">{shipment.quantity}</td>
                  <td className="py-4 text-slate-600">{formatDate(shipment.eta)}</td>
                  <td className="py-4 text-slate-600">
                    {shipment.linked_purchase_order_id
                      ? orderMap.get(shipment.linked_purchase_order_id)?.po_number ?? "Unknown PO"
                      : "None"}
                  </td>
                  <td className="py-4">
                    <div className="space-y-3">
                      <StatusBadge value={shipment.arrival_status} />
                      {canUpdateStatus ? (
                        <form action={updateShipmentStatusAction} className="flex flex-col gap-2 lg:flex-row">
                          <input name="id" type="hidden" value={shipment.id} />
                          <select className="input-field min-w-36 py-2" defaultValue={shipment.arrival_status} name="status">
                            {shipmentStatuses.map((status) => (
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
