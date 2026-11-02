-- hun. — the management side of the menu.
--
-- Customers read the catalogue through the public policies in 0001_schema.sql.
-- Staff change it here: a signed-in member of a restaurant can switch an item
-- off when it sells out, put it back on, mark it featured, or move its price.
-- Both functions are SECURITY DEFINER and check the caller's staff profile, so
-- no client-side UPDATE policy is needed and no one can edit another tenant's
-- menu.
--
-- Everything still goes through the catalogue: place_order re-reads price and
-- availability from these rows, so a change here takes effect on the next order
-- (FR-033).

-- ---------------------------------------------------------------------------
-- staff_menu — the editable catalogue for the signed-in staff member
-- ---------------------------------------------------------------------------
create or replace function public.staff_menu()
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
    select jsonb_agg(
             jsonb_build_object(
               'id', i.id,
               'category_id', i.category_id,
               'category', c.name,
               'category_sort', c.sort_order,
               'name', i.name,
               'description', i.description,
               'price_minor', i.price_minor,
               'image_url', i.image_url,
               'available', i.available,
               'featured', i.featured,
               'sort_order', i.sort_order
             )
             order by c.sort_order, i.sort_order, i.name
           )
      from public.menu_items i
      join public.categories c on c.id = i.category_id
     where i.restaurant_id = v_restaurant
       and not i.archived
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------------
-- update_menu_item — availability, price and the featured flag
-- ---------------------------------------------------------------------------
-- Arguments left null are left alone, so the dashboard can send one change at
-- a time. The returned row is the new state, so the calling screen never has to
-- guess what the database decided.
create or replace function public.update_menu_item(
  p_item_id uuid,
  p_available boolean default null,
  p_price_minor integer default null,
  p_featured boolean default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant uuid;
  v_item public.menu_items%rowtype;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_restaurant := public.current_staff_restaurant_id();
  if v_restaurant is null then
    raise exception 'FORBIDDEN';
  end if;

  if p_available is null and p_price_minor is null and p_featured is null then
    raise exception 'NOTHING_TO_UPDATE';
  end if;

  if p_price_minor is not null and (p_price_minor <= 0 or p_price_minor > 10000000) then
    raise exception 'INVALID_PRICE';
  end if;

  select * into v_item
    from public.menu_items
   where id = p_item_id
     and restaurant_id = v_restaurant
     and not archived;

  if not found then
    raise exception 'ITEM_NOT_FOUND';
  end if;

  update public.menu_items
     set available = coalesce(p_available, available),
         price_minor = coalesce(p_price_minor, price_minor),
         featured = coalesce(p_featured, featured)
   where id = v_item.id
  returning * into v_item;

  return jsonb_build_object(
    'id', v_item.id,
    'price_minor', v_item.price_minor,
    'available', v_item.available,
    'featured', v_item.featured
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- staff_day_summary — what the owner wants at a glance
-- ---------------------------------------------------------------------------
-- "Today" is the café's own day in Addis, not UTC, so the numbers do not reset
-- at three in the morning.
create or replace function public.staff_day_summary()
returns jsonb
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_restaurant uuid;
  v_today date;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  v_restaurant := public.current_staff_restaurant_id();
  if v_restaurant is null then
    raise exception 'FORBIDDEN';
  end if;

  v_today := (now() at time zone 'Africa/Addis_Ababa')::date;

  return jsonb_build_object(
    'orders_today', (
      select count(*) from public.orders
       where restaurant_id = v_restaurant
         and created_at >= (v_today::timestamp at time zone 'Africa/Addis_Ababa')
    ),
    'completed_today', (
      select count(*) from public.orders
       where restaurant_id = v_restaurant
         and status = 'completed'
         and created_at >= (v_today::timestamp at time zone 'Africa/Addis_Ababa')
    ),
    'revenue_minor', (
      select coalesce(sum(total_minor), 0) from public.orders
       where restaurant_id = v_restaurant
         and status = 'completed'
         and payment_status = 'paid'
         and created_at >= (v_today::timestamp at time zone 'Africa/Addis_Ababa')
    ),
    'payments_to_verify', (
      select count(*) from public.payments
       where restaurant_id = v_restaurant
         and status in ('pending', 'awaiting_confirmation')
    ),
    'top_item', (
      select oi.name
        from public.order_items oi
        join public.orders o on o.id = oi.order_id
       where o.restaurant_id = v_restaurant
         and o.created_at >= (v_today::timestamp at time zone 'Africa/Addis_Ababa')
       group by oi.name
       order by sum(oi.quantity) desc
       limit 1
    )
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------
revoke all on function public.staff_day_summary() from public;
revoke all on function public.staff_menu() from public;
revoke all on function public.update_menu_item(uuid, boolean, integer, boolean) from public;

grant execute on function public.staff_menu() to authenticated, service_role;
grant execute on function public.staff_day_summary() to authenticated, service_role;
grant execute on function public.update_menu_item(uuid, boolean, integer, boolean) to authenticated, service_role;
