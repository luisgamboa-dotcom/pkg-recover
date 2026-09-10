import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

export interface CartItem {
  lotId: string;
  qty: number;
}

interface CartState {
  items: CartItem[];
  count: number;
  add: (lotId: string, qty?: number) => void;
  setQty: (lotId: string, qty: number) => void;
  remove: (lotId: string) => void;
  clear: () => void;
}

const KEY = 'rp-cart-v1';
const CartContext = createContext<CartState | null>(null);

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartItem[];
    return parsed.filter((i) => i.lotId && i.qty > 0);
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(load);

  useEffect(() => {
    localStorage.setItem(KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<CartState>(() => {
    const count = items.reduce((a, i) => a + i.qty, 0);
    return {
      items,
      count,
      add: (lotId, qty = 1) =>
        setItems((prev) => {
          const found = prev.find((i) => i.lotId === lotId);
          if (found)
            return prev.map((i) =>
              i.lotId === lotId ? { ...i, qty: i.qty + qty } : i,
            );
          return [...prev, { lotId, qty }];
        }),
      setQty: (lotId, qty) =>
        setItems((prev) =>
          qty <= 0
            ? prev.filter((i) => i.lotId !== lotId)
            : prev.map((i) => (i.lotId === lotId ? { ...i, qty } : i)),
        ),
      remove: (lotId) => setItems((prev) => prev.filter((i) => i.lotId !== lotId)),
      clear: () => setItems([]),
    };
  }, [items]);

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartState {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de <CartProvider>');
  return ctx;
}
