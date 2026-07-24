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
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-center text-slate-500">
              <tr>
                <th className="pb-3 font-medium">Date</th>
                <th className="pb-3 font-medium">Product</th>
                <th className="pb-3 font-medium">Quantity</th>
                <th className="pb-3 font-medium">Type</th>
                <th className="pb-3 font-medium">Reason</th>
                <th className="pb-3 font-medium">User</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((transaction) => (
                <tr className="border-b border-slate-100 last:border-b-0" key={transaction.id}>
                  <td className="py-4 text-slate-600">{formatDate(transaction.created_at)}</td>
                  <td className="py-4">
                    <p className="font-medium text-slate-950">
                      {productMap.get(transaction.product_id)?.name ?? "Unknown product"}
                    </p>
                    <p className="text-xs text-slate-400">
                      {productMap.get(transaction.product_id)?.sku ?? "No SKU"}
                    </p>
                  </td>
                  <td
                    className={`py-4 font-semibold ${
                      transaction.quantity > 0 ? "text-emerald-700" : "text-rose-700"
                    }`}
                  >
                    {formatSignedQuantity(transaction.quantity)}
                  </td>
                  <td className="py-4">
                    <StatusBadge value={transaction.type} />
                  </td>
                  <td className="py-4 text-slate-600">{transaction.reason}</td>
                  <td className="py-4 text-slate-600">
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
