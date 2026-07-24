"use server";

import { revalidatePath } from "next/cache";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import { requirePortalUser } from "@/lib/session";

export async function clearInventoryTransactionsAction() {
  await requirePortalUser("admin");

  const adminClient = createAdminSupabaseClient();
  const { error } = await adminClient
    .from("inventory_transactions")
    .delete()
    .gte("created_at", "1970-01-01T00:00:00.000Z");

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/transactions");
  revalidatePath("/adjustments");
}
