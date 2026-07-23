-- Run this in the Supabase SQL editor for existing projects.

alter type public.shipment_status add value if not exists 'scheduled';

alter table public.shipments
  alter column product_id drop not null,
  alter column quantity drop not null,
  alter column arrival_status set default 'scheduled';

alter table public.shipments
  drop constraint if exists shipments_quantity_check;

alter table public.shipments
  add constraint shipments_quantity_check check (quantity is null or quantity > 0);

create or replace function public.sync_shipment_stock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_in_transit_qty integer := case
    when tg_op <> 'INSERT'
      and old.arrival_status = 'at_sea'
      and old.product_id is not null
      and old.quantity is not null
    then old.quantity
    else 0
  end;
  new_in_transit_qty integer := case
    when tg_op <> 'DELETE'
      and new.arrival_status = 'at_sea'
      and new.product_id is not null
      and new.quantity is not null
    then new.quantity
    else 0
  end;
  old_landed_qty integer := case
    when tg_op <> 'INSERT'
      and old.arrival_status in ('arrived', 'completed')
      and old.product_id is not null
      and old.quantity is not null
    then old.quantity
    else 0
  end;
  new_landed_qty integer := case
    when tg_op <> 'DELETE'
      and new.arrival_status in ('arrived', 'completed')
      and new.product_id is not null
      and new.quantity is not null
    then new.quantity
    else 0
  end;
begin
  if tg_op = 'INSERT' then
    if new_in_transit_qty > 0 then
      perform public.apply_inventory_delta(new.product_id, 0, new_in_transit_qty);
    end if;

    if new_landed_qty > 0 then
      perform public.apply_inventory_delta(new.product_id, new_landed_qty, 0);
      perform public.record_inventory_transaction(
        new.product_id,
        new_landed_qty,
        'shipment_arrived',
        'Shipment ' || new.container_number || ' recorded as landed',
        'shipments',
        new.id,
        new.created_by
      );
    end if;

    return new;
  end if;

  if tg_op = 'DELETE' then
    if old_in_transit_qty > 0 then
      perform public.apply_inventory_delta(old.product_id, 0, -old_in_transit_qty);
    end if;

    if old_landed_qty > 0 then
      perform public.apply_inventory_delta(old.product_id, -old_landed_qty, 0);
      perform public.record_inventory_transaction(
        old.product_id,
        -old_landed_qty,
        'shipment_reversed',
        'Shipment ' || old.container_number || ' arrival reversed by deletion',
        'shipments',
        old.id,
        old.created_by
      );
    end if;

    return old;
  end if;

  if old.product_id is not distinct from new.product_id then
    if new_in_transit_qty <> old_in_transit_qty then
      perform public.apply_inventory_delta(new.product_id, 0, new_in_transit_qty - old_in_transit_qty);
    end if;

    if new_landed_qty <> old_landed_qty then
      perform public.apply_inventory_delta(new.product_id, new_landed_qty - old_landed_qty, 0);

      if new_landed_qty > old_landed_qty then
        perform public.record_inventory_transaction(
          new.product_id,
          new_landed_qty - old_landed_qty,
          'shipment_arrived',
          'Shipment ' || new.container_number || ' marked as arrived',
          'shipments',
          new.id,
          auth.uid()
        );
      elsif new_landed_qty < old_landed_qty then
        perform public.record_inventory_transaction(
          new.product_id,
          new_landed_qty - old_landed_qty,
          'shipment_reversed',
          'Shipment ' || new.container_number || ' arrival reversed',
          'shipments',
          new.id,
          auth.uid()
        );
      end if;
    end if;
  else
    if old_in_transit_qty > 0 then
      perform public.apply_inventory_delta(old.product_id, 0, -old_in_transit_qty);
    end if;

    if old_landed_qty > 0 then
      perform public.apply_inventory_delta(old.product_id, -old_landed_qty, 0);
      perform public.record_inventory_transaction(
        old.product_id,
        -old_landed_qty,
        'shipment_reversed',
        'Shipment ' || old.container_number || ' moved away from product',
        'shipments',
        old.id,
        auth.uid()
      );
    end if;

    if new_in_transit_qty > 0 then
      perform public.apply_inventory_delta(new.product_id, 0, new_in_transit_qty);
    end if;

    if new_landed_qty > 0 then
      perform public.apply_inventory_delta(new.product_id, new_landed_qty, 0);
      perform public.record_inventory_transaction(
        new.product_id,
        new_landed_qty,
        'shipment_arrived',
        'Shipment ' || new.container_number || ' recorded as landed',
        'shipments',
        new.id,
        auth.uid()
      );
    end if;
  end if;

  return new;
end;
$$;
