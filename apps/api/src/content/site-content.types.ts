export const STOREFRONT_SECTION_TYPES = [
  'NEW_ARRIVALS',
  'COLLECTIONS',
  'BEST_SELLERS',
  'PROMOTION_BAND',
  'ABOUT',
  'SPECIAL_ORDER',
] as const;

export type StorefrontSectionType = (typeof STOREFRONT_SECTION_TYPES)[number];

export type StorefrontLink = {
  label: string;
  href: string;
};

export type StorefrontNavigationItem = StorefrontLink & {
  id: string;
  kind: 'LINK' | 'PERFUME_MENU';
};

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
};

export type SiteContentDocument = {
  global: {
    announcement: {
      enabled: boolean;
      text: string;
    };
    header: {
      logoUrl: string;
      logoAlt: string;
      navigation: StorefrontNavigationItem[];
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
    footer: {
      eyebrow: string;
      title: string;
      description: string;
    };
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
