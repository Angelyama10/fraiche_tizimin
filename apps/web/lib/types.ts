export type ProductLine =
  | 'DESIGNER_CLASSIC'
  | 'DESIGNER_37'
  | 'NEECHE_PASSION'
  | 'PREMIUM'
  | 'PERSONAL_CARE';

export type ProductImage = {
  id?: string;
  url: string;
  altText: string;
  isPrimary?: boolean;
  sortOrder?: number;
};

export type ProductVariant = {
  id: string;
  sku: string;
  name: string;
  concentrationLabel: string | null;
  concentrationPercent: string | null;
  volumeMl: number | null;
  priceCents: number;
  compareAtPriceCents: number | null;
  currency: string;
  available: number;
  inStock: boolean;
  attributes?: Record<string, unknown> | null;
};

export type Category = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  imageUrl?: string | null;
  children?: Category[];
};

export type Brand = {
  id: string;
  slug: string;
  name: string;
};

export type CatalogAudience = 'GENERAL' | 'WOMEN' | 'MEN' | 'UNISEX' | 'KIDS';

export type PerfumeHouse = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  sortOrder?: number;
  productCount?: number;
};

export type CatalogLine = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  audience: CatalogAudience;
  sortOrder: number;
  showInInspirations: boolean;
  inspirationGroupSlug?: string | null;
  inspirationGroupName?: string | null;
  inspirationSortOrder?: number | null;
  productCount?: number;
  houses?: PerfumeHouse[];
  section?: Omit<CatalogSection, 'lines'>;
};

export type CatalogSection = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  iconKey?: string | null;
  sortOrder: number;
  lines: CatalogLine[];
};

export type CatalogNavigation = {
  sections: CatalogSection[];
};

export type InspirationGroup = {
  slug: string;
  name: string;
  sortOrder: number;
  lines: CatalogLine[];
};

export type InspirationsResponse = {
  groups: InspirationGroup[];
};

export type Product = {
  id: string;
  slug: string;
  name: string;
  shortDescription: string | null;
  description: string | null;
  line: ProductLine;
  brand?: { id?: string; name: string; slug?: string } | null;
  inspirationHouse?: PerfumeHouse | null;
  catalogLines?: CatalogLine[];
  isFeatured: boolean;
  isNew: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  attributes?: Record<string, unknown> | null;
  images: ProductImage[];
  categories: Category[];
  variants: ProductVariant[];
  priceRange: {
    minimumCents: number | null;
    maximumCents: number | null;
    currency: string;
  };
};

export type ProductListResponse = {
  items: Product[];
  nextCursor: string | null;
};

export type ProductSuggestion = {
  slug: string;
  name: string;
  brand?: { name: string } | null;
  inspirationHouse?: { name: string } | null;
  images: ProductImage[];
};

export type Promotion = {
  id?: string;
  slug: string;
  code: string | null;
  name: string;
  description: string | null;
  imageUrl: string | null;
  type: 'PERCENTAGE' | 'FIXED_AMOUNT';
  value: number;
  minimumCents: number;
  startsAt: string;
  endsAt: string | null;
  isFeatured: boolean;
  placement: 'GENERAL' | 'DAILY' | 'MONTHLY' | 'FLASH' | 'WELCOME';
  requiresCode: boolean;
  maximumDiscountCents: number | null;
  priority: number;
  isActive?: boolean;
};

export type CartItem = {
  id: string;
  variantId: string;
  quantity: number;
  product: {
    slug: string;
    name: string;
    line: ProductLine;
    image: ProductImage | null;
  };
  variant: {
    sku: string;
    name: string;
    concentrationLabel: string | null;
    volumeMl: number | null;
  };
  unitPriceCents: number;
  lineTotalCents: number;
  currency: string;
  available: number;
};

export type Cart = {
  publicToken: string;
  status: 'ACTIVE' | 'CONVERTED' | 'ABANDONED' | 'EXPIRED';
  currency: string;
  expiresAt: string;
  items: CartItem[];
  itemCount: number;
  subtotalCents: number;
};

export type CustomerSummary = {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  marketingOptIn: boolean;
  emailVerifiedAt: string | null;
};

export type AuthResponse = {
  accessToken: string;
  expiresInSeconds: number;
  refreshExpiresAt: string;
  customer: CustomerSummary;
};

export type CustomerProfile = CustomerSummary & {
  emailVerifiedAt: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  _count: {
    orders: number;
    addresses: number;
    wishlistItems: number;
  };
};

export type CustomerAddress = {
  id: string;
  label: string;
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string | null;
  neighborhood: string;
  city: string;
  municipality: string | null;
  state: string;
  postalCode: string;
  country: string;
  reference: string | null;
  isDefault: boolean;
};

export type ShipmentEvent = {
  id: string;
  status: string;
  title: string;
  description?: string | null;
  location?: string | null;
  occurredAt: string;
};

export type Shipment = {
  id: string;
  carrier: string;
  service?: string | null;
  trackingNumber: string;
  trackingUrl?: string | null;
  status: string;
  estimatedDeliveryAt?: string | null;
  shippedAt?: string | null;
  deliveredAt?: string | null;
  events: ShipmentEvent[];
};

export type Order = {
  publicToken: string;
  number: string;
  status: string;
  paymentStatus: string;
  fulfillmentStatus: string;
  paymentMethod: string;
  deliveryMethod: string;
  currency: string;
  subtotalCents: number;
  discountCents: number;
  shippingCents: number;
  shippingQuoteStatus: 'NOT_REQUIRED' | 'PENDING' | 'QUOTED';
  shippingQuotedAt?: string | null;
  shippingQuoteNotes?: string | null;
  totalCents: number;
  shippingAddress?: Record<string, string | null> | null;
  customerNotes?: string | null;
  expiresAt: string;
  paidAt?: string | null;
  items: Array<{
    id: string;
    productName: string;
    productSlug: string;
    variantName: string;
    imageUrl?: string | null;
    quantity: number;
    unitPriceCents: number;
    lineTotalCents: number;
  }>;
  promotions: Array<{ id: string; promotionName: string; discountCents: number }>;
  shipments: Shipment[];
  payments: Array<{
    id: string;
    provider: string;
    method: string;
    status: string;
    checkoutUrl?: string | null;
    transferProofs?: Array<{
      id: string;
      fileName: string;
      status: 'PENDING_REVIEW' | 'APPROVED' | 'REJECTED';
      reviewNotes?: string | null;
      reviewedAt?: string | null;
      createdAt: string;
    }>;
  }>;
  createdAt: string;
  updatedAt: string;
};

export type Paginated<T> = {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type WishlistEntry = {
  addedAt: string;
  product: {
    id: string;
    slug: string;
    name: string;
    line: ProductLine;
    shortDescription: string | null;
    image: ProductImage | null;
    variants: Array<{
      id: string;
      sku: string;
      name: string;
      price: { amountCents: number; currency: string };
      available: number;
    }>;
  };
};
