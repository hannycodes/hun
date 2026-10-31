import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import {
  ErrorState,
  Field,
  Wordmark,
  inputClass,
} from '../components/ui';
import { AppError, fetchPaymentMethods, friendlyMessage, placeOrder } from '../lib/api';
import { formatMinor } from '../lib/money';
import type { OrderType, PaymentMethod } from '../lib/types';

const KIND_HINT: Record<PaymentMethod['kind'], string> = {
  wallet: 'Mobile wallet',
  bank_transfer: 'Bank transfer',
  cash: 'At the counter',
};

export default function CheckoutPage() {
  const { lines, subtotalMinor, currency, clear } = useCart();
  const navigate = useNavigate();

  // One key per checkout session: a double tap or a network retry replays the
  // same key, so the database can collapse both into a single order.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const [type, setType] = useState<OrderType>('pickup');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [tableLabel, setTableLabel] = useState('');
  const [note, setNote] = useState('');
  const [methodCode, setMethodCode] = useState('');
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedWithoutToken, setPlacedWithoutToken] = useState(false);

  useEffect(() => {
    let active = true;
    void fetchPaymentMethods()
      .then((next) => {
        if (!active) return;
        setMethods(next);
        setMethodCode((current) => current || next[0]?.code || '');
      })
      .catch(() => {
        // The order can still be placed; the pay page lists methods again.
      });
    return () => {
      active = false;
    };
  }, []);

  const total = useMemo(() => subtotalMinor, [subtotalMinor]);
  const selected = methods.find((method) => method.code === methodCode) ?? null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;

    if (lines.length === 0) {
      setError('EMPTY_CART');
      return;
    }
    if (!name.trim()) {
      setError('NAME_REQUIRED');
      return;
    }
    if (type === 'dine_in' && !tableLabel.trim()) {
      setError('TABLE_REQUIRED');
      return;
    }
    if (!methodCode) {
      setError('PAYMENT_METHOD_UNAVAILABLE');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const order = await placeOrder({
        idempotencyKey,
        type,
        customerName: name.trim(),
        customerPhone: phone.trim() || null,
        tableLabel: type === 'dine_in' ? tableLabel.trim() : null,
        customerNote: note.trim() || null,
        lines: lines.map((line) => ({
          menuItemId: line.menuItem.id,
          quantity: line.quantity,
        })),
      });

      clear();

      if (order.tracking_token) {
        navigate(`/pay/${order.tracking_token}?method=${methodCode}`, { replace: true });
      } else {
        // Replay of a key whose token was already shown: the order exists,
        // but this browser cannot recover its tracking token.
        setPlacedWithoutToken(true);
      }
    } catch (caught) {
      setError(caught instanceof AppError ? caught.code : 'UNKNOWN');
      setSubmitting(false);
    }
  }

  if (placedWithoutToken) {
    return (
      <Shell>
        <ErrorState
          title="This order is already in"
          message="This checkout was submitted twice, so the order was created only once — exactly as intended. Your confirmation link from the first attempt still works."
          onRetry={() => navigate('/menu')}
        />
      </Shell>
    );
  }

  if (lines.length === 0 && !submitting) {
    return (
      <Shell>
        <ErrorState
          title="Your order is empty"
          message="Add a coffee and something from the pastry counter, then come back."
          onRetry={() => navigate('/menu')}
        />
      </Shell>
    );
  }

  return (
    <Shell>
      <main className="mx-auto grid max-w-5xl gap-12 px-5 py-10 sm:px-8 lg:grid-cols-[1.35fr_1fr] lg:gap-16 lg:py-14">
        <section>
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Checkout</p>
          <h1 className="mt-4 font-display text-[clamp(2.2rem,5vw,3.4rem)]">
            One last <span className="display-italic">thing.</span>
          </h1>
          <p className="mt-3 max-w-md text-[14px] leading-relaxed text-charcoal">
            Where it's going, and how you'd like to pay. We keep only what the
            kitchen needs.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 space-y-8">
            <fieldset>
              <legend className="mb-3 text-[11px] uppercase tracking-[0.2em] text-charcoal">
                How would you like it?
              </legend>
              <div className="grid grid-cols-2 gap-3">
                {(
                  [
                    { value: 'pickup', label: 'Pickup', hint: 'Ready at the counter' },
                    { value: 'dine_in', label: 'Dine-in', hint: 'Bring it to my table' },
                  ] as const
                ).map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setType(option.value)}
                    className={`rounded-2xl border px-4 py-4 text-left transition ${
                      type === option.value
                        ? 'border-ink bg-blush'
                        : 'border-baby bg-white hover:border-rose/70'
                    }`}
                  >
                    <span className="block font-display text-xl">{option.label}</span>
                    <span className="mt-1 block text-[11px] text-charcoal">
                      {option.hint}
                    </span>
                  </button>
                ))}
              </div>
            </fieldset>

            <Field label="Name for the order">
              <input
                className={inputClass}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Amara"
                maxLength={80}
                autoComplete="name"
                required
              />
            </Field>

            {type === 'dine_in' && (
              <Field label="Table number" hint="On the little stand">
                <input
                  className={inputClass}
                  value={tableLabel}
                  onChange={(event) => setTableLabel(event.target.value)}
                  placeholder="e.g. 12"
                  maxLength={12}
                  required
                />
              </Field>
            )}

            <Field label="Phone" hint="optional">
              <input
                className={inputClass}
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="09xx xxx xxx"
                maxLength={32}
                autoComplete="tel"
                inputMode="tel"
              />
            </Field>

            <Field label="A note for the kitchen" hint="optional">
              <textarea
                className={`${inputClass} min-h-[96px] resize-y`}
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="Allergies, no onions, happy birthday…"
                maxLength={500}
              />
            </Field>

            {/* Payment */}
            <fieldset>
              <legend className="mb-3 flex w-full items-baseline justify-between text-[11px] uppercase tracking-[0.2em] text-charcoal">
                Payment
                <span className="normal-case tracking-normal text-charcoal/60">
                  Priced in Birr
                </span>
              </legend>

              {methods.length === 0 && (
                <p className="rounded-xl border border-baby bg-blush/60 px-4 py-3 text-[13px] text-charcoal">
                  Payment methods are loading. You can still place the order and pay
                  on the next screen.
                </p>
              )}

              <div className="grid gap-2 sm:grid-cols-2">
                {methods.map((method) => (
                  <button
                    key={method.code}
                    type="button"
                    onClick={() => setMethodCode(method.code)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-3 text-left transition ${
                      methodCode === method.code
                        ? 'border-ink bg-blush'
                        : 'border-baby bg-white hover:border-rose/70'
                    }`}
                  >
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush font-display text-xs text-plum">
                      {method.short}
                    </span>
                    <span>
                      <span className="block text-[13px] text-ink">{method.label}</span>
                      <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-charcoal/70">
                        {KIND_HINT[method.kind]}
                      </span>
                    </span>
                  </button>
                ))}
              </div>

              {selected && (
                <p className="mt-3 text-[12px] leading-relaxed text-charcoal">
                  {selected.kind === 'cash'
                    ? 'Nothing to pay now — settle at the counter when you collect.'
                    : 'You will get the account details and a payment reference on the next screen.'}
                </p>
              )}
            </fieldset>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose/50 bg-blush px-4 py-3 text-sm text-ink"
              >
                {friendlyMessage(error)}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-ink px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum disabled:cursor-wait disabled:opacity-60"
            >
              {submitting
                ? 'Sending it through…'
                : `Place order · ${formatMinor(total, currency)}`}
            </button>

            <p className="text-center text-[11px] leading-relaxed text-charcoal/70">
              Your order is created on the café's server and priced from today's menu.
            </p>
          </form>
        </section>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <div className="rounded-3xl border border-baby bg-blush/70 p-6">
            <p className="text-[10px] uppercase tracking-[0.26em] text-gold">
              Your order
            </p>

            <ul className="mt-5 space-y-4">
              {lines.map((line) => (
                <li
                  key={line.menuItem.id}
                  className="flex items-start justify-between gap-4 text-sm"
                >
                  <span className="text-ink">
                    <span className="mr-2 tabular-nums text-charcoal">
                      {line.quantity}×
                    </span>
                    {line.menuItem.name}
                  </span>
                  <span className="tabular-nums text-charcoal">
                    {formatMinor(line.menuItem.price_minor * line.quantity, currency)}
                  </span>
                </li>
              ))}
            </ul>

            <div className="mt-6 space-y-2 border-t border-baby pt-4 text-[13px]">
              <div className="flex justify-between text-charcoal">
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMinor(subtotalMinor, currency)}</span>
              </div>
              <div className="flex justify-between text-charcoal">
                <span>Service</span>
                <span>Included</span>
              </div>
            </div>

            <div className="mt-4 flex items-baseline justify-between border-t border-baby pt-4">
              <span className="text-[10px] uppercase tracking-[0.26em] text-charcoal">
                Total
              </span>
              <span className="font-display text-3xl tabular-nums">
                {formatMinor(total, currency)}
              </span>
            </div>
            <p className="mt-2 text-[11px] text-charcoal/70">
              All prices include tax. No card details are stored.
            </p>
          </div>
        </aside>
      </main>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link to="/" aria-label="hun. home">
            <Wordmark className="text-2xl" />
          </Link>
          <Link
            to="/menu"
            className="text-[11px] uppercase tracking-[0.18em] text-charcoal transition hover:text-ink"
          >
            ← Menu
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
