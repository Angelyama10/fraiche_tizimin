import { redirect } from 'next/navigation';
export default async function PaymentPending({ searchParams }: { searchParams: Promise<{ order?: string }> }) { const { order } = await searchParams; redirect(order ? `/pedidos/${order}?payment=pending` : '/cuenta?tab=pedidos'); }
