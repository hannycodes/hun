-- hun. — order functions.
-- All writes run through SECURITY DEFINER functions so that no client-side
-- INSERT/UPDATE policy is ever needed: server-side pricing, idempotency,
-- optimistic concurrency and the order state machine live here.

-- ---------------------------------------------------------------------------
-- Shared response shape for an order (with its snapshot lines)
-- ---------------------------------------------------------------------------
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
-- place_order — the single write path for customer orders
--
-- Prices, availability and totals come from the catalogue, never from the
-- client (FR-033). The unique (restaurant_id, idempotency_key) constraint
-- makes retries return the original order instead of creating a second
-- (FR-034, NFR-010). Order lines are snapshots (FR-035).
-- ---------------------------------------------------------------------------
create or replace function public.place_order(
  p_restaurant_slug text,
  p_idempotency_key text,
  p_type text,
  p_customer_name text,
  p_lines jsonb,
  p_customer_phone text default null,
  p_table_label text default null,
  p_customer_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_restaurant public.restaurants%rowtype;
  v_order public.orders%rowtype;
  v_line jsonb;
  v_item public.menu_items%rowtype;
  v_qty integer;
  v_line_total integer;
  v_subtotal integer := 0;
  v_lines jsonb := '[]'::jsonb;
  v_token text;
begin
  if p_type not in ('pickup', 'dine_in') then
    raise exception 'INVALID_ORDER_TYPE';
  end if;
  if p_type = 'dine_in' and (p_table_label is null or length(btrim(p_table_label)) = 0) then
    raise exception 'TABLE_REQUIRED';
  end if;
  if p_customer_name is null or length(btrim(p_customer_name)) = 0 or length(p_customer_name) > 80 then
    raise exception 'NAME_REQUIRED';
  end if;
  if p_idempotency_key is null or length(p_idempotency_key) < 8 or length(p_idempotency_key) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array'
     or jsonb_array_length(p_lines) = 0 or jsonb_array_length(p_lines) > 50 then
    raise exception 'EMPTY_CART';
  end if;

  select * into v_restaurant
    from public.restaurants
    where slug = btrim(p_restaurant_slug);
  if not found then
    raise exception 'RESTAURANT_NOT_FOUND';
  end if;
  if v_restaurant.status <> 'active' or not v_restaurant.ordering_enabled then
    raise exception 'ORDERING_DISABLED';
  end if;

  -- Idempotency: a repeat of a known key returns the original order as-is.
  select * into v_order
    from public.orders
    where restaurant_id = v_restaurant.id and idempotency_key = p_idempotency_key;
  if found then
    return public.order_json(v_order, null);
  end if;

  -- Server-side pricing: only the catalogue decides what an item costs.
  for v_line in select * from jsonb_array_elements(p_lines)
  loop
    begin
      v_qty := (v_line->>'quantity')::integer;
    exception when others then
      raise exception 'INVALID_QUANTITY';
    end;
    if v_qty is null or v_qty < 1 or v_qty > 99 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select * into v_item
      from public.menu_items
      where id = (v_line->>'menu_item_id')::uuid
        and restaurant_id = v_restaurant.id
        and not archived
        and available;
    if not found then
      raise exception 'ITEM_UNAVAILABLE';
    end if;

    v_line_total := v_item.price_minor * v_qty;
    v_subtotal := v_subtotal + v_line_total;

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'menu_item_id', v_item.id,
      'name', v_item.name,
      'price_minor', v_item.price_minor,
      'quantity', v_qty,
      'line_total_minor', v_line_total,
      'note', left(coalesce(btrim(v_line->>'note'), ''), 200)
    ));
  end loop;

  v_token := encode(gen_random_bytes(24), 'hex');

  begin
    insert into public.orders (
      restaurant_id, type, table_label, customer_name, customer_phone, customer_note,
      subtotal_minor, total_minor, currency, idempotency_key, tracking_token_hash
    ) values (
      v_restaurant.id, p_type, nullif(btrim(coalesce(p_table_label, '')), ''),
      btrim(p_customer_name), nullif(btrim(coalesce(p_customer_phone, '')), ''),
      nullif(btrim(coalesce(p_customer_note, '')), ''),
      v_subtotal, v_subtotal, v_restaurant.currency,
      p_idempotency_key, encode(digest(v_token, 'sha256'), 'hex')
    )
    returning * into v_order;
  exception when unique_violation then
    -- A concurrent retry of the same key won the race: return its order.
    select * into v_order
      from public.orders
      where restaurant_id = v_restaurant.id and idempotency_key = p_idempotency_key;
    if found then
      return public.order_json(v_order, null);
    end if;
    raise;
  end;

  insert into public.order_items (order_id, restaurant_id, menu_item_id, name, price_minor, quantity, line_total_minor, note)
  select v_order.id, v_restaurant.id,
         (l->>'menu_item_id')::uuid, l->>'name', (l->>'price_minor')::integer,
         (l->>'quantity')::integer, (l->>'line_total_minor')::integer, l->>'note'
    from jsonb_array_elements(v_lines) as l;

  insert into public.order_status_events (order_id, restaurant_id, from_status, to_status, actor)
  values (v_order.id, v_restaurant.id, null, 'placed', 'customer');

  return public.order_json(v_order, v_token);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_order_status — the order state machine (FR-041, FR-044, FR-045)
--
-- placed     -> accepted | rejected | cancelled
-- accepted   -> preparing | cancelled
-- preparing  -> ready
-- ready      -> completed
-- completed / rejected / cancelled are terminal.
-- ---------------------------------------------------------------------------
create or replace function public.update_order_status(
  p_order_id uuid,
  p_expected_version integer,
  p_new_status text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  v_order public.orders%rowtype;
  v_from text;
  v_actor text;
  v_allowed boolean;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select sp.display_name into v_actor
    from public.staff_profiles sp
   where sp.user_id = auth.uid();
  if v_actor is null then
    raise exception 'FORBIDDEN';
  end if;

  select * into v_order from public.orders where id = p_order_id;
  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  -- Staff may only touch orders of their own restaurant (tenant isolation).
  if not exists (
    select 1 from public.staff_profiles sp
     where sp.user_id = auth.uid() and sp.restaurant_id = v_order.restaurant_id
  ) then
    raise exception 'FORBIDDEN';
  end if;

  v_allowed := case v_order.status
    when 'placed'    then p_new_status in ('accepted', 'rejected', 'cancelled')
    when 'accepted'  then p_new_status in ('preparing', 'cancelled')
    when 'preparing' then p_new_status = 'ready'
    when 'ready'     then p_new_status = 'completed'
    else false
  end;
  if not v_allowed then
    raise exception 'INVALID_TRANSITION';
  end if;
  if p_new_status in ('rejected', 'cancelled')
     and (p_reason is null or length(btrim(p_reason)) = 0) then
    raise exception 'REASON_REQUIRED';
  end if;

  v_from := v_order.status;

  update public.orders
     set status = p_new_status,
         version = version + 1
   where id = p_order_id
     and version = p_expected_version
  returning * into v_order;

  if not found then
    raise exception 'VERSION_CONFLICT';
  end if;

  insert into public.order_status_events (order_id, restaurant_id, from_status, to_status, actor)
  values (p_order_id, v_order.restaurant_id, v_from, p_new_status, v_actor);

  return public.order_json(v_order, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- get_order_by_tracking — customer status view (FR-036)
-- The tracking token is high entropy and stored only as a SHA-256 hash.
-- ---------------------------------------------------------------------------
create or replace function public.get_order_by_tracking(p_tracking_token text)
returns jsonb
language plpgsql
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

  return public.order_json(v_order, null);
end;
$$;

-- ---------------------------------------------------------------------------
-- Status history for a tracked order (shown on the confirmation page)
-- ---------------------------------------------------------------------------
create or replace function public.get_order_events_by_tracking(p_tracking_token text)
returns jsonb
language plpgsql
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

  return coalesce((
    select jsonb_agg(
      jsonb_build_object(
        'from_status', e.from_status,
        'to_status', e.to_status,
        'actor', e.actor,
        'created_at', e.created_at
      ) order by e.created_at
    )
    from public.order_status_events e
    where e.order_id = v_order.id
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- Execute grants (Supabase roles)
-- ---------------------------------------------------------------------------
grant execute on function public.place_order(text, text, text, text, jsonb, text, text, text)
  to anon, authenticated, service_role;
grant execute on function public.update_order_status(uuid, integer, text, text)
  to anon, authenticated, service_role;
grant execute on function public.get_order_by_tracking(text)
  to anon, authenticated, service_role;
grant execute on function public.get_order_events_by_tracking(text)
  to anon, authenticated, service_role;
grant execute on function public.order_json(public.orders, text)
  to anon, authenticated, service_role;
