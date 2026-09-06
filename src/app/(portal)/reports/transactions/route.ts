import type { InventoryTransactionRow, ProductRow, ProfileRow } from "@/lib/database.types";
import { buildReportFilename, csvDownloadResponse } from "@/lib/reports";
import { requirePortalUser } from "@/lib/session";
import { formatDate, formatEnumLabel } from "@/lib/utils";

function normalizeSearchTerm(value: string | null) {
  return value?.trim().toLowerCase() ?? "";

}

export async function GET(request: Request) {
  const { supabase } = await requirePortalUser();
  const searchParams = new URL(request.url).searchParams;
  const startDate = searchParams.get("start")?.trim();
  const endDate = searchParams.get("end")?.trim();
  const selectedProductIds = searchParams.getAll("productId").map((id) => id.trim()).filter(Boolean);
  const query = normalizeSearchTerm(searchParams.get("query"));

  let transactionsQuery = supabase
    .from("inventory_transactions")
    .select("*")
    .order("created_at", { ascending: false });

  if (startDate) {
    transactionsQuery = transactionsQuery.gte("created_at", `${startDate}T00:00:00.000Z`);
  }

  if (endDate) {
    transactionsQuery = transactionsQuery.lte("created_at", `${endDate}T23:59:59.999Z`);
  }

  const [{ data: transactionsData }, { data: productsData }, { data: profilesData }] = await Promise.all([
    transactionsQuery,
    supabase.from("products").select("*").order("name"),
    supabase.from("profiles").select("*"),
  ]);

  const transactions = (transactionsData ?? []) as InventoryTransactionRow[];
  const products = (productsData ?? []) as ProductRow[];
  const profiles = (profilesData ?? []) as ProfileRow[];
  const productMap = new Map(products.map((product) => [product.id, product]));
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const matchingProductIds = new Set(
    products
      .filter((product) => {
        if (selectedProductIds.length > 0 && !selectedProductIds.includes(product.id)) {
          return false;
        }

        if (!query) {
          return true;
        }

        return [product.name, product.sku].join(" ").toLowerCase().includes(query);
      })
      .map((product) => product.id),
  );
  const filteredTransactions = transactions.filter((transaction) =>
    selectedProductIds.length > 0 || query ? matchingProductIds.has(transaction.product_id) : true,
  );
  const rows = filteredTransactions.map((transaction) => {
    const product = productMap.get(transaction.product_id);
    const profile = transaction.performed_by ? profileMap.get(transaction.performed_by) : undefined;

    return [
      formatDate(transaction.created_at),
      product?.sku ?? "",
      product?.name ?? "Unknown product",
      transaction.quantity,
      formatEnumLabel(transaction.type),
      transaction.reason,
      profile?.full_name ?? (transaction.performed_by ? "Unknown user" : "System"),
      transaction.reference_table ?? "",
      transaction.reference_id ?? "",
    ];
  });

  return csvDownloadResponse(buildReportFilename("transaction-report"), [
    [
      "Date",
      "SKU",
      "Product Name",
      "Quantity",
      "Type",
      "Reason",
      "User",
      "Reference Table",
      "Reference ID",
    ],
    ...rows,
  ]);

}
