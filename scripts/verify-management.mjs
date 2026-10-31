// Local verification of the staff management functions against `supabase start`.
// Run with: node scripts/verify-management.mjs
//
// The script changes one price and switches one item off, then puts both back,
// so it can be run against a freshly reset database without leaving a mess.
const BASE = process.env.API_URL ?? 'http://127.0.0.1:54321';
const KEY =
  process.env.ANON_KEY ??
  'sb_publishable_ACJWlzQHlZjBrEguHvfOxg_3BJgxAaH';

let failures = 0;
function check(label, condition, detail) {
  if (condition) {
    console.log(`  ok   ${label}`);
  } else {
    failures += 1;
    console.log(`  FAIL ${label}${detail ? ` — ${JSON.stringify(detail)}` : ''}`);
  }
}

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1${path}`, {
    ...init,
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${init.token ?? KEY}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${path}: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

const rpc = (name, body, token) =>
  rest(`/rpc/${name}`, { method: 'POST', body: JSON.stringify(body), token });

async function main() {
  const signIn = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@hun.test', password: 'hun-demo-2026' }),
  });
  const session = await signIn.json();
  check('owner can sign in', Boolean(session.access_token), session);
  const staffToken = session.access_token;

  let guestRefused = false;
  try {
    await rpc('staff_menu', {});
  } catch {
    guestRefused = true;
  }
  check('guests cannot read the staff menu', guestRefused);

  const items = await rpc('staff_menu', {}, staffToken);
  check('the menu loads for staff', Array.isArray(items) && items.length > 0, items?.length);
  check(
    'every item carries a category and a price',
    items.every((item) => item.category && item.price_minor > 0),
  );

  const chechebsa = items.find((item) => item.name === 'Chechebsa');
  check('chechebsa is on the menu', Boolean(chechebsa));

  // --- price ---------------------------------------------------------------
  const changed = await rpc(
    'update_menu_item',
    { p_item_id: chechebsa.id, p_price_minor: 27500 },
    staffToken,
  );
  check('the price can be changed', changed.price_minor === 27500, changed);

  let badPriceRefused = false;
  try {
    await rpc('update_menu_item', { p_item_id: chechebsa.id, p_price_minor: 0 }, staffToken);
  } catch (error) {
    badPriceRefused = String(error.message).includes('INVALID_PRICE');
  }
  check('a zero price is refused', badPriceRefused);

  const repriced = await rpc('place_order', {
    p_restaurant_slug: 'hun-cafe',
    p_idempotency_key: `verify-price-${Date.now()}`,
    p_type: 'pickup',
    p_customer_name: 'Price Check',
    p_lines: [{ menu_item_id: chechebsa.id, quantity: 2 }],
  });
  check('the new price is what the customer is charged', repriced.total_minor === 55000, {
    total: repriced.total_minor,
  });

  // --- availability --------------------------------------------------------
  const off = await rpc(
    'update_menu_item',
    { p_item_id: chechebsa.id, p_available: false },
    staffToken,
  );
  check('an item can be switched off', off.available === false, off);

  let soldOutRefused = false;
  try {
    await rpc('place_order', {
      p_restaurant_slug: 'hun-cafe',
      p_idempotency_key: `verify-soldout-${Date.now()}`,
      p_type: 'pickup',
      p_customer_name: 'Sold Out Check',
      p_lines: [{ menu_item_id: chechebsa.id, quantity: 1 }],
    });
  } catch (error) {
    soldOutRefused = String(error.message).includes('ITEM_UNAVAILABLE');
  }
  check('a switched-off item cannot be ordered', soldOutRefused);

  const on = await rpc(
    'update_menu_item',
    { p_item_id: chechebsa.id, p_available: true, p_featured: true },
    staffToken,
  );
  check('the item can be put back on', on.available === true && on.featured === true, on);

  // --- summary -------------------------------------------------------------
  const summary = await rpc('staff_day_summary', {}, staffToken);
  check(
    'the day summary returns numbers',
    typeof summary.orders_today === 'number' &&
      typeof summary.revenue_minor === 'number' &&
      typeof summary.payments_to_verify === 'number',
    summary,
  );
  check(
    'the summary names a best seller',
    typeof summary.top_item === 'string' && summary.top_item.length > 0,
    summary,
  );

  // --- restore -------------------------------------------------------------
  await rpc(
    'update_menu_item',
    { p_item_id: chechebsa.id, p_price_minor: 26000, p_featured: true },
    staffToken,
  );
  check('the seed price is restored', (await rpc('staff_menu', {}, staffToken)).find(
    (item) => item.id === chechebsa.id,
  ).price_minor === 26000);

  console.log(
    failures === 0 ? '\nAll management checks passed.' : `\n${failures} check(s) failed.`,
  );
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exitCode = 1;
});
