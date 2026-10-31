-- hun. — payments.
--
-- The café collects Birr through the rails its guests already use: Telebirr,
-- CBE Birr, the mobile-banking apps of the commercial banks, and cash at the
-- counter. Each method is a row in payment_methods, so the café's own account
-- numbers live in the database rather than in the client bundle.
--
-- Flow:
--   create_payment      → pending            (customer picks a method)
--   submit_payment_proof→ awaiting_confirmation (customer sends the money)
--   confirm_payment     → paid | failed      (staff verify the transfer)
--
-- No raw INSERT/UPDATE policy exists: every write is a SECURITY DEFINER
-- function. Prices are never taken from the client — the intent copies the
-- order's own total.

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------
create table public.payment_methods (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  code text not null check (code ~ '^[a-z0-9_]{2,32}$'),
  label text not null,
  short text not null,
  kind text not null check (kind in ('wallet', 'bank_transfer', 'cash')),
  account_name text,
  account_number text,
  short_code text,
  instructions text,
  sort_order integer not null default 0,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  order_id uuid not null references public.orders (id) on delete cascade,
  method_code text not null,
  method_label text not null,
  method_short text not null,
  method_kind text not null check (method_kind in ('wallet', 'bank_transfer', 'cash')),
  status text not null default 'pending'
    check (status in ('pending', 'awaiting_confirmation', 'paid', 'failed')),
  amount_minor integer not null check (amount_minor > 0),
  currency text not null,
  -- Human reference the customer quotes in the transfer description.
  reference text not null,
  account_name text,
  account_number text,
  short_code text,
  instructions text,
  payer_name text check (payer_name is null or char_length(payer_name) <= 80),
  payer_phone text check (payer_phone is null or char_length(payer_phone) <= 32),
  transaction_ref text check (transaction_ref is null or char_length(transaction_ref) <= 64),
  submitted_at timestamptz,
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id),
  confirmed_channel text check (confirmed_channel in ('staff', 'sandbox', 'provider')),
  decline_reason text check (decline_reason is null or char_length(decline_reason) <= 300),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One live intent per order. A declined (failed) attempt may be replaced.
create unique index payments_one_active_per_order
  on public.payments (order_id)
  where status <> 'failed';

create index payments_order_idx on public.payments (order_id, created_at desc);
create index payments_queue_idx on public.payments (restaurant_id, status, created_at desc);

create trigger payments_touch_updated_at
  before update on public.payments
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.payment_methods enable row level security;
alter table public.payments enable row level security;

/** The signed-in staff member's restaurant, or null. */
create or replace function public.current_staff_restaurant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select restaurant_id from public.staff_profiles where user_id = auth.uid();
$$;

revoke all on function public.current_staff_restaurant_id() from public;
grant execute on function public.current_staff_restaurant_id() to authenticated, service_role;

create policy "guests read enabled payment methods of active restaurants"
  on public.payment_methods for select
  using (enabled and exists (
    select 1 from public.restaurants r
    where r.id = payment_methods.restaurant_id and r.status = 'active'
  ));

create policy "staff read their restaurant's payment methods"
  on public.payment_methods for select
  to authenticated
  using (restaurant_id = public.current_staff_restaurant_id());

create policy "staff read their restaurant's payments"
  on public.payments for select
  to authenticated
  using (restaurant_id = public.current_staff_restaurant_id());

-- ---------------------------------------------------------------------------
-- JSON shapes
-- ---------------------------------------------------------------------------
create or replace function public.payment_json(p_payment public.payments)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_payment.id,
    'order_id', p_payment.order_id,
    'order_number', (select o.number from public.orders o where o.id = p_payment.order_id),
    'restaurant_id', p_payment.restaurant_id,
    'method_code', p_payment.method_code,
    'method_label', p_payment.method_label,
    'method_short', p_payment.method_short,
    'method_kind', p_payment.method_kind,
    'status', p_payment.status,
    'amount_minor', p_payment.amount_minor,
    'currency', p_payment.currency,
    'reference', p_payment.reference,
    'account_name', p_payment.account_name,
    'account_number', p_payment.account_number,
    'short_code', p_payment.short_code,
    'instructions', p_payment.instructions,
    'payer_name', p_payment.payer_name,
    'payer_phone', p_payment.payer_phone,
    'transaction_ref', p_payment.transaction_ref,
    'submitted_at', p_payment.submitted_at,
    'confirmed_at', p_payment.confirmed_at,
    'created_at', p_payment.created_at
  );
$$;

-- order_json gains payment_status; the rest of the shape is unchanged.
create or replace function public.order_json(p_order public.orders, p_tracking_token text default null)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', p_order.id,
    'number', p_order.number,
    'status', p_order.status,
    'type', p_order.type,
    'table_label', p_order.table_label,
    'customer_name', p_order.customer_name,
    'customer_note', p_order.customer_note,
    'subtotal_minor', p_order.subtotal_minor,
    'total_minor', p_order.total_minor,
    'currency', p_order.currency,
    'version', p_order.version,
    'payment_status', p_order.payment_status,
    'created_at', p_order.created_at,
    'updated_at', p_order.updated_at,
    'tracking_token', p_tracking_token,
    'items', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'name', oi.name,
          'price_minor', oi.price_minor,
          'quantity', oi.quantity,
          'line_total_minor', oi.line_total_minor,
          'note', oi.note
        )
        order by oi.id
      )
      from public.order_items oi
      where oi.order_id = p_order.id
    ), '[]'::jsonb)
  );
$$;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function public.order_from_tracking(p_tracking_token text)
returns public.orders
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
begin
  if p_tracking_token is null or length(p_tracking_token) < 32 then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  select * into v_order
    from public.orders
   where tracking_token_hash = encode(digest(btrim(p_tracking_token), 'sha256'), 'hex');

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  return v_order;
end;
$$;

/** HUN-0042 — short enough to type into a bank app. */
create or replace function public.payment_reference(p_order_number bigint)
returns text
language sql
immutable
as $$
  select 'HUN-' || lpad(p_order_number::text, 4, '0');
$$;

-- ---------------------------------------------------------------------------
-- create_payment — start (or re-point) a payment intent
-- ---------------------------------------------------------------------------
create or replace function public.create_payment(
  p_tracking_token text,
  p_method_code text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_method public.payment_methods%rowtype;
  v_payment public.payments%rowtype;
begin
  v_order := public.order_from_tracking(p_tracking_token);

  -- Serialise concurrent starts for the same order. A double tap, a StrictMode
  -- remount or a retried request can otherwise both pass the "no payment yet"
  -- check below and collide on payments_one_active_per_order (HTTP 409).
  perform 1 from public.orders where id = v_order.id for update;

  if v_order.status in ('rejected', 'cancelled') then
    raise exception 'ORDER_CLOSED';
  end if;
  if v_order.payment_status = 'paid' then
    raise exception 'ALREADY_PAID';
  end if;

  select * into v_method
    from public.payment_methods
   where restaurant_id = v_order.restaurant_id
     and code = p_method_code
     and enabled;
  if not found then
    raise exception 'PAYMENT_METHOD_UNAVAILABLE';
  end if;

  select * into v_payment
    from public.payments
   where order_id = v_order.id
     and status in ('pending', 'awaiting_confirmation', 'paid')
   order by created_at desc
   limit 1;

  if found then
    if v_payment.status = 'paid' then
      raise exception 'ALREADY_PAID';
    end if;
    if v_payment.status = 'awaiting_confirmation' then
      raise exception 'PAYMENT_UNDER_REVIEW';
    end if;

    -- Still pending: switching method is allowed and clears any draft proof.
    update public.payments
       set method_code = v_method.code,
           method_label = v_method.label,
           method_short = v_method.short,
           method_kind = v_method.kind,
           account_name = v_method.account_name,
           account_number = v_method.account_number,
           short_code = v_method.short_code,
           instructions = v_method.instructions,
           transaction_ref = null,
           payer_name = null,
           payer_phone = null,
           submitted_at = null
     where id = v_payment.id
    returning * into v_payment;

    return public.payment_json(v_payment);
  end if;

  insert into public.payments (
    restaurant_id, order_id, method_code, method_label, method_short, method_kind,
    amount_minor, currency, reference, account_name, account_number, short_code, instructions
  ) values (
    v_order.restaurant_id, v_order.id, v_method.code, v_method.label, v_method.short,
    v_method.kind, v_order.total_minor, v_order.currency,
    public.payment_reference(v_order.number),
    v_method.account_name, v_method.account_number, v_method.short_code, v_method.instructions
  )
  returning * into v_payment;

  update public.orders
     set payment_status = 'pending'
   where id = v_order.id;

  return public.payment_json(v_payment);
end;
$$;

-- ---------------------------------------------------------------------------
-- submit_payment_proof — the customer says "I have sent it, here is the ref"
-- ---------------------------------------------------------------------------
create or replace function public.submit_payment_proof(
  p_tracking_token text,
  p_transaction_ref text,
  p_payer_name text,
  p_payer_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  v_order := public.order_from_tracking(p_tracking_token);

  select * into v_payment
    from public.payments
   where order_id = v_order.id and status <> 'failed'
   order by created_at desc
   limit 1;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;
  if v_payment.status = 'paid' then
    raise exception 'ALREADY_PAID';
  end if;
  if v_payment.status = 'awaiting_confirmation' then
    raise exception 'PAYMENT_UNDER_REVIEW';
  end if;
  if v_payment.method_kind = 'cash' then
    raise exception 'CASH_ON_COLLECTION';
  end if;
  if p_transaction_ref is null or char_length(btrim(p_transaction_ref)) < 4 then
    raise exception 'REFERENCE_REQUIRED';
  end if;

  update public.payments
     set status = 'awaiting_confirmation',
         transaction_ref = left(btrim(p_transaction_ref), 64),
         payer_name = nullif(btrim(coalesce(p_payer_name, '')), ''),
         payer_phone = nullif(btrim(coalesce(p_payer_phone, '')), ''),
         submitted_at = now()
   where id = v_payment.id
  returning * into v_payment;

  return public.payment_json(v_payment);
end;
$$;

-- ---------------------------------------------------------------------------
-- Reads for the customer
-- ---------------------------------------------------------------------------
create or replace function public.get_payment_by_tracking(p_tracking_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
begin
  v_order := public.order_from_tracking(p_tracking_token);

  select * into v_payment
    from public.payments
   where order_id = v_order.id and status <> 'failed'
   order by created_at desc
   limit 1;

  if not found then
    return null;
  end if;

  return public.payment_json(v_payment);
end;
$$;

create or replace function public.get_payment_methods(p_restaurant_slug text)
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(jsonb_agg(to_jsonb(m) order by m.sort_order, m.label), '[]'::jsonb)
    from public.payment_methods m
    join public.restaurants r on r.id = m.restaurant_id
   where r.slug = btrim(p_restaurant_slug)
     and r.status = 'active'
     and m.enabled;
$$;

-- ---------------------------------------------------------------------------
-- Sandbox approval — only while a restaurant opts in
--
-- This is how the flow is demonstrated on a portfolio deployment without a
-- live merchant account. It refuses to run unless payments_sandbox is true.
-- ---------------------------------------------------------------------------
create or replace function public.sandbox_approve_payment(p_tracking_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_sandbox boolean;
begin
  v_order := public.order_from_tracking(p_tracking_token);

  select r.payments_sandbox into v_sandbox
    from public.restaurants r
   where r.id = v_order.restaurant_id;

  if not coalesce(v_sandbox, false) then
    raise exception 'SANDBOX_DISABLED';
  end if;

  select * into v_payment
    from public.payments
   where order_id = v_order.id
     and status in ('pending', 'awaiting_confirmation')
   order by created_at desc
   limit 1;

  if not found then
    raise exception 'PAYMENT_NOT_FOUND';
  end if;

  update public.payments
     set status = 'paid',
         confirmed_at = now(),
         confirmed_by = null,
         confirmed_channel = 'sandbox'
   where id = v_payment.id
  returning * into v_payment;

  update public.orders
     set payment_status = 'paid'
   where id = v_order.id;

  return public.payment_json(v_payment);
end;
$$;

-- ---------------------------------------------------------------------------
-- confirm_payment — staff verify or decline a transfer
-- ---------------------------------------------------------------------------
create or replace function public.confirm_payment(
  p_payment_id uuid,
  p_action text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_payment public.payments%rowtype;
  v_restaurant uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_restaurant := public.current_staff_restaurant_id();
  if v_restaurant is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_payment from public.payments where id = p_payment_id;
  if not found or v_payment.restaurant_id <> v_restaurant then
    raise exception 'FORBIDDEN';
  end if;
  if v_payment.status not in ('pending', 'awaiting_confirmation') then
    raise exception 'PAYMENT_NOT_PENDING';
  end if;

  if p_action = 'confirm' then
    update public.payments
       set status = 'paid',
           confirmed_at = now(),
           confirmed_by = auth.uid(),
           confirmed_channel = 'staff',
           decline_reason = null
     where id = v_payment.id
    returning * into v_payment;

    update public.orders
       set payment_status = 'paid'
     where id = v_payment.order_id;
  elsif p_action = 'decline' then
    if p_reason is null or length(btrim(p_reason)) = 0 then
      raise exception 'REASON_REQUIRED';
    end if;

    update public.payments
       set status = 'failed',
           decline_reason = left(btrim(p_reason), 300),
           confirmed_by = auth.uid(),
           confirmed_channel = 'staff'
     where id = v_payment.id
    returning * into v_payment;

    update public.orders
       set payment_status = 'unpaid'
     where id = v_payment.order_id;
  else
    raise exception 'INVALID_PAYMENT_ACTION';
  end if;

  return public.payment_json(v_payment);
end;
$$;

-- ---------------------------------------------------------------------------
-- Staff queue
-- ---------------------------------------------------------------------------
create or replace function public.list_payments_for_staff(
  p_only_open boolean default true
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant uuid;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_restaurant := public.current_staff_restaurant_id();
  if v_restaurant is null then
    raise exception 'FORBIDDEN';
  end if;

  return coalesce((
    select jsonb_agg(entry order by entry->>'created_at' desc)
      from (
        select public.payment_json(p) || jsonb_build_object(
                 'customer_name', o.customer_name,
                 'order_total_minor', o.total_minor,
                 'order_status', o.status
               ) as entry
          from public.payments p
          join public.orders o on o.id = p.order_id
         where p.restaurant_id = v_restaurant
           and (not p_only_open or p.status = 'awaiting_confirmation')
         order by p.created_at desc
         limit 40
      ) rows
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
grant execute on function public.create_payment(text, text) to anon, authenticated, service_role;
grant execute on function public.submit_payment_proof(text, text, text, text) to anon, authenticated, service_role;
grant execute on function public.get_payment_by_tracking(text) to anon, authenticated, service_role;
grant execute on function public.get_payment_methods(text) to anon, authenticated, service_role;
grant execute on function public.sandbox_approve_payment(text) to anon, authenticated, service_role;
grant execute on function public.order_from_tracking(text) to anon, authenticated, service_role;
grant execute on function public.confirm_payment(uuid, text, text) to authenticated, service_role;
grant execute on function public.list_payments_for_staff(boolean) to authenticated, service_role;
grant execute on function public.payment_json(public.payments) to anon, authenticated, service_role;
grant execute on function public.payment_reference(bigint) to anon, authenticated, service_role;
