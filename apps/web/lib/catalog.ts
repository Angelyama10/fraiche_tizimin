import type { Product, ProductLine } from './types';

export const LINE_LABELS: Record<ProductLine, string> = {
  DESIGNER_CLASSIC: 'Diseñador clásico',
  DESIGNER_37: 'Diseñador 37%',
  NEECHE_PASSION: 'Neeche Passion',
  PREMIUM: 'Premium nicho y árabe',
  PERSONAL_CARE: 'Cuidado personal',
};

export const LINE_SHORT_LABELS: Record<ProductLine, string> = {
  DESIGNER_CLASSIC: 'Clásica',
  DESIGNER_37: '37% esencia',
  NEECHE_PASSION: 'Neeche',
  PREMIUM: 'Premium',
  PERSONAL_CARE: 'Cuidado',
};

const PRODUCT_FALLBACKS: Record<string, string> = {
  'elegance-floral-clasico': '/images/products/elegance-floral.png',
  'noir-intense-37': '/images/products/noir-intense.png',
  'neeche-passion-floral': '/images/products/neeche-passion.png',
  'premium-oud-royal': '/images/products/premium-oud.png',
  'crema-corporal-fraiche-floral': '/images/products/crema-corporal.png',
};

const LINE_FALLBACKS: Record<ProductLine, string> = {
  DESIGNER_CLASSIC: '/images/products/elegance-floral.png',
  DESIGNER_37: '/images/products/noir-intense.png',
  NEECHE_PASSION: '/images/products/neeche-passion.png',
  PREMIUM: '/images/products/premium-oud.png',
  PERSONAL_CARE: '/images/products/crema-corporal.png',
};

export function productImage(product: Pick<Product, 'slug' | 'line' | 'images'>) {
  return product.images[0]?.url || PRODUCT_FALLBACKS[product.slug] || null;
}

export function productFallbackImage(slug: string) {
  return PRODUCT_FALLBACKS[slug];
}

export function productImageAlt(product: Pick<Product, 'name' | 'images'>) {
  return product.images[0]?.altText || `${product.name} en Fraîche Tizimín`;
}

export function lineFallbackImage(line: ProductLine) {
  return LINE_FALLBACKS[line];
}

export function stockMessage(available: number) {
  if (available <= 0) return 'Agotado';
  if (available === 1) return 'Solo 1 disponible';
  if (available <= 5) return `Solo ${available} disponibles`;
  return 'Disponible';
}
