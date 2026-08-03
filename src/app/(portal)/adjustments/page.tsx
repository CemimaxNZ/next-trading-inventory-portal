import {
  createStockAdjustmentAction,
  updateStockAdjustmentHistoryAction,
} from "@/app/actions/adjustments";
import { StockAdjustmentItemsFields } from "@/components/adjustments/stock-adjustment-items-fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import type {
  InventoryTransactionRow,
  ProductRow,
  ProfileRow,
} from "@/lib/database.types";
import { canAdjustStock, canManageAdjustmentHistory } from "@/lib/permissions";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatSignedQuantity } from "@/lib/utils";
import { Fragment } from "react";

type AdjustmentsPageProps = {
  searchParams?: Promise<{
    error?: string;
  }>;
};

export default async function AdjustmentsPage({ searchParams }: AdjustmentsPageProps) {
  const { supabase, profile } = await requirePortalUser();
  const resolvedSearchParams = searchParams ? await searchParams : undefined;
  const errorMessage = resolvedSearchParams?.error;
  const [{ data: productsData }, { data: transactionsData }, { data: profilesData }] =
    await Promise.all([
      supabase.from("products").select("*").order("name"),
      supabase
        .from("inventory_transactions")
        .select("*")
        .in("type", ["manual_add", "manual_remove"])
        .order("created_at", { ascending: false })
        .limit(20),
      supabase.from("profiles").select("*"),
    ]);

  const products = (productsData ?? []) as ProductRow[];
  const transactions = (transactionsData ?? []) as InventoryTransactionRow[];
  const profiles = (profilesData ?? []) as ProfileRow[];
  const productOptions = products.map((product) => ({
    id: product.id,
    name: product.name,
    sku: product.sku,
  }));
  const productMap = new Map(products.map((product) => [product.id, product]));
  const profileMap = new Map(profiles.map((entry) => [entry.id, entry]));
  const canAdjust = canAdjustStock(profile.role);
  const canManageHistory = canManageAdjustmentHistory(profile.role);
  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHeader
        description="Add or remove stock manually while preserving a full audit trail."
        title="Manual Stock Adjustment"
      />

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      {canAdjust ? (
        <SectionCard
          description="Operators and admins can record controlled stock changes here."
          title="Create Adjustment"
        >
          <form action={createStockAdjustmentAction} className="space-y-5">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(0,15rem)_minmax(0,1fr)]">
              <div>
                <label className="field-label" htmlFor="effective_date">
                  Adjustment Date
                </label>
                <div className="date-input-wrap">
                  <input
                    className="input-field"
                    defaultValue={today}
                    id="effective_date"
                    name="effective_date"
                    required
                    type="date"
                  />
                </div>
              </div>
              <div>
                <label className="field-label" htmlFor="reason">
                  Reason
                </label>
                <input className="input-field" id="reason" name="reason" required type="text" />
              </div>
            </div>

            <div>
              <div className="mb-3 h-1.5 w-12 rounded-full bg-brand-400" />
              <h3 className="text-base font-semibold text-slate-950">Adjustment Lines</h3>
              <p className="mt-1 text-sm text-slate-600">
                Use one date and one reason for the whole stock count, then add all product changes below.
              </p>
            </div>

            <StockAdjustmentItemsFields products={productOptions} />

            <div>
              <SubmitButton className="btn-primary" pendingLabel="Saving...">
                Save Adjustment
              </SubmitButton>
            </div>
          </form>
        </SectionCard>
      ) : (
        <SectionCard
          description="Viewer accounts can review the adjustment history but cannot create changes."
          title="Adjustment Access"
        >
          <p className="text-sm text-slate-600">
            Your role is read-only for manual stock adjustments.
          </p>
        </SectionCard>
      )}

      <SectionCard
        description="Recent manual stock additions and removals."
        title="Adjustment History"
      >
        <div className="space-y-4 md:hidden">
          {transactions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No manual adjustments recorded yet.
            </div>
          ) : (
            transactions.map((transaction) => (
              <article
                className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
                key={transaction.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-base font-semibold text-slate-950">
                      {productMap.get(transaction.product_id)?.name ?? "Unknown product"}
                    </p>
                    <p className="mt-1 text-sm text-slate-500">
                      {productMap.get(transaction.product_id)?.sku ?? "No SKU"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-slate-500">{formatDate(transaction.created_at)}</p>
                    <p
                      className={`mt-1 text-base font-semibold ${
                        transaction.quantity > 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatSignedQuantity(transaction.quantity)}
                    </p>
                  </div>
                </div>

                <div className="grid gap-3 text-sm">
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">Reason</p>
                    <p className="mt-1 text-slate-700">{transaction.reason}</p>
                  </div>
                  <div className="rounded-2xl bg-slate-50 px-3 py-3">
                    <p className="text-xs font-medium uppercase tracking-[0.2em] text-slate-400">User</p>
                    <p className="mt-1 text-slate-700">
                      {transaction.performed_by
                        ? profileMap.get(transaction.performed_by)?.full_name ?? "Unknown user"
                        : "System"}
                    </p>
                  </div>
                </div>

                {canManageHistory ? (
                  <details className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <summary className="cursor-pointer text-sm font-medium text-brand-700">
                      Edit adjustment
                    </summary>
                    <div className="mt-4">
                      <form action={updateStockAdjustmentHistoryAction} className="space-y-4">
                        <input name="id" type="hidden" value={transaction.id} />
                        <div className="grid gap-4">
                          <div>
                            <label className="field-label" htmlFor={`adjustment-date-mobile-${transaction.id}`}>
                              Adjustment Date
                            </label>
                            <div className="date-input-wrap">
                              <input
                                className="input-field"
                                defaultValue={transaction.created_at.slice(0, 10)}
                                id={`adjustment-date-mobile-${transaction.id}`}
                                name="effective_date"
                                required
                                type="date"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="field-label" htmlFor={`adjustment-product-mobile-${transaction.id}`}>
                              Product
                            </label>
                            <select
                              className="input-field"
                              defaultValue={transaction.product_id}
                              id={`adjustment-product-mobile-${transaction.id}`}
                              name="product_id"
                            >
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name} ({product.sku})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="grid gap-4 sm:grid-cols-2">
                            <div>
                              <label className="field-label" htmlFor={`adjustment-type-mobile-${transaction.id}`}>
                                Adjustment Type
                              </label>
                              <select
                                className="input-field"
                                defaultValue={transaction.quantity >= 0 ? "add" : "remove"}
                                id={`adjustment-type-mobile-${transaction.id}`}
                                name="adjustment"
                              >
                                <option value="add">Add Stock</option>
                                <option value="remove">Remove Stock</option>
                              </select>
                            </div>
                            <div>
                              <label className="field-label" htmlFor={`adjustment-quantity-mobile-${transaction.id}`}>
                                Quantity
                              </label>
                              <input
                                className="input-field input-field-number"
                                defaultValue={Math.abs(transaction.quantity)}
                                id={`adjustment-quantity-mobile-${transaction.id}`}
                                min="1"
                                name="quantity"
                                required
                                type="number"
                              />
                            </div>
                          </div>
                          <div>
                            <label className="field-label" htmlFor={`adjustment-reason-mobile-${transaction.id}`}>
                              Reason
                            </label>
                            <input
                              className="input-field"
                              defaultValue={transaction.reason}
                              id={`adjustment-reason-mobile-${transaction.id}`}
                              name="reason"
                              required
                              type="text"
                            />
                          </div>
                        </div>
                        <SubmitButton className="btn-secondary w-full justify-center" pendingLabel="Saving...">
                          Save Changes
                        </SubmitButton>
                      </form>
                    </div>
                  </details>
                ) : null}
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[32%]" />
              <col className="w-[12%]" />
              <col className="w-[26%]" />
              <col className="w-[16%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 pb-3 font-medium text-center">Date</th>
                <th className="pb-3 pr-4 font-medium text-left">Product</th>
                <th className="px-3 pb-3 font-medium text-center">Quantity</th>
                <th className="pb-3 pr-4 font-medium text-left">Reason</th>
                <th className="px-3 pb-3 font-medium text-center">User</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <Fragment key={transaction.id}>
                  <tr className={`${canManageHistory ? "border-b-0" : "border-b"} border-slate-100 last:border-b-0`}>
                    <td className="px-3 py-4 text-center text-slate-600">{formatDate(transaction.created_at)}</td>
                    <td className="py-4">
                      <p className="font-medium text-slate-950">
                        {productMap.get(transaction.product_id)?.name ?? "Unknown product"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {productMap.get(transaction.product_id)?.sku ?? "No SKU"}
                      </p>
                    </td>
                    <td
                      className={`px-3 py-4 text-center font-semibold ${
                        transaction.quantity > 0 ? "text-emerald-700" : "text-rose-700"
                      }`}
                    >
                      {formatSignedQuantity(transaction.quantity)}
                    </td>
                    <td className="py-4 text-slate-600">{transaction.reason}</td>
                    <td className="px-3 py-4 text-center text-slate-600">
                      {transaction.performed_by
                        ? profileMap.get(transaction.performed_by)?.full_name ?? "Unknown user"
                        : "System"}
                    </td>
                  </tr>
                  {canManageHistory ? (
                    <tr className="border-b border-slate-100 last:border-b-0">
                      <td className="pb-4 pt-0" colSpan={5}>
                        <details className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
                          <summary className="cursor-pointer text-sm font-medium text-brand-700">
                            Edit adjustment
                          </summary>
                          <div className="mt-5">
                            <form action={updateStockAdjustmentHistoryAction} className="space-y-5">
                              <input name="id" type="hidden" value={transaction.id} />
                              <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-5">
                                <div>
                                  <label className="field-label" htmlFor={`adjustment-date-${transaction.id}`}>
                                    Adjustment Date
                                  </label>
                                  <div className="date-input-wrap">
                                    <input
                                      className="input-field"
                                      defaultValue={transaction.created_at.slice(0, 10)}
                                      id={`adjustment-date-${transaction.id}`}
                                      name="effective_date"
                                      required
                                      type="date"
                                    />
                                  </div>
                                </div>
                                <div>
                                  <label className="field-label" htmlFor={`adjustment-product-${transaction.id}`}>
                                    Product
                                  </label>
                                  <select
                                    className="input-field"
                                    defaultValue={transaction.product_id}
                                    id={`adjustment-product-${transaction.id}`}
                                    name="product_id"
                                  >
                                    {products.map((product) => (
                                      <option key={product.id} value={product.id}>
                                        {product.name} ({product.sku})
                                      </option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="field-label" htmlFor={`adjustment-type-${transaction.id}`}>
                                    Adjustment Type
                                  </label>
                                  <select
                                    className="input-field"
                                    defaultValue={transaction.quantity >= 0 ? "add" : "remove"}
                                    id={`adjustment-type-${transaction.id}`}
                                    name="adjustment"
                                  >
                                    <option value="add">Add Stock</option>
                                    <option value="remove">Remove Stock</option>
                                  </select>
                                </div>
                                <div>
                                  <label className="field-label" htmlFor={`adjustment-quantity-${transaction.id}`}>
                                    Quantity
                                  </label>
                                  <input
                                    className="input-field input-field-number"
                                    defaultValue={Math.abs(transaction.quantity)}
                                    id={`adjustment-quantity-${transaction.id}`}
                                    min="1"
                                    name="quantity"
                                    required
                                    type="number"
                                  />
                                </div>
                                <div className="2xl:col-span-1 lg:col-span-2">
                                  <label className="field-label" htmlFor={`adjustment-reason-${transaction.id}`}>
                                    Reason
                                  </label>
                                  <input
                                    className="input-field"
                                    defaultValue={transaction.reason}
                                    id={`adjustment-reason-${transaction.id}`}
                                    name="reason"
                                    required
                                    type="text"
                                  />
                                </div>
                              </div>
                              <SubmitButton className="btn-secondary min-w-40" pendingLabel="Saving...">
                                Save Changes
                              </SubmitButton>
                            </form>
                          </div>
                        </details>
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </>
  );
}
