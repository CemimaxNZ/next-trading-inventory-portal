insert into public.products (id, name, sku, current_stock, in_transit_stock, low_stock_warning_level)
values
  ('35fc0361-3d81-48bf-b2b2-f76838636d4f', 'Marine Grade Bearing Set', 'NT-BRG-001', 120, 0, 30),
  ('8ea18ad8-bc0f-4f59-9cb8-03194370554d', 'Hydraulic Hose Kit', 'NT-HYD-044', 45, 0, 20),
  ('352c0ad2-dd43-49df-a60d-8af6e72d7e4d', 'Container Seal Pack', 'NT-SEA-118', 12, 0, 15),
  ('f89e6b18-5fa5-4f84-b79b-a7dff0ec9151', 'Control Relay Module', 'NT-CRM-212', 8, 0, 10),
  ('96abdfc1-4bd7-4744-b9a3-9e95010f0b8a', 'Warehouse Safety Gloves', 'NT-SAF-501', 220, 0, 50)
on conflict (id) do nothing;

insert into public.purchase_orders (
  id,
  po_number,
  product_id,
  quantity,
  supplier,
  order_date,
  status
)
values
  ('40df09b8-57f4-4de1-b81e-5bb4ae61ebc5', 'PO-2026-1001', '8ea18ad8-bc0f-4f59-9cb8-03194370554d', 50, 'Harbour Industrial Supply', date '2026-07-01', 'shipped'),
  ('56cad8ab-1bb3-4c1f-b8ad-7d943f202556', 'PO-2026-1002', '352c0ad2-dd43-49df-a60d-8af6e72d7e4d', 40, 'Pacific Consumables', date '2026-07-04', 'arrived'),
  ('87f9526d-3750-4e9a-8819-bfb1b170fa8c', 'PO-2026-1003', 'f89e6b18-5fa5-4f84-b79b-a7dff0ec9151', 15, 'RelayCore Electronics', date '2026-07-07', 'ready')
on conflict (id) do nothing;

insert into public.shipments (
  id,
  container_number,
  product_id,
  quantity,
  eta,
  arrival_status
)
values
  ('7d71ba7f-9f9c-4e44-a1bd-63548f0e4ef0', 'CONT-NE-4401', '8ea18ad8-bc0f-4f59-9cb8-03194370554d', 30, date '2026-07-27', 'at_sea'),
  ('1e313a97-32f9-4d67-9920-843bf49d41c4', 'CONT-NE-4402', '35fc0361-3d81-48bf-b2b2-f76838636d4f', 25, date '2026-07-19', 'arrived')
on conflict (id) do nothing;

