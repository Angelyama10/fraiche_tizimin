import type { Metadata } from 'next';
import { PromotionsExperience } from '@/components/promotions/promotions-experience';
import { apiRequest } from '@/lib/api';
import type { Promotion } from '@/lib/types';
import './promociones.css';

export const metadata: Metadata = {
  title: 'Promociones',
  description: 'Ofertas vigentes, beneficios de bienvenida y promociones especiales de Fraîche Tizimín.',
  alternates: { canonical: '/promociones' },
};

export const revalidate = 60;

export default async function PromotionsPage() {
  const promotions = await apiRequest<Promotion[]>('/promotions', { next: { revalidate: 60 } }).catch(() => []);
  return <PromotionsExperience promotions={promotions} />;
}
