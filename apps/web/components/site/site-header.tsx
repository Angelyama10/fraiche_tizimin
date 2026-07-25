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
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import type { SiteContentDocument } from '@/lib/site-content';
import { BrandIdentity } from './brand-identity';

const perfumeLinks = [
  { href: '/productos?line=DESIGNER_CLASSIC', label: 'Diseñador clásico', note: '60 ml · concentración clásica' },
  { href: '/productos?line=DESIGNER_37', label: 'Diseñador 37%', note: 'Mayor intensidad y duración' },
  { href: '/productos?line=NEECHE_PASSION', label: 'Neeche Passion', note: '60 ml · $350 MXN' },
  { href: '/productos?line=PREMIUM', label: 'Premium', note: 'Nicho y árabes · $380 MXN' },
];

export function SiteHeader({
  content,
  onOpenSearch,
}: {
  content: SiteContentDocument['global'];
  onOpenSearch: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();
  const { customer } = useAuth();
  const { cart, setDrawerOpen } = useCart();
  const navItems = content.header.navigation;
  const perfumeItem = navItems.find((item) => item.kind === 'PERFUME_MENU') ?? navItems[0];

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  return (
    <>
      {content.announcement.enabled && (
        <div className="announcementBar">
          <p>Envíos a todo México</p>
          <span aria-hidden="true" />
          <p>{content.announcement.text}</p>
        </div>
      )}
      <header className={`siteHeader ${scrolled ? 'isScrolled' : ''}`}>
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

          <Link className="brandIdentityLink" href="/" aria-label="KI'IBOK Exclusivo, inicio">
            <BrandIdentity compact logoAlt={content.header.logoAlt} logoUrl={content.header.logoUrl} />
          </Link>

          <nav className="desktopNav" aria-label="Navegación principal">
            <div className="desktopNav__dropdown">
              <Link className={pathname === '/productos' ? 'isActive' : ''} href={perfumeItem.href}>
                {perfumeItem.label} <ChevronDown aria-hidden="true" size={14} />
              </Link>
              <div className="desktopNav__menu">
                <div>
                  <span className="menuEyebrow">{content.header.menuEyebrow}</span>
                  {perfumeLinks.map((item) => (
                    <Link href={item.href} key={item.href}>
                      <strong>{item.label}</strong>
                      <small>{item.note}</small>
                    </Link>
                  ))}
                </div>
                <Link className="desktopNav__feature" href={content.header.featureLink.href}>
                  <Image
                    alt=""
                    aria-hidden="true"
                    fill
                    sizes="300px"
                    src={content.header.featureImageUrl}
                    unoptimized={content.header.featureImageUrl.startsWith('http')}
                  />
                  <span>{content.header.featureEyebrow}</span>
                  <strong>{content.header.featureTitle}</strong>
                  <p>{content.header.featureDescription}</p>
                  <small>{content.header.featureLink.label}</small>
                </Link>
              </div>
            </div>
            {navItems.filter((item) => item.id !== perfumeItem.id).map((item) => (
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
                <BrandIdentity compact logoAlt={content.header.logoAlt} logoUrl={content.header.logoUrl} />
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
