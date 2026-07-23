create extension if not exists pgcrypto;

create type public.app_role as enum ('admin', 'operator', 'viewer');
create type public.product_category as enum ('cemimax', 'accessories');
create type public.purchase_order_status as enum ('paid', 'ready', 'shipped', 'arrived');
create type public.shipment_status as enum ('scheduled', 'at_sea', 'arrived', 'completed');
create type public.inventory_transaction_type as enum (
  'manual_add',
  'manual_remove',
  'purchase_order_arrived',
  'purchase_order_reversed',
  'shipment_arrived',
  'shipment_reversed'
);

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text unique,
  full_name text not null,
  role public.app_role not null default 'viewer',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text not null unique,
  category public.product_category not null default 'cemimax',
  current_stock integer not null default 0 check (current_stock >= 0),
  in_transit_stock integer not null default 0 check (in_transit_stock >= 0),
  low_stock_warning_level integer not null default 10 check (low_stock_warning_level >= 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null unique,
  supplier text not null,
  order_date date not null,
  status public.purchase_order_status not null default 'paid',
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (purchase_order_id, product_id)
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  container_number text not null unique,
  product_id uuid references public.products (id) on delete restrict,
  quantity integer check (quantity > 0),
  eta date not null,
  arrival_status public.shipment_status not null default 'scheduled',
  linked_purchase_order_id uuid references public.purchase_orders (id) on delete set null,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.inventory_transactions (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default timezone('utc', now()),
  product_id uuid not null references public.products (id) on delete restrict,
  quantity integer not null check (quantity <> 0),
  type public.inventory_transaction_type not null,
  reason text not null,
  reference_table text,
  reference_id uuid,
  performed_by uuid references public.profiles (id) on delete set null
);

create index products_sku_idx on public.products (sku);
create index products_category_idx on public.products (category);
create index purchase_orders_status_idx on public.purchase_orders (status);
create index purchase_order_items_purchase_order_idx on public.purchase_order_items (purchase_order_id);
create index purchase_order_items_product_idx on public.purchase_order_items (product_id);
create index shipments_product_idx on public.shipments (product_id);
create index shipments_status_idx on public.shipments (arrival_status);
create index inventory_transactions_product_idx on public.inventory_transactions (product_id);
create index inventory_transactions_created_at_idx on public.inventory_transactions (created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, 'user'), '@', 1))
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name;

  return new;
end;
$$;

create or replace function public.current_user_role()
returns public.app_role
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    (select role from public.profiles where id = auth.uid()),
    'viewer'::public.app_role
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() = 'admin';
$$;

create or replace function public.is_operator_or_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_role() in ('admin', 'operator');
$$;

create or replace function public.apply_inventory_delta(
  p_product_id uuid,
  p_current_delta integer default 0,
  p_in_transit_delta integer default 0
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.products%rowtype;
begin
  select *
  into current_row
  from public.products
  where id = p_product_id
  for update;

  if not found then
    raise exception 'Product % not found', p_product_id;
  end if;

  if current_row.current_stock + p_current_delta < 0 then
    raise exception 'Current stock cannot become negative for product %', p_product_id;
  end if;

  if current_row.in_transit_stock + p_in_transit_delta < 0 then
    raise exception 'In transit stock cannot become negative for product %', p_product_id;
  end if;

  update public.products
  set current_stock = current_stock + p_current_delta,
      in_transit_stock = in_transit_stock + p_in_transit_delta,
      updated_at = timezone('utc', now())
  where id = p_product_id;
end;
$$;

create or replace function public.record_inventory_transaction(
  p_product_id uuid,
  p_quantity integer,
  p_type public.inventory_transaction_type,
  p_reason text,
  p_reference_table text default null,
  p_reference_id uuid default null,
  p_performed_by uuid default auth.uid()
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.inventory_transactions (
    product_id,
    quantity,
    type,
    reason,
    reference_table,
    reference_id,
    performed_by
  )
  values (
    p_product_id,
    p_quantity,
    p_type,
    p_reason,
    p_reference_table,
    p_reference_id,
    p_performed_by
  );
end;
$$;

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
  p_po_number text,
  p_supplier text,
  p_order_date date,
  p_status public.purchase_order_status,
  p_items jsonb,
  p_purchase_order_id uuid default null,
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

create or replace function public.perform_stock_adjustment(
  p_product_id uuid,
  p_adjustment text,
  p_quantity integer,
  p_reason text
)
returns public.inventory_transactions
language plpgsql
security definer
set search_path = public
as $$
declare
  signed_quantity integer;
  created_transaction public.inventory_transactions;
begin
  if not public.is_operator_or_admin() then
    raise exception 'Only admins or operators can adjust stock';
  end if;

  if p_quantity <= 0 then
    raise exception 'Quantity must be greater than zero';
  end if;

  if p_adjustment not in ('add', 'remove') then
    raise exception 'Adjustment must be add or remove';
  end if;

  signed_quantity := case when p_adjustment = 'add' then p_quantity else -p_quantity end;

  perform public.apply_inventory_delta(p_product_id, signed_quantity, 0);

  insert into public.inventory_transactions (
    product_id,
    quantity,
    type,
    reason,
    reference_table,
    performed_by
  )
  values (
    p_product_id,
    signed_quantity,
    case when p_adjustment = 'add' then 'manual_add' else 'manual_remove' end,
    p_reason,
    'manual_adjustment',
    auth.uid()
  )
  returning * into created_transaction;

  return created_transaction;
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

create or replace function public.update_shipment_status(
  p_shipment_id uuid,
  p_status public.shipment_status
)
returns public.shipments
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_row public.shipments;
begin
  if not public.is_operator_or_admin() then
    raise exception 'Only admins or operators can update shipment status';
  end if;

  update public.shipments
  set arrival_status = p_status,
      updated_at = timezone('utc', now())
  where id = p_shipment_id
  returning * into updated_row;

  return updated_row;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute procedure public.set_updated_at();

create trigger products_set_updated_at
before update on public.products
for each row execute procedure public.set_updated_at();

create trigger purchase_orders_set_updated_at
before update on public.purchase_orders
for each row execute procedure public.set_updated_at();

create trigger purchase_order_items_set_updated_at
before update on public.purchase_order_items
for each row execute procedure public.set_updated_at();

create trigger shipments_set_updated_at
before update on public.shipments
for each row execute procedure public.set_updated_at();

create trigger on_auth_user_created
after insert on auth.users
for each row execute procedure public.handle_new_user();

create trigger shipments_stock_sync
after insert or update or delete on public.shipments
for each row execute procedure public.sync_shipment_stock();

alter table public.profiles enable row level security;
alter table public.products enable row level security;
alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;
alter table public.shipments enable row level security;
alter table public.inventory_transactions enable row level security;

create policy "Authenticated users can read profiles"
on public.profiles
for select
to authenticated
using (true);

create policy "Admins manage profiles"
on public.profiles
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read products"
on public.products
for select
to authenticated
using (true);

create policy "Admins manage products"
on public.products
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read purchase orders"
on public.purchase_orders
for select
to authenticated
using (true);

create policy "Admins manage purchase orders"
on public.purchase_orders
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read purchase order items"
on public.purchase_order_items
for select
to authenticated
using (true);

create policy "Admins manage purchase order items"
on public.purchase_order_items
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read shipments"
on public.shipments
for select
to authenticated
using (true);

create policy "Admins manage shipments"
on public.shipments
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create policy "Authenticated users can read transactions"
on public.inventory_transactions
for select
to authenticated
using (true);

-- Prevent direct calls to internal SECURITY DEFINER helpers.
revoke execute on function public.set_updated_at() from public;
revoke execute on function public.handle_new_user() from public;
revoke execute on function public.apply_inventory_delta(uuid, integer, integer) from public;
revoke execute on function public.record_inventory_transaction(
  uuid,
  integer,
  public.inventory_transaction_type,
  text,
  text,
  uuid,
  uuid
) from public;
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
revoke execute on function public.sync_shipment_stock() from public;
revoke execute on function public.perform_stock_adjustment(uuid, text, integer, text) from public;
revoke execute on function public.save_purchase_order(
  text,
  text,
  date,
  public.purchase_order_status,
  jsonb,
  uuid,
  uuid
) from public;
revoke execute on function public.delete_purchase_order(uuid) from public;
revoke execute on function public.update_purchase_order_status(uuid, public.purchase_order_status) from public;
revoke execute on function public.update_shipment_status(uuid, public.shipment_status) from public;
revoke execute on function public.current_user_role() from public;
revoke execute on function public.is_admin() from public;
revoke execute on function public.is_operator_or_admin() from public;

grant usage on schema public to anon, authenticated, service_role;
grant select on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on function public.current_user_role() to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_operator_or_admin() to authenticated;
grant execute on function public.perform_stock_adjustment(uuid, text, integer, text) to authenticated;
grant execute on function public.save_purchase_order(
  text,
  text,
  date,
  public.purchase_order_status,
  jsonb,
  uuid,
  uuid
) to authenticated;
grant execute on function public.delete_purchase_order(uuid) to authenticated;
grant execute on function public.update_purchase_order_status(uuid, public.purchase_order_status) to authenticated;
grant execute on function public.update_shipment_status(uuid, public.shipment_status) to authenticated;
