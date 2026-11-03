-- hun. — reset the application tables so the migrations can be applied once,
-- in order (0001 → 0005), on a database with no real data in it.
--
-- Run this in the Supabase SQL Editor, then run each migration file in its own
-- new query. The Supabase `auth` schema is not touched: the demo dashboard
-- account owner@hun.test survives.
--
-- This deletes every restaurant, menu item, order and payment row.

drop table if exists
  public.order_status_events,
  public.order_items,
  public.orders,
  public.payments,
  public.menu_items,
  public.categories,
  public.payment_methods,
  public.staff_profiles,
  public.restaurants
cascade;
