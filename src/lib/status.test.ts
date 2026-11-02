import { describe, expect, it } from 'vitest';
import type { OrderStatus } from './types';
import { canTransition, flowIndex, isTerminal, nextAction, TRANSITIONS } from './status';

const ALL: OrderStatus[] = [
  'placed',
  'accepted',
  'preparing',
  'ready',
  'completed',
  'rejected',
  'cancelled',
];

describe('order state machine', () => {
  it('allows exactly the documented transitions from placed', () => {
    expect(ALL.filter((to) => canTransition('placed', to))).toEqual([
      'accepted',
      'rejected',
      'cancelled',
    ]);
  });

  it('walks the happy path', () => {
    expect(canTransition('accepted', 'preparing')).toBe(true);
    expect(canTransition('preparing', 'ready')).toBe(true);
    expect(canTransition('ready', 'completed')).toBe(true);
  });

  it('refuses skipped steps', () => {
    expect(canTransition('placed', 'ready')).toBe(false);
    expect(canTransition('placed', 'completed')).toBe(false);
    expect(canTransition('accepted', 'ready')).toBe(false);
    expect(canTransition('preparing', 'completed')).toBe(false);
  });

  it('refuses backward transitions', () => {
    expect(canTransition('ready', 'preparing')).toBe(false);
    expect(canTransition('completed', 'ready')).toBe(false);
    expect(canTransition('accepted', 'placed')).toBe(false);
  });

  it('treats terminal states as final', () => {
    for (const terminal of ['completed', 'rejected', 'cancelled'] as const) {
      expect(isTerminal(terminal)).toBe(true);
      for (const to of ALL) {
        expect(canTransition(terminal, to)).toBe(false);
      }
    }
  });

  it('never advertises an action from a terminal state', () => {
    expect(nextAction('completed')).toBeNull();
    expect(nextAction('rejected')).toBeNull();
    expect(nextAction('cancelled')).toBeNull();
    expect(nextAction('placed')).toBe('accepted');
    expect(nextAction('ready')).toBe('completed');
  });

  it('keeps every transition list inside the known status set', () => {
    for (const from of ALL) {
      for (const to of TRANSITIONS[from]) {
        expect(ALL).toContain(to);
      }
    }
  });
});

describe('flowIndex', () => {
  it('positions happy path statuses', () => {
    expect(flowIndex('placed')).toBe(0);
    expect(flowIndex('ready')).toBe(3);
    expect(flowIndex('completed')).toBe(4);
  });

  it('is negative once an order leaves the happy path', () => {
    expect(flowIndex('rejected')).toBe(-1);
    expect(flowIndex('cancelled')).toBe(-1);
  });
});
