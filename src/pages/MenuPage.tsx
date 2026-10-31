import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import {
  ErrorState,
  Minus,
  Plus,
  SectionLabel,
  SiteFooter,
  SiteHeader,
  Spinner,
} from '../components/ui';
import { useCart } from '../cart/CartContext';
import { AppError, fetchMenu, friendlyMessage, type MenuBundle } from '../lib/api';
import { formatMinor } from '../lib/money';

type LoadState = 'loading' | 'ready' | 'error';

export default function MenuPage() {
  const { lines, count, subtotalMinor, add, setQuantity, currency } = useCart();
  const [bundle, setBundle] = useState<MenuBundle | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [message, setMessage] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setState('loading');
    try {
      const next = await fetchMenu();
      setBundle(next);
      setState('ready');
    } catch (error) {
      setMessage(
        error instanceof AppError
          ? friendlyMessage(error.code)
          : 'The menu could not be loaded.',
      );
      setState('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grouped = useMemo(() => {
    if (!bundle) return [];
    return bundle.categories
      .map((category) => ({
        category,
        items: bundle.items.filter((item) => item.category_id === category.id),
      }))
      .filter((group) => group.items.length > 0);
  }, [bundle]);

  const quantityOf = (menuItemId: string) =>
    lines.find((line) => line.menuItem.id === menuItemId)?.quantity ?? 0;

  const orderingOpen =
    bundle?.restaurant.status === 'active' && bundle.restaurant.ordering_enabled;

  return (
    <div className="min-h-screen bg-paper pb-28">
      <SiteHeader />

      {state === 'loading' && <Spinner label="Setting the table" />}

      {state === 'error' && (
        <ErrorState
          title="The menu did not load"
          message={message}
          onRetry={() => void load()}
        />
      )}

      {state === 'ready' && bundle && (
        <>
          {/* Editorial header */}
          <section className="relative overflow-hidden border-b border-baby bg-[#fdf4f0]">
            <div className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.2fr_0.8fr]">
              <div>
                <SectionLabel>Bole · Addis Ababa</SectionLabel>
                <h1 className="mt-5 font-display text-[clamp(2.6rem,6vw,4.4rem)]">
                  {bundle.restaurant.name}
                </h1>
                <p className="mt-4 max-w-lg text-[15px] leading-[1.8] text-charcoal">
                  {bundle.restaurant.tagline}
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-x-6 gap-y-2 text-[11px] uppercase tracking-[0.2em] text-charcoal">
                  <span>Open 7:30 — 20:00</span>
                  <span className="text-gold">·</span>
                  <span>Pickup or dine-in</span>
                  <span className="text-gold">·</span>
                  <span>Paid in Birr</span>
                </div>

                {!orderingOpen && (
                  <p className="mt-7 inline-block rounded-full bg-ink px-5 py-2.5 text-[11px] uppercase tracking-[0.16em] text-paper">
                    Ordering is closed right now
                  </p>
                )}
              </div>

              <div className="hidden h-[260px] overflow-hidden rounded-t-full rounded-b-[28px] lg:block">
                <img
                  src="/images/img-31.jpg"
                  alt="A black coffee in a glass cup, sunlight across the table"
                  className="h-full w-full object-cover"
                />
              </div>
            </div>
          </section>

          {/* Category rail */}
          <nav className="sticky top-[69px] z-20 border-b border-baby bg-paper/95 backdrop-blur-md">
            <div className="no-scrollbar mx-auto flex max-w-6xl gap-2 overflow-x-auto px-5 py-3 sm:px-8">
              {grouped.map(({ category }) => (
                <a
                  key={category.id}
                  href={`#cat-${category.id}`}
                  className="whitespace-nowrap rounded-full border border-baby px-4 py-2 text-[11px] uppercase tracking-[0.14em] text-charcoal transition hover:border-ink hover:text-ink"
                >
                  {category.name}
                </a>
              ))}
            </div>
          </nav>

          <main className="mx-auto max-w-6xl px-5 sm:px-8">
            {grouped.length === 0 && (
              <div className="py-24 text-center">
                <h2 className="font-display text-3xl">The menu is being written</h2>
                <p className="mt-3 text-sm text-charcoal">
                  No categories have been published yet.
                </p>
              </div>
            )}

            {grouped.map(({ category, items }, index) => (
              <section key={category.id} id={`cat-${category.id}`} className="scroll-mt-40 pt-14">
                <div className="grid gap-6 border-t border-baby pt-10 md:grid-cols-[240px_1fr] md:gap-12">
                  <div>
                    <div className="h-[180px] overflow-hidden rounded-t-full rounded-b-[20px] bg-blush md:h-[220px]">
                      {category.image_url && (
                        <img
                          src={category.image_url}
                          alt={category.name}
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </div>
                    <p className="mt-4 text-[10px] uppercase tracking-[0.3em] text-gold">
                      0{index + 1}
                    </p>
                    <h2 className="mt-2 font-display text-[30px] leading-tight">
                      {category.name}
                    </h2>
                    {category.tagline && (
                      <p className="mt-2 text-[13px] leading-relaxed text-charcoal">
                        {category.tagline}
                      </p>
                    )}
                  </div>

                  <ul>
                    {items.map((item) => {
                      const quantity = quantityOf(item.id);
                      const soldOut = !item.available;
                      return (
                        <li
                          key={item.id}
                          className="flex items-start justify-between gap-5 border-b border-baby py-6 first:pt-0 sm:gap-8"
                        >
                          <div className="max-w-xl">
                            <div className="flex flex-wrap items-baseline gap-3">
                              <h3 className="font-display text-[21px] leading-snug">
                                {item.name}
                              </h3>
                              {item.featured && (
                                <span className="rounded-full bg-blush px-2.5 py-0.5 text-[9px] uppercase tracking-[0.18em] text-plum">
                                  Most loved
                                </span>
                              )}
                              {soldOut && (
                                <span className="rounded-full border border-rose/60 px-2 py-0.5 text-[10px] uppercase tracking-[0.14em] text-charcoal">
                                  Sold out
                                </span>
                              )}
                            </div>
                            {item.description && (
                              <p className="mt-2 text-[13px] leading-relaxed text-charcoal">
                                {item.description}
                              </p>
                            )}
                          </div>

                          <div className="flex shrink-0 flex-col items-end gap-3">
                            <span className="font-display text-lg tabular-nums">
                              {formatMinor(item.price_minor, currency)}
                            </span>

                            {soldOut ? (
                              <span className="text-[10px] uppercase tracking-[0.18em] text-charcoal/60">
                                Unavailable
                              </span>
                            ) : quantity === 0 ? (
                              <button
                                type="button"
                                onClick={() => add(item)}
                                className="rounded-full border border-ink px-5 py-2 text-[11px] uppercase tracking-[0.16em] text-ink transition hover:bg-ink hover:text-paper"
                              >
                                Add
                              </button>
                            ) : (
                              <div className="inline-flex items-center rounded-full bg-ink text-paper">
                                <button
                                  type="button"
                                  aria-label={`Remove one ${item.name}`}
                                  onClick={() => setQuantity(item.id, quantity - 1)}
                                  className="grid h-9 w-9 place-items-center transition hover:opacity-70"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </button>
                                <span className="w-6 text-center text-[13px] tabular-nums">
                                  {quantity}
                                </span>
                                <button
                                  type="button"
                                  aria-label={`Add one ${item.name}`}
                                  onClick={() => setQuantity(item.id, quantity + 1)}
                                  className="grid h-9 w-9 place-items-center transition hover:opacity-70"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </section>
            ))}

            <div className="mt-16 rounded-3xl border border-baby bg-blush/60 p-8 text-center">
              <p className="text-[10px] uppercase tracking-[0.32em] text-gold">
                Ordering hours
              </p>
              <p className="mt-3 font-display text-2xl">
                Kitchen closes at 19:45. Coffee keeps going.
              </p>
              <p className="mt-2 text-[13px] text-charcoal">
                Paid with Telebirr, CBE Birr, your bank or at the counter.
              </p>
            </div>
          </main>

          <div className="mt-16">
            <SiteFooter />
          </div>
        </>
      )}

      {/* Floating cart bar */}
      {count > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-baby bg-paper/95 px-5 py-4 backdrop-blur-md sm:px-8">
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
            <div className="text-sm text-charcoal">
              <span className="font-medium text-ink">
                {count} {count === 1 ? 'item' : 'items'}
              </span>
              <span className="mx-2 text-gold">·</span>
              <span className="tabular-nums">{formatMinor(subtotalMinor, currency)}</span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setDrawerOpen(true)}
                className="rounded-full border border-ink/25 px-5 py-2.5 text-[11px] uppercase tracking-[0.16em] transition hover:bg-blush"
              >
                View order
              </button>
              <Link
                to="/checkout"
                className="rounded-full bg-ink px-6 py-2.5 text-[11px] uppercase tracking-[0.16em] text-paper transition hover:bg-plum"
              >
                Checkout
              </Link>
            </div>
          </div>
        </div>
      )}

      <CartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} currency={currency} />
    </div>
  );
}
