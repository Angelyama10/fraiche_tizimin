import { apiRequest } from './api';
import type { ProductListResponse, Promotion, ScentFamily } from './types';

export async function getStorefrontData() {
  const [products, scents, promotions] = await Promise.all([
    apiRequest<ProductListResponse>('/products?take=20', { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<ScentFamily[]>('/scent-families', { next: { revalidate: 300 } }).catch(() => []),
    apiRequest<Promotion[]>('/promotions?includeUpcoming=true', { next: { revalidate: 60 } }).catch(() => []),
  ]);
  return { products: products.items, scents, promotions };
}
