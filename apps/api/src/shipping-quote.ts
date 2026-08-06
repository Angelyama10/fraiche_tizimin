import { DeliveryMethod, ShippingQuoteStatus } from '@prisma/client';

export const TIZIMIN_DELIVERY_FEE_CENTS = 3_500;
export const SHIPPING_QUOTE_RESERVATION_MS = 24 * 60 * 60 * 1000;

type ShippingAddress = {
  city?: unknown;
  municipality?: unknown;
  state?: unknown;
};

export type ShippingQuoteResolution = {
  deliveryMethod: DeliveryMethod;
  shippingCents: number;
  status: ShippingQuoteStatus;
  quotedAt: Date | null;
  notes: string | null;
};

function normalizePlace(value: unknown) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function isTiziminAddress(address: ShippingAddress | null | undefined) {
  if (!address) return false;
  return [address.city, address.municipality]
    .map(normalizePlace)
    .some((value) => value === 'tizimin' || value.includes('tizimin'));
}

export function resolveShippingQuote(
  requestedMethod: DeliveryMethod,
  address: ShippingAddress | null | undefined,
  now = new Date(),
): ShippingQuoteResolution {
  if (requestedMethod === DeliveryMethod.STORE_PICKUP) {
    return {
      deliveryMethod: DeliveryMethod.STORE_PICKUP,
      shippingCents: 0,
      status: ShippingQuoteStatus.NOT_REQUIRED,
      quotedAt: null,
      notes: null,
    };
  }

  if (isTiziminAddress(address)) {
    return {
      deliveryMethod: DeliveryMethod.LOCAL_DELIVERY,
      shippingCents: TIZIMIN_DELIVERY_FEE_CENTS,
      status: ShippingQuoteStatus.QUOTED,
      quotedAt: now,
      notes: 'Tarifa fija de entrega en Tizimin.',
    };
  }

  return {
    deliveryMethod: DeliveryMethod.SHIPPING,
    shippingCents: 0,
    status: ShippingQuoteStatus.PENDING,
    quotedAt: null,
    notes: null,
  };
}
