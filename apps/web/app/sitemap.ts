import type { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api';
import { SITE_URL } from '@/lib/seo';
import type { ProductListResponse } from '@/lib/types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const products: ProductListResponse['items'] = [];
  const seenCursors = new Set<string>();
  let cursor: string | null = null;

  for (let page = 0; page < 100; page += 1) {
    const query = new URLSearchParams({ take: '50' });
    if (cursor) query.set('cursor', cursor);
    const response = await apiRequest<ProductListResponse>(`/products?${query.toString()}`, {
      next: { revalidate: 3600 },
    }).catch(() => ({ items: [], nextCursor: null }));
    products.push(...response.items);
    if (!response.nextCursor || seenCursors.has(response.nextCursor)) break;
    seenCursors.add(response.nextCursor);
    cursor = response.nextCursor;
  }

  const publicPages = [
    '',
    '/productos',
    '/promociones',
    '/pedidos-especiales',
    '/guia-de-perfumes',
    '/envios-y-devoluciones',
    '/terminos',
    '/privacidad',
    '/cookies',
  ];
  const pages = publicPages.map((path) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency: path.startsWith('/productos') || path === '' ? ('daily' as const) : ('monthly' as const),
    priority: path === '' ? 1 : path === '/productos' ? 0.9 : 0.6,
  }));

  return [...pages, ...products.map((product) => ({
    url: `${SITE_URL}/productos/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))];
}
