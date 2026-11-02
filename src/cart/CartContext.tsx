import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartLine, MenuItem } from '../lib/types';

interface CartValue {
  lines: CartLine[];
  count: number;
  subtotalMinor: number;
  currency: string;
  add: (menuItem: MenuItem, quantity?: number) => void;
  setQuantity: (menuItemId: string, quantity: number) => void;
  remove: (menuItemId: string) => void;
  clear: () => void;
}

const CartContext = createContext<CartValue | null>(null);

export function CartProvider({
  children,
  currency = 'ETB',
}: {
  children: ReactNode;
  currency?: string;
}) {
  const [lines, setLines] = useState<CartLine[]>([]);

  const add = useCallback((menuItem: MenuItem, quantity = 1) => {
    setLines((current) => {
      const existing = current.find((l) => l.menuItem.id === menuItem.id);
      if (existing) {
        return current.map((l) =>
          l.menuItem.id === menuItem.id
            ? { ...l, quantity: Math.min(99, l.quantity + quantity) }
            : l,
        );
      }
      return [...current, { menuItem, quantity }];
    });
  }, []);

  const setQuantity = useCallback((menuItemId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((l) => l.menuItem.id !== menuItemId)
        : current.map((l) =>
            l.menuItem.id === menuItemId
              ? { ...l, quantity: Math.min(99, quantity) }
              : l,
          ),
    );
  }, []);

  const remove = useCallback((menuItemId: string) => {
    setLines((current) => current.filter((l) => l.menuItem.id !== menuItemId));
  }, []);

  const clear = useCallback(() => setLines([]), []);

  const value = useMemo<CartValue>(() => {
    const subtotalMinor = lines.reduce(
      (sum, l) => sum + l.menuItem.price_minor * l.quantity,
      0,
    );
    const count = lines.reduce((sum, l) => sum + l.quantity, 0);
    return { lines, count, subtotalMinor, currency, add, setQuantity, remove, clear };
  }, [lines, currency, add, setQuantity, remove, clear]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used inside CartProvider');
  return ctx;
}
