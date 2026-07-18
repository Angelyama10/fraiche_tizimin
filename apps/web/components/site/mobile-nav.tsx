'use client';

import { Heart, Home, Search, ShoppingBag, UserRound } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCart } from '@/providers/cart-provider';

export function MobileNav({ onOpenSearch }: { onOpenSearch: () => void }) {
  const pathname = usePathname();
  const { cart, setDrawerOpen } = useCart();

  return (
    <nav className="mobileNav" aria-label="Accesos rápidos">
      <Link className={pathname === '/' ? 'isActive' : ''} href="/">
        <Home aria-hidden="true" size={20} />
        <span>Inicio</span>
      </Link>
      <button onClick={onOpenSearch} type="button">
        <Search aria-hidden="true" size={20} />
        <span>Buscar</span>
      </button>
      <Link className={pathname.includes('favoritos') ? 'isActive' : ''} href="/cuenta?tab=favoritos">
        <Heart aria-hidden="true" size={20} />
        <span>Favoritos</span>
      </Link>
      <button className="mobileNav__cart" onClick={() => setDrawerOpen(true)} type="button">
        <ShoppingBag aria-hidden="true" size={20} />
        {(cart?.itemCount ?? 0) > 0 && <b>{cart?.itemCount}</b>}
        <span>Carrito</span>
      </button>
      <Link className={pathname.startsWith('/cuenta') ? 'isActive' : ''} href="/cuenta">
        <UserRound aria-hidden="true" size={20} />
        <span>Cuenta</span>
      </Link>
    </nav>
  );
}
