import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import type { Session } from '@supabase/supabase-js';
import { EmptyState, ErrorState, Spinner, StatusPill, Wordmark, inputClass } from '../components/ui';
import { usePolling } from '../hooks/usePolling';
import {
  AppError,
  confirmPayment,
  fetchOrders,
  fetchStaffDaySummary,
  fetchStaffMenu,
  fetchStaffPayments,
  fetchStaffProfile,
  friendlyMessage,
  signOut,
  updateMenuItem,
  updateOrderStatus,
} from '../lib/api';
import { formatMinor } from '../lib/money';
import { STATUS_LABEL, STATUS_SHORT, isTerminal } from '../lib/status';
import { supabase } from '../lib/supabase';
import type {
  Order,
  OrderStatus,
  StaffDaySummary,
  StaffMenuItem,
  StaffPayment,
  StaffProfile,
} from '../lib/types';

type Phase = 'loading' | 'ready' | 'error';
type Tab = 'orders' | 'menu';

const ACTIVE: readonly OrderStatus[] = ['placed', 'accepted', 'preparing', 'ready'];

export default function DashboardPage() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [profilePhase, setProfilePhase] = useState<Phase>('loading');
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersPhase, setOrdersPhase] = useState<Phase>('loading');
  const [payments, setPayments] = useState<StaffPayment[]>([]);
  const [paymentBusy, setPaymentBusy] = useState<string | null>(null);
  const [declineTarget, setDeclineTarget] = useState<string | null>(null);
  const [declineDraft, setDeclineDraft] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('orders');
  const [summary, setSummary] = useState<StaffDaySummary | null>(null);
  const [menu, setMenu] = useState<StaffMenuItem[]>([]);
  const [menuPhase, setMenuPhase] = useState<Phase>('loading');
  const [menuBusy, setMenuBusy] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState<{ id: string; value: string } | null>(null);
  const [reasonDraft, setReasonDraft] = useState('');
  const [reasonTarget, setReasonTarget] = useState<{
    order: Order;
    next: OrderStatus;
  } | null>(null);

  // --- session -------------------------------------------------------------
  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) setSession(data.session ?? null);
    });
    const { data: subscription } = supabase.auth.onAuthStateChange(
      (_event, next) => setSession(next),
    );
    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  // --- staff profile -------------------------------------------------------
  const loadProfile = useCallback(async () => {
    if (!session) return;
    setProfilePhase('loading');
    try {
      const next = await fetchStaffProfile(session.user.id);
      setProfile(next);
      setProfilePhase('ready');
    } catch {
      setProfile(null);
      setProfilePhase('error');
    }
  }, [session]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // --- order queue ---------------------------------------------------------
  const restaurantId = profile?.restaurant_id ?? null;

  const refresh = useCallback(
    async (silent = false) => {
      if (!restaurantId) return;
      if (!silent) setOrdersPhase('loading');
      try {
        const [next, openPayments, today] = await Promise.all([
          fetchOrders(restaurantId),
          fetchStaffPayments(true).catch(() => [] as StaffPayment[]),
          fetchStaffDaySummary().catch(() => null),
        ]);
        setOrders(next);
        setPayments(openPayments);
        setSummary(today);
        setOrdersPhase('ready');
      } catch {
        if (!silent) setOrdersPhase('error');
      }
    },
    [restaurantId],
  );

  // --- menu ----------------------------------------------------------------
  const loadMenu = useCallback(async () => {
    setMenuPhase('loading');
    try {
      setMenu(await fetchStaffMenu());
      setMenuPhase('ready');
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
      setMenuPhase('error');
    }
  }, []);

  useEffect(() => {
    if (tab === 'menu' && menuPhase !== 'ready') void loadMenu();
  }, [tab, menuPhase, loadMenu]);

  async function saveMenuItem(
    item: StaffMenuItem,
    change: { available?: boolean; featured?: boolean; priceMinor?: number },
  ) {
    setMenuBusy(item.id);
    setBanner(null);
    try {
      const updated = await updateMenuItem({ itemId: item.id, ...change });
      setMenu((current) =>
        current.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
      );
      setPriceDraft(null);
      await refresh(true);
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
    } finally {
      setMenuBusy(null);
    }
  }

  usePolling(() => refresh(true), 5000, Boolean(restaurantId));

  const activeOrders = useMemo(
    () =>
      orders
        .filter((order) => ACTIVE.includes(order.status))
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    [orders],
  );

  const doneOrders = useMemo(
    () =>
      orders
        .filter((order) => isTerminal(order.status))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 24),
    [orders],
  );

  // --- status changes ------------------------------------------------------
  async function applyStatus(order: Order, next: OrderStatus, reason?: string) {
    setBusyId(order.id);
    setBanner(null);
    try {
      const updated = await updateOrderStatus({
        orderId: order.id,
        expectedVersion: order.version,
        nextStatus: next,
        reason: reason ?? null,
      });
      setOrders((current) =>
        current.map((existing) =>
          existing.id === updated.id ? { ...existing, ...updated } : existing,
        ),
      );
      setReasonTarget(null);
      setReasonDraft('');
    } catch (caught) {
      const code = caught instanceof AppError ? caught.code : 'UNKNOWN';
      setBanner(friendlyMessage(code));
      // Version conflicts and rejected transitions both mean our copy is stale.
      await refresh(true);
    } finally {
      setBusyId(null);
    }
  }

  // --- payment verification ------------------------------------------------
  async function settlePayment(
    payment: StaffPayment,
    action: 'confirm' | 'decline',
    reason?: string,
  ) {
    setPaymentBusy(payment.id);
    setBanner(null);
    try {
      await confirmPayment({ paymentId: payment.id, action, reason: reason ?? null });
      setDeclineTarget(null);
      setDeclineDraft('');
      await refresh(true);
    } catch (caught) {
      setBanner(friendlyMessage(caught instanceof AppError ? caught.code : 'UNKNOWN'));
      await refresh(true);
    } finally {
      setPaymentBusy(null);
    }
  }

  // --- gate ----------------------------------------------------------------
  if (session === undefined) {
    return (
      <div className="min-h-screen bg-paper">
        <Spinner label="Checking your session" />
      </div>
    );
  }

  if (session === null) return <Navigate to="/signin" replace />;

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-20 border-b border-baby bg-paper/95 px-5 py-4 backdrop-blur sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex items-baseline gap-4">
            <Link to="/" aria-label="hun. menu">
              <Wordmark className="text-2xl" />
            </Link>
            <span className="hidden text-xs uppercase tracking-[0.24em] text-charcoal sm:inline">
              Order queue
            </span>
          </div>
          <div className="flex items-center gap-4">
            <span className="hidden text-xs text-charcoal sm:inline">
              {profile?.display_name} · {profile?.role}
            </span>
            <button
              type="button"
              onClick={() => {
                void signOut().then(() => setSession(null));
              }}
              className="rounded-full border border-baby px-4 py-2 text-xs transition hover:border-ink"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-5 pb-24 pt-8 sm:px-8">
        {profilePhase === 'loading' && <Spinner label="Loading your station" />}

        {profilePhase === 'error' && (
          <ErrorState
            title="This account has no station"
            message="Your user is not linked to a restaurant yet. Ask an owner to add you as staff, then try again."
            onRetry={() => void loadProfile()}
          />
        )}

        {profilePhase === 'ready' && profile && (
          <>
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.24em] text-charcoal">
                  {profile.restaurants?.name ?? 'hun.'}
                </p>
                <h1 className="mt-2 font-display text-4xl sm:text-5xl">
                  {tab === 'menu'
                    ? 'The menu.'
                    : activeOrders.length === 0
                      ? 'All clear.'
                      : `${activeOrders.length} in the kitchen`}
                </h1>
              </div>
              <button
                type="button"
                onClick={() => void refresh()}
                className="rounded-full border border-baby px-5 py-2.5 text-xs transition hover:border-ink"
              >
                Refresh now
              </button>
            </div>

            <div className="mt-7 flex gap-2 border-b border-baby">
              {(
                [
                  { id: 'orders', label: 'Orders & payments' },
                  { id: 'menu', label: 'Menu & prices' },
                ] as Array<{ id: Tab; label: string }>
              ).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`-mb-px border-b-2 px-1 pb-3 text-[12px] uppercase tracking-[0.18em] transition ${
                    tab === item.id
                      ? 'border-ink text-ink'
                      : 'border-transparent text-charcoal hover:text-ink'
                  }`}
                  style={{ marginRight: 20 }}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {summary && (
              <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 rounded-3xl border border-baby bg-blush/40 px-5 py-4 sm:grid-cols-4">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.22em] text-charcoal">
                    Orders today
                  </dt>
                  <dd className="mt-1 font-display text-2xl tabular-nums">
                    {summary.orders_today}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.22em] text-charcoal">
                    Collected
                  </dt>
                  <dd className="mt-1 font-display text-2xl tabular-nums">
                    {formatMinor(summary.revenue_minor, 'ETB')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.22em] text-charcoal">
                    To verify
                  </dt>
                  <dd className="mt-1 font-display text-2xl tabular-nums">
                    {summary.payments_to_verify}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.22em] text-charcoal">
                    Selling most
                  </dt>
                  <dd className="mt-1 truncate text-[13px] leading-6 text-ink">
                    {summary.top_item ?? '—'}
                  </dd>
                </div>
              </dl>
            )}

            {banner && (
              <p
                role="alert"
                className="mt-6 rounded-xl border border-rose/50 bg-blush px-4 py-3 text-sm"
              >
                {banner}
              </p>
            )}

            {tab === 'menu' && (
              <MenuPanel
                items={menu}
                phase={menuPhase}
                busyId={menuBusy}
                priceDraft={priceDraft}
                currency="ETB"
                onRetry={() => void loadMenu()}
                onPriceDraft={setPriceDraft}
                onToggle={(item, available) => void saveMenuItem(item, { available })}
                onFeature={(item, featured) => void saveMenuItem(item, { featured })}
                onSavePrice={(item, value) =>
                  void saveMenuItem(item, { priceMinor: Math.round(value * 100) })
                }
              />
            )}

            {tab === 'orders' && (
              <>
            {/* Payments waiting for a human to look at the transaction */}
            {payments.length > 0 && (
              <section className="mt-8 rounded-3xl border border-gold/30 bg-[#fdf7f1] p-5 sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.28em] text-gold">
                      Payments to verify
                    </p>
                    <h2 className="mt-2 font-display text-2xl">
                      {payments.length} {payments.length === 1 ? 'transfer' : 'transfers'} waiting
                    </h2>
                  </div>
                  <p className="max-w-xs text-[11px] leading-relaxed text-charcoal">
                    Check the transaction number against the café account before
                    accepting. Nothing reaches the kitchen until you do.
                  </p>
                </div>

                <ul className="mt-5 space-y-3">
                  {payments.map((payment) => (
                    <li
                      key={payment.id}
                      className="rounded-2xl border border-baby bg-white p-4"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2.5">
                          <span className="grid h-8 w-8 place-items-center rounded-full bg-blush font-display text-[11px] text-plum">
                            {payment.method_short}
                          </span>
                          <div>
                            <p className="text-[13px] text-ink">
                              {payment.method_label} · #{payment.order_number}
                            </p>
                            <p className="text-[11px] text-charcoal">
                              {payment.customer_name} · {ago(payment.created_at)}
                            </p>
                          </div>
                        </div>
                        <p className="font-display text-xl tabular-nums">
                          {formatMinor(payment.amount_minor, payment.currency)}
                        </p>
                      </div>

                      <dl className="mt-3 grid gap-x-6 gap-y-1.5 border-t border-baby pt-3 text-[12px] sm:grid-cols-2">
                        <div className="flex justify-between gap-3">
                          <dt className="text-charcoal">Reference</dt>
                          <dd className="font-mono text-ink">{payment.reference}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-charcoal">Transaction</dt>
                          <dd className="font-mono text-ink">
                            {payment.transaction_ref ?? '—'}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-charcoal">Payer</dt>
                          <dd className="text-ink">{payment.payer_name ?? '—'}</dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-charcoal">Phone</dt>
                          <dd className="text-ink">{payment.payer_phone ?? '—'}</dd>
                        </div>
                      </dl>

                      {declineTarget === payment.id ? (
                        <div className="mt-3 rounded-xl border border-baby bg-blush/60 p-3">
                          <label className="block text-[10px] uppercase tracking-[0.18em] text-charcoal">
                            Why can't this be matched?
                          </label>
                          <textarea
                            className={`${inputClass} mt-2 min-h-[64px] resize-y`}
                            value={declineDraft}
                            onChange={(event) => setDeclineDraft(event.target.value)}
                            placeholder="No transfer found, amount short, wrong reference…"
                            maxLength={300}
                            autoFocus
                          />
                          <div className="mt-2 flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setDeclineTarget(null);
                                setDeclineDraft('');
                              }}
                              className="rounded-full px-4 py-2 text-[11px] text-charcoal transition hover:text-ink"
                            >
                              Keep waiting
                            </button>
                            <button
                              type="button"
                              disabled={paymentBusy === payment.id || !declineDraft.trim()}
                              onClick={() =>
                                void settlePayment(payment, 'decline', declineDraft.trim())
                              }
                              className="rounded-full bg-ink px-5 py-2 text-[11px] text-paper transition hover:bg-plum disabled:opacity-50"
                            >
                              Decline
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={paymentBusy === payment.id}
                            onClick={() => void settlePayment(payment, 'confirm')}
                            className="rounded-full bg-ink px-5 py-2 text-[11px] uppercase tracking-[0.12em] text-paper transition hover:bg-plum disabled:cursor-wait disabled:opacity-60"
                          >
                            {paymentBusy === payment.id ? 'Saving…' : 'Payment received'}
                          </button>
                          <button
                            type="button"
                            disabled={paymentBusy === payment.id}
                            onClick={() => {
                              setDeclineTarget(payment.id);
                              setDeclineDraft('');
                            }}
                            className="rounded-full border border-baby px-5 py-2 text-[11px] uppercase tracking-[0.12em] text-charcoal transition hover:border-ink hover:text-ink disabled:opacity-50"
                          >
                            Can't find it
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* Active queue */}
            <section className="mt-8">
              {ordersPhase === 'loading' && orders.length === 0 && (
                <Spinner label="Fetching orders" />
              )}

              {ordersPhase === 'error' && (
                <ErrorState
                  title="The queue could not load"
                  message="We could not reach the kitchen display. Check the connection and try again."
                  onRetry={() => void refresh()}
                />
              )}

              {ordersPhase === 'ready' && activeOrders.length === 0 && (
                <EmptyState
                  title="Nothing waiting"
                  message="New orders appear here the moment they are placed. This page refreshes itself every few seconds."
                />
              )}

              <div className="space-y-4">
                {activeOrders.map((order) => (
                  <OrderCard
                    key={order.id}
                    order={order}
                    busy={busyId === order.id}
                    reasonTarget={
                      reasonTarget?.order.id === order.id ? reasonTarget : null
                    }
                    reasonDraft={reasonDraft}
                    onReasonChange={setReasonDraft}
                    onReasonCancel={() => {
                      setReasonTarget(null);
                      setReasonDraft('');
                    }}
                    onReasonConfirm={() => {
                      if (!reasonTarget) return;
                      if (!reasonDraft.trim()) return;
                      void applyStatus(
                        reasonTarget.order,
                        reasonTarget.next,
                        reasonDraft.trim(),
                      );
                    }}
                    onAccept={(order) => void applyStatus(order, 'accepted')}
                    onPreparing={(order) => void applyStatus(order, 'preparing')}
                    onReady={(order) => void applyStatus(order, 'ready')}
                    onComplete={(order) => void applyStatus(order, 'completed')}
                    onDanger={(order, next) => {
                      setReasonTarget({ order, next });
                      setReasonDraft('');
                    }}
                  />
                ))}
              </div>
            </section>

            {/* Recently finished */}
            {doneOrders.length > 0 && (
              <section className="mt-14">
                <h2 className="text-xs uppercase tracking-[0.24em] text-charcoal">
                  Finished today
                </h2>
                <ul className="mt-4 overflow-hidden rounded-2xl border border-baby">
                  {doneOrders.map((order) => (
                    <li
                      key={order.id}
                      className="flex items-center justify-between gap-4 border-b border-baby bg-blush/40 px-4 py-3 text-sm last:border-0"
                    >
                      <span className="flex items-center gap-3">
                        <span className="tabular-nums text-charcoal">
                          #{order.number}
                        </span>
                        <span>{order.customer_name}</span>
                        <span className="hidden text-charcoal sm:inline">
                          {order.type === 'dine_in'
                            ? `Table ${order.table_label ?? '—'}`
                            : 'Pickup'}
                        </span>
                      </span>
                      <span className="flex items-center gap-4">
                        <span className="tabular-nums text-charcoal">
                          {formatMinor(order.total_minor, order.currency)}
                        </span>
                        <StatusPill
                          status={order.status}
                          label={STATUS_SHORT[order.status]}
                        />
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Menu management
// ---------------------------------------------------------------------------

function MenuPanel({
  items,
  phase,
  busyId,
  priceDraft,
  currency,
  onRetry,
  onPriceDraft,
  onToggle,
  onFeature,
  onSavePrice,
}: {
  items: StaffMenuItem[];
  phase: Phase;
  busyId: string | null;
  priceDraft: { id: string; value: string } | null;
  currency: string;
  onRetry: () => void;
  onPriceDraft: (draft: { id: string; value: string } | null) => void;
  onToggle: (item: StaffMenuItem, available: boolean) => void;
  onFeature: (item: StaffMenuItem, featured: boolean) => void;
  onSavePrice: (item: StaffMenuItem, value: number) => void;
}) {
  if (phase === 'loading' && items.length === 0) {
    return <Spinner label="Fetching the menu" />;
  }

  if (phase === 'error' && items.length === 0) {
    return (
      <ErrorState
        title="The menu could not load"
        message="Check the connection and try again. If this is a fresh database, apply the migrations in supabase/migrations first."
        onRetry={onRetry}
      />
    );
  }

  const groups: Array<{ category: string; rows: StaffMenuItem[] }> = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.category === item.category) last.rows.push(item);
    else groups.push({ category: item.category, rows: [item] });
  }

  const offCount = items.filter((item) => !item.available).length;

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] uppercase tracking-[0.28em] text-gold">Menu</p>
          <h2 className="mt-2 font-display text-2xl">
            {items.length} {items.length === 1 ? 'item' : 'items'}
            {offCount > 0 && (
              <span className="text-charcoal"> · {offCount} off</span>
            )}
          </h2>
        </div>
        <p className="max-w-sm text-[11px] leading-relaxed text-charcoal">
          Switch an item off the moment it runs out — the customer menu follows
          straight away. Prices are in Birr.
        </p>
      </div>

      <div className="mt-6 space-y-8">
        {groups.map((group) => (
          <div key={group.category}>
            <h3 className="text-[11px] uppercase tracking-[0.24em] text-charcoal">
              {group.category}
            </h3>

            <ul className="mt-3 overflow-hidden rounded-2xl border border-baby bg-white">
              {group.rows.map((item) => {
                const busy = busyId === item.id;
                const editing = priceDraft?.id === item.id;

                return (
                  <li
                    key={item.id}
                    className="flex flex-wrap items-center gap-4 border-b border-baby px-4 py-3 last:border-0"
                  >
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-blush">
                      {item.image_url && (
                        <img
                          src={item.image_url}
                          alt=""
                          loading="lazy"
                          className={`h-full w-full object-cover ${item.available ? '' : 'opacity-40'}`}
                        />
                      )}
                    </div>

                    <div className="min-w-[140px] flex-1">
                      <p className={item.available ? 'text-sm' : 'text-sm text-charcoal'}>
                        {item.name}
                      </p>
                      <p className="text-[11px] text-charcoal">
                        {item.featured ? 'Featured on the home page' : '‎'}
                      </p>
                    </div>

                    {editing ? (
                      <form
                        onSubmit={(event) => {
                          event.preventDefault();
                          const value = Number(priceDraft.value);
                          if (!Number.isFinite(value) || value <= 0) return;
                          onSavePrice(item, value);
                        }}
                        className="flex items-center gap-2"
                      >
                        <input
                          type="number"
                          step="0.01"
                          min="1"
                          autoFocus
                          value={priceDraft.value}
                          onChange={(event) =>
                            onPriceDraft({ id: item.id, value: event.target.value })
                          }
                          className={`${inputClass} w-24 py-1.5 text-right text-sm tabular-nums`}
                        />
                        <button
                          type="submit"
                          disabled={busy}
                          className="rounded-full bg-ink px-3 py-1.5 text-[11px] text-paper transition hover:bg-plum disabled:opacity-50"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => onPriceDraft(null)}
                          className="text-[11px] text-charcoal transition hover:text-ink"
                        >
                          Cancel
                        </button>
                      </form>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          onPriceDraft({
                            id: item.id,
                            value: (item.price_minor / 100).toFixed(2),
                          })
                        }
                        className="rounded-full border border-baby px-3 py-1.5 text-sm tabular-nums transition hover:border-ink"
                        title="Change the price"
                      >
                        {formatMinor(item.price_minor, currency)}
                      </button>
                    )}

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onFeature(item, !item.featured)}
                        aria-pressed={item.featured}
                        className={`rounded-full border px-3 py-1.5 text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                          item.featured
                            ? 'border-gold bg-blush text-plum'
                            : 'border-baby text-charcoal hover:border-ink hover:text-ink'
                        }`}
                      >
                        Featured
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => onToggle(item, !item.available)}
                        aria-pressed={item.available}
                        className={`rounded-full px-4 py-1.5 text-[10px] uppercase tracking-[0.12em] transition disabled:opacity-50 ${
                          item.available
                            ? 'bg-ink text-paper hover:bg-plum'
                            : 'border border-rose/60 text-charcoal hover:border-ink hover:text-ink'
                        }`}
                      >
                        {busy ? 'Saving…' : item.available ? 'On the menu' : 'Off — sold out'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

function OrderCard({
  order,
  busy,
  reasonTarget,
  reasonDraft,
  onReasonChange,
  onReasonCancel,
  onReasonConfirm,
  onAccept,
  onPreparing,
  onReady,
  onComplete,
  onDanger,
}: {
  order: Order;
  busy: boolean;
  reasonTarget: { order: Order; next: OrderStatus } | null;
  reasonDraft: string;
  onReasonChange: (value: string) => void;
  onReasonCancel: () => void;
  onReasonConfirm: () => void;
  onAccept: (order: Order) => void;
  onPreparing: (order: Order) => void;
  onReady: (order: Order) => void;
  onComplete: (order: Order) => void;
  onDanger: (order: Order, next: OrderStatus) => void;
}) {
  const showReason = reasonTarget?.order.id === order.id;

  return (
    <article className="rounded-3xl border border-baby bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-display text-2xl tabular-nums">#{order.number}</span>
          <StatusPill status={order.status} label={STATUS_LABEL[order.status]} />
          <PaymentBadge status={order.payment_status} />
          <span className="text-xs text-charcoal">{ago(order.created_at)}</span>
        </div>
        <div className="text-right text-sm">
          <p className="font-medium">
            {order.type === 'dine_in'
              ? `Table ${order.table_label ?? '—'}`
              : 'Pickup'}
          </p>
          <p className="text-charcoal">{order.customer_name}</p>
        </div>
      </div>

      <ul className="mt-4 space-y-1.5 border-t border-baby pt-4 text-sm">
        {order.items.map((line, position) => (
          <li key={`${line.name}-${position}`} className="flex justify-between gap-4">
            <span>
              <span className="mr-2 tabular-nums text-charcoal">{line.quantity}×</span>
              {line.name}
            </span>
            <span className="tabular-nums text-charcoal">
              {formatMinor(line.line_total_minor, order.currency)}
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-baseline justify-between border-t border-baby pt-3">
        <span className="text-xs uppercase tracking-[0.2em] text-charcoal">Total</span>
        <span className="font-display text-2xl tabular-nums">
          {formatMinor(order.total_minor, order.currency)}
        </span>
      </div>

      {order.customer_note && (
        <p className="mt-4 rounded-2xl bg-blush px-4 py-3 text-sm text-ink">
          “{order.customer_note}”
        </p>
      )}

      {showReason ? (
        <div className="mt-5 rounded-2xl border border-baby bg-blush p-4">
          <label className="block text-xs uppercase tracking-[0.18em] text-charcoal">
            Reason for {STATUS_LABEL[reasonTarget!.next].toLowerCase()}
          </label>
          <textarea
            className={`${inputClass} mt-2 min-h-[72px] resize-y`}
            value={reasonDraft}
            onChange={(event) => onReasonChange(event.target.value)}
            placeholder="Sold out, kitchen closing, duplicate order…"
            maxLength={300}
            autoFocus
          />
          <div className="mt-3 flex justify-end gap-3">
            <button
              type="button"
              onClick={onReasonCancel}
              className="rounded-full px-4 py-2 text-xs text-charcoal transition hover:text-ink"
            >
              Keep order
            </button>
            <button
              type="button"
              onClick={onReasonConfirm}
              disabled={busy || !reasonDraft.trim()}
              className="rounded-full bg-ink px-5 py-2 text-xs font-medium text-paper transition hover:opacity-85 disabled:opacity-50"
            >
              {busy ? 'Saving…' : 'Confirm'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap gap-2">
          {order.status === 'placed' && (
            <ActionButton onClick={() => onAccept(order)} busy={busy}>
              Accept order
            </ActionButton>
          )}
          {order.status === 'accepted' && (
            <ActionButton onClick={() => onPreparing(order)} busy={busy}>
              Start preparing
            </ActionButton>
          )}
          {order.status === 'preparing' && (
            <ActionButton onClick={() => onReady(order)} busy={busy}>
              Mark ready
            </ActionButton>
          )}
          {order.status === 'ready' && (
            <ActionButton onClick={() => onComplete(order)} busy={busy}>
              Hand over · done
            </ActionButton>
          )}

          {(order.status === 'placed' || order.status === 'accepted') && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDanger(order, 'cancelled')}
              className="rounded-full border border-baby px-5 py-2.5 text-xs text-charcoal transition hover:border-ink hover:text-ink disabled:opacity-50"
            >
              Cancel
            </button>
          )}
          {order.status === 'placed' && (
            <button
              type="button"
              disabled={busy}
              onClick={() => onDanger(order, 'rejected')}
              className="rounded-full border border-rose/60 px-5 py-2.5 text-xs text-charcoal transition hover:border-ink hover:text-ink disabled:opacity-50"
            >
              Reject
            </button>
          )}
        </div>
      )}
    </article>
  );
}

function PaymentBadge({ status }: { status: Order['payment_status'] }) {
  const label =
    status === 'paid' ? 'Paid' : status === 'pending' ? 'Payment pending' : 'Unpaid';
  const tone =
    status === 'paid'
      ? 'bg-ink text-paper'
      : status === 'pending'
        ? 'bg-baby text-ink'
        : 'border border-rose/50 text-charcoal';

  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[10px] uppercase tracking-[0.12em] ${tone}`}>
      {label}
    </span>
  );
}

function ActionButton({
  children,
  onClick,
  busy,
}: {
  children: React.ReactNode;
  onClick: () => void;
  busy: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="rounded-full bg-ink px-6 py-2.5 text-xs font-medium text-paper transition hover:opacity-85 disabled:cursor-wait disabled:opacity-60"
    >
      {busy ? 'Saving…' : children}
    </button>
  );
}

function ago(iso: string): string {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - new Date(iso).getTime()) / 60_000),
  );
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return new Date(iso).toLocaleDateString([], { month: 'short', day: 'numeric' });
}
