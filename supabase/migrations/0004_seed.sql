-- hun. — demo tenant, menu catalogue, payment methods and the dashboard account.
-- This is the only seed data: it is real data in real tables, not fixture code
-- in the application.
--
-- Prices are in santim (1 Birr = 100 santim), so 12000 is Br 120.00.
-- The bank and wallet details below are placeholders — replace them with the
-- café's own merchant numbers before taking a real payment.

insert into public.restaurants (slug, name, tagline, currency, status, ordering_enabled, payments_sandbox)
values (
  'hun-cafe',
  'hun.',
  'A café in Bole, Addis Ababa. Coffee, chechebsa, and a room worth sitting in.',
  'ETB',
  'active',
  true,
  true
);

-- ---------------------------------------------------------------------------
-- Categories
-- ---------------------------------------------------------------------------
insert into public.categories (restaurant_id, name, tagline, image_url, sort_order)
select r.id, c.name, c.tagline, c.image_url, c.sort_order
from public.restaurants r
cross join (values
  ('Coffee & Tea', 'Ethiopian coffee, ground and brewed to order', '/images/img-36.jpg', 10),
  ('Pastry', 'Baked here before the shutters go up', '/images/img-24.jpg', 20),
  ('Breakfast', 'Served from 7:30 until three in the afternoon', '/images/chechebsa.jpg', 30),
  ('Lunch', 'Plates from the afternoon kitchen', '/images/tibs.jpg', 40)
) as c(name, tagline, image_url, sort_order)
where r.slug = 'hun-cafe';

-- ---------------------------------------------------------------------------
-- Menu items (prices in santim)
-- ---------------------------------------------------------------------------
insert into public.menu_items (
  restaurant_id, category_id, name, description, price_minor, image_url, featured, sort_order
)
select r.id, c.id, i.name, i.description, i.price_minor, i.image_url, i.featured, i.sort_order
from public.restaurants r
join public.categories c on c.restaurant_id = r.id
cross join (values
  -- Coffee & Tea
  ('Coffee & Tea', 'Macchiato', 'Two shots and a spoon of steamed milk in a small glass. The one we drink standing up.', 7000, '/images/img-36.jpg', true, 10),
  ('Coffee & Tea', 'Sini Buna', 'Coffee brewed in the jebena and poured into the small cup, with a sprig of rue.', 8000, '/images/buna.jpg', false, 20),
  ('Coffee & Tea', 'Yirgacheffe Filter', 'Washed Yirgacheffe, ground when you order and poured by hand. Jasmine and bergamot.', 18000, '/images/img-03.jpg', false, 30),
  ('Coffee & Tea', 'Honey Oat Latte', 'Oat milk, wildflower honey, a pinch of salt.', 20000, '/images/img-33.jpg', false, 40),
  ('Coffee & Tea', 'Cold Brew Tonic', 'Eighteen-hour cold brew, tonic and orange peel over ice.', 22000, '/images/img-05.jpg', false, 50),
  -- Pastry
  ('Pastry', 'Butter Croissant', 'Butter, folded and rested overnight, baked before we open.', 15000, '/images/img-11.jpg', false, 10),
  ('Pastry', 'From the Pastry Case', 'Whatever came out of the oven this morning. Ask what is still warm.', 18000, '/images/img-24.jpg', false, 20),
  ('Pastry', 'Sourdough Loaf', 'Country loaf, dark crust, open crumb. Whole or sliced.', 22000, '/images/img-12.jpg', false, 30),
  -- Breakfast
  ('Breakfast', 'Chechebsa', 'Kita torn by hand, warmed in niter kibbeh and berbere, honey on the side.', 26000, '/images/chechebsa.jpg', true, 10),
  ('Breakfast', 'Avocado & Egg Toast', 'Sourdough, avocado, two boiled eggs, chilli and lemon.', 34000, '/images/img-23.jpg', false, 20),
  ('Breakfast', 'Buttermilk Pancakes', 'A stack with banana, honey and mint. Made to share, rarely shared.', 34000, '/images/img-17.jpg', false, 30),
  ('Breakfast', 'French Toast', 'Thick-cut bread soaked overnight, griddled, with banana and blueberry.', 36000, '/images/img-15.jpg', false, 40),
  ('Breakfast', 'Fresh Orange Juice', 'Oranges pressed when you order. Nothing added.', 14000, '/images/img-34.jpg', false, 50),
  -- Lunch
  ('Lunch', 'Beef Tibs', 'Beef cut small and seared with rosemary, onion and green chilli, served in a clay pot with rolled injera.', 48000, '/images/tibs.jpg', true, 10),
  ('Lunch', 'Chicken & Potato Pizza', 'Thin base, chicken, potato, red onion, coriander. One between two.', 52000, '/images/img-29.jpg', false, 20),
  ('Lunch', 'Crisp Tofu Bowl', 'Golden tofu, egg, sweetcorn, red cabbage and tomato with sesame dressing.', 42000, '/images/img-13.jpg', false, 30),
  ('Lunch', 'Chicken Burger & Fries', 'Buttermilk-fried chicken, pickles, slaw and a basket of fries.', 44000, '/images/img-28.jpg', false, 40),
  ('Lunch', 'Avocado & Chickpea Bowl', 'Avocado, chickpeas, roast sweet potato and leaves, lemon dressing.', 40000, '/images/img-14.jpg', false, 50)
) as i(cat, name, description, price_minor, image_url, featured, sort_order)
where r.slug = 'hun-cafe' and c.name = i.cat;

-- ---------------------------------------------------------------------------
-- Payment methods the café accepts
-- ---------------------------------------------------------------------------
insert into public.payment_methods (
  restaurant_id, code, label, short, kind,
  account_name, account_number, short_code, instructions, sort_order
)
select r.id, m.code, m.label, m.short, m.kind,
       m.account_name, m.account_number, m.short_code, m.instructions, m.sort_order
from public.restaurants r
cross join (values
  ('telebirr', 'Telebirr', 'T', 'wallet',
   'hun. Café', null, '1271803',
   'Open Telebirr → Send Money → To a merchant. Enter the short code and the exact amount, then paste the transaction number below.', 10),
  ('cbe_birr', 'CBE Birr', 'C', 'wallet',
   'hun. Café', null, '8091',
   'Open CBE Birr → Pay → Merchant. Use the merchant short code and the exact amount, then paste the transaction number below.', 20),
  ('cbe', 'CBE', 'CBE', 'bank_transfer',
   'hun. Café PLC', '1000234567890', null,
   'Transfer the exact amount to the CBE account below, using the payment reference as the description. Paste the bank transaction number below.', 30),
  ('awash', 'Awash Bank', 'A', 'bank_transfer',
   'hun. Café PLC', '0132012345678', null,
   'Transfer the exact amount to the Awash Bank account below, using the payment reference as the description.', 40),
  ('abyssinia', 'Bank of Abyssinia', 'BoA', 'bank_transfer',
   'hun. Café PLC', '0180123456789', null,
   'Transfer the exact amount to the Bank of Abyssinia account below, using the payment reference as the description.', 50),
  ('dashen', 'Dashen Bank', 'D', 'bank_transfer',
   'hun. Café PLC', '0021234567890', null,
   'Transfer the exact amount to the Dashen Bank account below, using the payment reference as the description.', 60),
  ('mpesa', 'M-Pesa', 'M', 'wallet',
   'hun. Café', null, '340200',
   'Open M-Pesa → Lipa na M-Pesa → Pay Bill. Use the short code and the exact amount, then paste the confirmation code below.', 70),
  ('cash', 'Cash at the counter', 'Br', 'cash',
   null, null, null,
   'Nothing to pay now. Show your order number at the counter when you collect.', 80)
) as m(code, label, short, kind, account_name, account_number, short_code, instructions, sort_order)
where r.slug = 'hun-cafe';

-- ---------------------------------------------------------------------------
-- Dashboard sign-in account
--   email:    owner@hun.test
--   password: hun-demo-2026
-- Inserted directly into auth so the demo works immediately after migration.
-- Change or delete this row before anyone real uses the dashboard.
-- ---------------------------------------------------------------------------
do $$
declare
  v_user_id uuid;
  v_has_provider_id boolean;
begin
  if exists (select 1 from auth.users where email = 'owner@hun.test') then
    return;
  end if;

  v_user_id := gen_random_uuid();

  -- The *_token columns are nullable but GoTrue scans them into a Go string,
  -- so they must be '' (not NULL) or every sign-in for this user 500s.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    confirmation_token, recovery_token, email_change, email_change_token_new,
    created_at, updated_at
  ) values (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    'owner@hun.test',
    crypt('hun-demo-2026', gen_salt('bf', 10)),
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Hanan Seid"}'::jsonb,
    '', '', '', '',
    now(),
    now()
  );

  select exists (
    select 1 from information_schema.columns
     where table_schema = 'auth' and table_name = 'identities' and column_name = 'provider_id'
  ) into v_has_provider_id;

  if v_has_provider_id then
    insert into auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id, v_user_id::text,
      jsonb_build_object('sub', v_user_id::text, 'email', 'owner@hun.test',
                         'email_verified', true, 'full_name', 'Hanan Seid'),
      'email', now(), now(), now()
    );
  else
    insert into auth.identities (
      id, user_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(), v_user_id,
      jsonb_build_object('sub', v_user_id::text, 'email', 'owner@hun.test',
                         'email_verified', true, 'full_name', 'Hanan Seid'),
      'email', now(), now(), now()
    );
  end if;
end;
$$;

insert into public.staff_profiles (user_id, restaurant_id, display_name, role)
select u.id, r.id, 'Hanan Seid', 'owner'
from auth.users u
join public.restaurants r on r.slug = 'hun-cafe'
where u.email = 'owner@hun.test'
on conflict (user_id) do nothing;
