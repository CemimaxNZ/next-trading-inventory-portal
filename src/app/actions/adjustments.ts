"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { ZodError } from "zod";
import type { InventoryTransactionRow, ProductRow } from "@/lib/database.types";
import { requirePortalUser } from "@/lib/session";
import { createAdminSupabaseClient } from "@/lib/supabase/admin";
import {
  stockAdjustmentBatchSchema,
  stockAdjustmentHistoryUpdateSchema,
} from "@/lib/validators";

type StockAdjustmentItemInput = {
  product_id: string;
  adjustment: "add" | "remove";
  quantity: number;
};

function extractStockAdjustmentItems(formData: FormData) {
  const productIds = formData.getAll("item_product_id").map((value) => String(value ?? "").trim());
  const adjustments = formData.getAll("item_adjustment").map((value) => String(value ?? "").trim());
  const quantities = formData.getAll("item_quantity").map((value) => String(value ?? "").trim());
  const rowCount = Math.max(productIds.length, adjustments.length, quantities.length);
  const items: { product_id: string; adjustment: string; quantity: string }[] = [];

  for (let index = 0; index < rowCount; index += 1) {
    const productId = productIds[index] ?? "";
    const adjustment = adjustments[index] ?? "";
    const quantity = quantities[index] ?? "";

    if (!productId && !adjustment && !quantity) {
      continue;
    }

    items.push({
      product_id: productId,
      adjustment,
      quantity,
    });
  }

  return items;
}

function redirectToAdjustmentsError(message: string) {
  redirect(`/adjustments?error=${encodeURIComponent(message)}`);
}

function getAdjustmentErrorMessage(error: unknown) {
  if (error instanceof ZodError) {
    const duplicateProductIssue = error.issues.find(
      (issue) => issue.message === "Each product can only appear once per adjustment.",
    );

    if (duplicateProductIssue) {
      return "Each product can only appear once in the same adjustment.";
    }

    return "Please complete every adjustment line before saving.";
  }

  if (error instanceof Error) {
    if (error.message.includes("Current stock cannot become negative")) {
      return "One or more stock removals would make current stock negative. Please check the quantities.";
    }

    return error.message;
  }

  return "The stock adjustment could not be saved. Please try again.";
}

function buildSignedQuantity(item: StockAdjustmentItemInput) {
  return item.adjustment === "add" ? item.quantity : -item.quantity;
}

function buildSignedQuantityFromParts(adjustment: "add" | "remove", quantity: number) {
  return adjustment === "add" ? quantity : -quantity;
}

export async function createStockAdjustmentAction(formData: FormData) {
  const { profile } = await requirePortalUser("operator");
  const adminClient = createAdminSupabaseClient();

  try {
    const parsed = stockAdjustmentBatchSchema.parse({
      effective_date: String(formData.get("effective_date") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      items: extractStockAdjustmentItems(formData),
    });

    const productIds = parsed.items.map((item) => item.product_id);
    const { data: productsData, error: productsError } = await adminClient
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsError) {
      throw new Error(productsError.message);
    }

    const products = (productsData ?? []) as ProductRow[];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const updatedAt = new Date().toISOString();

    for (const item of parsed.items) {
      const product = productMap.get(item.product_id);

      if (!product) {
        throw new Error(`Product ${item.product_id} not found`);
      }

      const nextCurrentStock = product.current_stock + buildSignedQuantity(item);

      if (nextCurrentStock < 0) {
        throw new Error(`Current stock cannot become negative for product ${product.name}`);
      }
    }

    for (const item of parsed.items) {
      const product = productMap.get(item.product_id);

      if (!product) {
        continue;
      }

      const nextCurrentStock = product.current_stock + buildSignedQuantity(item);
      product.current_stock = nextCurrentStock;

      const { error: productUpdateError } = await adminClient
        .from("products")
        .update({
          current_stock: nextCurrentStock,
          updated_at: updatedAt,
        })
        .eq("id", item.product_id);

      if (productUpdateError) {
        throw new Error(productUpdateError.message);
      }
    }

    const batchId = crypto.randomUUID();
    const createdAt = `${parsed.effective_date}T00:00:00.000Z`;
    const transactions = parsed.items.map((item) => ({
      product_id: item.product_id,
      quantity: buildSignedQuantity(item),
      type: (item.adjustment === "add" ? "manual_add" : "manual_remove") as InventoryTransactionRow["type"],
      reason: parsed.reason,
      reference_table: "manual_adjustment_batch",
      reference_id: batchId,
      performed_by: profile.id,
      created_at: createdAt,
    }));

    const { error: transactionsError } = await adminClient
      .from("inventory_transactions")
      .insert(transactions);

    if (transactionsError) {
      throw new Error(transactionsError.message);
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/adjustments");
    revalidatePath("/transactions");
    redirect("/adjustments");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdjustmentsError(getAdjustmentErrorMessage(error));
  }
}

export async function updateStockAdjustmentHistoryAction(formData: FormData) {
  await requirePortalUser("admin");
  const adminClient = createAdminSupabaseClient();

  try {
    const parsed = stockAdjustmentHistoryUpdateSchema.parse({
      id: String(formData.get("id") ?? ""),
      effective_date: String(formData.get("effective_date") ?? ""),
      reason: String(formData.get("reason") ?? ""),
      product_id: String(formData.get("product_id") ?? ""),
      adjustment: String(formData.get("adjustment") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
    });

    const { data: existingTransactionData, error: transactionError } = await adminClient
      .from("inventory_transactions")
      .select("*")
      .eq("id", parsed.id)
      .single();

    if (transactionError) {
      throw new Error(transactionError.message);
    }

    const existingTransaction = existingTransactionData as InventoryTransactionRow;

    if (!["manual_add", "manual_remove"].includes(existingTransaction.type)) {
      throw new Error("Only manual adjustment history can be edited here.");
    }

    const productIds = Array.from(new Set([existingTransaction.product_id, parsed.product_id]));
    const { data: productsData, error: productsError } = await adminClient
      .from("products")
      .select("*")
      .in("id", productIds);

    if (productsError) {
      throw new Error(productsError.message);
    }

    const products = (productsData ?? []) as ProductRow[];
    const productMap = new Map(products.map((product) => [product.id, product]));
    const existingProduct = productMap.get(existingTransaction.product_id);
    const nextProduct = productMap.get(parsed.product_id);

    if (!existingProduct || !nextProduct) {
      throw new Error("The selected product could not be found.");
    }

    const oldSignedQuantity = existingTransaction.quantity;
    const newSignedQuantity = buildSignedQuantityFromParts(parsed.adjustment, parsed.quantity);
    const updatedAt = new Date().toISOString();

    if (existingProduct.id === nextProduct.id) {
      const revisedCurrentStock = existingProduct.current_stock - oldSignedQuantity + newSignedQuantity;

      if (revisedCurrentStock < 0) {
        throw new Error("This edit would make current stock negative.");
      }

      const { error: productUpdateError } = await adminClient
        .from("products")
        .update({
          current_stock: revisedCurrentStock,
          updated_at: updatedAt,
        })
        .eq("id", existingProduct.id);

      if (productUpdateError) {
        throw new Error(productUpdateError.message);
      }
    } else {
      const existingProductStock = existingProduct.current_stock - oldSignedQuantity;
      const nextProductStock = nextProduct.current_stock + newSignedQuantity;

      if (existingProductStock < 0 || nextProductStock < 0) {
        throw new Error("This edit would make current stock negative.");
      }

      const { error: revertProductError } = await adminClient
        .from("products")
        .update({
          current_stock: existingProductStock,
          updated_at: updatedAt,
        })
        .eq("id", existingProduct.id);

      if (revertProductError) {
        throw new Error(revertProductError.message);
      }

      const { error: applyProductError } = await adminClient
        .from("products")
        .update({
          current_stock: nextProductStock,
          updated_at: updatedAt,
        })
        .eq("id", nextProduct.id);

      if (applyProductError) {
        throw new Error(applyProductError.message);
      }
    }

    const { error: updateTransactionError } = await adminClient
      .from("inventory_transactions")
      .update({
        created_at: `${parsed.effective_date}T00:00:00.000Z`,
        product_id: parsed.product_id,
        quantity: newSignedQuantity,
        reason: parsed.reason,
        type: parsed.adjustment === "add" ? "manual_add" : "manual_remove",
      })
      .eq("id", parsed.id);

    if (updateTransactionError) {
      throw new Error(updateTransactionError.message);
    }

    revalidatePath("/");
    revalidatePath("/products");
    revalidatePath("/adjustments");
    revalidatePath("/transactions");
    redirect("/adjustments");
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectToAdjustmentsError(getAdjustmentErrorMessage(error));
  }
}
