import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const entries = [];

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");

    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    const value = line.slice(separatorIndex + 1).trim();
    entries.push([key, value]);
  }

  return Object.fromEntries(entries);
}

function getShipmentOrderIds(shipment) {
  if (Array.isArray(shipment.linked_purchase_order_ids) && shipment.linked_purchase_order_ids.length > 0) {
    return shipment.linked_purchase_order_ids;
  }

  return shipment.linked_purchase_order_id ? [shipment.linked_purchase_order_id] : [];
}

async function main() {
  const envPath = path.join(process.cwd(), ".env.local");

  if (!fs.existsSync(envPath)) {
    throw new Error(".env.local was not found in the project root.");
  }

  const env = loadEnvFile(envPath);
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Supabase environment variables are missing from .env.local.");
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data: shipmentsData, error: shipmentsError } = await supabase
    .from("shipments")
    .select("id, container_number, arrival_status, linked_purchase_order_id, linked_purchase_order_ids")
    .in("arrival_status", ["arrived", "completed"]);

  if (shipmentsError) {
    throw new Error(`Could not load shipments: ${shipmentsError.message}`);
  }

  const shipments = shipmentsData ?? [];
  const linkedOrderIds = [...new Set(shipments.flatMap(getShipmentOrderIds))];

  if (linkedOrderIds.length === 0) {
    console.log("No arrived shipments with linked purchase orders were found.");
    return;
  }

  const { data: purchaseOrdersData, error: purchaseOrdersError } = await supabase
    .from("purchase_orders")
    .select("id, po_number, status")
    .in("id", linkedOrderIds);

  if (purchaseOrdersError) {
    throw new Error(`Could not load purchase orders: ${purchaseOrdersError.message}`);
  }

  const purchaseOrders = purchaseOrdersData ?? [];
  const notArrivedOrders = purchaseOrders.filter((purchaseOrder) => purchaseOrder.status !== "arrived");

  if (notArrivedOrders.length === 0) {
    console.log("All linked purchase orders are already marked as arrived.");
    return;
  }

  const updatedPoNumbers = [];

  for (const purchaseOrder of notArrivedOrders) {
    const { error } = await supabase.rpc("update_purchase_order_status", {
      p_purchase_order_id: purchaseOrder.id,
      p_status: "arrived",
    });

    if (error) {
      throw new Error(`Could not update PO ${purchaseOrder.po_number}: ${error.message}`);
    }

    updatedPoNumbers.push(purchaseOrder.po_number);
  }

  console.log(`Updated ${updatedPoNumbers.length} purchase order(s) to Arrived.`);
  console.log(updatedPoNumbers.join("\n"));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
