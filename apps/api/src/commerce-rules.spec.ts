import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DeliveryMethod,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PromotionPlacement,
  PromotionType,
  ShipmentStatus,
} from '@prisma/client';
import {
  calculatePromotionDiscount,
  canTransitionOrder,
  canTransitionShipment,
  customerCanUsePromotion,
  fulfillmentForOrderStatus,
  reservationLifetimeMs,
  selectAppliedPromotions,
} from './commerce-rules';

test('permite el recorrido normal de una guia y bloquea cambios despues de entregar', () => {
  assert.equal(
    canTransitionShipment(ShipmentStatus.LABEL_CREATED, ShipmentStatus.IN_TRANSIT),
    true,
  );
  assert.equal(
    canTransitionShipment(ShipmentStatus.IN_TRANSIT, ShipmentStatus.DELIVERED),
    true,
  );
  assert.equal(
    canTransitionShipment(ShipmentStatus.DELIVERED, ShipmentStatus.IN_TRANSIT),
    false,
  );
});

test('mantiene el flujo operativo de una orden en una sola direccion', () => {
  assert.equal(canTransitionOrder(OrderStatus.PENDING_PAYMENT, OrderStatus.READY), true);
  assert.equal(canTransitionOrder(OrderStatus.CONFIRMED, OrderStatus.PROCESSING), true);
  assert.equal(canTransitionOrder(OrderStatus.CONFIRMED, OrderStatus.READY), true);
  assert.equal(canTransitionOrder(OrderStatus.PROCESSING, OrderStatus.READY), true);
  assert.equal(canTransitionOrder(OrderStatus.READY, OrderStatus.COMPLETED), true);
  assert.equal(canTransitionOrder(OrderStatus.COMPLETED, OrderStatus.PROCESSING), false);
});

test('convierte listo al estado de entrega correcto segun el metodo', () => {
  assert.equal(
    fulfillmentForOrderStatus(
      OrderStatus.READY,
      DeliveryMethod.STORE_PICKUP,
      FulfillmentStatus.PREPARING,
    ),
    FulfillmentStatus.READY_FOR_PICKUP,
  );
  assert.equal(
    fulfillmentForOrderStatus(
      OrderStatus.READY,
      DeliveryMethod.LOCAL_DELIVERY,
      FulfillmentStatus.PREPARING,
    ),
    FulfillmentStatus.READY_FOR_PICKUP,
  );
  assert.equal(
    fulfillmentForOrderStatus(
      OrderStatus.READY,
      DeliveryMethod.SHIPPING,
      FulfillmentStatus.PREPARING,
    ),
    FulfillmentStatus.PREPARING,
  );
});

test('reserva mas tiempo para pagos manuales', () => {
  assert.equal(reservationLifetimeMs(PaymentMethod.CARD), 30 * 60 * 1000);
  assert.equal(reservationLifetimeMs(PaymentMethod.BANK_TRANSFER), 24 * 60 * 60 * 1000);
  assert.equal(reservationLifetimeMs(PaymentMethod.CASH), 48 * 60 * 60 * 1000);
});

test('calcula porcentaje entero y respeta el descuento maximo', () => {
  assert.equal(
    calculatePromotionDiscount({
      type: PromotionType.PERCENTAGE,
      value: 20,
      eligibleSubtotalCents: 10_000,
      maximumDiscountCents: 1_500,
    }),
    1_500,
  );
});

test('un descuento fijo nunca supera el subtotal elegible', () => {
  assert.equal(
    calculatePromotionDiscount({
      type: PromotionType.FIXED_AMOUNT,
      value: 5_000,
      eligibleSubtotalCents: 3_800,
    }),
    3_800,
  );
});

test('la bienvenida solo se aplica cuando el cliente no tiene pedidos previos', () => {
  assert.equal(
    customerCanUsePromotion(PromotionPlacement.WELCOME, false),
    true,
  );
  assert.equal(
    customerCanUsePromotion(PromotionPlacement.WELCOME, true),
    false,
  );
  assert.equal(
    customerCanUsePromotion(PromotionPlacement.GENERAL, true),
    true,
  );
});

test('combina solo promociones acumulables y nunca deja un total negativo', () => {
  const applied = selectAppliedPromotions(
    [
      { promotion: { isStackable: false }, discountCents: 7_000 },
      { promotion: { isStackable: false }, discountCents: 6_000 },
      { promotion: { isStackable: true }, discountCents: 5_000 },
    ],
    false,
    10_000,
  );
  assert.deepEqual(
    applied.map((entry) => entry.discountCents),
    [7_000, 3_000],
  );
});
