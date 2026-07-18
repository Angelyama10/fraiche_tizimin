'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import type { Cart } from '@/lib/types';
import { useAuth } from './auth-provider';
import { useNotify } from './notification-provider';

type CartContextValue = {
  cart: Cart | null;
  loading: boolean;
  mutating: boolean;
  drawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  refreshCart: () => Promise<void>;
  resetCart: () => void;
};

const CartContext = createContext<CartContextValue | null>(null);
const CART_KEY = 'fraiche_cart_token';

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [loading, setLoading] = useState(true);
  const [mutating, setMutating] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const cartRef = useRef<Cart | null>(null);
  const ensurePromise = useRef<Promise<Cart> | null>(null);
  const claimedKey = useRef<string | null>(null);
  const auth = useAuth();
  const notify = useNotify();

  const storeCart = useCallback((next: Cart) => {
    cartRef.current = next;
    setCart(next);
    localStorage.setItem(CART_KEY, next.publicToken);
    return next;
  }, []);

  const createCart = useCallback(async () => {
    const created = await apiRequest<Cart>('/carts', { method: 'POST' });
    return storeCart(created);
  }, [storeCart]);

  const ensureCart = useCallback(async () => {
    if (cartRef.current?.status === 'ACTIVE') return cartRef.current;
    if (ensurePromise.current) return ensurePromise.current;

    ensurePromise.current = (async () => {
      const token = localStorage.getItem(CART_KEY);
      if (token) {
        try {
          const existing = await apiRequest<Cart>(`/carts/${token}`, { cache: 'no-store' });
          if (existing.status === 'ACTIVE') return storeCart(existing);
        } catch {
          localStorage.removeItem(CART_KEY);
        }
      }
      return createCart();
    })();

    try {
      return await ensurePromise.current;
    } finally {
      ensurePromise.current = null;
    }
  }, [createCart, storeCart]);

  useEffect(() => {
    void ensureCart()
      .catch((error) => {
        notify({ title: 'Carrito no disponible', description: errorMessage(error), tone: 'error' });
      })
      .finally(() => setLoading(false));
  }, [ensureCart, notify]);

  useEffect(() => {
    const token = cart?.publicToken;
    const customerId = auth.customer?.id;
    if (auth.status !== 'authenticated' || !token || !customerId) return;
    const key = `${customerId}:${token}`;
    if (claimedKey.current === key) return;
    claimedKey.current = key;
    void auth.request(`/customers/me/carts/${token}/claim`, { method: 'POST' }).catch(() => {
      claimedKey.current = null;
    });
  }, [auth, cart?.publicToken]);

  const mutate = useCallback(
    async (operation: (activeCart: Cart) => Promise<Cart>) => {
      setMutating(true);
      try {
        const activeCart = await ensureCart();
        return storeCart(await operation(activeCart));
      } finally {
        setMutating(false);
      }
    },
    [ensureCart, storeCart],
  );

  const addItem = useCallback(
    async (variantId: string, quantity = 1) => {
      try {
        await mutate((activeCart) =>
          apiRequest<Cart>(`/carts/${activeCart.publicToken}/items`, {
            method: 'POST',
            body: JSON.stringify({ variantId, quantity }),
          }),
        );
        setDrawerOpen(true);
        notify({ title: 'Añadido a tu selección', description: 'Tu carrito se actualizó al instante.', tone: 'success' });
      } catch (error) {
        notify({ title: 'No pudimos agregarlo', description: errorMessage(error), tone: 'error' });
        throw error;
      }
    },
    [mutate, notify],
  );

  const updateItem = useCallback(
    async (itemId: string, quantity: number) => {
      try {
        await mutate((activeCart) =>
          apiRequest<Cart>(`/carts/${activeCart.publicToken}/items/${itemId}`, {
            method: 'PATCH',
            body: JSON.stringify({ quantity }),
          }),
        );
      } catch (error) {
        notify({ title: 'No pudimos cambiar la cantidad', description: errorMessage(error), tone: 'error' });
      }
    },
    [mutate, notify],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      try {
        await mutate((activeCart) =>
          apiRequest<Cart>(`/carts/${activeCart.publicToken}/items/${itemId}`, { method: 'DELETE' }),
        );
      } catch (error) {
        notify({ title: 'No pudimos retirar el producto', description: errorMessage(error), tone: 'error' });
      }
    },
    [mutate, notify],
  );

  const refreshCart = useCallback(async () => {
    const activeCart = await ensureCart();
    storeCart(await apiRequest<Cart>(`/carts/${activeCart.publicToken}`, { cache: 'no-store' }));
  }, [ensureCart, storeCart]);

  const resetCart = useCallback(() => {
    localStorage.removeItem(CART_KEY);
    cartRef.current = null;
    setCart(null);
    claimedKey.current = null;
  }, []);

  const value = useMemo<CartContextValue>(
    () => ({
      cart,
      loading,
      mutating,
      drawerOpen,
      setDrawerOpen,
      addItem,
      updateItem,
      removeItem,
      refreshCart,
      resetCart,
    }),
    [cart, loading, mutating, drawerOpen, addItem, updateItem, removeItem, refreshCart, resetCart],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart debe utilizarse dentro de CartProvider.');
  return context;
}
