import Link from "next/link";
import {
  createShipmentAction,
  deleteShipmentAction,
  updateShipmentAction,
  updateShipmentStatusAction,
} from "@/app/actions/shipments";
import { SubmitButton } from "@/components/forms/submit-button";
import { ShipmentPurchaseOrderPicker } from "@/components/forms/shipment-purchase-order-picker";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { shipmentStatuses } from "@/lib/constants";
import type { PurchaseOrderRow, ShipmentRow } from "@/lib/database.types";
import {
  canCreateOrders,
  canEditOrders,
  canManageOrders,
  canUpdateOperationalStatus,
} from "@/lib/permissions";
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

function getAvailableOrderOptions(
  orders: PurchaseOrderRow[],
  shipments: ShipmentRow[],
  currentShipment?: ShipmentRow,
) {
  const currentOrderIds = new Set(currentShipment ? getShipmentOrderIds(currentShipment) : []);
  const usedOrderIds = new Set(
    shipments
      .filter((shipment) => shipment.id !== currentShipment?.id)
      .flatMap(getShipmentOrderIds),
  );

  return orders
    .filter((order) => !usedOrderIds.has(order.id) || currentOrderIds.has(order.id))
    .map((order) => ({
      id: order.id,
      po_number: order.po_number,
      supplier: order.supplier,
    }));
}

function getShipmentLinkedPoDisplay(shipment: ShipmentRow, orderMap: Map<string, PurchaseOrderRow>) {
  const linkedOrderIds = getShipmentOrderIds(shipment);

  if (linkedOrderIds.length === 0) {
    return <span className="text-slate-500">None</span>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {linkedOrderIds.map((orderId) => (
        <Link
          className="inline-flex rounded-full bg-brand-50 px-2.5 py-1 text-xs font-medium text-slate-700 transition hover:bg-brand-100 hover:text-slate-950"
          href={`/purchase-orders?highlight=${orderId}`}
          key={orderId}
        >
          {orderMap.get(orderId)?.po_number ?? "Unknown PO"}
        </Link>
      ))}
    </div>
  );
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
  const createOrderOptions = getAvailableOrderOptions(orders, shipments);
  const canCreate = canCreateOrders(profile.role);
  const canEdit = canEditOrders(profile.role);
  const isAdmin = canManageOrders(profile.role);
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const today = new Date().toISOString().slice(0, 10);
  const activeShipments = shipments.filter(
    (shipment) => getVisibleShipmentStatus(shipment.arrival_status) !== "arrived",
  );
  const historyShipments = shipments.filter(
    (shipment) => getVisibleShipmentStatus(shipment.arrival_status) === "arrived",
  );

  return (
    <>
      <PageHeader
        description="Monitor inbound containers and move units into stock when they arrive."
        title="Shipments"
      />

      {canCreate ? (
        <SectionCard
          className="relative z-20"
          description="Track a container by its ETD, ETA, status, and one or more linked purchase orders."
          title="Create Shipment"
        >
          <form action={createShipmentAction} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="container_number">
                  Container Number
                </label>
                <input className="input-field" id="container_number" name="container_number" required type="text" />
              </div>
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="etd">
                  ETD
                </label>
                <div className="date-input-wrap">
                  <input className="input-field" defaultValue={today} id="etd" name="etd" type="date" />
                </div>
              </div>
              <div className="match-date-width-field">
                <label className="field-label" htmlFor="eta">
                  ETA
                </label>
                <div className="date-input-wrap">
                  <input className="input-field" defaultValue={today} id="eta" name="eta" required type="date" />
                </div>
              </div>
              <div className="match-date-width-field">
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
            </div>
            <div>
              <ShipmentPurchaseOrderPicker
                helperText="Search and add multiple purchase orders for the same shipment."
                inputName="linked_purchase_order_ids"
                inputPrefix="shipment-create"
                label="Linked Purchase Orders"
                orders={createOrderOptions}
              />
            </div>
            <div>
              <SubmitButton className="btn-primary" pendingLabel="Creating...">
                Create Shipment
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.75fr)_minmax(320px,0.95fr)]">
        <SectionCard
          className="relative z-0"
          description="Changing a shipment to Arrived automatically moves units from in-transit stock into current stock."
          title="Shipment List"
        >
        <div className="mb-4 text-sm text-slate-500">
          Active {activeShipments.length} • History {historyShipments.length}
        </div>

        <div className="space-y-4 md:hidden">
          {activeShipments.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No active shipments right now.
            </div>
          ) : (
            activeShipments.map((shipment) => {
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
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETD</p>
                    <p className="mt-1 text-slate-700">{shipment.etd ? formatDate(shipment.etd) : "Not specified"}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETA</p>
                    <p className="mt-1 text-slate-700">{formatDate(shipment.eta)}</p>
                  </div>
                  <div className="sm:col-span-2 rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Linked PO</p>
                    <div className="mt-2">{getShipmentLinkedPoDisplay(shipment, orderMap)}</div>
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

                {canEdit ? (
                  <details className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                    <summary className="cursor-pointer whitespace-nowrap px-4 py-3 text-sm font-semibold text-brand-700">
                      Edit shipment
                    </summary>
                    <div className="border-t border-slate-200 bg-slate-50/80 p-4">
                      <form action={updateShipmentAction} className="space-y-4">
                        <input name="id" type="hidden" value={shipment.id} />
                        <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
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
                            <div className="date-input-wrap">
                              <input
                                className="input-field"
                                defaultValue={shipment.etd ?? ""}
                                id={`etd-mobile-${shipment.id}`}
                                name="etd"
                                type="date"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="field-label" htmlFor={`eta-mobile-${shipment.id}`}>
                              ETA
                            </label>
                            <div className="date-input-wrap">
                              <input
                                className="input-field"
                                defaultValue={shipment.eta}
                                id={`eta-mobile-${shipment.id}`}
                                name="eta"
                                required
                                type="date"
                              />
                            </div>
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
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-white p-4">
                          <ShipmentPurchaseOrderPicker
                            helperText="Search and add or remove linked purchase orders."
                            initialSelectedIds={getShipmentOrderIds(shipment)}
                            inputName="linked_purchase_order_ids"
                            inputPrefix={`shipment-mobile-${shipment.id}`}
                            label="Linked Purchase Orders"
                            orders={getAvailableOrderOptions(orders, shipments, shipment)}
                          />
                        </div>
                        <div className="space-y-3">
                          <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                            Save Changes
                          </SubmitButton>
                          {isAdmin ? (
                            <form action={deleteShipmentAction}>
                              <input name="id" type="hidden" value={shipment.id} />
                              <SubmitButton className="btn-danger w-full justify-center" pendingLabel="Deleting...">
                                Delete Shipment
                              </SubmitButton>
                            </form>
                          ) : null}
                        </div>
                      </form>
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
              <col className="w-[24%]" />
              <col className="w-[13%]" />
              <col className="w-[13%]" />
              <col className="w-[32%]" />
              <col className="w-[18%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="pb-3 pr-4 font-medium text-left">Container</th>
                <th className="px-3 pb-3 font-medium text-center">ETD</th>
                <th className="px-3 pb-3 font-medium text-center">ETA</th>
                <th className="px-3 pb-3 font-medium text-center">Linked PO</th>
                <th className="px-3 pb-3 font-medium text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {activeShipments.map((shipment) => {
                const shipmentStatus = getVisibleShipmentStatus(shipment.arrival_status);

                return (
                <tr className="border-b border-slate-100 align-top last:border-b-0" key={shipment.id}>
                  <td className="py-4">
                    <p className="font-medium text-slate-950">{shipment.container_number}</p>
                    {canEdit ? (
                      <details className="mt-3 overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-sm">
                        <summary className="cursor-pointer whitespace-nowrap px-4 py-3 text-sm font-semibold text-brand-700">
                          Edit shipment
                        </summary>
                        <div className="border-t border-slate-200 bg-slate-50/80 p-4">
                          <form action={updateShipmentAction} className="space-y-4">
                            <input name="id" type="hidden" value={shipment.id} />
                            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4">
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
                                <div className="date-input-wrap">
                                  <input
                                    className="input-field"
                                    defaultValue={shipment.etd ?? ""}
                                    id={`etd-${shipment.id}`}
                                    name="etd"
                                    type="date"
                                  />
                                </div>
                              </div>
                              <div>
                                <label className="field-label" htmlFor={`eta-${shipment.id}`}>
                                  ETA
                                </label>
                                <div className="date-input-wrap">
                                  <input
                                    className="input-field"
                                    defaultValue={shipment.eta}
                                    id={`eta-${shipment.id}`}
                                    name="eta"
                                    required
                                    type="date"
                                  />
                                </div>
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
                            </div>
                            <div className="rounded-2xl border border-slate-200 bg-white p-4">
                              <ShipmentPurchaseOrderPicker
                                helperText="Search and add or remove linked purchase orders."
                                initialSelectedIds={getShipmentOrderIds(shipment)}
                                inputName="linked_purchase_order_ids"
                                inputPrefix={`shipment-desktop-${shipment.id}`}
                                label="Linked Purchase Orders"
                                orders={getAvailableOrderOptions(orders, shipments, shipment)}
                              />
                            </div>
                            <div className="flex flex-wrap gap-3">
                              <SubmitButton className="btn-secondary min-w-40" pendingLabel="Saving...">
                                Save Changes
                              </SubmitButton>
                              {isAdmin ? (
                                <form action={deleteShipmentAction}>
                                  <input name="id" type="hidden" value={shipment.id} />
                                  <SubmitButton className="btn-danger" pendingLabel="Deleting...">
                                    Delete Shipment
                                  </SubmitButton>
                                </form>
                              ) : null}
                            </div>
                          </form>
                        </div>
                      </details>
                    ) : null}
                  </td>
                  <td className="px-3 py-4 text-center text-slate-600">{shipment.etd ? formatDate(shipment.etd) : "Not specified"}</td>
                  <td className="px-3 py-4 text-center text-slate-600">{formatDate(shipment.eta)}</td>
                  <td className="px-3 py-4 text-slate-600">
                    <div className="flex justify-center">
                      {getShipmentLinkedPoDisplay(shipment, orderMap)}
                    </div>
                  </td>
                  <td className="px-3 py-4">
                    <div className="space-y-3 text-center">
                      <div className="flex justify-center">
                        <StatusBadge value={shipmentStatus} />
                      </div>
                      {canUpdateStatus ? (
                        <form action={updateShipmentStatusAction} className="flex flex-col gap-2 lg:items-center">
                          <input name="id" type="hidden" value={shipment.id} />
                          <select className="input-field min-w-36 py-2" defaultValue={shipmentStatus} name="status">
                            {shipmentStatuses.map((status) => (
                              <option key={status} value={status}>
                                {formatEnumLabel(status)}
                              </option>
                            ))}
                          </select>
                          <SubmitButton className="btn-secondary justify-center" pendingLabel="Saving...">
                            Update
                          </SubmitButton>
                        </form>
                      ) : null}
                    </div>
                  </td>
                </tr>
                );
              })}
              {activeShipments.length === 0 ? (
                <tr>
                  <td className="py-6 text-sm text-slate-500" colSpan={5}>
                    No active shipments right now.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        </SectionCard>

        <SectionCard
          description="Arrived shipments are archived here for quick reference."
          title="History"
        >
          <div className="mb-4 text-sm text-slate-500">Arrived shipments: {historyShipments.length}</div>

          <div className="space-y-3">
            {historyShipments.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
                No arrived shipments yet.
              </div>
            ) : (
              historyShipments.map((shipment) => {
                const shipmentStatus = getVisibleShipmentStatus(shipment.arrival_status);

                return (
                  <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm" key={shipment.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{shipment.container_number}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          ETA {formatDate(shipment.eta)}
                        </p>
                      </div>
                      <StatusBadge value={shipmentStatus} />
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">ETD</p>
                        <p className="mt-1 text-sm text-slate-700">
                          {shipment.etd ? formatDate(shipment.etd) : "Not specified"}
                        </p>
                      </div>
                      <div className="rounded-2xl bg-slate-50 px-3 py-3">
                        <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">
                          Linked PO
                        </p>
                        <div className="mt-2">{getShipmentLinkedPoDisplay(shipment, orderMap)}</div>
                      </div>
                    </div>

                    {canUpdateStatus ? (
                      <form action={updateShipmentStatusAction} className="mt-4 flex flex-col gap-2 sm:flex-row">
                        <input name="id" type="hidden" value={shipment.id} />
                        <select className="input-field min-w-0 flex-1 py-2" defaultValue={shipmentStatus} name="status">
                          {shipmentStatuses.map((status) => (
                            <option key={status} value={status}>
                              {formatEnumLabel(status)}
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
