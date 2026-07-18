import type { Metadata } from 'next';
import { CatalogExperience } from '@/components/catalog/catalog-experience';
import { apiRequest } from '@/lib/api';
import type { Category, ProductListResponse, ScentFamily } from '@/lib/types';

export const metadata: Metadata = {
  title: 'Perfumes y cuidado personal',
  description: 'Explora perfumes de diseñador, 37%, Neeche Passion, Premium y cuidado personal.',
  alternates: { canonical: '/productos' },
};

export const revalidate = 60;

export default async function ProductsPage() {
  const [products, categories, scents] = await Promise.all([
    apiRequest<ProductListResponse>('/products?take=50', { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<Category[]>('/categories', { next: { revalidate: 300 } }).catch(() => []),
    apiRequest<ScentFamily[]>('/scent-families', { next: { revalidate: 300 } }).catch(() => []),
  ]);

  return <CatalogExperience initialProducts={products.items} categories={categories} scents={scents} />;
}
