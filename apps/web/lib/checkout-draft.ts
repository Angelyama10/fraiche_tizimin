export type CheckoutStep = 'review' | 'delivery' | 'payment';
export type CheckoutPaymentMethod =
  | 'CARD'
  | 'PAYMENT_LINK'
  | 'BANK_TRANSFER'
  | 'CASH';
export type CheckoutPaymentProvider = 'MERCADO_PAGO' | 'STRIPE';
export type CheckoutDeliveryMethod =
  | 'SHIPPING'
  | 'LOCAL_DELIVERY'
  | 'STORE_PICKUP';

export type CheckoutAddressDraft = {
  recipientName: string;
  phone: string;
  street: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  city: string;
  municipality: string;
  state: string;
  postalCode: string;
  country: string;
  reference: string;
};

export type CheckoutDraft = {
  step: CheckoutStep;
  deliveryMethod: CheckoutDeliveryMethod;
  paymentMethod: CheckoutPaymentMethod;
  paymentProvider: CheckoutPaymentProvider;
  addressId: string;
  newAddress: boolean;
  address: CheckoutAddressDraft;
  promotionCode: string;
  customerNotes: string;
};

const CHECKOUT_DRAFT_PREFIX = 'kiibok_checkout_draft:';

export const emptyCheckoutAddress = (): CheckoutAddressDraft => ({
  recipientName: '',
  phone: '',
  street: '',
  exteriorNumber: '',
  interiorNumber: '',
  neighborhood: '',
  city: 'Tizimín',
  municipality: 'Tizimín',
  state: 'Yucatán',
  postalCode: '',
  country: 'MX',
  reference: '',
});

export function normalizeCheckoutAddress(
  source?: Record<string, string | null> | null,
): CheckoutAddressDraft {
  const fallback = emptyCheckoutAddress();
  if (!source) return fallback;
  return Object.fromEntries(
    Object.entries(fallback).map(([key, value]) => [key, source[key] ?? value]),
  ) as CheckoutAddressDraft;
}

export function loadCheckoutDraft(cartToken: string): CheckoutDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${CHECKOUT_DRAFT_PREFIX}${cartToken}`);
    return raw ? (JSON.parse(raw) as CheckoutDraft) : null;
  } catch {
    return null;
  }
}

export function saveCheckoutDraft(cartToken: string, draft: CheckoutDraft) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(
    `${CHECKOUT_DRAFT_PREFIX}${cartToken}`,
    JSON.stringify(draft),
  );
}

export function clearCheckoutDraft(cartToken: string) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(`${CHECKOUT_DRAFT_PREFIX}${cartToken}`);
}
