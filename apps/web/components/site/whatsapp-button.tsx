'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';

export function WhatsAppButton() {
  const [loading, setLoading] = useState(false);
  const [heroVisible, setHeroVisible] = useState(false);
  const pathname = usePathname();
  const { cart } = useCart();
  const notify = useNotify();

  const hiddenOnFocusedFlow = ['/cuenta', '/carrito', '/admin', '/pedidos/', '/pedidos-especiales'].some((path) => pathname.startsWith(path));

  useEffect(() => {
    if (pathname !== '/') {
      setHeroVisible(false);
      return;
    }
    let intersectionObserver: IntersectionObserver | null = null;
    const connect = () => {
      const hero = document.querySelector('.homeHero');
      if (!hero) return false;
      intersectionObserver = new IntersectionObserver(([entry]) => setHeroVisible(entry.isIntersecting), { threshold: 0.08 });
      intersectionObserver.observe(hero);
      return true;
    };
    if (connect()) return () => intersectionObserver?.disconnect();

    const contentObserver = new MutationObserver(() => {
      if (connect()) contentObserver.disconnect();
    });
    contentObserver.observe(document.body, { childList: true, subtree: true });
    return () => {
      contentObserver.disconnect();
      intersectionObserver?.disconnect();
    };
  }, [pathname]);

  async function openWhatsApp() {
    setLoading(true);
    try {
      const query = cart?.itemCount ? `?cartToken=${encodeURIComponent(cart.publicToken)}` : '';
      const result = await apiRequest<{ url: string }>(`/contact/whatsapp${query}`, { cache: 'no-store' });
      window.open(result.url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      notify({ title: 'WhatsApp no está disponible', description: errorMessage(error), tone: 'error' });
    } finally {
      setLoading(false);
    }
  }

  if (hiddenOnFocusedFlow) return null;

  return (
    <button
      aria-label="Contactar por WhatsApp"
      className={`whatsappButton ${heroVisible ? 'isOverHero' : ''}`}
      disabled={loading}
      onClick={openWhatsApp}
      title="WhatsApp"
      type="button"
    >
      <MessageCircle aria-hidden="true" size={24} />
      <span>¿Te ayudamos?</span>
    </button>
  );
}
