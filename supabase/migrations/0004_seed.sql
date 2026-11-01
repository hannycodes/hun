-- hun. — demo tenant, café menu, payment methods and the dashboard account.
-- This is the only seed data: it is real data in real tables, not fixture code
-- in the application.
--
-- Prices are in santim (1 Birr = 100 santim), so 9000 is Br 90.00. They are
-- ordinary Addis Ababa café prices for 2026 and can be changed from the
-- dashboard without touching this file.
-- Every image is a real photograph of the thing it labels, stored under
-- public/images/menu/ — see docs/photography.md for the source of each one.
-- The bank and wallet details below are placeholders — replace them with the
-- café's own merchant numbers before taking a real payment.

insert into public.restaurants (slug, name, tagline, currency, status, ordering_enabled, payments_sandbox)
values (
  'hun-cafe',
  'hun.',
  'A café in Bole, Addis Ababa. Coffee, tea, pastries, and a room worth sitting in.',
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
  ('Coffee', 'Ethiopian coffee, ground when you order', '/images/menu/latte.jpg', 10),
  ('Tea', 'Poured by the glass, all day', '/images/menu/mint-tea.jpg', 20),
  ('Cold Drinks', 'Over ice, for the long afternoons', '/images/menu/iced-latte.jpg', 30),
  ('Fresh Juice', 'Pressed after you ask', '/images/menu/mango-juice.jpg', 40),
  ('Pastries', 'Baked here before the doors open', '/images/menu/croissant.jpg', 50),
  ('Cakes & Desserts', 'Cut thick, straight from the case', '/images/menu/cheesecake.jpg', 60)
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
  -- Coffee
  ('Coffee', 'Espresso', 'One shot, in a small cup. Best drunk standing at the bar.', 9000, '/images/menu/espresso.jpg', false, 10),
  ('Coffee', 'Macchiato', 'Espresso with a spoon of steamed milk. The one most of Addis orders.', 8500, '/images/menu/macchiato.jpg', false, 20),
  ('Coffee', 'Cappuccino', 'Equal parts coffee, milk and foam, dusted with cocoa.', 15000, '/images/menu/cappuccino.jpg', false, 30),
  ('Coffee', 'Caffè Latte', 'A long pour of steamed milk over a double shot.', 16000, '/images/menu/latte.jpg', true, 40),
  ('Coffee', 'Flat White', 'Stronger than a latte, less foam, finished with a thin layer of milk.', 16000, '/images/menu/flat-white.jpg', false, 50),
  ('Coffee', 'Cortado', 'Equal parts espresso and warm milk, in a small glass.', 13000, '/images/menu/cortado.jpg', false, 60),
  ('Coffee', 'Americano', 'A double shot with hot water. Nothing else.', 12000, '/images/menu/americano.jpg', false, 70),
  ('Coffee', 'Caffè Mocha', 'Espresso, chocolate and steamed milk, with cocoa on top.', 18000, '/images/menu/mocha.jpg', false, 80),
  ('Coffee', 'Sini Buna', 'Coffee brewed in the jebena and poured into the small cup, with a sprig of rue.', 7000, '/images/menu/buna.jpg', false, 90),
  ('Coffee', 'Jebena Buna for Two', 'A full jebena brought to the table with two cups, sugar and rue.', 16000, '/images/menu/jebena.jpg', true, 100),
  ('Coffee', 'V60 Pour Over', 'Single origin, ground when you order and poured by hand. Ask what is open today.', 22000, '/images/menu/v60.jpg', false, 110),
  ('Coffee', 'Chemex for Two', 'A slower brew for a slower morning. Served in two cups.', 28000, '/images/menu/chemex.jpg', false, 120),

  -- Tea
  ('Tea', 'Black Tea', 'Loose leaf, brewed strong, served with sugar on the side.', 6000, '/images/menu/black-tea.jpg', false, 10),
  ('Tea', 'Ethiopian Shai', 'Black tea with cinnamon and clove, the way it is made at home.', 7000, '/images/menu/shai.jpg', false, 20),
  ('Tea', 'Mint Tea', 'Fresh mint steeped in hot water, honey on the side.', 9000, '/images/menu/mint-tea.jpg', false, 30),
  ('Tea', 'Green Tea', 'Light and clean, brewed at a lower temperature so it stays sweet.', 8000, '/images/menu/green-tea.jpg', false, 40),
  ('Tea', 'Chai Latte', 'Spiced black tea with steamed milk and a little honey.', 16000, '/images/menu/chai-latte.jpg', false, 50),
  ('Tea', 'Karkade', 'Hibiscus petals steeped and served cold or hot. Tart and deep red.', 10000, '/images/menu/hibiscus.jpg', false, 60),
  ('Tea', 'Ginger & Lemon Tea', 'Fresh ginger, lemon and honey. Good for a sore throat.', 11000, '/images/menu/ginger-lemon.jpg', false, 70),
  ('Tea', 'Earl Grey', 'Bergamot black tea, served with a slice of lemon.', 7000, '/images/menu/earl-grey.jpg', false, 80),

  -- Cold Drinks
  ('Cold Drinks', 'Iced Latte', 'Two shots poured over cold milk and ice.', 19000, '/images/menu/iced-latte.jpg', true, 10),
  ('Cold Drinks', 'Cold Brew', 'Steeped for eighteen hours, served over ice. Smooth, no bitterness.', 20000, '/images/menu/cold-brew.jpg', false, 20),
  ('Cold Drinks', 'Iced Americano', 'A double shot, cold water and ice. The lightest way to have coffee.', 15000, '/images/menu/iced-americano.jpg', false, 30),
  ('Cold Drinks', 'Iced Tea', 'Black tea chilled with lemon and a little sugar.', 13000, '/images/menu/iced-tea.jpg', false, 40),
  ('Cold Drinks', 'Lemonade', 'Lemons squeezed to order, sugar and cold water.', 14000, '/images/menu/lemonade.jpg', false, 50),
  ('Cold Drinks', 'Mint Lemonade', 'Lemonade with mint pressed into the glass.', 16000, '/images/menu/mint-lemonade.jpg', false, 60),
  ('Cold Drinks', 'Coffee Frappé', 'Cold coffee blended with ice and milk, whipped until foamy.', 20000, '/images/menu/frappe.jpg', false, 70),
  ('Cold Drinks', 'Iced Mocha', 'Chocolate, espresso and cold milk over ice, with cream on top.', 20000, '/images/menu/iced-mocha.jpg', false, 80),
  ('Cold Drinks', 'Sparkling Water', 'A chilled bottle and a glass with lemon.', 8000, '/images/menu/sparkling.jpg', false, 90),

  -- Fresh Juice
  ('Fresh Juice', 'Mango Juice', 'Ripe mango blended thick. No water added.', 18000, '/images/menu/mango-juice.jpg', false, 10),
  ('Fresh Juice', 'Avocado Juice', 'Avocado blended with a little lime and sugar. Thick enough for a spoon.', 19000, '/images/menu/avocado-juice.jpg', false, 20),
  ('Fresh Juice', 'Papaya Juice', 'Papaya blended smooth, served very cold.', 17000, '/images/menu/papaya-juice.jpg', false, 30),
  ('Fresh Juice', 'Fresh Orange Juice', 'Oranges pressed when you order.', 15000, '/images/menu/orange-juice.jpg', false, 40),
  ('Fresh Juice', 'Passion Fruit Juice', 'Passion fruit, seeds strained out, sharp and sweet.', 17000, '/images/menu/passion-juice.jpg', false, 50),
  ('Fresh Juice', 'Beetroot Juice', 'Beetroot with apple and a squeeze of lime.', 18000, '/images/menu/beetroot-juice.jpg', false, 60),
  ('Fresh Juice', 'Watermelon Juice', 'Watermelon blended with ice, nothing else.', 16000, '/images/menu/watermelon-juice.jpg', false, 70),
  ('Fresh Juice', 'Pineapple Juice', 'Pineapple blended and strained, with mint if you like.', 17000, '/images/menu/pineapple-juice.jpg', false, 80),

  -- Pastries
  ('Pastries', 'Butter Croissant', 'Laminated with butter and rested overnight, baked before we open.', 17000, '/images/menu/croissant.jpg', false, 10),
  ('Pastries', 'Almond Croissant', 'Yesterday''s croissant filled with almond cream and baked again with flaked almonds.', 22000, '/images/menu/almond-croissant.jpg', true, 20),
  ('Pastries', 'Pain au Chocolat', 'Two batons of dark chocolate in a butter-laminated dough.', 19000, '/images/menu/pain-au-chocolat.jpg', false, 30),
  ('Pastries', 'Cinnamon Roll', 'Rolled with cinnamon sugar and finished with a thin glaze.', 20000, '/images/menu/cinnamon-roll.jpg', false, 40),
  ('Pastries', 'Blueberry Muffin', 'Baked with blueberries and a little lemon zest.', 16000, '/images/menu/blueberry-muffin.jpg', false, 50),
  ('Pastries', 'Buttermilk Scone', 'Plain and crumbly, with butter and jam on the side.', 15000, '/images/menu/scone.jpg', false, 60),
  ('Pastries', 'Cheese Danish', 'Sweet pastry with a centre of soft cheese.', 19000, '/images/menu/danish.jpg', false, 70),
  ('Pastries', 'Banana Bread', 'A thick slice, warmed if you ask.', 17000, '/images/menu/banana-bread.jpg', false, 80),
  ('Pastries', 'Chocolate Brownie', 'Dense, a little salty, with walnuts.', 18000, '/images/menu/brownie.jpg', false, 90),
  ('Pastries', 'Chocolate Chip Cookie', 'Chewy in the middle, baked in the morning.', 10000, '/images/menu/cookie.jpg', false, 100),
  ('Pastries', 'Sesame Bagel', 'Boiled then baked, with sesame on top. Butter or cream cheese.', 14000, '/images/menu/bagel.jpg', false, 110),
  ('Pastries', 'Lemon Pound Cake', 'A slice of the loaf we keep under glass by the till.', 17000, '/images/menu/pound-cake.jpg', false, 120),

  -- Cakes & Desserts
  ('Cakes & Desserts', 'Cheesecake', 'Baked vanilla cheesecake on a biscuit base.', 26000, '/images/menu/cheesecake.jpg', true, 10),
  ('Cakes & Desserts', 'Carrot Cake', 'Carrot, walnut and spice with cream cheese frosting.', 24000, '/images/menu/carrot-cake.jpg', false, 20),
  ('Cakes & Desserts', 'Chocolate Cake', 'Dark chocolate sponge with a thick chocolate ganache.', 25000, '/images/menu/chocolate-cake.jpg', false, 30),
  ('Cakes & Desserts', 'Tiramisu', 'Coffee-soaked sponge, mascarpone and cocoa. Made in the morning.', 28000, '/images/menu/tiramisu.jpg', false, 40),
  ('Cakes & Desserts', 'Baklava', 'Layers of filo with walnuts and honey syrup.', 18000, '/images/menu/baklava.jpg', false, 50),
  ('Cakes & Desserts', 'Affogato', 'A scoop of vanilla ice cream with a shot of hot espresso poured over it.', 22000, '/images/menu/affogato.jpg', false, 60),
  ('Cakes & Desserts', 'Macarons', 'Three, from whatever colours we made this week.', 15000, '/images/menu/macaron.jpg', false, 70),
  ('Cakes & Desserts', 'Fruit Tart', 'Shortcrust, vanilla cream and the fruit of the season.', 24000, '/images/menu/fruit-tart.jpg', false, 80)
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
