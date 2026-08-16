import { DeliveryMethod, ShippingQuoteStatus } from '@prisma/client';

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

export function isShippingQuoteReadyForPayment(
  deliveryMethod: DeliveryMethod,
  status: ShippingQuoteStatus,
) {
  return (
    deliveryMethod === DeliveryMethod.STORE_PICKUP ||
    status === ShippingQuoteStatus.QUOTED
  );
}

export function resolveShippingQuote(
  requestedMethod: DeliveryMethod,
  _address: ShippingAddress | null | undefined,
  _now = new Date(),
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

  return {
    deliveryMethod: requestedMethod,
    shippingCents: 0,
    status: ShippingQuoteStatus.PENDING,
    quotedAt: null,
    notes: null,
  };
}
