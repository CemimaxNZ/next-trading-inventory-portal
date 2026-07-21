do $$
begin
  if not exists (
    select 1
    from pg_type
    where typname = 'product_category'
      and typnamespace = 'public'::regnamespace
  ) then
    create type public.product_category as enum ('cemimax', 'accessories');
  end if;
end
$$;

alter table public.products
add column if not exists category public.product_category not null default 'cemimax';

create index if not exists products_category_idx on public.products (category);
