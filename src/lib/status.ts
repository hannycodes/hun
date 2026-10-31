import type { OrderStatus } from './types';

/**
 * The MVP order lifecycle from docs/requirements.md:
 *
 *   placed → accepted → preparing → ready → completed
 *      |         |
 *      ├→ rejected   (restaurant, with reason)
 *      └→ cancelled  (before acceptance, or by staff with reason)
 *
 * The server enforces this same matrix inside `update_order_status`;
 * this copy only drives which buttons the UI offers.
 */
export const TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  placed: ['accepted', 'rejected', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready'],
  ready: ['completed'],
  completed: [],
  rejected: [],
  cancelled: [],
};

export const TERMINAL_STATUSES: readonly OrderStatus[] = [
  'completed',
  'rejected',
  'cancelled',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  placed: 'Order placed',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STATUS_SHORT: Record<OrderStatus, string> = {
  placed: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready',
  completed: 'Done',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

export const STATUS_HINT: Record<OrderStatus, string> = {
  placed: 'We have your order and are reviewing it now.',
  accepted: 'The kitchen has your order.',
  preparing: 'Everything is being made fresh.',
  ready: 'Ready at the counter — thank you for waiting.',
  completed: 'Enjoy. We hope to see you again soon.',
  rejected: 'The restaurant could not take this order.',
  cancelled: 'This order was cancelled.',
};

/** Ordered happy path used for the customer's progress timeline. */
export const FLOW: readonly OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'completed',
];

export function isTerminal(status: OrderStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Index on the happy path, or -1 when the order left the happy path. */
export function flowIndex(status: OrderStatus): number {
  return FLOW.indexOf(status);
}

/** Next single step for staff, when one exists. */
export function nextAction(status: OrderStatus): OrderStatus | null {
  const options = TRANSITIONS[status];
  if (options.length === 0) return null;
  if (status === 'placed') return 'accepted';
  return options[0] ?? null;
}
