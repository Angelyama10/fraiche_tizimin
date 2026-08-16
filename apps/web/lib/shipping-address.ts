import type { CheckoutAddressDraft } from './checkout-draft';

const personNamePattern = /^(?=.*\p{L})[\p{L}\s.'-]+$/u;
const addressTextPattern = /^(?=.*[\p{L}\d])[\p{L}\d\s.,'#/&()-]+$/u;
const addressNumberPattern = /^(?=.*[\p{L}\d])[\p{L}\d\s#./-]+$/u;
const placePattern = /^(?=.*\p{L})[\p{L}\d\s.'-]+$/u;

export type ShippingAddressField = keyof CheckoutAddressDraft;

export type ShippingAddressIssue = {
  field: ShippingAddressField;
  message: string;
};

export function shippingAddressIssue(
  address: CheckoutAddressDraft,
): ShippingAddressIssue | null {
  const recipientName = clean(address.recipientName);
  if (
    recipientName.length < 3 ||
    recipientName.length > 120 ||
    !personNamePattern.test(recipientName)
  ) {
    return {
      field: 'recipientName',
      message: 'Escribe el nombre completo de quien recibe.',
    };
  }

  const phone = digits(address.phone);
  if (phone.length !== 10) {
    return { field: 'phone', message: 'El WhatsApp debe contener 10 dígitos.' };
  }

  const street = clean(address.street);
  if (
    street.length < 3 ||
    street.length > 160 ||
    !addressTextPattern.test(street)
  ) {
    return { field: 'street', message: 'La calle debe tener al menos 3 caracteres.' };
  }

  const exteriorNumber = clean(address.exteriorNumber);
  if (exteriorNumber.length > 20 || !addressNumberPattern.test(exteriorNumber)) {
    return { field: 'exteriorNumber', message: 'Escribe un número exterior válido.' };
  }

  const interiorNumber = clean(address.interiorNumber);
  if (
    interiorNumber &&
    (interiorNumber.length > 20 || !addressNumberPattern.test(interiorNumber))
  ) {
    return { field: 'interiorNumber', message: 'El número interior no es válido.' };
  }

  for (const [field, label] of [
    ['neighborhood', 'colonia'],
    ['city', 'ciudad'],
    ['municipality', 'municipio'],
    ['state', 'estado'],
  ] as const) {
    const value = clean(address[field]);
    if (value.length < 2 || value.length > 100 || !placePattern.test(value)) {
      return { field, message: `Escribe ${label} correctamente.` };
    }
  }

  if (!/^\d{5}$/.test(digits(address.postalCode))) {
    return { field: 'postalCode', message: 'El código postal debe contener 5 dígitos.' };
  }

  const reference = clean(address.reference);
  if (
    reference &&
    (reference.length < 5 ||
      reference.length > 300 ||
      !addressTextPattern.test(reference))
  ) {
    return {
      field: 'reference',
      message: 'La referencia debe describir un punto cercano con al menos 5 caracteres.',
    };
  }

  return null;
}

export function toShippingAddressPayload(address: CheckoutAddressDraft) {
  return {
    recipientName: clean(address.recipientName),
    phone: digits(address.phone),
    street: clean(address.street),
    exteriorNumber: clean(address.exteriorNumber),
    interiorNumber: clean(address.interiorNumber) || undefined,
    neighborhood: clean(address.neighborhood),
    city: clean(address.city),
    municipality: clean(address.municipality),
    state: clean(address.state),
    postalCode: digits(address.postalCode),
    country: 'MX',
    reference: clean(address.reference) || undefined,
  };
}

function clean(value: string) {
  return value.trim().replace(/\s+/g, ' ');
}

function digits(value: string) {
  return value.replace(/\D/g, '');
}
