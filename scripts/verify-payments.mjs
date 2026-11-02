// Local verification of the payment flow against `supabase start`.
// Run with: node scripts/verify-payments.mjs
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
  const [restaurant] = await rest('/restaurants?select=*&slug=eq.hun-cafe');
  check('restaurant is priced in ETB', restaurant.currency === 'ETB', restaurant);
  check('payments sandbox is on for the demo', restaurant.payments_sandbox === true);

  const methods = await rpc('get_payment_methods', { p_restaurant_slug: 'hun-cafe' });
  check('eight payment methods are seeded', methods.length === 8, methods.map((m) => m.code));
  check(
    'methods include Telebirr, CBE and a bank transfer',
    ['telebirr', 'cbe', 'awash'].every((code) => methods.some((m) => m.code === code)),
  );

  const items = await rest(
    '/menu_items?select=id,name,price_minor&restaurant_id=eq.' + restaurant.id + '&limit=2',
  );
  check('menu items are priced in santim', items[0].price_minor >= 1000, items[0]);

  const order = await rpc('place_order', {
    p_restaurant_slug: 'hun-cafe',
    p_idempotency_key: `verify-${Date.now()}`,
    p_type: 'pickup',
    p_customer_name: 'Verification',
    p_lines: [
      { menu_item_id: items[0].id, quantity: 2 },
      { menu_item_id: items[1].id, quantity: 1 },
    ],
  });
  check('order is created unpaid', order.payment_status === 'unpaid', order);
  check('tracking token is returned', typeof order.tracking_token === 'string');

  const expected =
    items[0].price_minor * 2 + items[1].price_minor;
  check('server prices the order from the catalogue', order.total_minor === expected, {
    expected,
    got: order.total_minor,
  });

  const payment = await rpc('create_payment', {
    p_tracking_token: order.tracking_token,
    p_method_code: 'telebirr',
  });
  check('payment intent is pending', payment.status === 'pending', payment);
  check(
    'reference is the order number',
    payment.reference === `HUN-${String(order.number).padStart(4, '0')}`,
    payment.reference,
  );
  check('short code is copied from the method', payment.short_code === '1271803');

  let afterOrder = await rpc('get_order_by_tracking', {
    p_tracking_token: order.tracking_token,
  });
  check('order payment status is pending', afterOrder.payment_status === 'pending');

  const submitted = await rpc('submit_payment_proof', {
    p_tracking_token: order.tracking_token,
    p_transaction_ref: 'FT24VERIFY0001',
    p_payer_name: 'Verification Tester',
    p_payer_phone: '0911000000',
  });
  check(
    'proof moves the payment to awaiting_confirmation',
    submitted.status === 'awaiting_confirmation',
    submitted,
  );

  const paid = await rpc('sandbox_approve_payment', {
    p_tracking_token: order.tracking_token,
  });
  check('sandbox approval marks it paid', paid.status === 'paid', paid);
  check('approval channel is recorded', paid.confirmed_at !== null);

  afterOrder = await rpc('get_order_by_tracking', {
    p_tracking_token: order.tracking_token,
  });
  check('order is now paid', afterOrder.payment_status === 'paid');

  let alreadyPaid = false;
  try {
    await rpc('create_payment', {
      p_tracking_token: order.tracking_token,
      p_method_code: 'cbe',
    });
  } catch (error) {
    alreadyPaid = String(error.message).includes('ALREADY_PAID');
  }
  check('a paid order cannot start a second payment', alreadyPaid);

  // --- staff verification ------------------------------------------------
  const order2 = await rpc('place_order', {
    p_restaurant_slug: 'hun-cafe',
    p_idempotency_key: `verify-staff-${Date.now()}`,
    p_type: 'pickup',
    p_customer_name: 'Staff Check',
    p_lines: [{ menu_item_id: items[0].id, quantity: 1 }],
  });
  await rpc('create_payment', {
    p_tracking_token: order2.tracking_token,
    p_method_code: 'cbe',
  });
  await rpc('submit_payment_proof', {
    p_tracking_token: order2.tracking_token,
    p_transaction_ref: 'FT24STAFF0001',
    p_payer_name: 'Staff Check',
  });

  const signIn = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'owner@hun.test', password: 'hun-demo-2026' }),
  });
  const session = await signIn.json();
  check('staff can sign in', Boolean(session.access_token), session);
  const staffToken = session.access_token;

  let anonymousRefused = false;
  try {
    await rpc('list_payments_for_staff', { p_only_open: true });
  } catch {
    anonymousRefused = true;
  }
  check('guests cannot read the payment queue', anonymousRefused);

  const queue = await rpc('list_payments_for_staff', { p_only_open: true }, staffToken);
  const target = queue.find((entry) => entry.order_id === order2.id);
  check('staff see the open transfer', Boolean(target), queue);

  const confirmed = await rpc(
    'confirm_payment',
    { p_payment_id: target.id, p_action: 'confirm' },
    staffToken,
  );
  check('staff confirmation records the channel', confirmed.status === 'paid');

  const paidOrder = await rpc('get_order_by_tracking', {
    p_tracking_token: order2.tracking_token,
  });
  check('staff confirmation marks the order paid', paidOrder.payment_status === 'paid');

  console.log(failures === 0 ? '\nAll payment checks passed.' : `\n${failures} check(s) failed.`);
  process.exitCode = failures === 0 ? 0 : 1;
}

main().catch((error) => {
  console.error('Verification failed:', error.message);
  process.exitCode = 1;
});
