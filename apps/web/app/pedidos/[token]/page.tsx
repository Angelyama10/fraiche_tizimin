import type { Metadata } from 'next';
import { OrderTracking } from '@/components/orders/order-tracking';
import '../pedidos.css';

export const metadata: Metadata = { title: 'Seguimiento de pedido', robots: { index: false, follow: false } };

export default async function OrderPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <OrderTracking orderToken={token} />;
}
