import type { MetadataRoute } from 'next';
import { apiRequest } from '@/lib/api';
import type { ProductListResponse } from '@/lib/types';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000';
  const products = await apiRequest<ProductListResponse>('/products?take=50', { next: { revalidate: 3600 } }).catch(() => ({ items: [], nextCursor: null }));
  const pages = ['', '/productos', '/promociones', '/pedidos-especiales'].map((path) => ({
    url: `${baseUrl}${path}`,
    lastModified: new Date(),
    changeFrequency: path ? ('weekly' as const) : ('daily' as const),
    priority: path ? 0.8 : 1,
  }));
  return [...pages, ...products.items.map((product) => ({
    url: `${baseUrl}/productos/${product.slug}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }))];
}
