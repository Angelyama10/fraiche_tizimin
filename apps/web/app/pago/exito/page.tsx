import { redirect } from 'next/navigation';
export default async function PaymentSuccess({ searchParams }: { searchParams: Promise<{ order?: string }> }) { const { order } = await searchParams; redirect(order ? `/pedidos/${order}?payment=success` : '/cuenta?tab=pedidos'); }
