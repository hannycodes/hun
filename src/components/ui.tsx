import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useCart } from '../cart/CartContext';

/** Wordmark — lowercase, with the full stop (docs/brand.md). */
export function Wordmark({ className = 'text-2xl' }: { className?: string }) {
  return (
    <span className={`font-display leading-none tracking-[-0.045em] ${className}`}>
      hun<span className="text-rose">.</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

export const btnPrimary =
  'inline-flex items-center justify-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.14em] text-paper transition hover:bg-plum disabled:cursor-wait disabled:opacity-55';

export const btnOutline =
  'inline-flex items-center justify-center gap-2 rounded-full border border-ink/25 px-7 py-3.5 text-[13px] font-medium uppercase tracking-[0.14em] text-ink transition hover:border-ink hover:bg-blush disabled:opacity-45';

export const btnQuiet =
  'inline-flex items-center justify-center gap-2 rounded-full border border-baby px-5 py-2.5 text-[12px] text-charcoal transition hover:border-ink hover:text-ink disabled:opacity-45';

// ---------------------------------------------------------------------------
// Structure
// ---------------------------------------------------------------------------

/** Small gold rule above a section label. */
export function Rule({ className = '' }: { className?: string }) {
  return <span className={`block h-px w-10 bg-gold/70 ${className}`} />;
}

export function SectionLabel({
  children,
  className = '',
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={`flex items-center gap-3 text-[11px] font-medium uppercase tracking-[0.32em] text-charcoal ${className}`}>
      <Rule />
      {children}
    </p>
  );
}

/** Arch-cropped photograph — the brand's signature shape. */
export function ArchImage({
  src,
  alt,
  className = '',
  priority = false,
}: {
  src: string;
  alt: string;
  className?: string;
  priority?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      loading={priority ? 'eager' : 'lazy'}
      className={`arch h-full w-full object-cover ${className}`}
    />
  );
}

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-charcoal">
      <span
        className="h-4 w-4 animate-spin rounded-full border border-baby border-t-ink"
        aria-hidden="true"
      />
      <span className="text-[13px] tracking-wide">{label}</span>
    </div>
  );
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <Rule className="mx-auto mb-7" />
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-charcoal">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className={`mt-8 ${btnPrimary}`}>
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <Rule className="mx-auto mb-7" />
      <h2 className="font-display text-3xl">{title}</h2>
      <p className="mt-3 text-sm leading-relaxed text-charcoal">{message}</p>
      {action && <div className="mt-8">{action}</div>}
    </div>
  );
}

export function StatusPill({ status, label }: { status: string; label: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${toneFor(status)}`}
    >
      {label}
    </span>
  );
}

export function toneFor(status: string): string {
  switch (status) {
    case 'placed':
      return 'bg-ink text-paper';
    case 'accepted':
    case 'preparing':
      return 'bg-blush text-ink';
    case 'ready':
      return 'bg-baby text-ink';
    case 'completed':
      return 'border border-baby text-charcoal';
    case 'rejected':
    case 'cancelled':
      return 'border border-rose/60 text-charcoal';
    default:
      return 'bg-blush text-ink';
  }
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-baseline justify-between text-[11px] uppercase tracking-[0.2em] text-charcoal">
        {label}
        {hint && <span className="normal-case tracking-normal text-charcoal/70">{hint}</span>}
      </span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full rounded-xl border border-baby bg-white px-4 py-3 text-[15px] text-ink placeholder:text-charcoal/45 transition focus:border-ink focus:outline-none';

// ---------------------------------------------------------------------------
// Public site chrome
// ---------------------------------------------------------------------------

const NAV = [
  { to: '/menu', label: 'Menu' },
  { to: '/#story', label: 'Our story' },
  { to: '/#room', label: 'The room' },
  { to: '/#visit', label: 'Visit' },
];

export function SiteHeader({ floating = false }: { floating?: boolean }) {
  const { count } = useCart();

  return (
    <header
      className={`z-40 border-b border-baby/70 ${
        floating ? 'absolute inset-x-0 top-0 border-transparent bg-transparent' : 'sticky top-0 bg-paper/92 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8">
        <Link to="/" aria-label="hun. home" className="text-ink">
          <Wordmark className="text-[26px]" />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.label}
              to={item.to}
              className="text-[12px] uppercase tracking-[0.2em] text-charcoal transition hover:text-ink"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link to="/menu" className="relative rounded-full border border-ink/20 px-4 py-2 text-[11px] uppercase tracking-[0.18em] transition hover:border-ink">
            Cart
            {count > 0 && (
              <span className="ml-2 rounded-full bg-ink px-1.5 py-0.5 text-[10px] text-paper">
                {count}
              </span>
            )}
          </Link>
          <Link
            to="/menu"
            className="hidden items-center gap-2 rounded-full bg-ink px-5 py-2.5 text-[11px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum sm:inline-flex"
          >
            Order
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </header>
  );
}

/**
 * The footer is the darkest surface on the page, so the section above it can
 * stay light. Shared by every public page.
 */
export function SiteFooter() {
  return (
    <footer className="bg-plum text-paper">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:px-8 md:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Wordmark className="text-3xl" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-baby/85">
            A café on Bole Road, Addis Ababa. Coffee, chechebsa and pastry, made
            here since 2026.
          </p>
          <p className="mt-6 text-[11px] uppercase tracking-[0.28em] text-baby/60">
            Opened by Hanan Seid
          </p>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-baby/60">Visit</p>
          <ul className="mt-4 space-y-2 text-sm text-baby/85">
            <li>Bole Road, Addis Ababa</li>
            <li>Mon – Sun · 7:30 – 20:00</li>
            <li>hello@hun.cafe</li>
            <li>+251 91 000 0000</li>
          </ul>
        </div>

        <div>
          <p className="text-[11px] uppercase tracking-[0.3em] text-baby/60">The café</p>
          <ul className="mt-4 space-y-2 text-sm">
            <li>
              <Link to="/menu" className="text-baby/85 transition hover:text-paper">
                Menu & ordering
              </Link>
            </li>
            <li>
              <NavLink to="/signin" className="text-baby/85 transition hover:text-paper">
                Staff sign in
              </NavLink>
            </li>
            <li>
              <a href="https://t.me/hun.cafe" className="text-baby/85 transition hover:text-paper">
                Telegram
              </a>
            </li>
            <li>
              <a href="https://instagram.com/hun.cafe" className="text-baby/85 transition hover:text-paper">
                Instagram
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="mx-auto flex max-w-6xl flex-col gap-2 border-t border-paper/15 px-5 py-6 text-[11px] uppercase tracking-[0.2em] text-baby/55 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <span>© {new Date().getFullYear()} hun. café · Addis Ababa</span>
        <span>Prices in Ethiopian Birr · All taxes included</span>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// Icons — hairline strokes, no fill, so they sit quietly next to the type.
// ---------------------------------------------------------------------------

function svgProps(className: string) {
  return {
    className,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.4,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
  };
}

export function ArrowRight({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 12h15" />
      <path d="M13 6l6 6-6 6" />
    </svg>
  );
}

export function Plus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

export function Minus({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M5 12h14" />
    </svg>
  );
}

export function Check({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M4 12.5l5 5L20 6.5" />
    </svg>
  );
}

export function Bag({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <path d="M5 8h14l-1 12H6L5 8Z" />
      <path d="M9 8V6a3 3 0 0 1 6 0v2" />
    </svg>
  );
}

export function Copy({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <svg {...svgProps(className)}>
      <rect x="9" y="9" width="11" height="11" rx="2" />
      <path d="M15 5H6a1 1 0 0 0-1 1v9" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Payment marks — text-only, so no third-party logo files are needed.
// ---------------------------------------------------------------------------

export function PaymentMark({
  label,
  short,
  className = '',
}: {
  label: string;
  short: string;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border border-baby bg-white px-3 py-1.5 ${className}`}
      title={label}
    >
      <span className="grid h-5 w-5 place-items-center rounded-full bg-blush font-display text-[10px] text-plum">
        {short}
      </span>
      <span className="text-[11px] uppercase tracking-[0.12em] text-charcoal">{label}</span>
    </span>
  );
}
