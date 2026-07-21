"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { tableMutation } from "@/lib/supabase/mutations";
import { productSchema } from "@/lib/validators";

export async function createProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? "").toUpperCase(),
    low_stock_warning_level: formData.get("low_stock_warning_level"),
  });

  const { error } = await products.insert(parsed);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/products");
}

export async function updateProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const id = String(formData.get("id") ?? "");
  const parsed = productSchema.parse({
    name: String(formData.get("name") ?? ""),
    sku: String(formData.get("sku") ?? "").toUpperCase(),
    low_stock_warning_level: formData.get("low_stock_warning_level"),
  });

  const { error } = await products.update(parsed).eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/products");
}

export async function deleteProductAction(formData: FormData) {
  const { supabase } = await requirePortalUser("admin");
  const products = tableMutation(supabase, "products");
  const id = String(formData.get("id") ?? "");
  const { error } = await products.delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/products");
}
