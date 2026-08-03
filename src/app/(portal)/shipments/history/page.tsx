import Link from "next/link";
import {
  updateShipmentStatusAction,
} from "@/app/actions/shipments";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import { shipmentStatuses } from "@/lib/constants";
import type { PurchaseOrderRow, ShipmentRow } from "@/lib/database.types";
import { canUpdateOperationalStatus } from "@/lib/permissions";
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

export default async function ShipmentHistoryPage() {
  const { supabase, profile } = await requirePortalUser();
  const [{ data: shipmentsData }, { data: ordersData }] = await Promise.all([
    supabase.from("shipments").select("*").order("eta"),
    supabase.from("purchase_orders").select("*").order("po_number"),
  ]);

  const shipments = (shipmentsData ?? []) as ShipmentRow[];
  const orders = (ordersData ?? []) as PurchaseOrderRow[];
  const orderMap = new Map(orders.map((order) => [order.id, order]));
  const canUpdateStatus = canUpdateOperationalStatus(profile.role);
  const historyShipments = shipments.filter(
    (shipment) => getVisibleShipmentStatus(shipment.arrival_status) === "arrived",
  );

  return (
    <>
      <PageHeader
        description="View all arrived shipments in one separate history page."
        title="Shipment History"
      />

      <SectionCard
        description="Arrived shipments are stored here so the active shipment list stays shorter."
        headerAside={(
          <Link className="btn-secondary whitespace-nowrap" href="/shipments">
            Back to Shipment List
          </Link>
        )}
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
    </>
  );
}
