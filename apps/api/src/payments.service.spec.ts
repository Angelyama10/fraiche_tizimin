import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import {
  DeliveryMethod,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '@prisma/client';
import { PrismaService } from './prisma.service';
import { PaymentsService } from './payments.service';

function configService(values: Record<string, string>) {
  return {
    get(key: string) {
      return values[key];
    },
  } as ConfigService;
}

test('la configuracion publica nunca expone secretos de las pasarelas', () => {
  const service = new PaymentsService(
    {} as PrismaService,
    configService({
      MERCADOPAGO_PUBLIC_KEY: 'APP_USR-public',
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-secret',
      MERCADOPAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
      STRIPE_PUBLISHABLE_KEY: 'stripe-public-key',
      STRIPE_SECRET_KEY: 'stripe-secret-for-test',
      STRIPE_WEBHOOK_SECRET: 'stripe-webhook-for-test',
    }),
  );

  const configuration = service.paymentConfiguration();
  const serialized = JSON.stringify(configuration);

  assert.equal(configuration.mercadoPago.enabled, true);
  assert.equal(configuration.mercadoPago.cardEnabled, true);
  assert.equal(configuration.mercadoPago.linkEnabled, true);
  assert.equal(configuration.stripe.enabled, true);
  assert.equal(serialized.includes('APP_USR-secret'), false);
  assert.equal(serialized.includes('stripe-secret-for-test'), false);
  assert.equal(serialized.includes('stripe-webhook-for-test'), false);
});

test('una pasarela sin firma de webhook se anuncia como no disponible', () => {
  const service = new PaymentsService(
    {} as PrismaService,
    configService({
      MERCADOPAGO_PUBLIC_KEY: 'APP_USR-public',
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-secret',
      STRIPE_PUBLISHABLE_KEY: 'stripe-public-key',
      STRIPE_SECRET_KEY: 'stripe-secret-for-test',
    }),
  );

  const configuration = service.paymentConfiguration();

  assert.equal(configuration.mercadoPago.enabled, false);
  assert.equal(configuration.mercadoPago.cardEnabled, false);
  assert.equal(configuration.mercadoPago.linkEnabled, false);
  assert.equal(configuration.stripe.enabled, false);
});

test('el link de Mercado Pago funciona sin la llave publica de tarjeta', () => {
  const service = new PaymentsService(
    {} as PrismaService,
    configService({
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-secret',
      MERCADOPAGO_WEBHOOK_SECRET: 'mp-webhook-secret',
    }),
  );

  const configuration = service.paymentConfiguration();

  assert.equal(configuration.mercadoPago.enabled, false);
  assert.equal(configuration.mercadoPago.cardEnabled, false);
  assert.equal(configuration.mercadoPago.linkEnabled, true);
  assert.equal(configuration.mercadoPago.publicKey, null);
});

test('Mercado Pago cobra el total y correo guardados en la orden', async () => {
  let requestBody: Record<string, unknown> | undefined;
  const payment = {
    id: 'payment-1',
    orderId: 'order-1',
    provider: PaymentProvider.MERCADO_PAGO,
    method: PaymentMethod.CARD,
    status: PaymentStatus.PENDING,
    amountCents: 42_000,
    currency: 'MXN',
    providerPaymentId: null,
    providerPreferenceId: null,
    checkoutUrl: null,
    statusDetail: null,
    providerResponse: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const order = {
    id: 'order-1',
    publicToken: 'order-token',
    number: 'FTZ-TEST',
    idempotencyKey: 'order-idempotency',
    customerId: 'customer-1',
    customerName: 'Cliente',
    customerEmail: 'cliente@example.com',
    customerPhone: '9990000000',
    status: OrderStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
    paymentMethod: PaymentMethod.CARD,
    deliveryMethod: DeliveryMethod.SHIPPING,
    shippingAddress: null,
    currency: 'MXN',
    subtotalCents: 42_000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 42_000,
    customerNotes: null,
    internalNotes: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    payments: [payment],
  };
  const transaction = {
    payment: { update: async () => payment },
    order: { update: async () => order },
  };
  const prisma = {
    order: {
      findFirst: async () => order,
      findUnique: async () => order,
    },
    $transaction: async (callback: (client: typeof transaction) => unknown) =>
      callback(transaction),
  } as unknown as PrismaService;
  const service = new PaymentsService(
    prisma,
    configService({
      PUBLIC_API_URL: 'https://api.example.com',
      MERCADOPAGO_ACCESS_TOKEN: 'APP_USR-secret',
    }),
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input, init) => {
    requestBody = JSON.parse(String(init?.body)) as Record<string, unknown>;
    return new Response(
      JSON.stringify({
        id: 123,
        status: 'pending',
        external_reference: order.publicToken,
        transaction_amount: 420,
        currency_id: 'MXN',
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    );
  };

  try {
    await service.processMercadoPagoCard(
      order.publicToken,
      {
        token: 'card-token',
        payment_method_id: 'debvisa',
        transaction_amount: 0.01,
        installments: 1,
        payer: { email: 'atacante@example.com' },
      },
      'customer-1',
    );
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert.equal(requestBody?.transaction_amount, 420);
  assert.deepEqual(requestBody?.payer, {
    email: 'cliente@example.com',
  });
});

test('Stripe no reembolsa cuando otra solicitud ya confirmo y consumio la reserva', async () => {
  const payment = {
    id: 'payment-stripe-1',
    orderId: 'order-stripe-1',
    provider: PaymentProvider.STRIPE,
    method: PaymentMethod.CARD,
    status: PaymentStatus.PENDING,
    amountCents: 1_000,
    currency: 'MXN',
    providerPaymentId: 'pi_succeeded',
    providerPreferenceId: null,
    checkoutUrl: null,
    statusDetail: null,
    providerResponse: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const pendingOrder = {
    id: 'order-stripe-1',
    publicToken: 'stripe-order-token',
    number: 'FTZ-STRIPE',
    idempotencyKey: 'stripe-idempotency',
    customerId: 'customer-1',
    customerName: 'Cliente',
    customerEmail: 'cliente@example.com',
    customerPhone: '9990000000',
    status: OrderStatus.PENDING_PAYMENT,
    paymentStatus: PaymentStatus.PENDING,
    fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
    paymentMethod: PaymentMethod.CARD,
    deliveryMethod: DeliveryMethod.SHIPPING,
    shippingAddress: null,
    currency: 'MXN',
    subtotalCents: 1_000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 1_000,
    customerNotes: null,
    internalNotes: null,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000),
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    payments: [payment],
  };
  const finalizedOrder = {
    status: OrderStatus.CONFIRMED,
    paymentStatus: PaymentStatus.APPROVED,
    expiresAt: pendingOrder.expiresAt,
  };
  let orderStateReads = 0;
  let refundCalls = 0;
  const prisma = {
    order: {
      findFirst: async () => pendingOrder,
      findUnique: async () => {
        orderStateReads += 1;
        return orderStateReads === 1
          ? {
              status: OrderStatus.PENDING_PAYMENT,
              paymentStatus: PaymentStatus.PENDING,
              expiresAt: pendingOrder.expiresAt,
            }
          : finalizedOrder;
      },
    },
    inventoryReservation: {
      count: async () => 0,
    },
  } as unknown as PrismaService;
  const service = new PaymentsService(prisma, configService({}));
  Object.assign(service, {
    stripeClient: () => ({
      paymentIntents: {
        retrieve: async () => ({
          id: 'pi_succeeded',
          amount: 1_000,
          amount_received: 1_000,
          currency: 'mxn',
          status: 'succeeded',
          metadata: { orderToken: pendingOrder.publicToken },
          last_payment_error: null,
        }),
      },
      refunds: {
        create: async () => {
          refundCalls += 1;
          return { id: 're_should_not_exist' };
        },
      },
    }),
  });

  const result = await service.syncStripePayment(pendingOrder.publicToken, 'customer-1');

  assert.equal(result.status, PaymentStatus.APPROVED);
  assert.equal(orderStateReads, 2);
  assert.equal(refundCalls, 0);
});

test('Stripe conserva el reembolso automatico para una reserva realmente expirada', async () => {
  const payment = {
    id: 'payment-stripe-expired',
    orderId: 'order-stripe-expired',
    provider: PaymentProvider.STRIPE,
    method: PaymentMethod.CARD,
    status: PaymentStatus.PENDING,
    amountCents: 1_000,
    currency: 'MXN',
    providerPaymentId: 'pi_late',
    providerPreferenceId: null,
    checkoutUrl: null,
    statusDetail: null,
    providerResponse: null,
    approvedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  const expiredOrder = {
    id: 'order-stripe-expired',
    publicToken: 'stripe-expired-token',
    number: 'FTZ-EXPIRED',
    idempotencyKey: 'stripe-expired-idempotency',
    customerId: 'customer-1',
    customerName: 'Cliente',
    customerEmail: 'cliente@example.com',
    customerPhone: '9990000000',
    status: OrderStatus.EXPIRED,
    paymentStatus: PaymentStatus.CANCELLED,
    fulfillmentStatus: FulfillmentStatus.UNFULFILLED,
    paymentMethod: PaymentMethod.CARD,
    deliveryMethod: DeliveryMethod.SHIPPING,
    shippingAddress: null,
    currency: 'MXN',
    subtotalCents: 1_000,
    discountCents: 0,
    shippingCents: 0,
    totalCents: 1_000,
    customerNotes: null,
    internalNotes: null,
    expiresAt: new Date(Date.now() - 60_000),
    paidAt: null,
    cancelledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    items: [],
    payments: [payment],
  };
  let refundCalls = 0;
  const prisma = {
    order: {
      findFirst: async () => expiredOrder,
      findUnique: async () => ({
        status: OrderStatus.EXPIRED,
        paymentStatus: PaymentStatus.CANCELLED,
        expiresAt: expiredOrder.expiresAt,
      }),
      update: async () => expiredOrder,
    },
    payment: {
      findFirst: async () => payment,
      update: async () => payment,
    },
    $transaction: async (operations: Array<Promise<unknown>>) => Promise.all(operations),
  } as unknown as PrismaService;
  const service = new PaymentsService(prisma, configService({}));
  Object.assign(service, {
    stripeClient: () => ({
      paymentIntents: {
        retrieve: async () => ({
          id: 'pi_late',
          amount: 1_000,
          amount_received: 1_000,
          currency: 'mxn',
          status: 'succeeded',
          metadata: { orderToken: expiredOrder.publicToken },
          last_payment_error: null,
        }),
      },
      refunds: {
        create: async () => {
          refundCalls += 1;
          return { id: 're_late' };
        },
      },
    }),
  });

  const result = await service.syncStripePayment(expiredOrder.publicToken, 'customer-1');

  assert.equal(result.status, PaymentStatus.REFUNDED);
  assert.equal(refundCalls, 1);
});
