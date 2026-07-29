import type { Metadata } from 'next';
import { PaymentExperience } from '@/components/payments/payment-experience';
import '../../pedidos/pedidos.css';
import '../pago.css';

export const metadata: Metadata = {
  title: 'Pago seguro',
  robots: { index: false, follow: false },
};

export default async function PaymentPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ stripe_return?: string }>;
}) {
  const { token } = await params;
  const { stripe_return: stripeReturn } = await searchParams;
  return (
    <PaymentExperience
      orderToken={token}
      returningFromStripe={stripeReturn === '1'}
    />
  );
}
