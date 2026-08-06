'use client';

import {
  ChevronDown,
  Heart,
  LogOut,
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
import { useEffect, useMemo, useState } from 'react';
import { apiRequest } from '@/lib/api';
import {
  FALLBACK_CATALOG_NAVIGATION,
  catalogLineHref,
  inspirationsFromNavigation,
  mergeCatalogNavigation,
} from '@/lib/catalog-navigation';
import type { CatalogNavigation, CatalogSection } from '@/lib/types';
import type { SiteContentDocument } from '@/lib/site-content';
import { useAuth } from '@/providers/auth-provider';
import { useCart } from '@/providers/cart-provider';
import { BrandIdentity } from './brand-identity';

export function SiteHeader({
  content,
  onOpenSearch,
}: {
  content: SiteContentDocument['global'];
  onOpenSearch: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [navigation, setNavigation] = useState<CatalogNavigation>(
    FALLBACK_CATALOG_NAVIGATION,
  );
  const pathname = usePathname();
  const { customer, logout } = useAuth();
  const { cart, setDrawerOpen } = useCart();

  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 18);
    update();
    window.addEventListener('scroll', update, { passive: true });
    return () => window.removeEventListener('scroll', update);
  }, []);

  useEffect(() => {
    void apiRequest<CatalogNavigation>('/catalog/navigation', { cache: 'no-store' })
      .then((next) => setNavigation(mergeCatalogNavigation(next)))
      .catch(() => setNavigation(FALLBACK_CATALOG_NAVIGATION));
  }, []);

  const perfumes = navigation.sections.find((section) => section.slug === 'perfumes');
  const collections = navigation.sections.find((section) => section.slug === 'colecciones');
  const exploreSections = navigation.sections.filter(
    (section) => !['perfumes', 'colecciones'].includes(section.slug),
  );
  const inspirations = useMemo(
    () => inspirationsFromNavigation(navigation).groups,
    [navigation],
  );

  function closeMenu() {
    setMenuOpen(false);
  }

  async function closeSession() {
    closeMenu();
    await logout();
    window.location.assign('/');
  }

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
            <Link className={pathname === '/' ? 'isActive' : ''} href="/">Inicio</Link>
            {perfumes && (
              <CatalogDropdown
                active={pathname === '/productos'}
                content={content}
                section={perfumes}
              />
            )}
            <div className="desktopNav__dropdown">
              <Link className={pathname === '/inspiraciones' ? 'isActive' : ''} href="/inspiraciones">
                Inspiraciones <ChevronDown aria-hidden="true" size={14} />
              </Link>
              <div className="desktopNav__menu desktopNav__menu--inspirations">
                <div>
                  <span className="menuEyebrow">Explora por casa perfumera</span>
                  {inspirations.map((group) => (
                    <Link href={`/inspiraciones#${group.slug}`} key={group.slug}>
                      <strong>{group.name}</strong>
                      <small>
                        {group.lines.length} {group.lines.length === 1 ? 'línea' : 'líneas'}
                      </small>
                    </Link>
                  ))}
                </div>
                <Link className="desktopNav__editorial" href="/inspiraciones">
                  <span>Casas perfumeras</span>
                  <strong>Encuentra el aroma por su inspiración.</strong>
                  <small>Ver todas las inspiraciones</small>
                </Link>
              </div>
            </div>
            <div className="desktopNav__dropdown">
              <Link href="/productos">
                Explorar <ChevronDown aria-hidden="true" size={14} />
              </Link>
              <div className="desktopNav__menu desktopNav__menu--catalog">
                <div className="desktopNav__catalogGroups">
                  <span className="menuEyebrow">Todo el catálogo</span>
                  {exploreSections.map((section) => (
                    <SectionGroup key={section.slug} section={section} />
                  ))}
                  <div className="desktopNav__catalogGroup">
                    <Link href="/#contacto"><strong>Contacto</strong></Link>
                    <Link href="/#contacto">WhatsApp, ubicación y horarios</Link>
                  </div>
                </div>
              </div>
            </div>
            <Link className={pathname === '/colecciones' ? 'isActive' : ''} href="/colecciones">
              Colecciones
            </Link>
            <Link className={pathname === '/pedidos-especiales' ? 'isActive' : ''} href="/pedidos-especiales">
              Pedido especial
            </Link>
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
            {customer && (
              <button
                aria-label="Cerrar sesión"
                className="iconButton headerActions__optional"
                onClick={() => { void closeSession(); }}
                title="Cerrar sesión"
                type="button"
              >
                <LogOut aria-hidden="true" size={19} />
              </button>
            )}
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
              onClick={closeMenu}
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
                <button aria-label="Cerrar menú" className="iconButton" onClick={closeMenu} type="button">
                  <X aria-hidden="true" size={20} />
                </button>
              </div>
              <p className="menuEyebrow">Explorar KI&apos;IBOK</p>
              <nav className="mobileCatalogNav">
                <Link href="/" onClick={closeMenu}>Inicio</Link>
                {perfumes && <MobileSection onNavigate={closeMenu} section={perfumes} />}
                <details>
                  <summary>Inspiraciones <ChevronDown size={15} /></summary>
                  <div>
                    {inspirations.map((group) => (
                      <Link href={`/inspiraciones#${group.slug}`} key={group.slug} onClick={closeMenu}>
                        {group.name}
                      </Link>
                    ))}
                  </div>
                </details>
                {exploreSections.map((section) => (
                  <MobileSection key={section.slug} onNavigate={closeMenu} section={section} />
                ))}
                {collections && <MobileSection onNavigate={closeMenu} section={collections} />}
                <Link href="/pedidos-especiales" onClick={closeMenu}>Pedido especial</Link>
                <Link href="/promociones" onClick={closeMenu}>Promociones</Link>
                <Link href="/#contacto" onClick={closeMenu}>Contacto</Link>
              </nav>
              <Link className="button button--dark button--wide" href="/cuenta" onClick={closeMenu}>
                <UserRound aria-hidden="true" size={18} />
                {customer ? `Hola, ${customer.firstName}` : 'Entrar o crear cuenta'}
              </Link>
              {customer && (
                <button
                  className="mobileMenu__logout"
                  onClick={() => { void closeSession(); }}
                  type="button"
                >
                  <LogOut aria-hidden="true" size={18} /> Cerrar sesión
                </button>
              )}
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function CatalogDropdown({
  active,
  content,
  section,
}: {
  active: boolean;
  content: SiteContentDocument['global'];
  section: CatalogSection;
}) {
  return (
    <div className="desktopNav__dropdown">
      <Link className={active ? 'isActive' : ''} href="/productos?catalogSection=perfumes">
        Perfumes <ChevronDown aria-hidden="true" size={14} />
      </Link>
      <div className="desktopNav__menu desktopNav__menu--perfumes">
        <div>
          <span className="menuEyebrow">Elige tu línea</span>
          {section.lines.map((item) => (
            <Link href={catalogLineHref(item)} key={item.slug}>
              <strong>{item.name}</strong>
              <small>{item.description}</small>
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
  );
}

function SectionGroup({ section }: { section: CatalogSection }) {
  return (
    <div className="desktopNav__catalogGroup">
      <Link href={`/productos?catalogSection=${section.slug}`}>
        <strong>{section.name}</strong>
      </Link>
      {section.lines.map((line) => (
        <Link href={catalogLineHref(line)} key={line.slug}>{line.name}</Link>
      ))}
    </div>
  );
}

function MobileSection({
  onNavigate,
  section,
}: {
  onNavigate: () => void;
  section: CatalogSection;
}) {
  return (
    <details>
      <summary>{section.name} <ChevronDown size={15} /></summary>
      <div>
        <Link href={`/productos?catalogSection=${section.slug}`} onClick={onNavigate}>
          Ver todo
        </Link>
        {section.lines.map((item) => (
          <Link href={catalogLineHref(item)} key={item.slug} onClick={onNavigate}>
            {item.name}
          </Link>
        ))}
      </div>
    </details>
  );
}
