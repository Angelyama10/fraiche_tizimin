'use client';

import {
  ChevronDown,
  Heart,
  Menu,
  Search,
  ShoppingBag,
  UserRound,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';

const navItems = [
  { href: '/productos', label: 'Perfumes' },
  { href: '/productos?line=PERSONAL_CARE', label: 'Cuidado personal' },
  { href: '/promociones', label: 'Promociones' },
  { href: '/pedidos-especiales', label: 'Pedidos especiales' },
  { href: '/#nosotros', label: 'Nosotros' },
];

const perfumeLinks = [
  { href: '/productos?line=DESIGNER_CLASSIC', label: 'Diseñador clásico', note: '60 ml · concentración clásica' },
  { href: '/productos?line=DESIGNER_37', label: 'Diseñador 37%', note: 'Mayor intensidad y duración' },
  { href: '/productos?line=NEECHE_PASSION', label: 'Neeche Passion', note: '60 ml · $350 MXN' },
  { href: '/productos?line=PREMIUM', label: 'Premium', note: 'Nicho y árabes · $380 MXN' },
];

export function SiteHeader({ onOpenSearch }: { onOpenSearch: () => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const { customer } = useAuth();
  const { cart, setDrawerOpen } = useCart();

  return (
    <>
      <div className="announcementBar">
        <p>Envíos a todo México</p>
        <span aria-hidden="true" />
        <p>Atención cercana desde Tizimín</p>
      </div>
      <header className="siteHeader">
        <div className="siteHeader__inner">
          <button
            aria-label="Abrir menú"
            className="iconButton siteHeader__menuButton"
            onClick={() => setMenuOpen(true)}
            title="Menú"
            type="button"
          >
            <Menu aria-hidden="true" size={22} />
          </button>

          <Link className="brandMark" href="/" aria-label="Fraîche Tizimín, inicio">
            <span className="brandMark__monogram">F</span>
            <span>
              <strong>Fraîche</strong>
              <small>Tizimín</small>
            </span>
          </Link>

          <nav className="desktopNav" aria-label="Navegación principal">
            <div className="desktopNav__dropdown">
              <Link className={pathname === '/productos' ? 'isActive' : ''} href="/productos">
                Perfumes <ChevronDown aria-hidden="true" size={14} />
              </Link>
              <div className="desktopNav__menu">
                <div>
                  <span className="menuEyebrow">Explora por línea</span>
                  {perfumeLinks.map((item) => (
                    <Link href={item.href} key={item.href}>
                      <strong>{item.label}</strong>
                      <small>{item.note}</small>
                    </Link>
                  ))}
                </div>
                <Link className="desktopNav__feature" href="/productos?featured=true">
                  <span>Nuestra selección</span>
                  <strong>Los aromas que todos quieren</strong>
                  <small>Ver destacados</small>
                </Link>
              </div>
            </div>
            {navItems.slice(1).map((item) => (
              <Link href={item.href} key={item.href}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="headerActions">
            <button
              aria-label="Buscar"
              className="iconButton"
              onClick={onOpenSearch}
              title="Buscar"
              type="button"
            >
              <Search aria-hidden="true" size={20} />
            </button>
            <Link aria-label="Favoritos" className="iconButton headerActions__optional" href="/cuenta?tab=favoritos" title="Favoritos">
              <Heart aria-hidden="true" size={20} />
            </Link>
            <Link aria-label="Mi cuenta" className="iconButton" href="/cuenta" title="Mi cuenta">
              {customer ? <span className="headerAvatar">{customer.firstName?.[0] ?? 'F'}</span> : <UserRound aria-hidden="true" size={20} />}
            </Link>
            <button
              aria-label={`Carrito con ${cart?.itemCount ?? 0} productos`}
              className="iconButton cartIconButton"
              onClick={() => setDrawerOpen(true)}
              title="Carrito"
              type="button"
            >
              <ShoppingBag aria-hidden="true" size={20} />
              {(cart?.itemCount ?? 0) > 0 && <span>{cart?.itemCount}</span>}
            </button>
          </div>
        </div>
      </header>

      <AnimatePresence>
        {menuOpen && (
          <>
            <motion.button
              aria-label="Cerrar menú"
              className="drawerBackdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMenuOpen(false)}
              type="button"
            />
            <motion.aside
              aria-label="Menú móvil"
              className="mobileMenu"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            >
              <div className="mobileMenu__header">
                <span className="brandMark__monogram">F</span>
                <button aria-label="Cerrar menú" className="iconButton" onClick={() => setMenuOpen(false)} type="button">
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              <p className="menuEyebrow">Tu próxima esencia</p>
              <nav>
                {navItems.map((item, index) => (
                  <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                    <span>{String(index + 1).padStart(2, '0')}</span>
                    {item.label}
                  </Link>
                ))}
              </nav>
              <div className="mobileMenu__lines">
                {perfumeLinks.map((item) => (
                  <Link href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>
                    {item.label}
                  </Link>
                ))}
              </div>
              <Link className="button button--dark button--wide" href="/cuenta" onClick={() => setMenuOpen(false)}>
                <UserRound aria-hidden="true" size={18} />
                {customer ? `Hola, ${customer.firstName}` : 'Entrar o crear cuenta'}
              </Link>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
