'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CartDrawer } from './store/cart-drawer';
import { SearchDialog } from './store/search-dialog';
import { MobileNav } from './site/mobile-nav';
import { SiteFooter } from './site/site-footer';
import { SiteHeader } from './site/site-header';
import { WhatsAppButton } from './site/whatsapp-button';

export function SiteShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdmin = pathname.startsWith('/admin');

  if (isAdmin) return <>{children}</>;

  return (
    <>
      <SiteHeader onOpenSearch={() => setSearchOpen(true)} />
      {children}
      <SiteFooter />
      <MobileNav onOpenSearch={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <WhatsAppButton />
    </>
  );
}
