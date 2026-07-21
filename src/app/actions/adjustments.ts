"use server";

import { revalidatePath } from "next/cache";
import { requirePortalUser } from "@/lib/session";
import { rpcMutation } from "@/lib/supabase/mutations";
import { stockAdjustmentSchema } from "@/lib/validators";

export async function createStockAdjustmentAction(formData: FormData) {
  const { supabase } = await requirePortalUser("operator");
  const runRpc = rpcMutation(supabase);
  const parsed = stockAdjustmentSchema.parse({
    product_id: String(formData.get("product_id") ?? ""),
    adjustment: String(formData.get("adjustment") ?? ""),
    quantity: formData.get("quantity"),
    reason: String(formData.get("reason") ?? ""),
  });

  const { error } = await runRpc("perform_stock_adjustment", {
    p_product_id: parsed.product_id,
    p_adjustment: parsed.adjustment,
    p_quantity: parsed.quantity,
    p_reason: parsed.reason,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/products");
  revalidatePath("/adjustments");
  revalidatePath("/transactions");
}
