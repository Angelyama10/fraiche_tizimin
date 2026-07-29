import { LINE_LABELS } from './catalog';
import type { SiteContentDocument } from './site-content';
import type { Product } from './types';

export const SITE_URL = (process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:3000').replace(/\/+$/, '');

export function absoluteUrl(path: string) {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

export function jsonLd(value: unknown) {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

export function isConfiguredSocialUrl(value: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/+$/, '');
    return path.length > 0;
  } catch {
    return false;
  }
}

export function organizationSchema(content: SiteContentDocument['global']) {
  const { contact, header } = content;
  const sameAs = [contact.instagramUrl, contact.facebookUrl].filter(isConfiguredSocialUrl);

  return {
    '@context': 'https://schema.org',
    '@type': ['Store', 'Organization'],
    '@id': `${SITE_URL}/#store`,
    name: "KI'IBOK Exclusivo",
    alternateName: 'Fraîche Tizimín',
    url: SITE_URL,
    logo: absoluteUrl(header.logoUrl),
    email: contact.email,
    telephone: `+${contact.whatsappPhone}`,
    description: content.footer.description,
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'C. 56 396, entre 45 y 47, Centro',
      addressLocality: 'Tizimín',
      addressRegion: 'Yucatán',
      postalCode: '97700',
      addressCountry: 'MX',
    },
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: `+${contact.whatsappPhone}`,
      contactType: 'customer service',
      availableLanguage: 'Spanish',
    },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function productSchema(product: Product) {
  const url = absoluteUrl(`/productos/${product.slug}`);
  const images = product.images.map((image) => absoluteUrl(image.url));
  const offers = product.variants.map((variant) => ({
    '@type': 'Offer',
    url,
    sku: variant.sku,
    name: variant.name,
    priceCurrency: variant.currency,
    price: (variant.priceCents / 100).toFixed(2),
    availability: variant.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    itemCondition: 'https://schema.org/NewCondition',
    seller: { '@id': `${SITE_URL}/#store` },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    '@id': `${url}/#product`,
    url,
    name: product.name,
    description: product.description ?? product.shortDescription ?? undefined,
    ...(images.length ? { image: images } : {}),
    ...(product.variants[0]?.sku ? { sku: product.variants[0].sku } : {}),
    category: LINE_LABELS[product.line],
    brand: {
      '@type': 'Brand',
      name: product.brand?.name ?? 'Fraîche',
    },
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

export function productBreadcrumbSchema(product: Product) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Inicio',
        item: SITE_URL,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Productos',
        item: absoluteUrl('/productos'),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: product.name,
        item: absoluteUrl(`/productos/${product.slug}`),
      },
    ],
  };
}
