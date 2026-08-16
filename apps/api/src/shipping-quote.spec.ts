import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliveryMethod, ShippingQuoteStatus } from '@prisma/client';
import {
  isShippingQuoteReadyForPayment,
  resolveShippingQuote,
} from './shipping-quote';

test('deja pendiente el envio nacional hasta que administracion lo cotice', () => {
  const quote = resolveShippingQuote(DeliveryMethod.SHIPPING, { municipality: 'Tizimín' });
  assert.equal(quote.deliveryMethod, DeliveryMethod.SHIPPING);
  assert.equal(quote.status, ShippingQuoteStatus.PENDING);
  assert.equal(quote.shippingCents, 0);
});

test('deja pendiente la entrega local hasta que administracion la cotice', () => {
  const quote = resolveShippingQuote(DeliveryMethod.LOCAL_DELIVERY, { city: 'Tizimín' });
  assert.equal(quote.deliveryMethod, DeliveryMethod.LOCAL_DELIVERY);
  assert.equal(quote.status, ShippingQuoteStatus.PENDING);
  assert.equal(quote.shippingCents, 0);
});

test('el retiro en tienda no requiere cotizacion', () => {
  const quote = resolveShippingQuote(DeliveryMethod.STORE_PICKUP, null);
  assert.equal(quote.status, ShippingQuoteStatus.NOT_REQUIRED);
  assert.equal(quote.shippingCents, 0);
});

test('bloquea el pago de entregas pendientes y habilita las ya cotizadas', () => {
  assert.equal(
    isShippingQuoteReadyForPayment(
      DeliveryMethod.LOCAL_DELIVERY,
      ShippingQuoteStatus.PENDING,
    ),
    false,
  );
  assert.equal(
    isShippingQuoteReadyForPayment(
      DeliveryMethod.SHIPPING,
      ShippingQuoteStatus.QUOTED,
    ),
    true,
  );
  assert.equal(
    isShippingQuoteReadyForPayment(
      DeliveryMethod.STORE_PICKUP,
      ShippingQuoteStatus.NOT_REQUIRED,
    ),
    true,
  );
});
