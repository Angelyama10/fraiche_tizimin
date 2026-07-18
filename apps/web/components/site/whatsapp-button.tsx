'use client';

import { MessageCircle } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { apiRequest, errorMessage } from '@/lib/api';
import { useCart } from '@/providers/cart-provider';
import { useNotify } from '@/providers/notification-provider';

export function WhatsAppButton() {
  const [loading, setLoading] = useState(false);
  const pathname = usePathname();
  const { cart } = useCart();
  const notify = useNotify();

  const hiddenOnFocusedFlow = ['/cuenta', '/carrito', '/admin', '/pedidos/', '/pedidos-especiales'].some((path) => pathname.startsWith(path));

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
      className="whatsappButton"
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
