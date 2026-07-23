alter table public.shipments
  add column if not exists etd date,
  add column if not exists linked_purchase_order_ids uuid[] not null default '{}';

update public.shipments
set linked_purchase_order_ids = case
  when linked_purchase_order_id is null then '{}'
  else array[linked_purchase_order_id]
end
where coalesce(array_length(linked_purchase_order_ids, 1), 0) = 0;
