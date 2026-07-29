import { apiRequest } from './api';

export const STOREFRONT_SECTION_TYPES = [
  'NEW_ARRIVALS',
  'COLLECTIONS',
  'BEST_SELLERS',
  'SCENT_FINDER',
  'PROMOTION_BAND',
  'ABOUT',
  'SPECIAL_ORDER',
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

export type StorefrontLink = { label: string; href: string };

export type StorefrontScentLink = StorefrontLink & { id: string };

export type StorefrontSection = {
  id: string;
  type: StorefrontSectionType;
  enabled: boolean;
  eyebrow: string;
  title: string;
  description: string;
  secondaryText: string;
  imageUrl: string;
  ctaLabel: string;
  ctaHref: string;
  scentLinks: StorefrontScentLink[];
};

export type SiteContentDocument = {
  global: {
    announcement: { enabled: boolean; text: string };
    header: {
      logoUrl: string;
      logoAlt: string;
      navigation: Array<StorefrontLink & { id: string; kind: 'LINK' | 'PERFUME_MENU' }>;
      menuEyebrow: string;
      featureEyebrow: string;
      featureTitle: string;
      featureDescription: string;
      featureImageUrl: string;
      featureLink: StorefrontLink;
    };
    contact: {
      whatsappPhone: string;
      whatsappLabel: string;
      email: string;
      address: string;
      mapsEmbedUrl: string;
      instagramUrl: string;
      facebookUrl: string;
    };
    footer: { eyebrow: string; title: string; description: string };
  };
  home: {
    hero: {
      eyebrow: string;
      title: string;
      titleAccent: string;
      tagline: string;
      description: string;
      imageUrl: string;
      imageAlt: string;
      primaryLink: StorefrontLink;
      secondaryLink: StorefrontLink;
    };
    commercePanel: {
      productsLabel: string;
      promotionsLabel: string;
      mobilePromotionsLabel: string;
    };
    sections: StorefrontSection[];
  };
};

export type SiteContentResponse = {
  content: SiteContentDocument;
  version: number;
  publishedAt?: string | null;
  preview?: boolean;
};

export const DEFAULT_SITE_CONTENT: SiteContentDocument = {
  global: {
    announcement: { enabled: true, text: 'Atención cercana desde Tizimín' },
    header: {
      logoUrl: '/images/brand/kiibok-emblem.png',
      logoAlt: "KI'IBOK Exclusivo",
      navigation: [
        { id: 'perfumes', kind: 'PERFUME_MENU', label: 'Perfumes', href: '/productos' },
        { id: 'cuidado-personal', kind: 'LINK', label: 'Cuidado personal', href: '/productos?line=PERSONAL_CARE' },
        { id: 'promociones', kind: 'LINK', label: 'Promociones', href: '/promociones' },
        { id: 'pedidos-especiales', kind: 'LINK', label: 'Pedidos especiales', href: '/pedidos-especiales' },
        { id: 'nosotros', kind: 'LINK', label: 'Nosotros', href: '/#nosotros' },
      ],
      menuEyebrow: 'Explora por línea',
      featureEyebrow: 'Nuestra selección',
      featureTitle: 'Los aromas que todos quieren',
      featureDescription: 'Descubre los perfumes favoritos de nuestra comunidad.',
      featureImageUrl: '/images/products/premium-oud.png',
      featureLink: { label: 'Ver destacados', href: '/productos?featured=true' },
    },
    contact: {
      whatsappPhone: '529993020863',
      whatsappLabel: '+52 999 302 0863',
      email: 'angelyama792@gmail.com',
      address: 'C. 56 396, entre 45 y 47, Centro, 97700 Tizimín, Yuc.',
      mapsEmbedUrl: 'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3721.166970482269!2d-88.15797412451728!3d21.14575248053305!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x8f522bc379f1112b%3A0x4e83441b1970ba72!2sFraiche%20Tizmin!5e0!3m2!1ses-419!2smx!4v1784400980423!5m2!1ses-419!2smx',
      instagramUrl: '',
      facebookUrl: '',
    },
    footer: {
      eyebrow: 'KI’IBOK Exclusivo',
      title: 'Tu próxima esencia empieza aquí.',
      description: 'Perfumería y cuidado personal con atención cercana desde Tizimín, Yucatán.',
    },
  },
  home: {
    hero: {
      eyebrow: 'Línea Fraîche · Tizimín',
      title: "KI'IBOK",
      titleAccent: 'Exclusivo',
      tagline: 'Perfumes que dejan huella.',
      description: 'Encuentra una esencia que se sienta tan tuya como tu historia.',
      imageUrl: '/images/brand/hero-perfumes.png',
      imageAlt: 'Colección de perfumes en vidrio coral, esmeralda y ámbar',
      primaryLink: { label: 'Descubrir perfumes', href: '/productos' },
      secondaryLink: { label: 'Pedir un aroma', href: '/pedidos-especiales' },
    },
    commercePanel: {
      productsLabel: 'Novedades',
      promotionsLabel: 'Ofertas',
      mobilePromotionsLabel: 'Ver ofertas',
    },
    sections: [
      { id: 'novedades', type: 'NEW_ARRIVALS', enabled: true, eyebrow: 'Recién llegados', title: 'Nuevas formas de dejar huella', description: 'Fragancias luminosas, intensas y difíciles de olvidar.', secondaryText: '', imageUrl: '', ctaLabel: 'Explorar catálogo', ctaHref: '/productos', scentLinks: [] },
      { id: 'colecciones', type: 'COLLECTIONS', enabled: true, eyebrow: 'Encuentra tu línea', title: 'Una esencia para cada versión de ti', description: '', secondaryText: '', imageUrl: '', ctaLabel: '', ctaHref: '', scentLinks: [] },
      { id: 'favoritos', type: 'BEST_SELLERS', enabled: true, eyebrow: 'Los más elegidos', title: 'Aromas que siempre reciben cumplidos', description: 'Una selección de favoritos para acertar contigo o con alguien especial.', secondaryText: '', imageUrl: '', ctaLabel: 'Ver favoritos', ctaHref: '/productos?featured=true', scentLinks: [] },
      { id: 'familias-aromaticas', type: 'SCENT_FINDER', enabled: true, eyebrow: 'Elige por sensación', title: '¿Cómo quieres sentirte hoy?', description: 'Empieza por una familia aromática y deja que tu intuición haga el resto.', secondaryText: '', imageUrl: '', ctaLabel: '', ctaHref: '', scentLinks: [
        { id: 'amaderado', label: 'Amaderado', href: '/productos?scent=amaderado' },
        { id: 'arabe', label: 'Árabe', href: '/productos?scent=arabe' },
        { id: 'citrico', label: 'Cítrico', href: '/productos?scent=citrico' },
        { id: 'dulce', label: 'Dulce', href: '/productos?scent=dulce' },
        { id: 'floral', label: 'Floral', href: '/productos?scent=floral' },
        { id: 'fresco', label: 'Fresco', href: '/productos?scent=fresco' },
        { id: 'nicho', label: 'Nicho', href: '/productos?scent=nicho' },
        { id: 'oriental', label: 'Oriental', href: '/productos?scent=oriental' },
      ] },
      { id: 'oferta-mensual', type: 'PROMOTION_BAND', enabled: false, eyebrow: 'Oferta del mes', title: 'Tu primera esencia merece celebrarse', description: 'Las promociones activas aparecen en el panel flotante del inicio.', secondaryText: '', imageUrl: '/images/products/premium-oud.png', ctaLabel: 'Ver promociones', ctaHref: '/promociones', scentLinks: [] },
      { id: 'nosotros', type: 'ABOUT', enabled: true, eyebrow: 'Nuestra historia', title: 'Una perfumería nacida para atenderte de cerca.', description: 'En Fraîche Tizimín cada aroma se recomienda escuchando primero a la persona. Seleccionamos perfumes y productos de cuidado que combinan calidad, duración y una experiencia cálida desde el primer mensaje.', secondaryText: 'Estamos construyendo una forma más fácil, transparente y bonita de encontrar tu fragancia favorita.', imageUrl: '', ctaLabel: 'Cómo llegar', ctaHref: '', scentLinks: [] },
      { id: 'pedido-especial', type: 'SPECIAL_ORDER', enabled: true, eyebrow: '¿No está tu aroma?', title: 'Cuéntanos cuál buscas. Nosotros seguimos la pista.', description: '', secondaryText: '', imageUrl: '', ctaLabel: 'Solicitar aroma', ctaHref: '/pedidos-especiales', scentLinks: [] },
    ],
  },
};

export async function getPublishedSiteContent() {
  try {
    const response = await apiRequest<SiteContentResponse>('/content/site', {
      next: { revalidate: 15, tags: ['site-content'] },
    });
    return response.content;
  } catch {
    return DEFAULT_SITE_CONTENT;
  }
}
