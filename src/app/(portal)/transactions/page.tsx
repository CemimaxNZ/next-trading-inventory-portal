import { PageHeader } from "@/components/ui/page-header";
import { SectionCard } from "@/components/ui/section-card";
import { StatusBadge } from "@/components/ui/status-badge";
import type {
  InventoryTransactionRow,
  ProductRow,
  ProfileRow,
} from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatSignedQuantity } from "@/lib/utils";

export default async function TransactionsPage() {
  const { supabase } = await requirePortalUser();
  const [{ data: transactionsData }, { data: productsData }, { data: profilesData }] =
    await Promise.all([
      supabase.from("inventory_transactions").select("*").order("created_at", { ascending: false }),
      supabase.from("products").select("*"),
      supabase.from("profiles").select("*"),
    ]);

  const transactions = (transactionsData ?? []) as InventoryTransactionRow[];
  const products = (productsData ?? []) as ProductRow[];
  const profiles = (profilesData ?? []) as ProfileRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));

  return (
    <>
      <PageHeader
        description="Every inventory movement is captured here for traceability."
        title="Inventory Transactions"
      />

      <SectionCard
        description="This ledger includes automated arrivals and manual adjustments."
        title="Transaction History"
      >
        <div className="space-y-4 md:hidden">
          {transactions.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No transactions recorded yet.
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

                <div className="flex justify-start">
                  <StatusBadge value={transaction.type} />
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
              </article>
            ))
          )}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="min-w-full table-fixed text-left text-sm">
            <colgroup>
              <col className="w-[14%]" />
              <col className="w-[28%]" />
              <col className="w-[12%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[12%]" />
            </colgroup>
            <thead className="border-b border-slate-200 text-slate-500">
              <tr>
                <th className="px-3 pb-3 font-medium text-center">Date</th>
                <th className="pb-3 pr-4 font-medium text-left">Product</th>
                <th className="px-3 pb-3 font-medium text-center">Quantity</th>
                <th className="px-3 pb-3 font-medium text-center">Type</th>
                <th className="pb-3 pr-4 font-medium text-left">Reason</th>
                <th className="px-3 pb-3 font-medium text-center">User</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr className="border-b border-slate-100 last:border-b-0" key={transaction.id}>
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
                  <td className="px-3 py-4 text-center">
                    <div className="flex justify-center">
                      <StatusBadge value={transaction.type} />
                    </div>
                  </td>
                  <td className="py-4 text-slate-600">{transaction.reason}</td>
                  <td className="px-3 py-4 text-center text-slate-600">
                    {transaction.performed_by
                      ? profileMap.get(transaction.performed_by)?.full_name ?? "Unknown user"
                      : "System"}
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
