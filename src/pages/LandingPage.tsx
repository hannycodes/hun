import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CartDrawer from '../components/CartDrawer';
import { ArrowRight, SectionLabel, SiteFooter, SiteHeader } from '../components/ui';
import { useCart } from '../cart/CartContext';
import { fetchMenu, type MenuBundle } from '../lib/api';
import { formatMinor } from '../lib/money';

const BANNER = [
  'Ethiopian coffee',
  'Baked goods',
  'Addis Ababa',
  'Priced fairly',
  'Since 2026',
  'Pickup or dine in',
];

export default function LandingPage() {
  const { count, subtotalMinor, currency, add } = useCart();
  const [bundle, setBundle] = useState<MenuBundle | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setBundle(await fetchMenu());
    } catch {
      // The landing page is content-led: if the menu is unreachable the page
      // still reads, and the ordering links lead to the menu's own error state.
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured = useMemo(
    () => (bundle?.items ?? []).filter((item) => item.featured && item.available).slice(0, 3),
    [bundle],
  );

  return (
    <div className="min-h-screen bg-paper">
      <SiteHeader floating />

      {/* ------------------------------------------------------------------ */}
      {/* Hero                                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="relative overflow-hidden bg-[#fdf4f0]">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-40 top-10 h-[520px] w-[520px] rounded-full bg-baby/70 blur-3xl"
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-24 bottom-0 h-[420px] w-[420px] rounded-full bg-blush blur-2xl"
        />

        {/* The photograph and the text share one row, so the image ends
            exactly on the hairline that closes the hero. */}
        <div className="relative mx-auto max-w-6xl px-5 pt-24 sm:px-8 lg:pt-24">
          <div className="grid items-stretch gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
            <div className="rise-in flex flex-col justify-center pb-2">
              <SectionLabel>Addis Ababa · Since 2026</SectionLabel>

              <h1 className="mt-6 font-display text-[clamp(2.7rem,6.4vw,4.9rem)] leading-[1.02] text-ink">
                A café with
                <br />
                <span className="display-italic text-plum">a beautiful view.</span>
              </h1>

              <p className="mt-6 max-w-md text-[15px] leading-[1.75] text-charcoal">
                A small café in Addis Ababa, opened in 2026 by Hanan Seid. An addictive coffee with a side of sweet or sour treats based on your likes.
              </p>

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  to="/menu"
                  className="inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum"
                >
                  See the menu
                  <ArrowRight className="h-3.5 w-3.5" />
                </Link>
                <a
                  href="#story"
                  className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-7 py-3.5 text-[12px] font-medium uppercase tracking-[0.18em] text-ink transition hover:border-ink hover:bg-white/60"
                >
                  Read our story
                </a>
              </div>
            </div>

            <div className="relative rise-in h-[240px] overflow-hidden rounded-t-full rounded-b-[32px] border border-white/60 shadow-[0_30px_80px_-46px_rgba(36,26,32,0.5)] sm:h-[340px] lg:h-auto lg:min-h-[430px]">
              <img
                src="/images/hero.jpg"
                alt="A marble table by the café window with a cappuccino, a croissant and a book in the morning light"
                className="absolute inset-0 h-full w-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-plum/25 via-transparent to-transparent" />
              <div className="absolute left-5 top-6 hidden text-[10px] uppercase tracking-[0.36em] text-black/90 drop-shadow sm:block">
                Bole · Addis Ababa
              </div>
            </div>
          </div>

          <dl className="mt-0 flex flex-wrap gap-x-10 gap-y-5 border-t border-ink/12 pt-6 pb-14">
            {[
              { label: 'Open daily', value: '7:30 — 20:00' },
              { label: 'Service', value: 'Pickup & dine-in' },
              { label: 'Address', value: 'Addis Ababa' },
            ].map((item) => (
              <div key={item.label}>
                <dt className="text-[10px] uppercase tracking-[0.26em] text-gold">
                  {item.label}
                </dt>
                <dd className="mt-1.5 text-[13px] tracking-wide text-ink">
                  {item.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      {/* Marquee */}
      <div className="overflow-hidden border-y border-plum/10 bg-baby py-3.5">
        <div className="marquee-track flex w-max items-center gap-8 whitespace-nowrap">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center gap-8" aria-hidden={copy === 1}>
              {BANNER.map((word) => (
                <span
                  key={`${copy}-${word}`}
                  className="flex items-center gap-8 text-[11px] uppercase tracking-[0.32em] text-plum"
                >
                  {word}
                  <span className="text-gold">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Signature                                                          */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div className="max-w-xl">
            <SectionLabel>What we are known for</SectionLabel>
          </div>
          <Link
            to="/menu"
            className="group inline-flex items-center gap-2 border-b border-ink/20 pb-1 text-[11px] uppercase tracking-[0.22em] text-charcoal transition hover:border-ink hover:text-ink"
          >
            The whole menu
            <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
          </Link>
        </div>

        {featured.length > 0 && (
          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {featured.map((item, index) => (
              <article key={item.id} className="group">
                <div className="relative h-[300px] overflow-hidden rounded-[26px] bg-blush">
                  {item.image_url && (
                    <img
                      src={item.image_url}
                      alt={item.name}
                      loading="lazy"
                      className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.04]"
                    />
                  )}
                  <span className="absolute left-4 top-4 grid h-8 w-8 place-items-center rounded-full bg-paper/90 font-display text-sm text-plum">
                    0{index + 1}
                  </span>
                </div>

                <div className="mt-5 flex items-baseline justify-between gap-4">
                  <h3 className="font-display text-[22px] leading-tight">{item.name}</h3>
                  <span className="shrink-0 font-display text-lg tabular-nums">
                    {formatMinor(item.price_minor, currency)}
                  </span>
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-charcoal">
                  {item.description}
                </p>

                <button
                  type="button"
                  onClick={() => add(item)}
                  className="mt-4 inline-flex items-center gap-2 rounded-full border border-ink/20 px-5 py-2 text-[11px] uppercase tracking-[0.16em] transition hover:border-ink hover:bg-blush"
                >
                  Add to order
                </button>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Story                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section id="story" className="scroll-mt-24 bg-blush/60 py-20 sm:py-28">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 sm:px-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="relative">
            <div className="overflow-hidden rounded-t-full rounded-b-[28px]">
              <img
                src="/images/img-33.jpg"
                alt="Two coffees with latte art on a wooden table, surrounded by monstera leaves"
                loading="lazy"
                className="h-[420px] w-full object-cover sm:h-[520px]"
              />
            </div>
            <div className="absolute -bottom-8 -right-2 hidden w-[190px] overflow-hidden rounded-2xl border-[6px] border-paper sm:block">
              <img
                src="/images/img-11.jpg"
                alt="A croissant dusted with icing sugar"
                loading="lazy"
                className="h-[180px] w-full object-cover"
              />
            </div>
          </div>

          <div>
            <SectionLabel>Our story</SectionLabel>
            <div className="mt-7 space-y-4 text-[15px] leading-[1.8] text-charcoal">
              <p>
                I opened hun. in 2026 after years of café  hunting and not finding one that actually matches me and as a student i wanted to be able to enjoy my food and also study there.
              </p>
              <p>
                So this is a small café i created for people like me that would love to make it a comfortable and safe space to gather their thoughts and be able to actually work in that environment.
              </p>
            </div>

            <div className="mt-9 border-l border-gold/50 pl-6">
              <p className="display-italic text-2xl leading-snug text-plum">
                “I wanted a place where i can sit and relax and enjoy my mornings and evenings.”
              </p>
              <p className="mt-3 text-[11px] uppercase tracking-[0.28em] text-charcoal">
                Hanan Seid — founder
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Gallery                                                            */}
      {/* ------------------------------------------------------------------ */}
      <section id="room" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-20 sm:px-8 sm:py-24">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <SectionLabel>The room &amp; the plates</SectionLabel>
          </div>
          
        </div>

        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
          <figure className="relative col-span-2 row-span-2 overflow-hidden rounded-[26px]">
            <img
              src="/images/img-25.jpg"
              alt="The café window at night, warm bulbs lit inside and a table set by the glass"
              loading="lazy"
              className="h-full min-h-[320px] w-full object-cover md:min-h-[460px]"
            />
            <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/70 to-transparent px-5 pb-4 pt-10 text-[10px] uppercase tracking-[0.28em] text-paper">
              The room, after six
            </figcaption>
          </figure>
          <figure className="overflow-hidden rounded-[22px]">
            <img
              src="/images/img-36.jpg"
              alt="Eight macchiatos on a round wooden table"
              loading="lazy"
              className="h-[160px] w-full object-cover sm:h-[222px]"
            />
          </figure>
          <figure className="overflow-hidden rounded-[22px]">
            <img
              src="/images/img-24.jpg"
              alt="The pastry case: croissants, morning buns and cake"
              loading="lazy"
              className="h-[160px] w-full object-cover sm:h-[222px]"
            />
          </figure>
          <figure className="overflow-hidden rounded-[22px]">
            <img
              src="/images/chechebsa.jpg"
              alt="Chechebsa: shredded kita warmed in berbere butter, in a dark clay dish"
              loading="lazy"
              className="h-[160px] w-full object-cover sm:h-[222px]"
            />
          </figure>
          <figure className="overflow-hidden rounded-[22px]">
            <img
              src="/images/tibs.jpg"
              alt="Beef tibs in a clay pot with rolled injera"
              loading="lazy"
              className="h-[160px] w-full object-cover sm:h-[222px]"
            />
          </figure>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Visit                                                              */}
      {/* ------------------------------------------------------------------ */}
      <section id="visit" className="scroll-mt-24 py-20 sm:py-24">
        <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1fr_1fr] lg:gap-16">
          <div className="order-2 overflow-hidden rounded-[26px] lg:order-1">
            <img
              src="/images/img-07.jpg"
              alt="The café counter beneath a glowing CAFE sign"
              loading="lazy"
              className="h-[380px] w-full object-cover sm:h-[440px]"
            />
          </div>

          <div className="order-1 lg:order-2">
            <SectionLabel>Visit</SectionLabel>
            
            <p className="mt-5 max-w-md text-[15px] leading-[1.8] text-charcoal">
              We are open everyday from 7:30am to 8:00pm, and serve pickup and dine-in.
            </p>

            <dl className="mt-8 divide-y divide-baby border-y border-baby text-sm">
              {[
                { term: 'Address', detail: 'Addis Ababa' },
                { term: 'Monday – Friday', detail: '7:30 — 20:00' },
                { term: 'Saturday – Sunday', detail: '8:00 — 21:00' },
                { term: 'Reservations', detail: '+251 904665110 · hello@hun.com' },
              ].map((row) => (
                <div key={row.term} className="flex flex-wrap justify-between gap-2 py-3.5">
                  <dt className="text-[11px] uppercase tracking-[0.2em] text-charcoal">
                    {row.term}
                  </dt>
                  <dd className="text-right text-[13px] text-ink">{row.detail}</dd>
                </div>
              ))}
            </dl>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="https://maps.google.com/?q=Addis+Ababa"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-full border border-ink/25 px-6 py-3 text-[11px] uppercase tracking-[0.18em] transition hover:border-ink hover:bg-blush"
              >
                Get directions
                <ArrowRight className="h-3.5 w-3.5" />
              </a>
              <Link
                to="/menu"
                className="inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[11px] uppercase tracking-[0.18em] text-paper transition hover:bg-plum"
              >
                Order for pickup
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Closing band — light, so the dark footer lands with weight */}
      <section className="relative overflow-hidden bg-baby/70 px-5 py-20 text-center sm:px-8 sm:py-24">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -left-20 -top-24 h-64 w-64 rounded-full bg-paper/60 blur-3xl"
        />
        <p className="text-[10px] uppercase tracking-[0.4em] text-charcoal/70">hun. café</p>
        <h2 className="mx-auto mt-6 max-w-2xl font-display text-[clamp(2.1rem,5vw,3.6rem)] text-ink">
          Come for a good time.
          <br />
          <span className="display-italic text-plum">Stay for seconds.</span>
        </h2>
        <Link
          to="/menu"
          className="mt-9 inline-flex items-center gap-2 rounded-full bg-ink px-8 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum"
        >
          Start an order
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
        <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-charcoal/70">
          Pickup · Dine-in · Priced fairly
        </p>
      </section>

      <SiteFooter className={count > 0 ? 'pb-24' : ''} />

      {/* Cart bar */}
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
