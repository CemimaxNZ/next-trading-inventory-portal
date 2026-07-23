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
import type { PurchaseOrderRow, ShipmentRow } from "@/lib/database.types";
import { canManageOrders, canUpdateOperationalStatus } from "@/lib/permissions";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatEnumLabel } from "@/lib/utils";

function getVisibleShipmentStatus(status: ShipmentRow["arrival_status"]) {
  return status === "completed" ? "arrived" : status;
}

function getShipmentOrderIds(shipment: ShipmentRow) {
  if (shipment.linked_purchase_order_ids.length > 0) {
    return shipment.linked_purchase_order_ids;
  }

  return shipment.linked_purchase_order_id ? [shipment.linked_purchase_order_id] : [];
}

function formatShipmentLinkedPos(shipment: ShipmentRow, orderMap: Map<string, PurchaseOrderRow>) {
  const linkedOrderIds = getShipmentOrderIds(shipment);

  if (linkedOrderIds.length === 0) {
    return "None";
  }

  return linkedOrderIds
    .map((orderId) => orderMap.get(orderId)?.po_number ?? "Unknown PO")
    .join(", ");
}

export default async function ShipmentsPage() {
  const { supabase, profile } = await requirePortalUser();
  const [{ data: shipmentsData }, { data: ordersData }] = await Promise.all([
    supabase.from("shipments").select("*").order("eta"),
    supabase.from("purchase_orders").select("*").order("po_number"),
  ]);

  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const orders = (ordersData ?? []) as PurchaseOrderRow[];
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
          description="Track a container by its ETD, ETA, status, and one or more linked purchase orders."
          title="Create Shipment"
        >
          <form action={createShipmentAction} className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="container_number">
                Container Number
              </label>
              <input className="input-field" id="container_number" name="container_number" required type="text" />
            </div>
            <div>
              <label className="field-label" htmlFor="etd">
                ETD
              </label>
              <input className="input-field" defaultValue={today} id="etd" name="etd" type="date" />
            </div>
            <div>
              <label className="field-label" htmlFor="eta">
                ETA
              </label>
              <input className="input-field" defaultValue={today} id="eta" name="eta" required type="date" />
            </div>
            <div>
              <label className="field-label" htmlFor="shipment-status">
                Status
              </label>
              <select className="input-field" defaultValue="scheduled" id="shipment-status" name="arrival_status">
                {shipmentStatuses.map((status) => (
                  <option key={status} value={status}>
                    {formatEnumLabel(status)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label" htmlFor="linked_purchase_order_ids">
                Linked Purchase Orders
              </label>
              <select className="input-field min-h-40" id="linked_purchase_order_ids" multiple name="linked_purchase_order_ids">
                {orders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.po_number}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-slate-500">Hold Command or Control to select multiple POs.</p>
            </div>
            <div className="md:col-span-2">
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
          {shipments.map((shipment) => {
            const shipmentStatus = getVisibleShipmentStatus(shipment.arrival_status);

            return (
              <article
              className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
              key={shipment.id}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">Container</p>
                  <p className="mt-1 text-base font-semibold text-slate-950">{shipment.container_number}</p>
                </div>
                <StatusBadge value={shipmentStatus} />
              </div>

              <div className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETD</p>
                  <p className="mt-1 text-slate-700">{shipment.etd ? formatDate(shipment.etd) : "Not specified"}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Linked PO</p>
                  <p className="mt-1 text-slate-700">{formatShipmentLinkedPos(shipment, orderMap)}</p>
                </div>
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETA</p>
                  <p className="mt-1 text-slate-700">{formatDate(shipment.eta)}</p>
                </div>
              </div>

              {canUpdateStatus ? (
                <form action={updateShipmentStatusAction} className="flex flex-col gap-2">
                  <input name="id" type="hidden" value={shipment.id} />
                  <select className="input-field py-2" defaultValue={shipmentStatus} name="status">
                    {shipmentStatuses.map((status) => (
                      <option key={status} value={status}>
                        {formatEnumLabel(status)}
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
                        <label className="field-label" htmlFor={`etd-mobile-${shipment.id}`}>
                          ETD
                        </label>
                        <input
                          className="input-field"
                          defaultValue={shipment.etd ?? ""}
                          id={`etd-mobile-${shipment.id}`}
                          name="etd"
                          type="date"
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
                            Status
                        </label>
                        <select
                          className="input-field"
                          defaultValue={shipmentStatus}
                          id={`status-mobile-${shipment.id}`}
                          name="arrival_status"
                        >
                          {shipmentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatEnumLabel(status)}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="field-label" htmlFor={`linked-pos-mobile-${shipment.id}`}>
                          Linked Purchase Orders
                        </label>
                        <select
                          className="input-field min-h-40"
                          defaultValue={getShipmentOrderIds(shipment)}
                          id={`linked-pos-mobile-${shipment.id}`}
                          multiple
                          name="linked_purchase_order_ids"
                        >
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
            );
          })}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Container</th>
                <th className="pb-3 font-medium">ETD</th>
                <th className="pb-3 font-medium">ETA</th>
                <th className="pb-3 font-medium">Linked PO</th>
                <th className="pb-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((shipment) => {
                const shipmentStatus = getVisibleShipmentStatus(shipment.arrival_status);

                return (
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
                              <label className="field-label" htmlFor={`etd-${shipment.id}`}>
                                ETD
                              </label>
                              <input
                                className="input-field"
                                defaultValue={shipment.etd ?? ""}
                                id={`etd-${shipment.id}`}
                                name="etd"
                                type="date"
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
                                Status
                              </label>
                              <select
                                className="input-field"
                                defaultValue={shipmentStatus}
                                id={`status-${shipment.id}`}
                                name="arrival_status"
                              >
                                {shipmentStatuses.map((status) => (
                                  <option key={status} value={status}>
                                    {formatEnumLabel(status)}
                                  </option>
                                ))}
                              </select>
                            </div>
                            <div className="md:col-span-3">
                              <label className="field-label" htmlFor={`linked-pos-${shipment.id}`}>
                                Linked Purchase Orders
                              </label>
                              <select
                                className="input-field min-h-40"
                                defaultValue={getShipmentOrderIds(shipment)}
                                id={`linked-pos-${shipment.id}`}
                                multiple
                                name="linked_purchase_order_ids"
                              >
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
                  <td className="py-4 text-slate-600">{shipment.etd ? formatDate(shipment.etd) : "Not specified"}</td>
                  <td className="py-4 text-slate-600">{formatDate(shipment.eta)}</td>
                  <td className="py-4 text-slate-600">{formatShipmentLinkedPos(shipment, orderMap)}</td>
                  <td className="py-4">
                    <div className="space-y-3">
                      <StatusBadge value={shipmentStatus} />
                      {canUpdateStatus ? (
                        <form action={updateShipmentStatusAction} className="flex flex-col gap-2 lg:flex-row">
                          <input name="id" type="hidden" value={shipment.id} />
                          <select className="input-field min-w-36 py-2" defaultValue={shipmentStatus} name="status">
                            {shipmentStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatEnumLabel(status)}
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
