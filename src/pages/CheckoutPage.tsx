import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { Check, ErrorState, Field, Wordmark, inputClass } from '../components/ui';
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
  const [noteOpen, setNoteOpen] = useState(false);
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
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" aria-label="hun. home">
            <Wordmark className="text-[26px]" />
          </Link>
          <Link
            to="/menu"
            className="text-[11px] uppercase tracking-[0.18em] text-charcoal transition hover:text-ink"
          >
            ← Back to the menu
          </Link>
        </div>
      </header>

      {/* Split screen: the form on paper, the order sitting on the pink panel
          beside it, so neither long column has to be scrolled through alone. */}
      <main className="mx-auto grid max-w-6xl lg:grid-cols-[1.08fr_0.92fr]">
        <section className="px-5 py-9 sm:px-8 lg:py-12 lg:pr-14">
          <p className="text-[10px] uppercase tracking-[0.3em] text-gold">Checkout</p>
          <h1 className="mt-3 font-display text-[clamp(2rem,4vw,2.9rem)] leading-tight">
            One last <span className="display-italic">thing.</span>
          </h1>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <fieldset>
              <legend className="mb-2.5 text-[10px] uppercase tracking-[0.22em] text-charcoal">
                How would you like it?
              </legend>
              <div className="grid grid-cols-2 gap-2.5">
                {(
                  [
                    { value: 'pickup', label: 'Pickup', hint: 'At the counter' },
                    { value: 'dine_in', label: 'Dine-in', hint: 'Brought to your table' },
                  ] as const
                ).map((option) => {
                  const active = type === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setType(option.value)}
                      className={`rounded-2xl border px-4 py-3 text-left transition ${
                        active
                          ? 'border-ink bg-blush'
                          : 'border-baby bg-white hover:border-rose/70'
                      }`}
                    >
                      <span className="block font-display text-lg leading-none">
                        {option.label}
                      </span>
                      <span className="mt-1.5 block text-[11px] text-charcoal">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            <div className="grid gap-5 sm:grid-cols-2">
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
            </div>

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

            <div>
              <PaymentSelect
                methods={methods}
                selected={selected}
                onSelect={setMethodCode}
              />
              {selected && (
                <p className="mt-2.5 text-[12px] leading-relaxed text-charcoal">
                  {selected.kind === 'cash'
                    ? 'Nothing to pay now — settle at the counter when you collect.'
                    : 'The account details and a payment reference come on the next screen.'}
                </p>
              )}
            </div>

            <div>
              <button
                type="button"
                onClick={() => setNoteOpen((open) => !open)}
                aria-expanded={noteOpen}
                className="text-[11px] uppercase tracking-[0.18em] text-charcoal underline decoration-baby decoration-2 underline-offset-4 transition hover:text-ink"
              >
                {noteOpen ? 'Remove the note' : 'Add a note for the kitchen'}
              </button>
              {noteOpen && (
                <textarea
                  className={`${inputClass} mt-3 min-h-[84px] resize-y`}
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="Allergies, oat milk, no sugar…"
                  maxLength={500}
                  autoFocus
                />
              )}
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-xl border border-rose/50 bg-blush px-4 py-3 text-sm text-ink"
              >
                {friendlyMessage(error)}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-full bg-ink px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum disabled:cursor-wait disabled:opacity-60"
              >
                {submitting
                  ? 'Sending it through…'
                  : `Place order · ${formatMinor(total, currency)}`}
              </button>
              <Link
                to="/menu"
                className="text-center text-[11px] uppercase tracking-[0.16em] text-charcoal transition hover:text-ink"
              >
                Keep looking
              </Link>
            </div>

            <p className="text-[11px] leading-relaxed text-charcoal/70">
              Priced from today's menu when the order reaches the café. No card
              details are stored.
            </p>
          </form>
        </section>

        <aside className="border-t border-baby bg-blush/50 px-5 py-9 sm:px-8 lg:border-l lg:border-t-0 lg:py-12">
          <div className="lg:sticky lg:top-10">
            <p className="text-[10px] uppercase tracking-[0.26em] text-gold">Your order</p>

            <ul className="mt-5 space-y-3.5">
              {lines.map((line) => (
                <li
                  key={line.menuItem.id}
                  className="flex items-start justify-between gap-4 text-[13px]"
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

            <p className="mt-6 text-[11px] uppercase tracking-[0.2em] text-charcoal/60">
              Addis Ababa · 7:30 — 20:00
            </p>
          </div>
        </aside>
      </main>
    </div>
  );
}

/** Shared chrome for the short-lived checkout states (empty, duplicate). */
function Shell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby/70">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <Link to="/" aria-label="hun. home">
            <Wordmark className="text-[26px]" />
          </Link>
          <Link
            to="/menu"
            className="text-[11px] uppercase tracking-[0.18em] text-charcoal transition hover:text-ink"
          >
            ← Back to the menu
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}

/**
 * Payment choice as a quiet dropdown: the closed state shows only the method
 * you picked, so eight wallets and banks don't turn the form into a wall.
 */
function PaymentSelect({
  methods,
  selected,
  onSelect,
}: {
  methods: PaymentMethod[];
  selected: PaymentMethod | null;
  onSelect: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: MouseEvent) {
      if (!wrapRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapRef} className="relative">
      <span className="mb-2.5 block text-[10px] uppercase tracking-[0.22em] text-charcoal">
        Payment
      </span>

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`flex w-full items-center gap-3 rounded-2xl border bg-white px-4 py-3 text-left transition ${
          open ? 'border-ink' : 'border-baby hover:border-rose/70'
        }`}
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-blush font-display text-[11px] text-plum">
          {selected?.short ?? '—'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] text-ink">
            {selected ? selected.label : methods.length ? 'Choose a method' : 'Loading methods…'}
          </span>
          <span className="mt-0.5 block text-[10px] uppercase tracking-[0.14em] text-charcoal/70">
            {selected ? KIND_HINT[selected.kind] : 'Telebirr, bank or cash'}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          className={`h-4 w-4 shrink-0 text-charcoal transition ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open && methods.length > 0 && (
        <ul
          role="listbox"
          aria-label="Payment method"
          className="absolute inset-x-0 top-full z-30 mt-2 max-h-[300px] overflow-y-auto rounded-2xl border border-baby bg-paper p-1.5 shadow-[0_24px_60px_-30px_rgba(36,26,32,0.5)] fade-in"
        >
          {methods.map((method) => {
            const active = method.code === selected?.code;
            return (
              <li key={method.code}>
                <button
                  type="button"
                  role="option"
                  aria-selected={active}
                  onClick={() => {
                    onSelect(method.code);
                    setOpen(false);
                  }}
                  className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                    active ? 'bg-blush' : 'hover:bg-blush/60'
                  }`}
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-blush font-display text-[11px] text-plum">
                    {method.short}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13px] text-ink">
                      {method.label}
                    </span>
                    <span className="text-[10px] uppercase tracking-[0.14em] text-charcoal/60">
                      {KIND_HINT[method.kind]}
                    </span>
                  </span>
                  {active && <Check className="h-4 w-4 shrink-0 text-plum" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
