import { apiRequest } from './api';
import type { ProductListResponse, Promotion } from './types';

export async function getStorefrontData() {
  const [products, promotions] = await Promise.all([
    apiRequest<ProductListResponse>('/products?take=20', { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<Promotion[]>('/promotions?includeUpcoming=true', { next: { revalidate: 60 } }).catch(() => []),
  ]);
  return { products: products.items, promotions };
}
