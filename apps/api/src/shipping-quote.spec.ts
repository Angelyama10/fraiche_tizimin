import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryMethod, ShippingQuoteStatus } from '@prisma/client';
import {
  isTiziminAddress,
  resolveShippingQuote,
  TIZIMIN_DELIVERY_FEE_CENTS,
} from './shipping-quote';

test('reconoce Tizimin aunque lleve acento', () => {
  assert.equal(isTiziminAddress({ city: 'Tizimín' }), true);
});

test('asigna tarifa fija a entregas dentro de Tizimin', () => {
  const quote = resolveShippingQuote(DeliveryMethod.SHIPPING, { municipality: 'Tizimín' });
  assert.equal(quote.deliveryMethod, DeliveryMethod.LOCAL_DELIVERY);
  assert.equal(quote.status, ShippingQuoteStatus.QUOTED);
  assert.equal(quote.shippingCents, TIZIMIN_DELIVERY_FEE_CENTS);
});

test('deja pendiente cualquier envio fuera de Tizimin', () => {
  const quote = resolveShippingQuote(DeliveryMethod.LOCAL_DELIVERY, { city: 'Merida' });
  assert.equal(quote.deliveryMethod, DeliveryMethod.SHIPPING);
  assert.equal(quote.status, ShippingQuoteStatus.PENDING);
  assert.equal(quote.shippingCents, 0);
});

test('el retiro en tienda no requiere cotizacion', () => {
  const quote = resolveShippingQuote(DeliveryMethod.STORE_PICKUP, null);
  assert.equal(quote.status, ShippingQuoteStatus.NOT_REQUIRED);
  assert.equal(quote.shippingCents, 0);
});
