import { describe, expect, it } from 'vitest';
import { cartCount, cartSubtotal, formatMinor } from './money';

describe('formatMinor', () => {
  it('renders integer minor units as Birr with two decimals', () => {
    expect(formatMinor(1250)).toBe('Br 12.50');
    expect(formatMinor(0)).toBe('Br 0.00');
    expect(formatMinor(450)).toBe('Br 4.50');
  });

  it('never produces floating point artifacts', () => {
    expect(formatMinor(999_999)).toBe('Br 9,999.99');
    expect(formatMinor(3)).toBe('Br 0.03');
  });

  it('respects the order currency when it is not Birr', () => {
    expect(formatMinor(1250, 'USD')).toBe('$12.50');
  });
});

describe('cartSubtotal', () => {
  it('sums line totals from integers only', () => {
    const lines = [
      { priceMinor: 450, quantity: 2 },
      { priceMinor: 1250, quantity: 1 },
    ];
    expect(cartSubtotal(lines)).toBe(2150);
  });

  it('is zero for an empty cart', () => {
    expect(cartSubtotal([])).toBe(0);
  });
});

describe('cartCount', () => {
  it('counts units, not line rows', () => {
    expect(cartCount([{ quantity: 2 }, { quantity: 3 }])).toBe(5);
    expect(cartCount([])).toBe(0);
  });
});
