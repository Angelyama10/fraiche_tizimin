import { apiRequest } from './api';
import type { ProductLine, ProductListResponse, Promotion } from './types';

const STOREFRONT_LINES: ProductLine[] = [
  'DESIGNER_CLASSIC',
  'DESIGNER_37',
  'NEECHE_PASSION',
  'PREMIUM',
];

export async function getStorefrontData() {
  const [products, promotions, ...lineResponses] = await Promise.all([
    apiRequest<ProductListResponse>('/products?take=20', { next: { revalidate: 60 } }).catch(() => ({ items: [], nextCursor: null })),
    apiRequest<Promotion[]>('/promotions?includeUpcoming=true', { next: { revalidate: 60 } }).catch(() => []),
    ...STOREFRONT_LINES.map((line) =>
      apiRequest<ProductListResponse>(`/products?line=${line}&take=12`, {
        next: { revalidate: 60 },
      }).catch(() => ({ items: [], nextCursor: null })),
    ),
  ]);
  const showcaseProducts = lineResponses.flatMap((response) => {
    const available = response.items.find((product) =>
      product.variants.some((variant) => variant.inStock),
    );
    return available ? [available] : response.items.slice(0, 1);
  });
  return { products: products.items, promotions, showcaseProducts };
}
