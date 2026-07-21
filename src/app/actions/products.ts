"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { ProductRow } from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";
import { productCategories } from "@/lib/products";
import { tableMutation } from "@/lib/supabase/mutations";
import { productSchema } from "@/lib/validators";

function revalidateProductPaths() {
  revalidatePath("/");
  revalidatePath("/products");

  for (const category of productCategories) {
    revalidatePath(`/products/${category}`);
  }
}

export async function createProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? "").toUpperCase(),
    category: String(formData.get("category") ?? ""),
    current_stock: formData.get("current_stock"),
    low_stock_warning_level: formData.get("low_stock_warning_level"),
  });

  const { error } = await products.insert(parsed);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductPaths();
}

export async function updateProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? "").toUpperCase(),
    category: String(formData.get("category") ?? ""),
    current_stock: formData.get("current_stock"),
    low_stock_warning_level: formData.get("low_stock_warning_level"),
  });

  const { error } = await products.update(parsed).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidateProductPaths();
}

export async function deleteProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const id = String(formData.get("id") ?? "");

  const { data: productData } = await supabase
    .from("products")
    .select("category, name")
    .eq("id", id)
    .maybeSingle();
  const product = productData as Pick<ProductRow, "category" | "name"> | null;

  if (!product) {
    redirect(`/products?error=${encodeURIComponent("Product could not be found.")}`);
  }

  const [{ count: purchaseOrderCount }, { count: shipmentCount }, { count: transactionCount }] =
    await Promise.all([
      supabase
        .from("purchase_order_items")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id),
      supabase
        .from("shipments")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id),
      supabase
        .from("inventory_transactions")
        .select("id", { count: "exact", head: true })
        .eq("product_id", id),
    ]);

  if ((purchaseOrderCount ?? 0) > 0 || (shipmentCount ?? 0) > 0 || (transactionCount ?? 0) > 0) {
    redirect(
      `/products/${product.category}?error=${encodeURIComponent(
        `${product.name} cannot be deleted because it is already used by purchase orders, shipments, or inventory transactions. You can move it to another category or keep it for history.`,
      )}`,
    );
  }

  const { error } = await products.delete().eq("id", id);

  if (error) {
    redirect(
      `/products/${product.category}?error=${encodeURIComponent(
        "This product could not be deleted because it is still referenced by other records.",
      )}`,
    );
  }

  revalidateProductPaths();
}
