import type { Metadata } from 'next';
import { CheckoutExperience } from '@/components/checkout/checkout-experience';
import './carrito.css';

export const metadata: Metadata = {
  title: 'Carrito y pago',
  robots: { index: false, follow: false },
};

export default function CartPage() {
  return <CheckoutExperience />;
}
