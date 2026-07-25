'use client';

import { useEffect, useState } from 'react';
import type { SiteContentDocument } from '@/lib/site-content';
import { CartDrawer } from '@/components/store/cart-drawer';
import { SearchDialog } from '@/components/store/search-dialog';
import { MobileNav } from '@/components/site/mobile-nav';
import { SiteFooter } from '@/components/site/site-footer';
import { SiteHeader } from '@/components/site/site-header';
import { WhatsAppButton } from '@/components/site/whatsapp-button';

export function StorefrontPreviewFrame({ children, content }: { children: React.ReactNode; content: SiteContentDocument }) {
  const [searchOpen, setSearchOpen] = useState(false);
  useEffect(() => { window.scrollTo(0, 0); }, []);
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
