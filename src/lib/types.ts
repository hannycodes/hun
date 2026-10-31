export type OrderStatus =
  | 'placed'
  | 'accepted'
  | 'preparing'
  | 'ready'
  | 'completed'
  | 'rejected'
  | 'cancelled';

export type OrderType = 'pickup' | 'dine_in';

export type PaymentStatus =
  | 'pending'
  | 'awaiting_confirmation'
  | 'paid'
  | 'failed';

export type OrderPaymentStatus = 'unpaid' | 'pending' | 'paid';

export type PaymentKind = 'wallet' | 'bank_transfer' | 'cash';

export interface Restaurant {
  id: string;
  slug: string;
  name: string;
  tagline: string | null;
  currency: string;
  status: 'active' | 'suspended';
  ordering_enabled: boolean;
  payments_sandbox: boolean;
}

export interface Category {
  id: string;
  restaurant_id: string;
  name: string;
  tagline: string | null;
  image_url: string | null;
  sort_order: number;
}

export interface MenuItem {
  id: string;
  restaurant_id: string;
  category_id: string;
  name: string;
  description: string | null;
  price_minor: number;
  image_url: string | null;
  available: boolean;
  archived: boolean;
  featured: boolean;
  sort_order: number;
}

export interface OrderLine {
  name: string;
  price_minor: number;
  quantity: number;
  line_total_minor: number;
  note: string | null;
}

export interface Order {
  id: string;
  number: number;
  status: OrderStatus;
  type: OrderType;
  table_label: string | null;
  customer_name: string;
  customer_note: string | null;
  subtotal_minor: number;
  total_minor: number;
  currency: string;
  version: number;
  payment_status: OrderPaymentStatus;
  created_at: string;
  updated_at: string;
  tracking_token?: string | null;
  items: OrderLine[];
}

export interface StatusEvent {
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor: string;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  restaurant_id: string;
  code: string;
  label: string;
  short: string;
  kind: PaymentKind;
  account_name: string | null;
  account_number: string | null;
  short_code: string | null;
  instructions: string | null;
  sort_order: number;
  enabled: boolean;
}

export interface Payment {
  id: string;
  order_id: string;
  order_number: number;
  restaurant_id: string;
  method_code: string;
  method_label: string;
  method_short: string;
  method_kind: PaymentKind;
  status: PaymentStatus;
  amount_minor: number;
  currency: string;
  reference: string;
  account_name: string | null;
  account_number: string | null;
  short_code: string | null;
  instructions: string | null;
  payer_name: string | null;
  payer_phone: string | null;
  transaction_ref: string | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  created_at: string;
}

/** A payment row as staff see it in the dashboard. */
export interface StaffPayment extends Payment {
  customer_name: string;
  order_total_minor: number;
  order_status: OrderStatus;
}

export interface StaffProfile {
  user_id: string;
  restaurant_id: string;
  display_name: string;
  role: 'owner' | 'manager' | 'staff' | 'kitchen';
  restaurants: Pick<Restaurant, 'id' | 'name' | 'slug'> | null;
}

/** A menu row as staff edit it in the dashboard. */
export interface StaffMenuItem {
  id: string;
  category_id: string;
  category: string;
  category_sort: number;
  name: string;
  description: string | null;
  price_minor: number;
  image_url: string | null;
  available: boolean;
  featured: boolean;
  sort_order: number;
}

/** Today's numbers for the dashboard, in the café's own day. */
export interface StaffDaySummary {
  orders_today: number;
  completed_today: number;
  revenue_minor: number;
  payments_to_verify: number;
  top_item: string | null;
}

export interface CartLine {
  menuItem: MenuItem;
  quantity: number;
}
