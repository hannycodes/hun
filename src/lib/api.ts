import { RESTAURANT_SLUG, supabase } from './supabase';
import type {
  Category,
  MenuItem,
  Order,
  OrderStatus,
  OrderType,
  Payment,
  PaymentMethod,
  Restaurant,
  StaffDaySummary,
  StaffMenuItem,
  StaffPayment,
  StaffProfile,
  StatusEvent,
} from './types';

/** Errors carry a machine-readable code so the UI can explain them in words. */
export class AppError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AppError';
    this.code = code;
  }
}

const FRIENDLY: Record<string, string> = {
  INVALID_ORDER_TYPE: 'Choose pickup or dine-in.',
  TABLE_REQUIRED: 'Add the table number for a dine-in order.',
  NAME_REQUIRED: 'Add the name for the order.',
  INVALID_IDEMPOTENCY_KEY: 'Something went wrong with this request. Please try again.',
  EMPTY_CART: 'Your cart is empty.',
  RESTAURANT_NOT_FOUND: 'This restaurant could not be found.',
  ORDERING_DISABLED: 'Ordering is closed right now. Please try again later.',
  INVALID_QUANTITY: 'One of the quantities in your cart is not valid.',
  ITEM_UNAVAILABLE: 'An item in your cart is no longer available.',
  ORDER_NOT_FOUND: 'We could not find that order.',
  UNAUTHENTICATED: 'Please sign in to continue.',
  FORBIDDEN: 'You do not have access to this order.',
  ORDER_NOT_FOUND_: 'We could not find that order.',
  INVALID_TRANSITION: 'That status change is not allowed.',
  REASON_REQUIRED: 'Add a reason before rejecting or cancelling.',
  VERSION_CONFLICT: 'Someone else updated this order first. It has been refreshed.',
  NETWORK: 'Network error — check your connection and try again.',
  BAD_CREDENTIALS: 'That email and password combination did not work.',
  PAYMENT_METHOD_UNAVAILABLE: 'That payment method is not available right now.',
  PAYMENT_NOT_FOUND: 'Start a payment before sending the reference.',
  PAYMENT_NOT_PENDING: 'This payment has already been dealt with.',
  PAYMENT_UNDER_REVIEW: 'Your payment is with us for verification. Give us a moment.',
  ALREADY_PAID: 'This order is already paid — thank you.',
  ORDER_CLOSED: 'This order is closed, so no payment is needed.',
  REFERENCE_REQUIRED: 'Paste the transaction number from your banking app.',
  CASH_ON_COLLECTION: 'This order is paid at the counter — nothing to send.',
  SANDBOX_DISABLED: 'Sandbox approval is switched off for this café.',
  INVALID_PAYMENT_ACTION: 'That payment action is not supported.',
  ITEM_NOT_FOUND: 'That menu item is no longer on the list.',
  INVALID_PRICE: 'Enter a price between Br 1 and Br 100,000.',
  NOTHING_TO_UPDATE: 'Nothing changed — try again.',
};

export function friendlyMessage(code: string | null | undefined): string {
  if (!code) return 'Something went wrong. Please try again.';
  return FRIENDLY[code] ?? 'Something went wrong. Please try again.';
}

function unwrap<T>(data: T | null, error: { message?: string } | null): T {
  if (error) throw new AppError(normalizeCode(error.message));
  if (data === null || data === undefined) throw new AppError('EMPTY_RESPONSE');
  return data;
}

function normalizeCode(message: string | null | undefined): string {
  if (!message) return 'UNKNOWN';
  // Postgres raises our codes verbatim, but occasionally prefix them.
  const known = Object.keys(FRIENDLY);
  const hit = known.find((code) => message.includes(code));
  if (hit) return hit;
  if (/fetch|network|failed to fetch/i.test(message)) return 'NETWORK';
  if (/invalid login credentials/i.test(message)) return 'BAD_CREDENTIALS';
  return message;
}

// ---------------------------------------------------------------------------
// Public menu
// ---------------------------------------------------------------------------

export async function fetchRestaurant(): Promise<Restaurant> {
  const { data, error } = await supabase
    .from('restaurants')
    .select('*')
    .eq('slug', RESTAURANT_SLUG)
    .maybeSingle();
  if (error) throw new AppError(normalizeCode(error.message));
  if (!data) throw new AppError('RESTAURANT_NOT_FOUND');
  return data as Restaurant;
}

export interface MenuBundle {
  restaurant: Restaurant;
  categories: Category[];
  items: MenuItem[];
}

export async function fetchMenu(): Promise<MenuBundle> {
  const restaurant = await fetchRestaurant();

  const [categoriesRes, itemsRes] = await Promise.all([
    supabase
      .from('categories')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .order('sort_order', { ascending: true }),
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurant.id)
      .eq('archived', false)
      .order('sort_order', { ascending: true }),
  ]);

  if (categoriesRes.error) throw new AppError(normalizeCode(categoriesRes.error.message));
  if (itemsRes.error) throw new AppError(normalizeCode(itemsRes.error.message));

  return {
    restaurant,
    categories: (categoriesRes.data ?? []) as Category[],
    items: (itemsRes.data ?? []) as MenuItem[],
  };
}

// ---------------------------------------------------------------------------
// Order creation
// ---------------------------------------------------------------------------

export interface PlaceOrderInput {
  idempotencyKey: string;
  type: OrderType;
  customerName: string;
  customerPhone?: string | null;
  tableLabel?: string | null;
  customerNote?: string | null;
  lines: Array<{ menuItemId: string; quantity: number }>;
}

export async function placeOrder(input: PlaceOrderInput): Promise<Order> {
  const { data, error } = await supabase.rpc('place_order', {
    p_restaurant_slug: RESTAURANT_SLUG,
    p_idempotency_key: input.idempotencyKey,
    p_type: input.type,
    p_customer_name: input.customerName,
    p_customer_phone: input.customerPhone ?? null,
    p_table_label: input.tableLabel ?? null,
    p_customer_note: input.customerNote ?? null,
    p_lines: input.lines.map((line) => ({
      menu_item_id: line.menuItemId,
      quantity: line.quantity,
      note: null,
    })),
  });

  return unwrap<Order>(data as Order | null, error);
}

// ---------------------------------------------------------------------------
// Customer tracking (token-based; no session required)
// ---------------------------------------------------------------------------

export async function fetchOrderByToken(token: string): Promise<Order> {
  const { data, error } = await supabase.rpc('get_order_by_tracking', {
    p_tracking_token: token,
  });
  return unwrap<Order>(data as Order | null, error);
}

export async function fetchOrderEvents(token: string): Promise<StatusEvent[]> {
  const { data, error } = await supabase.rpc('get_order_events_by_tracking', {
    p_tracking_token: token,
  });
  if (error) throw new AppError(normalizeCode(error.message));
  return (data ?? []) as StatusEvent[];
}

// ---------------------------------------------------------------------------
// Staff authentication
// ---------------------------------------------------------------------------

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw new AppError(normalizeCode(error.message));
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export async function fetchStaffProfile(userId: string): Promise<StaffProfile> {
  const { data, error } = await supabase
    .from('staff_profiles')
    .select('*, restaurants(id, name, slug)')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new AppError(normalizeCode(error.message));
  if (!data) throw new AppError('FORBIDDEN');
  return data as unknown as StaffProfile;
}

// ---------------------------------------------------------------------------
// Dashboard order queue
// ---------------------------------------------------------------------------

export async function fetchOrders(restaurantId: string): Promise<Order[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*, order_items(*)')
    .eq('restaurant_id', restaurantId)
    .order('created_at', { ascending: false })
    .limit(60);

  if (error) throw new AppError(normalizeCode(error.message));

  return ((data ?? []) as Array<Order & { order_items: Order['items'] }>).map(
    ({ order_items, ...order }) => ({ ...order, items: order_items ?? [] }),
  );
}

export async function updateOrderStatus(input: {
  orderId: string;
  expectedVersion: number;
  nextStatus: OrderStatus;
  reason?: string | null;
}): Promise<Order> {
  const { data, error } = await supabase.rpc('update_order_status', {
    p_order_id: input.orderId,
    p_expected_version: input.expectedVersion,
    p_new_status: input.nextStatus,
    p_reason: input.reason ?? null,
  });
  return unwrap<Order>(data as Order | null, error);
}

// ---------------------------------------------------------------------------
// Payments
// ---------------------------------------------------------------------------

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data, error } = await supabase.rpc('get_payment_methods', {
    p_restaurant_slug: RESTAURANT_SLUG,
  });
  if (error) throw new AppError(normalizeCode(error.message));
  return (data ?? []) as PaymentMethod[];
}

export async function createPayment(
  token: string,
  methodCode: string,
): Promise<Payment> {
  const { data, error } = await supabase.rpc('create_payment', {
    p_tracking_token: token,
    p_method_code: methodCode,
  });
  return unwrap<Payment>(data as Payment | null, error);
}

export async function submitPaymentProof(input: {
  token: string;
  transactionRef: string;
  payerName: string;
  payerPhone?: string | null;
}): Promise<Payment> {
  const { data, error } = await supabase.rpc('submit_payment_proof', {
    p_tracking_token: input.token,
    p_transaction_ref: input.transactionRef,
    p_payer_name: input.payerName,
    p_payer_phone: input.payerPhone ?? null,
  });
  return unwrap<Payment>(data as Payment | null, error);
}

export async function fetchPaymentByToken(token: string): Promise<Payment | null> {
  const { data, error } = await supabase.rpc('get_payment_by_tracking', {
    p_tracking_token: token,
  });
  if (error) throw new AppError(normalizeCode(error.message));
  return (data as Payment | null) ?? null;
}

export async function sandboxApprovePayment(token: string): Promise<Payment> {
  const { data, error } = await supabase.rpc('sandbox_approve_payment', {
    p_tracking_token: token,
  });
  return unwrap<Payment>(data as Payment | null, error);
}

export async function fetchStaffPayments(onlyOpen = true): Promise<StaffPayment[]> {
  const { data, error } = await supabase.rpc('list_payments_for_staff', {
    p_only_open: onlyOpen,
  });
  if (error) throw new AppError(normalizeCode(error.message));
  return (data ?? []) as StaffPayment[];
}

// ---------------------------------------------------------------------------
// Menu management (staff)
// ---------------------------------------------------------------------------

export async function fetchStaffDaySummary(): Promise<StaffDaySummary> {
  const { data, error } = await supabase.rpc('staff_day_summary');
  return unwrap<StaffDaySummary>(data as StaffDaySummary | null, error);
}

export async function fetchStaffMenu(): Promise<StaffMenuItem[]> {
  const { data, error } = await supabase.rpc('staff_menu');
  if (error) throw new AppError(normalizeCode(error.message));
  return (data ?? []) as StaffMenuItem[];
}

export async function updateMenuItem(input: {
  itemId: string;
  available?: boolean;
  priceMinor?: number;
  featured?: boolean;
}): Promise<Pick<StaffMenuItem, 'id' | 'available' | 'featured' | 'price_minor'>> {
  const { data, error } = await supabase.rpc('update_menu_item', {
    p_item_id: input.itemId,
    p_available: input.available ?? null,
    p_price_minor: input.priceMinor ?? null,
    p_featured: input.featured ?? null,
  });
  return unwrap(
    data as Pick<StaffMenuItem, 'id' | 'available' | 'featured' | 'price_minor'> | null,
    error,
  );
}

export async function confirmPayment(input: {
  paymentId: string;
  action: 'confirm' | 'decline';
  reason?: string | null;
}): Promise<Payment> {
  const { data, error } = await supabase.rpc('confirm_payment', {
    p_payment_id: input.paymentId,
    p_action: input.action,
    p_reason: input.reason ?? null,
  });
  return unwrap<Payment>(data as Payment | null, error);
}
