-- hun. — initial schema, constraints and row-level security.
-- Money is always an integer in the currency's minor unit (ADR-0011).
-- Every tenant-owned table carries restaurant_id (ADR-0003).
-- Writes happen only through SECURITY DEFINER functions (see 0002_*.sql).

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create table public.restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  tagline text,
  currency text not null default 'ETB',
  status text not null default 'active' check (status in ('active', 'suspended')),
  ordering_enabled boolean not null default true,
  -- While true, the payment page offers a clearly labelled sandbox approval
  -- so the flow can be demonstrated without a live merchant account.
  payments_sandbox boolean not null default true,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name text not null,
  tagline text,
  image_url text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  category_id uuid not null references public.categories (id) on delete cascade,
  name text not null,
  description text,
  price_minor integer not null check (price_minor >= 0),
  image_url text,
  available boolean not null default true,
  archived boolean not null default false,
  featured boolean not null default false,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Ordering
-- ---------------------------------------------------------------------------
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id),
  number bigint generated always as identity,
  type text not null check (type in ('pickup', 'dine_in')),
  table_label text,
  status text not null default 'placed'
    check (status in ('placed', 'accepted', 'preparing', 'ready', 'completed', 'rejected', 'cancelled')),
  version integer not null default 1,
  customer_name text not null check (char_length(btrim(customer_name)) between 1 and 80),
  customer_phone text check (customer_phone is null or char_length(customer_phone) <= 32),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  subtotal_minor integer not null check (subtotal_minor >= 0),
  total_minor integer not null check (total_minor >= 0),
  currency text not null,
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'pending', 'paid')),
  idempotency_key text not null check (char_length(idempotency_key) between 8 and 128),
  tracking_token_hash text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_idempotency_unique unique (restaurant_id, idempotency_key)
);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  menu_item_id uuid references public.menu_items (id) on delete set null,
  name text not null,
  price_minor integer not null check (price_minor >= 0),
  quantity integer not null check (quantity between 1 and 99),
  line_total_minor integer not null check (line_total_minor >= 0),
  note text
);

create table public.order_status_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  from_status text,
  to_status text not null,
  actor text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Staff (Supabase Auth users scoped to one restaurant)
-- ---------------------------------------------------------------------------
create table public.staff_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  display_name text not null,
  role text not null default 'owner' check (role in ('owner', 'manager', 'staff', 'kitchen')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index menu_items_menu_idx on public.menu_items (restaurant_id, category_id, sort_order);
create index orders_queue_idx on public.orders (restaurant_id, created_at desc);
create index orders_status_idx on public.orders (restaurant_id, status);
create index order_items_order_idx on public.order_items (order_id);
create index events_order_idx on public.order_status_events (order_id, created_at);
create index staff_restaurant_idx on public.staff_profiles (restaurant_id);

-- ---------------------------------------------------------------------------
-- updated_at maintenance
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger orders_touch_updated_at
  before update on public.orders
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.restaurants enable row level security;
alter table public.categories enable row level security;
alter table public.menu_items enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_events enable row level security;
alter table public.staff_profiles enable row level security;

-- Public menu: anyone may read an active restaurant's catalogue.
create policy "public reads active restaurants"
  on public.restaurants for select
  using (status = 'active');

create policy "public reads categories of active restaurants"
  on public.categories for select
  using (exists (
    select 1 from public.restaurants r
    where r.id = categories.restaurant_id and r.status = 'active'
  ));

create policy "public reads menu items of active restaurants"
  on public.menu_items for select
  using (not archived and exists (
    select 1 from public.restaurants r
    where r.id = menu_items.restaurant_id and r.status = 'active'
  ));

-- Orders: no anonymous read. Staff of the owning restaurant may read.
create policy "staff read their restaurant's orders"
  on public.orders for select
  to authenticated
  using (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.restaurant_id = orders.restaurant_id
  ));

create policy "staff read their restaurant's order items"
  on public.order_items for select
  to authenticated
  using (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.restaurant_id = order_items.restaurant_id
  ));

create policy "staff read their restaurant's status events"
  on public.order_status_events for select
  to authenticated
  using (exists (
    select 1 from public.staff_profiles sp
    where sp.user_id = auth.uid() and sp.restaurant_id = order_status_events.restaurant_id
  ));

-- Staff can see their own profile only.
create policy "read own staff profile"
  on public.staff_profiles for select
  to authenticated
  using (user_id = auth.uid());

-- No INSERT/UPDATE/DELETE policies exist for anon or authenticated users:
-- every write goes through the SECURITY DEFINER functions in 0002.

-- ---------------------------------------------------------------------------
-- Realtime (best effort: the publication only exists on Supabase)
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'orders'
     ) then
    alter publication supabase_realtime add table public.orders;
  end if;
end;
$$;
