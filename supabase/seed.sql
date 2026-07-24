insert into public.products (
  id,
  name,
  sku,
  category,
  current_stock,
  in_transit_stock,
  low_stock_warning_level
)
values
  ('35fc0361-3d81-48bf-b2b2-f76838636d4f', 'Marine Grade Bearing Set', 'NT-BRG-001', 'cemimax', 120, 0, 30),
  ('8ea18ad8-bc0f-4f59-9cb8-03194370554d', 'Hydraulic Hose Kit', 'NT-HYD-044', 'cemimax', 45, 0, 20),
  ('352c0ad2-dd43-49df-a60d-8af6e72d7e4d', 'Container Seal Pack', 'NT-SEA-118', 'accessories', 12, 0, 15),
  ('f89e6b18-5fa5-4f84-b79b-a7dff0ec9151', 'Control Relay Module', 'NT-CRM-212', 'cemimax', 8, 0, 10),
  ('96abdfc1-4bd7-4744-b9a3-9e95010f0b8a', 'Warehouse Safety Gloves', 'NT-SAF-501', 'accessories', 220, 0, 50)
on conflict (id) do nothing;

insert into public.purchase_orders (
  id,
  po_number,
  supplier,
  order_date,
  status
)
values
  ('40df09b8-57f4-4de1-b81e-5bb4ae61ebc5', 'PO-2026-1001', 'Harbour Industrial Supply', date '2026-07-01', 'shipped'),
  ('56cad8ab-1bb3-4c1f-b8ad-7d943f202556', 'PO-2026-1002', 'Pacific Consumables', date '2026-07-04', 'arrived'),
  ('87f9526d-3750-4e9a-8819-bfb1b170fa8c', 'PO-2026-1003', 'RelayCore Electronics', date '2026-07-07', 'paid')
on conflict (id) do nothing;

insert into public.purchase_order_items (
  id,
  purchase_order_id,
  product_id,
  quantity
)
values
  ('39c6d1e8-86ce-4c43-9edc-18252f2a8b11', '40df09b8-57f4-4de1-b81e-5bb4ae61ebc5', '8ea18ad8-bc0f-4f59-9cb8-03194370554d', 50),
  ('e4f50e8f-40b9-4c62-8cd3-b4592cf7cc20', '40df09b8-57f4-4de1-b81e-5bb4ae61ebc5', '35fc0361-3d81-48bf-b2b2-f76838636d4f', 20),
  ('20c3a3a8-fcfd-4a7a-9455-4d4ca67fcb65', '56cad8ab-1bb3-4c1f-b8ad-7d943f202556', '352c0ad2-dd43-49df-a60d-8af6e72d7e4d', 40),
  ('e3d8e62e-48f5-4edc-90d7-d71f0566ef3e', '56cad8ab-1bb3-4c1f-b8ad-7d943f202556', '96abdfc1-4bd7-4744-b9a3-9e95010f0b8a', 60),
  ('dab2db58-09f6-4ef8-aae0-5239e8f0d2e7', '87f9526d-3750-4e9a-8819-bfb1b170fa8c', 'f89e6b18-5fa5-4f84-b79b-a7dff0ec9151', 15)
on conflict (id) do nothing;

with seeded_transactions as (
  insert into public.inventory_transactions (
    id,
    product_id,
    quantity,
    type,
    reason,
    reference_table,
    reference_id
  )
  values
    ('f3913bf2-b311-4293-9051-0a3cf582f9d6', '352c0ad2-dd43-49df-a60d-8af6e72d7e4d', 40, 'purchase_order_arrived', 'PO PO-2026-1002 marked as arrived', 'purchase_orders', '56cad8ab-1bb3-4c1f-b8ad-7d943f202556'),
    ('2265567b-fc6e-4607-a933-a17db434a647', '96abdfc1-4bd7-4744-b9a3-9e95010f0b8a', 60, 'purchase_order_arrived', 'PO PO-2026-1002 marked as arrived', 'purchase_orders', '56cad8ab-1bb3-4c1f-b8ad-7d943f202556')
  on conflict (id) do nothing
  returning product_id, quantity
)
update public.products
set current_stock = public.products.current_stock + seeded_transactions.quantity
from seeded_transactions
where public.products.id = seeded_transactions.product_id;

insert into public.shipments (
  id,
  container_number,
  product_id,
  quantity,
  etd,
  eta,
  arrival_status,
  linked_purchase_order_ids
)
values
  ('7d71ba7f-9f9c-4e44-a1bd-63548f0e4ef0', 'CONT-NE-4401', '8ea18ad8-bc0f-4f59-9cb8-03194370554d', 30, date '2026-07-20', date '2026-07-27', 'at_sea', '{}'),
  ('1e313a97-32f9-4d67-9920-843bf49d41c4', 'CONT-NE-4402', '35fc0361-3d81-48bf-b2b2-f76838636d4f', 25, date '2026-07-12', date '2026-07-19', 'arrived', '{}')
on conflict (id) do nothing;
