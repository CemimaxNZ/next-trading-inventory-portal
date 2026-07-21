create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (purchase_order_id, product_id)
);

create index if not exists purchase_order_items_purchase_order_idx
on public.purchase_order_items (purchase_order_id);

create index if not exists purchase_order_items_product_idx
on public.purchase_order_items (product_id);

insert into public.purchase_order_items (purchase_order_id, product_id, quantity)
select po.id, po.product_id, po.quantity
from public.purchase_orders po
where po.product_id is not null
  and po.quantity is not null
  and not exists (
    select 1
    from public.purchase_order_items poi
    where poi.purchase_order_id = po.id
      and poi.product_id = po.product_id
  );

drop trigger if exists purchase_orders_stock_sync on public.purchase_orders;

create trigger purchase_order_items_set_updated_at
before update on public.purchase_order_items
for each row execute procedure public.set_updated_at();

alter table public.purchase_order_items enable row level security;

drop policy if exists "Authenticated users can read purchase order items" on public.purchase_order_items;
create policy "Authenticated users can read purchase order items"
on public.purchase_order_items
for select
to authenticated
using (true);

drop policy if exists "Admins manage purchase order items" on public.purchase_order_items;
create policy "Admins manage purchase order items"
on public.purchase_order_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.reconcile_purchase_order_inventory(
  p_purchase_order_id uuid,
  p_old_po_number text,
  p_new_po_number text,
  p_old_status public.purchase_order_status,
  p_new_status public.purchase_order_status,
  p_old_items jsonb,
  p_new_items jsonb,
  p_actor uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  delta_record record;
begin
  for delta_record in
    with old_items as (
      select
        item.product_id,
        sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(
        case
          when p_old_status = 'arrived' then coalesce(p_old_items, '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as item(product_id uuid, quantity integer)
      group by item.product_id
    ),
    new_items as (
      select
        item.product_id,
        sum(item.quantity)::integer as quantity
      from jsonb_to_recordset(
        case
          when p_new_status = 'arrived' then coalesce(p_new_items, '[]'::jsonb)
          else '[]'::jsonb
        end
      ) as item(product_id uuid, quantity integer)
      group by item.product_id
    )
    select
      coalesce(new_items.product_id, old_items.product_id) as product_id,
      coalesce(new_items.quantity, 0) - coalesce(old_items.quantity, 0) as delta
    from old_items
    full join new_items using (product_id)
    where coalesce(new_items.quantity, 0) <> coalesce(old_items.quantity, 0)
  loop
    perform public.apply_inventory_delta(delta_record.product_id, delta_record.delta, 0);

    if delta_record.delta > 0 then
      perform public.record_inventory_transaction(
        delta_record.product_id,
        delta_record.delta,
        'purchase_order_arrived',
        'PO ' || coalesce(p_new_po_number, p_old_po_number) || ' marked as arrived',
        'purchase_orders',
        p_purchase_order_id,
        p_actor
      );
    else
      perform public.record_inventory_transaction(
        delta_record.product_id,
        delta_record.delta,
        'purchase_order_reversed',
        'PO ' || coalesce(p_old_po_number, p_new_po_number) || ' arrival reversed',
        'purchase_orders',
        p_purchase_order_id,
        p_actor
      );
    end if;
  end loop;
end;
$$;

create or replace function public.save_purchase_order(
  p_purchase_order_id uuid default null,
  p_po_number text,
  p_supplier text,
  p_order_date date,
  p_status public.purchase_order_status,
  p_items jsonb,
  p_created_by uuid default auth.uid()
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.purchase_orders;
  saved_order public.purchase_orders;
  old_items jsonb := '[]'::jsonb;
  actor_id uuid := coalesce(auth.uid(), p_created_by);
begin
  if not public.is_admin() then
    raise exception 'Only admins can manage purchase orders';
  end if;

  if jsonb_typeof(coalesce(p_items, '[]'::jsonb)) <> 'array' then
    raise exception 'Purchase order items must be a JSON array';
  end if;

  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'At least one purchase order item is required';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    group by item.product_id
    having count(*) > 1
  ) then
    raise exception 'Each product can only appear once per purchase order';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer)
    where item.quantity <= 0
  ) then
    raise exception 'Each purchase order line must have a quantity greater than zero';
  end if;

  if p_purchase_order_id is not null then
    select *
    into existing_order
    from public.purchase_orders
    where id = p_purchase_order_id
    for update;

    if not found then
      raise exception 'Purchase order % not found', p_purchase_order_id;
    end if;

    select coalesce(
      jsonb_agg(
        jsonb_build_object(
          'product_id', product_id,
          'quantity', quantity
        )
      ),
      '[]'::jsonb
    )
    into old_items
    from public.purchase_order_items
    where purchase_order_id = p_purchase_order_id;

    update public.purchase_orders
    set po_number = p_po_number,
        supplier = p_supplier,
        order_date = p_order_date,
        status = p_status,
        updated_at = timezone('utc', now())
    where id = p_purchase_order_id
    returning * into saved_order;
  else
    insert into public.purchase_orders (
      po_number,
      supplier,
      order_date,
      status,
      created_by
    )
    values (
      p_po_number,
      p_supplier,
      p_order_date,
      p_status,
      p_created_by
    )
    returning * into saved_order;
  end if;

  delete from public.purchase_order_items
  where purchase_order_id = saved_order.id;

  insert into public.purchase_order_items (
    purchase_order_id,
    product_id,
    quantity
  )
  select
    saved_order.id,
    item.product_id,
    item.quantity
  from jsonb_to_recordset(p_items) as item(product_id uuid, quantity integer);

  perform public.reconcile_purchase_order_inventory(
    saved_order.id,
    existing_order.po_number,
    saved_order.po_number,
    coalesce(existing_order.status, 'paid'::public.purchase_order_status),
    saved_order.status,
    old_items,
    p_items,
    actor_id
  );

  return saved_order;
end;
$$;

create or replace function public.delete_purchase_order(
  p_purchase_order_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existing_order public.purchase_orders;
  old_items jsonb := '[]'::jsonb;
begin
  if not public.is_admin() then
    raise exception 'Only admins can delete purchase orders';
  end if;

  select *
  into existing_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order % not found', p_purchase_order_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity
      )
    ),
    '[]'::jsonb
  )
  into old_items
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;

  perform public.reconcile_purchase_order_inventory(
    existing_order.id,
    existing_order.po_number,
    existing_order.po_number,
    existing_order.status,
    'paid'::public.purchase_order_status,
    old_items,
    '[]'::jsonb,
    auth.uid()
  );

  delete from public.purchase_orders
  where id = p_purchase_order_id;

  return true;
end;
$$;

create or replace function public.update_purchase_order_status(
  p_purchase_order_id uuid,
  p_status public.purchase_order_status
)
returns public.purchase_orders
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.purchase_orders;
  updated_row public.purchase_orders;
  current_items jsonb := '[]'::jsonb;
begin
  if not public.is_operator_or_admin() then
    raise exception 'Only admins or operators can update purchase order status';
  end if;

  select *
  into current_row
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;

  if not found then
    raise exception 'Purchase order % not found', p_purchase_order_id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'product_id', product_id,
        'quantity', quantity
      )
    ),
    '[]'::jsonb
  )
  into current_items
  from public.purchase_order_items
  where purchase_order_id = p_purchase_order_id;

  update public.purchase_orders
  set status = p_status,
      updated_at = timezone('utc', now())
  where id = p_purchase_order_id
  returning * into updated_row;

  perform public.reconcile_purchase_order_inventory(
    updated_row.id,
    current_row.po_number,
    updated_row.po_number,
    current_row.status,
    updated_row.status,
    current_items,
    current_items,
    auth.uid()
  );

  return updated_row;
end;
$$;

revoke execute on function public.reconcile_purchase_order_inventory(
  uuid,
  text,
  text,
  public.purchase_order_status,
  public.purchase_order_status,
  jsonb,
  jsonb,
  uuid
) from public;

revoke execute on function public.save_purchase_order(
  uuid,
  text,
  text,
  date,
  public.purchase_order_status,
  jsonb,
  uuid
) from public;

revoke execute on function public.delete_purchase_order(uuid) from public;

grant execute on function public.save_purchase_order(
  uuid,
  text,
  text,
  date,
  public.purchase_order_status,
  jsonb,
  uuid
) to authenticated;

grant execute on function public.delete_purchase_order(uuid) to authenticated;
