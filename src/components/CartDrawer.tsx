import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../cart/CartContext';
import { formatMinor } from '../lib/money';
import { Minus, Plus } from './ui';

export default function CartDrawer({
  open,
  onClose,
  currency,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
}) {
  const { lines, subtotalMinor, setQuantity, count } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close cart"
        onClick={onClose}
        className="absolute inset-0 bg-plum/45 backdrop-blur-[2px] fade-in"
      />

      <aside className="relative flex h-full w-full max-w-md flex-col bg-paper shadow-2xl rise-in">
        <header className="flex items-center justify-between border-b border-baby px-6 py-5">
          <div>
            <p className="text-[10px] uppercase tracking-[0.26em] text-gold">Your order</p>
            <p className="mt-1 font-display text-2xl">
              {count} {count === 1 ? 'item' : 'items'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-baby px-4 py-2 text-[11px] uppercase tracking-[0.16em] text-charcoal transition hover:border-ink hover:text-ink"
          >
            Close
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-6">
          {lines.length === 0 ? (
            <div className="py-16 text-center">
              <p className="font-display text-2xl">Nothing here yet</p>
              <p className="mt-2 text-sm text-charcoal">
                Add something lovely from the menu.
              </p>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  navigate('/menu');
                }}
                className="mt-6 rounded-full border border-ink px-6 py-2.5 text-[11px] uppercase tracking-[0.16em] transition hover:bg-ink hover:text-paper"
              >
                Browse the menu
              </button>
            </div>
          ) : (
            <ul>
              {lines.map((line) => (
                <li
                  key={line.menuItem.id}
                  className="flex items-start justify-between gap-4 border-b border-baby py-5"
                >
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-snug">{line.menuItem.name}</p>
                    <p className="mt-1 text-[13px] text-charcoal">
                      {formatMinor(line.menuItem.price_minor, currency)} each
                    </p>
                    <div className="mt-3 inline-flex items-center rounded-full border border-baby">
                      <button
                        type="button"
                        aria-label={`Remove one ${line.menuItem.name}`}
                        onClick={() => setQuantity(line.menuItem.id, line.quantity - 1)}
                        className="grid h-8 w-8 place-items-center text-charcoal transition hover:text-ink"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-8 text-center text-[13px] tabular-nums">
                        {line.quantity}
                      </span>
                      <button
                        type="button"
                        aria-label={`Add one ${line.menuItem.name}`}
                        onClick={() => setQuantity(line.menuItem.id, line.quantity + 1)}
                        className="grid h-8 w-8 place-items-center text-charcoal transition hover:text-ink"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="font-display text-lg tabular-nums">
                    {formatMinor(line.menuItem.price_minor * line.quantity, currency)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <footer className="border-t border-baby px-6 py-6">
          <div className="flex items-baseline justify-between">
            <span className="text-[10px] uppercase tracking-[0.26em] text-charcoal">
              Subtotal
            </span>
            <span className="font-display text-2xl tabular-nums">
              {formatMinor(subtotalMinor, currency)}
            </span>
          </div>
          <p className="mt-1 text-[11px] uppercase tracking-[0.14em] text-charcoal/70">
            Telebirr · CBE Birr · bank · cash
          </p>
          <button
            type="button"
            disabled={lines.length === 0}
            onClick={() => {
              onClose();
              navigate('/checkout');
            }}
            className="mt-5 w-full rounded-full bg-ink px-6 py-4 text-[12px] font-medium uppercase tracking-[0.18em] text-paper transition hover:bg-plum disabled:cursor-not-allowed disabled:opacity-30"
          >
            Continue to checkout
          </button>
        </footer>
      </aside>
    </div>
  );
}
