import { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Check,
  Copy,
  ErrorState,
  Field,
  Spinner,
  Wordmark,
  inputClass,
} from '../components/ui';
import { usePolling } from '../hooks/usePolling';
import {
  AppError,
  createPayment,
  fetchPaymentByToken,
  fetchPaymentMethods,
  fetchRestaurant,
  friendlyMessage,
  sandboxApprovePayment,
  submitPaymentProof,
} from '../lib/api';
import { formatMinor } from '../lib/money';
import type { Payment, PaymentMethod, Restaurant } from '../lib/types';

type Phase = 'loading' | 'ready' | 'error';

const STATUS_COPY: Record<Payment['status'], { label: string; tone: string }> = {
  pending: { label: 'Awaiting your transfer', tone: 'bg-blush text-ink' },
  awaiting_confirmation: { label: 'With us for verification', tone: 'bg-baby text-ink' },
  paid: { label: 'Paid', tone: 'bg-ink text-paper' },
  failed: { label: 'Not verified', tone: 'border border-rose/60 text-charcoal' },
};

export default function PayPage() {
  const { token = '' } = useParams();
  const [params] = useSearchParams();
  const requestedMethod = params.get('method');

  const [payment, setPayment] = useState<Payment | null>(null);
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);

  const [transactionRef, setTransactionRef] = useState('');
  const [payerName, setPayerName] = useState('');
  const [payerPhone, setPayerPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [approving, setApproving] = useState(false);

  const load = useCallback(async () => {
    setPhase('loading');
    setErrorCode(null);
    try {
      const [existing, list, resto] = await Promise.all([
        fetchPaymentByToken(token),
        fetchPaymentMethods().catch(() => [] as PaymentMethod[]),
        fetchRestaurant().catch(() => null),
      ]);
      setMethods(list);
      setRestaurant(resto);

      if (existing) {
        setPayment(existing);
      } else if (requestedMethod) {
        try {
          setPayment(await createPayment(token, requestedMethod));
        } catch (createError) {
          // Another tab or a remount may have started the intent first —
          // show the one that exists rather than an error page.
          const started = await fetchPaymentByToken(token);
          if (!started) throw createError;
          setPayment(started);
        }
      }

      setPhase('ready');
    } catch (caught) {
      setErrorCode(caught instanceof AppError ? caught.code : 'UNKNOWN');
      setPhase('error');
    }
  }, [token, requestedMethod]);

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  // Follow the payment while staff review the transfer.
  usePolling(
    async () => {
      try {
        const next = await fetchPaymentByToken(token);
        if (next) setPayment(next);
      } catch {
        // A dropped poll is not worth interrupting the customer for.
      }
    },
    4000,
    phase === 'ready' && payment?.status === 'awaiting_confirmation',
  );

  async function handleProof(event: React.FormEvent) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setBanner(null);

    try {
      const next = await submitPaymentProof({
        token,
        transactionRef: transactionRef.trim(),
        payerName: payerName.trim(),
        payerPhone: payerPhone.trim() || null,
      });
      setPayment(next);
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
    } finally {
      setSubmitting(false);
    }
  }

  async function switchMethod(code: string) {
    if (switching) return;
    setSwitching(true);
    setBanner(null);
    try {
      const next = await createPayment(token, code);
      setPayment(next);
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
    } finally {
      setSwitching(false);
    }
  }

  async function approveInSandbox() {
    setApproving(true);
    setBanner(null);
    try {
      const next = await sandboxApprovePayment(token);
      setPayment(next);
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
    } finally {
      setApproving(false);
    }
  }

  if (phase === 'loading') {
    return (
      <Shell>
        <Spinner label="Opening your payment" />
      </Shell>
    );
  }

  if (phase === 'error') {
    return (
      <Shell>
        <ErrorState
          title="We could not open this payment"
          message={friendlyMessage(errorCode)}
          onRetry={() => void load()}
        />
      </Shell>
    );
  }

  if (!payment) {
    return (
      <Shell>
        <ErrorState
          title="No payment started"
          message="This order does not have a payment yet. Open your order to see its total and pay."
          onRetry={() => undefined}
        />
      </Shell>
    );
  }

  const cash = payment.method_kind === 'cash';
  const paid = payment.status === 'paid';
  const reviewing = payment.status === 'awaiting_confirmation';
  const failed = payment.status === 'failed';
  const sandbox = Boolean(restaurant?.payments_sandbox);

  return (
    <Shell orderNumber={payment.order_number}>
      <div className="mx-auto max-w-3xl px-5 pb-24 pt-8 sm:px-8">
        {/* Headline */}
        <div className="text-center">
          <span
            className={`inline-flex items-center rounded-full px-3.5 py-1 text-[10px] uppercase tracking-[0.18em] ${STATUS_COPY[payment.status].tone}`}
          >
            {STATUS_COPY[payment.status].label}
          </span>

          <h1 className="mt-5 font-display text-[clamp(2.2rem,5.4vw,3.6rem)] leading-tight">
            {paid
              ? 'Payment received.'
              : reviewing
                ? 'With us for a moment.'
                : failed
                  ? 'We could not match that transfer.'
                  : cash
                    ? 'Pay at the counter.'
                    : 'Send the transfer.'}
          </h1>

          <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-charcoal">
            {paid
              ? 'Thank you — the kitchen has your order. A receipt reference is below.'
              : reviewing
                ? 'Our team is matching your transaction to the order. This page updates itself.'
                : failed
                  ? payment.method_label === 'Cash at the counter'
                    ? 'Choose another method and send the amount again.'
                    : 'Choose a method and send the exact amount again, or pay at the counter when you collect.'
                  : cash
                    ? 'Nothing to pay now. Show your order number when you collect and settle in Birr.'
                    : `Send exactly ${formatMinor(payment.amount_minor, payment.currency)} to the ${payment.method_label} account below, then paste the transaction number.`}
          </p>

          <p className="mt-6 font-display text-[44px] leading-none tabular-nums">
            {formatMinor(payment.amount_minor, payment.currency)}
          </p>
          <p className="mt-2 text-[11px] uppercase tracking-[0.2em] text-charcoal">
            Order #{payment.order_number} · {payment.method_label}
          </p>
        </div>

        {banner && (
          <p
            role="alert"
            className="mx-auto mt-6 max-w-md rounded-xl border border-rose/50 bg-blush px-4 py-3 text-center text-[13px] text-ink"
          >
            {banner}
          </p>
        )}

        {/* Paid */}
        {paid && (
          <div className="mt-10 rounded-3xl border border-baby bg-blush/60 p-6 sm:p-8">
            <div className="flex items-center gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-full bg-ink text-paper">
                <Check />
              </span>
              <p className="text-[13px] text-charcoal">
                Confirmed {payment.confirmed_at ? relative(payment.confirmed_at) : 'just now'}
                {payment.transaction_ref ? ` · ref ${payment.transaction_ref}` : ''}
              </p>
            </div>

            <dl className="mt-6 divide-y divide-baby border-t border-baby text-[13px]">
              <Row term="Reference" detail={payment.reference} />
              <Row term="Method" detail={payment.method_label} />
              <Row term="Paid" detail={formatMinor(payment.amount_minor, payment.currency)} />
            </dl>

            <div className="mt-7 flex flex-wrap gap-3">
              <Link
                to={`/order/${token}`}
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[11px] uppercase tracking-[0.18em] text-paper transition hover:bg-plum"
              >
                Track my order
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:border-ink"
              >
                Back to the menu
              </Link>
            </div>
          </div>
        )}

        {/* Awaiting verification */}
        {reviewing && (
          <div className="mt-10 rounded-3xl border border-baby bg-blush/60 p-6 sm:p-8">
            <p className="text-[11px] uppercase tracking-[0.24em] text-gold">
              What happens now
            </p>
            <ol className="mt-4 space-y-4">
              {[
                {
                  title: 'We check the transaction',
                  body: `We look for ${payment.reference} in the café's ${payment.method_label} account.`,
                },
                {
                  title: 'The kitchen starts',
                  body: 'As soon as it matches, your order moves forward and the tracking page updates.',
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4">
                  <span className="font-display text-lg text-gold">0{index + 1}</span>
                  <div>
                    <p className="text-[14px] text-ink">{step.title}</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-charcoal">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>

            <dl className="mt-6 divide-y divide-baby border-y border-baby text-[13px]">
              <Row term="Reference" detail={payment.reference} />
              {payment.transaction_ref && (
                <Row term="Your transaction" detail={payment.transaction_ref} />
              )}
              <Row term="Amount" detail={formatMinor(payment.amount_minor, payment.currency)} />
            </dl>

            {sandbox && (
              <SandboxPanel
                approving={approving}
                onApprove={() => void approveInSandbox()}
                note="Demonstration build: this stands in for the café's manual check. Staff can also verify it from the dashboard."
              />
            )}

            <div className="mt-7">
              <Link
                to={`/order/${token}`}
                className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:border-ink"
              >
                Track my order
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Pending / failed — instructions + proof */}
        {!paid && !reviewing && (
          <>
            {!cash && (
              <div className="mt-10 rounded-3xl border border-baby bg-white p-6 sm:p-8">
                <p className="text-[11px] uppercase tracking-[0.24em] text-gold">
                  {payment.method_kind === 'wallet' ? 'Send with your wallet' : 'Transfer to'}
                </p>

                <div className="mt-5 space-y-3">
                  {payment.short_code && (
                    <CopyRow label="Merchant short code" value={payment.short_code} />
                  )}
                  {payment.account_number && (
                    <CopyRow label="Account number" value={payment.account_number} />
                  )}
                  {payment.account_name && (
                    <div className="rounded-2xl bg-blush/60 px-4 py-3">
                      <p className="text-[10px] uppercase tracking-[0.2em] text-charcoal">
                        Account name
                      </p>
                      <p className="mt-1 text-[14px] text-ink">{payment.account_name}</p>
                    </div>
                  )}
                  <CopyRow label="Payment reference" value={payment.reference} strong />
                  <CopyRow
                    label="Exact amount"
                    value={formatMinor(payment.amount_minor, payment.currency)}
                    strong
                  />
                </div>

                {payment.instructions && (
                  <p className="mt-5 rounded-2xl border border-baby px-4 py-3 text-[12px] leading-relaxed text-charcoal">
                    {payment.instructions}
                  </p>
                )}
              </div>
            )}

            {cash && (
              <div className="mt-10 rounded-3xl border border-baby bg-blush/60 p-6 sm:p-8">
                <p className="text-[11px] uppercase tracking-[0.24em] text-gold">
                  At the counter
                </p>
                <p className="mt-3 text-[14px] leading-relaxed text-charcoal">
                  Give the counter your name and order number. We take Birr, and we
                  can send a Telebirr request on the spot if you prefer.
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <CopyRow label="Order number" value={`#${payment.order_number}`} strong />
                  <CopyRow
                    label="Amount due"
                    value={formatMinor(payment.amount_minor, payment.currency)}
                    strong
                  />
                </div>
              </div>
            )}

            {!cash && (
              <form
                onSubmit={handleProof}
                className="mt-6 rounded-3xl border border-baby bg-white p-6 sm:p-8"
              >
                <h2 className="font-display text-2xl">I have sent it.</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-charcoal">
                  Paste the transaction number from your banking app. We match it to
                  your reference before the kitchen starts.
                </p>

                <div className="mt-6 space-y-5">
                  <Field label="Transaction number" hint="Required">
                    <input
                      className={inputClass}
                      value={transactionRef}
                      onChange={(event) => setTransactionRef(event.target.value)}
                      placeholder="e.g. FT24A1K8P9Q2"
                      maxLength={64}
                      required
                    />
                  </Field>

                  <Field label="Name on the transfer" hint="Optional">
                    <input
                      className={inputClass}
                      value={payerName}
                      onChange={(event) => setPayerName(event.target.value)}
                      placeholder="As it appears in your bank app"
                      maxLength={80}
                    />
                  </Field>

                  <Field label="Phone" hint="Optional">
                    <input
                      className={inputClass}
                      value={payerPhone}
                      onChange={(event) => setPayerPhone(event.target.value)}
                      placeholder="09xx xxx xxx"
                      maxLength={32}
                      inputMode="tel"
                    />
                  </Field>
                </div>

                <button
                  type="submit"
                  disabled={submitting || transactionRef.trim().length < 4}
                  className="mt-6 w-full rounded-full bg-ink px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {submitting ? 'Sending for verification…' : 'Confirm my transfer'}
                </button>
              </form>
            )}

            {/* Change method */}
            {methods.length > 1 && (
              <div className="mt-6 rounded-3xl border border-baby p-6">
                <p className="text-[11px] uppercase tracking-[0.24em] text-charcoal">
                  {failed ? 'Pay another way' : 'Prefer another way?'}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {methods
                    .filter((method) => method.code !== payment.method_code)
                    .map((method) => (
                      <button
                        key={method.code}
                        type="button"
                        disabled={switching}
                        onClick={() => void switchMethod(method.code)}
                        className="inline-flex items-center gap-2 rounded-full border border-baby bg-white px-3.5 py-2 text-[11px] uppercase tracking-[0.1em] text-charcoal transition hover:border-ink hover:text-ink disabled:opacity-50"
                      >
                        <span className="grid h-5 w-5 place-items-center rounded-full bg-blush font-display text-[10px] text-plum">
                          {method.short}
                        </span>
                        {method.label}
                      </button>
                    ))}
                </div>
              </div>
            )}

            {sandbox && (
              <SandboxPanel
                approving={approving}
                onApprove={() => void approveInSandbox()}
                note="Demonstration build: approve this payment without a real transfer, exactly as staff would after checking it."
              />
            )}
          </>
        )}

        <p className="mt-10 text-center text-[11px] leading-relaxed text-charcoal/70">
          Keep the reference {payment.reference} on every transfer. Questions?{' '}
          <a href="tel:+251910000000" className="underline underline-offset-2 hover:text-ink">
            Call the café
          </a>
          .
        </p>
      </div>
    </Shell>
  );
}

function SandboxPanel({
  approving,
  onApprove,
  note,
}: {
  approving: boolean;
  onApprove: () => void;
  note: string;
}) {
  return (
    <div className="mt-6 rounded-2xl border border-dashed border-gold/50 bg-white/60 p-5">
      <p className="text-[10px] uppercase tracking-[0.24em] text-gold">Sandbox</p>
      <p className="mt-2 text-[12px] leading-relaxed text-charcoal">{note}</p>
      <button
        type="button"
        onClick={onApprove}
        disabled={approving}
        className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/25 px-5 py-2.5 text-[11px] uppercase tracking-[0.16em] transition hover:border-ink hover:bg-blush disabled:opacity-50"
      >
        {approving ? 'Approving…' : 'Approve payment (sandbox)'}
      </button>
    </div>
  );
}

function CopyRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard access can be denied; the value is on screen regardless.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 rounded-2xl bg-blush/60 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-[0.2em] text-charcoal">{label}</p>
        <p
          className={`mt-1 truncate tabular-nums ${
            strong ? 'font-display text-lg' : 'font-mono text-[14px]'
          } text-ink`}
        >
          {value}
        </p>
      </div>
      <button
        type="button"
        onClick={() => void copy()}
        aria-label={`Copy ${label}`}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-ink/15 bg-white px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] text-charcoal transition hover:border-ink hover:text-ink"
      >
        {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

function Row({ term, detail }: { term: string; detail: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2.5">
      <dt className="text-[10px] uppercase tracking-[0.2em] text-charcoal">{term}</dt>
      <dd className="text-[13px] text-ink">{detail}</dd>
    </div>
  );
}

function Shell({
  children,
  orderNumber,
}: {
  children: React.ReactNode;
  orderNumber?: number;
}) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby px-5 py-5 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4">
          <Link to="/" aria-label="hun. home">
            <Wordmark className="text-2xl" />
          </Link>
          <div className="flex items-center gap-4">
            {orderNumber !== undefined && (
              <span className="hidden text-[10px] uppercase tracking-[0.24em] text-charcoal sm:inline">
                Order #{orderNumber}
              </span>
            )}
            <Link
              to="/menu"
              className="text-[11px] uppercase tracking-[0.18em] text-charcoal transition hover:text-ink"
            >
              Menu
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  );
}

function relative(iso: string): string {
  const seconds = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}
