import { redirect } from 'next/navigation';
export default async function PaymentError({ searchParams }: { searchParams: Promise<{ order?: string }> }) { const { order } = await searchParams; redirect(order ? `/pedidos/${order}?payment=error` : '/cuenta?tab=pedidos'); }
