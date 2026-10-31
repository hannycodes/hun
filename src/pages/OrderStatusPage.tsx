import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ErrorState, Spinner, StatusPill, Wordmark } from '../components/ui';
import { AppError, fetchOrderEvents, fetchOrderByToken, friendlyMessage } from '../lib/api';
import { usePolling } from '../hooks/usePolling';
import { formatMinor } from '../lib/money';
import {
  FLOW,
  STATUS_HINT,
  STATUS_LABEL,
  flowIndex,
  isTerminal,
} from '../lib/status';
import type { Order, StatusEvent } from '../lib/types';

type LoadState = 'loading' | 'ready' | 'error';

export default function OrderStatusPage() {
  const { token = '' } = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [events, setEvents] = useState<StatusEvent[]>([]);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setState('loading');
      try {
        const [nextOrder, nextEvents] = await Promise.all([
          fetchOrderByToken(token),
          fetchOrderEvents(token),
        ]);
        setOrder(nextOrder);
        setEvents(nextEvents);
        setState('ready');
      } catch (error) {
        if (silent) return;
        setMessage(
          error instanceof AppError
            ? friendlyMessage(error.code)
            : 'This order could not be found.',
        );
        setState('error');
      }
    },
    [token],
  );

  useEffect(() => {
    if (token) void load();
  }, [token, load]);

  const open = order ? !isTerminal(order.status) : false;
  usePolling(() => {
    setRefreshing(true);
    return load(true).finally(() => setRefreshing(false));
  }, 4000, state === 'ready' && open);

  if (state === 'loading') {
    return (
      <Shell>
        <Spinner label="Finding your order" />
      </Shell>
    );
  }

  if (state === 'error' || !order) {
    return (
      <Shell>
        <ErrorState
          title="Order not found"
          message={message || 'That tracking link is not valid.'}
          onRetry={() => void load()}
        />
      </Shell>
    );
  }

  const index = flowIndex(order.status);
  const rejected = order.status === 'rejected' || order.status === 'cancelled';

  return (
    <Shell>
      <div className="mx-auto max-w-2xl px-6 pb-24">
        {/* Headline */}
        <div className="pt-10 text-center">
          <div className="mx-auto mb-6 h-px w-16 bg-baby" />
          <p className="text-xs uppercase tracking-[0.24em] text-charcoal">
            Order #{order.number}
          </p>
          <h1 className="mt-4 font-display text-4xl leading-tight sm:text-5xl">
            {STATUS_LABEL[order.status]}
          </h1>
          <p className="mx-auto mt-4 max-w-md text-[15px] leading-relaxed text-charcoal">
            {STATUS_HINT[order.status]}
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
            <span className="text-xs text-charcoal">
              {order.type === 'dine_in'
                ? `Table ${order.table_label ?? '—'}`
                : 'Pickup at the counter'}
            </span>
          </div>

          {order.status !== 'rejected' && order.status !== 'cancelled' && (
            <div className="mt-5 inline-flex flex-wrap items-center justify-center gap-x-3 gap-y-1 rounded-full border border-baby bg-white/70 px-4 py-2">
              <span className="text-[10px] uppercase tracking-[0.18em] text-charcoal">
                {order.payment_status === 'paid'
                  ? 'Payment received'
                  : order.payment_status === 'pending'
                    ? 'Payment in progress'
                    : 'Not paid yet'}
              </span>
              {order.payment_status !== 'paid' && (
                <Link
                  to={`/pay/${token}`}
                  className="text-[10px] uppercase tracking-[0.18em] text-ink underline underline-offset-4 transition hover:text-plum"
                >
                  {order.payment_status === 'pending' ? 'View payment' : 'Pay with Telebirr, CBE or cash'}
                </Link>
              )}
            </div>
          )}
        </div>

        {/* Timeline */}
        {!rejected && (
          <div className="mt-12 rounded-3xl border border-baby bg-blush p-6 sm:p-8">
            <ol className="space-y-0">
              {FLOW.map((step, stepIndex) => {
                const done = index >= stepIndex && index !== -1;
                const current = index === stepIndex;
                return (
                  <li key={step} className="flex gap-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border text-[10px] ${
                          done
                            ? 'border-ink bg-ink text-paper'
                            : 'border-baby bg-paper text-charcoal'
                        }`}
                        aria-hidden="true"
                      >
                        {done ? '✓' : stepIndex + 1}
                      </span>
                      {stepIndex < FLOW.length - 1 && (
                        <span
                          className={`my-1 w-px flex-1 ${
                            index > stepIndex ? 'bg-ink' : 'bg-baby'
                          }`}
                        />
                      )}
                    </div>
                    <div className={`pb-6 ${current ? '' : 'opacity-70'}`}>
                      <p
                        className={`text-sm ${
                          current ? 'font-medium text-ink' : 'text-charcoal'
                        }`}
                      >
                        {STATUS_LABEL[step]}
                      </p>
                      {current && open && (
                        <p className="mt-1 text-xs text-charcoal">
                          Current status — updates appear here automatically.
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        {rejected && (
          <div className="mt-12 rounded-3xl border border-rose/50 bg-blush p-6 text-center">
            <p className="text-sm leading-relaxed text-charcoal">
              {order.status === 'rejected'
                ? 'The restaurant could not take this order. If you have already paid at the counter, please speak to a member of staff.'
                : 'This order was cancelled.'}
            </p>
          </div>
        )}

        {/* Items */}
        <section className="mt-12">
          <div className="flex items-baseline justify-between">
            <h2 className="text-xs uppercase tracking-[0.24em] text-charcoal">
              What you ordered
            </h2>
            {refreshing && <span className="text-xs text-charcoal">updating…</span>}
          </div>

          <ul className="mt-4 border-t border-baby">
            {order.items.map((line, position) => (
              <li
                key={`${line.name}-${position}`}
                className="flex items-start justify-between gap-6 border-b border-baby py-4"
              >
                <span className="text-[15px]">
                  <span className="mr-2 tabular-nums text-charcoal">
                    {line.quantity}×
                  </span>
                  {line.name}
                </span>
                <span className="tabular-nums text-charcoal">
                  {formatMinor(line.line_total_minor, order.currency)}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-[0.2em] text-charcoal">
              Total
            </span>
            <span className="font-display text-3xl tabular-nums">
              {formatMinor(order.total_minor, order.currency)}
            </span>
          </div>

          {order.customer_note && (
            <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm text-charcoal">
              Your note: “{order.customer_note}”
            </p>
          )}
        </section>

        {/* History */}
        {events.length > 0 && (
          <section className="mt-12">
            <h2 className="text-xs uppercase tracking-[0.24em] text-charcoal">
              History
            </h2>
            <ul className="mt-4 space-y-3">
              {events.map((event, position) => (
                <li
                  key={`${event.created_at}-${position}`}
                  className="flex items-baseline justify-between gap-4 text-sm"
                >
                  <span className="text-charcoal">
                    {event.from_status
                      ? `${STATUS_LABEL[event.from_status]} → ${STATUS_LABEL[event.to_status]}`
                      : STATUS_LABEL[event.to_status]}
                  </span>
                  <span className="shrink-0 text-xs text-charcoal/80">
                    {new Date(event.created_at).toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-14 text-center">
          <Link
            to="/menu"
            className="rounded-full border border-ink px-7 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:bg-ink hover:text-paper"
          >
            Back to the menu
          </Link>
          <p className="mt-4 text-xs text-charcoal/80">
            {open
              ? 'Keep this page open — it refreshes on its own while your order is in progress.'
              : 'This order is finished. Thank you — we hope to see you again soon.'}
          </p>
        </div>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-baby px-6 py-5 sm:px-10">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <Link to="/" aria-label="hun. home">
            <Wordmark className="text-2xl" />
          </Link>
          <Link to="/dashboard" className="text-sm text-charcoal transition hover:text-ink">
            Staff
          </Link>
        </div>
      </header>
      {children}
    </div>
  );
}
