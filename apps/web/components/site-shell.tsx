'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { CartDrawer } from './store/cart-drawer';
import { SearchDialog } from './store/search-dialog';
import { MobileNav } from './site/mobile-nav';
import { SiteFooter } from './site/site-footer';
import { SiteHeader } from './site/site-header';
import { WhatsAppButton } from './site/whatsapp-button';
import type { SiteContentDocument } from '@/lib/site-content';

export function SiteShell({ children, content }: { children: React.ReactNode; content: SiteContentDocument }) {
  const pathname = usePathname();
  const [searchOpen, setSearchOpen] = useState(false);
  const isAdmin = pathname.startsWith('/admin');
  const isPreview = pathname.startsWith('/vista-previa');

  if (isAdmin || isPreview) return <>{children}</>;

  return (
    <>
      <SiteHeader content={content.global} onOpenSearch={() => setSearchOpen(true)} />
      {children}
      <SiteFooter content={content.global} />
      <MobileNav onOpenSearch={() => setSearchOpen(true)} />
      <SearchDialog open={searchOpen} onClose={() => setSearchOpen(false)} />
      <CartDrawer />
      <WhatsAppButton />
    </>
  );
}
