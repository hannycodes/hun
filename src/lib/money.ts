/**
 * Money is always an integer count of the currency's minor unit (ADR-0011).
 * Birr has 100 santim, so 1250 reads as Br 12.50.
 */
export function formatMinor(amountMinor: number, currency = 'ETB'): string {
  if (currency !== 'ETB') {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency,
    }).format(amountMinor / 100);
  }

  const amount = amountMinor / 100;
  const body = amount.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `Br ${body}`;
}

export function cartSubtotal(
  lines: ReadonlyArray<{ priceMinor: number; quantity: number }>,
): number {
  return lines.reduce((sum, line) => sum + line.priceMinor * line.quantity, 0);
}

export function cartCount(
  lines: ReadonlyArray<{ quantity: number }>,
): number {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}
