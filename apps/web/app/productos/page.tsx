import type { Metadata } from 'next';
import { CatalogExperience } from '@/components/catalog/catalog-experience';
import { apiRequest } from '@/lib/api';
import {
  FALLBACK_CATALOG_NAVIGATION,
  mergeCatalogNavigation,
} from '@/lib/catalog-navigation';
import type {
  CatalogNavigation,
  Category,
  PerfumeHouse,
  ProductListResponse,
} from '@/lib/types';

export const metadata: Metadata = {
  title: 'Perfumes y cuidado personal',
  description: 'Explora perfumes de diseñador, 37%, Neeche Passion, Premium y cuidado personal.',
  alternates: { canonical: '/productos' },
};

export const revalidate = 60;

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const requested = await searchParams;
  const productParams = new URLSearchParams({ take: '24' });
  for (const key of [
    'q',
    'catalogSection',
    'catalogLine',
    'house',
    'category',
    'featured',
  ]) {
    const value = requested[key];
    if (typeof value === 'string' && value) productParams.set(key, value);
  }

  const [products, categories, navigation, perfumeHouses] = await Promise.all([
    apiRequest<ProductListResponse>(`/products?${productParams.toString()}`, {
      next: { revalidate: 60 },
    }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<Category[]>('/categories', { next: { revalidate: 300 } }).catch(() => []),
    apiRequest<CatalogNavigation>('/catalog/navigation', {
      next: { revalidate: 300 },
    })
      .then(mergeCatalogNavigation)
      .catch(() => FALLBACK_CATALOG_NAVIGATION),
    apiRequest<PerfumeHouse[]>('/perfume-houses', {
      next: { revalidate: 300 },
    }).catch(() => []),
  ]);

  return (
    <CatalogExperience
      categories={categories}
      initialNextCursor={products.nextCursor}
      initialProducts={products.items}
      navigation={navigation}
      perfumeHouses={perfumeHouses}
    />
  );
}
