import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const { Pool } = pg;
const API_URL = process.env.API_URL ?? 'http://127.0.0.1:4000/api/v1';
const runId = randomUUID();
const email = `codex-shipping-${runId}@example.test`;
const password = `Codex-${runId}-Aa1!`;
const idempotencyKey = `codex-shipping-${runId}`;
let customerToken;
let cartToken;
let orderToken;

async function request(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      ...(options.body ? { 'content-type': 'application/json' } : {}),
      ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      ...(options.idempotencyKey
        ? { 'idempotency-key': options.idempotencyKey }
        : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  if (!response.ok && !options.allowFailure) {
    throw new Error(
      `${options.method ?? 'GET'} ${path} devolvió ${response.status}: ${JSON.stringify(body)}`,
    );
  }
  return { status: response.status, body };
}

async function cleanup() {
  if (customerToken && orderToken) {
    await request(`/orders/${orderToken}/cancel`, {
      method: 'POST',
      token: customerToken,
      allowFailure: true,
    }).catch(() => undefined);
  }

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const customers = await client.query(
      'SELECT "id" FROM "Customer" WHERE "email" = $1',
      [email],
    );
    const customerIds = customers.rows.map((row) => row.id);
    const orders = await client.query(
      'SELECT "id" FROM "Order" WHERE "customerEmail" = $1',
      [email],
    );
    const orderIds = orders.rows.map((row) => row.id);

    if (orderIds.length) {
      await client.query(
        'DELETE FROM "AuditLog" WHERE "entityId" = ANY($1::text[])',
        [orderIds],
      );
      await client.query(
        'DELETE FROM "OutboxEvent" WHERE "aggregateId" = ANY($1::text[])',
        [orderIds],
      );
      await client.query(
        'DELETE FROM "StockMovement" WHERE "referenceId" = ANY($1::text[])',
        [orderIds],
      );
      await client.query('DELETE FROM "Order" WHERE "id" = ANY($1::text[])', [orderIds]);
    }
    if (cartToken) {
      await client.query('DELETE FROM "Cart" WHERE "publicToken" = $1', [cartToken]);
    }
    if (customerIds.length) {
      await client.query(
        'DELETE FROM "OutboxEvent" WHERE "aggregateId" = ANY($1::text[])',
        [customerIds],
      );
      await client.query('DELETE FROM "Customer" WHERE "id" = ANY($1::text[])', [
        customerIds,
      ]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

try {
  assert.ok(process.env.ADMIN_EMAIL && process.env.ADMIN_PASSWORD, 'Falta el acceso admin local.');

  const products = await request('/products');
  const variant = products.body.items
    .flatMap((product) => product.variants)
    .find((entry) => entry.inStock && entry.available > 0);
  assert.ok(variant, 'No hay una variante disponible para el smoke test.');

  const customer = await request('/customer-auth/register', {
    method: 'POST',
    body: {
      email,
      password,
      firstName: 'Prueba',
      lastName: 'Cotización',
      phone: '9991234567',
    },
  });
  customerToken = customer.body.accessToken;

  const cart = await request('/carts', { method: 'POST' });
  cartToken = cart.body.publicToken;
  await request(`/carts/${cartToken}/items`, {
    method: 'POST',
    body: { variantId: variant.id, quantity: 1 },
  });

  const invalidAddress = await request('/orders', {
    method: 'POST',
    token: customerToken,
    idempotencyKey: `${idempotencyKey}-invalid-address`,
    allowFailure: true,
    body: {
      cartToken,
      deliveryMethod: 'LOCAL_DELIVERY',
      shippingAddress: {
        recipientName: 'Prueba Cotización',
        phone: '9991234567',
        street: 'a',
        exteriorNumber: '123',
        neighborhood: 'Centro',
        city: 'Tizimín',
        municipality: 'Tizimín',
        state: 'Yucatán',
        postalCode: '97700',
        country: 'MX',
      },
    },
  });
  assert.equal(invalidAddress.status, 400);
  assert.match(JSON.stringify(invalidAddress.body), /La calle debe tener al menos 3 caracteres/);

  const created = await request('/orders', {
    method: 'POST',
    token: customerToken,
    idempotencyKey,
    body: {
      cartToken,
      deliveryMethod: 'LOCAL_DELIVERY',
      shippingAddress: {
        recipientName: 'Prueba Cotización',
        phone: '9991234567',
        street: 'Calle 50',
        exteriorNumber: '123',
        neighborhood: 'Centro',
        city: 'Tizimín',
        municipality: 'Tizimín',
        state: 'Yucatán',
        postalCode: '97700',
        country: 'MX',
        reference: 'Frente al parque principal',
      },
    },
  });
  orderToken = created.body.publicToken;
  assert.equal(created.body.shippingQuoteStatus, 'PENDING');
  assert.equal(created.body.shippingCents, 0);
  assert.equal(created.body.paymentMethod, null);
  assert.equal(created.body.payments.length, 0);

  const repeatedCreate = await request('/orders', {
    method: 'POST',
    token: customerToken,
    idempotencyKey,
    body: {
      cartToken,
      deliveryMethod: 'LOCAL_DELIVERY',
      shippingAddress: {
        recipientName: 'Prueba Cotización',
        phone: '9991234567',
        street: 'Calle 50',
        exteriorNumber: '123',
        neighborhood: 'Centro',
        city: 'Tizimín',
        municipality: 'Tizimín',
        state: 'Yucatán',
        postalCode: '97700',
        country: 'MX',
        reference: 'Frente al parque principal',
      },
    },
  });
  assert.equal(repeatedCreate.body.publicToken, orderToken);

  const blockedPaymentSelection = await request(
    `/orders/${orderToken}/payment-method`,
    {
      method: 'PATCH',
      token: customerToken,
      allowFailure: true,
      body: { paymentMethod: 'BANK_TRANSFER' },
    },
  );
  assert.equal(blockedPaymentSelection.status, 409);

  const admin = await request('/auth/login', {
    method: 'POST',
    body: {
      email: process.env.ADMIN_EMAIL,
      password: process.env.ADMIN_PASSWORD,
    },
  });
  const adminOrderDetail = await request(`/admin/orders/${orderToken}`, {
    token: admin.body.accessToken,
  });
  assert.equal(adminOrderDetail.body.items.length, 1);
  const adminItem = adminOrderDetail.body.items[0];
  assert.ok(adminItem.productName);
  assert.ok(adminItem.variantName);
  assert.ok(adminItem.sku);
  assert.equal(adminItem.quantity, 1);
  assert.ok(adminItem.variant?.product?.name);
  assert.ok(adminItem.variant?.product?.brand?.name);
  assert.ok(Array.isArray(adminItem.variant?.product?.categories));
  assert.ok(Array.isArray(adminItem.variant?.product?.catalogLines));

  const quoted = await request(`/admin/orders/${orderToken}/shipping-quote`, {
    method: 'PATCH',
    token: admin.body.accessToken,
    body: {
      shippingCents: 12_345,
      notes: 'Smoke test local de cotización',
    },
  });
  assert.equal(quoted.body.shippingQuoteStatus, 'QUOTED');
  assert.equal(quoted.body.shippingCents, 12_345);
  assert.equal(
    quoted.body.totalCents,
    quoted.body.subtotalCents - quoted.body.discountCents + 12_345,
  );
  assert.equal(quoted.body.paymentMethod, null);
  assert.equal(quoted.body.payments.length, 0);

  const refreshed = await request(`/orders/${orderToken}`, { token: customerToken });
  assert.equal(refreshed.body.shippingQuoteStatus, 'QUOTED');
  assert.equal(refreshed.body.totalCents, quoted.body.totalCents);

  const [selectedPayment, repeatedSelection] = await Promise.all([
    request(`/orders/${orderToken}/payment-method`, {
      method: 'PATCH',
      token: customerToken,
      body: { paymentMethod: 'BANK_TRANSFER' },
    }),
    request(`/orders/${orderToken}/payment-method`, {
      method: 'PATCH',
      token: customerToken,
      body: { paymentMethod: 'BANK_TRANSFER' },
    }),
  ]);
  assert.equal(selectedPayment.body.paymentMethod, 'BANK_TRANSFER');
  const payment = selectedPayment.body.payments.find(
    (entry) => entry.method === 'BANK_TRANSFER' && entry.status === 'PENDING',
  );
  assert.equal(payment.amountCents, selectedPayment.body.totalCents);

  assert.equal(
    repeatedSelection.body.payments.filter((entry) => entry.status === 'PENDING').length,
    1,
  );

  const enabledUpload = await request('/uploads/transfer-proofs/presign', {
    method: 'POST',
    token: customerToken,
    body: {
      orderToken,
      fileName: 'comprobante.pdf',
      contentType: 'application/pdf',
      sizeBytes: 128,
    },
  });
  assert.match(enabledUpload.body.uploadUrl, /^https?:\/\//);

  console.log(
    JSON.stringify({
      status: 'ok',
      deliveryMethod: selectedPayment.body.deliveryMethod,
      shippingQuoteStatus: selectedPayment.body.shippingQuoteStatus,
      shippingCents: selectedPayment.body.shippingCents,
      paymentMethod: selectedPayment.body.paymentMethod,
      paymentAmountMatchesTotal: payment.amountCents === selectedPayment.body.totalCents,
      invalidAddressBlockedInSpanish: invalidAddress.status === 400,
      duplicateCreateReturnedSameOrder: repeatedCreate.body.publicToken === orderToken,
      paymentChoiceBlockedBeforeQuote: blockedPaymentSelection.status === 409,
      paymentChoiceCreatedOnce: repeatedSelection.body.payments.filter(
        (entry) => entry.status === 'PENDING',
      ).length === 1,
      uploadEnabledAfterQuote: Boolean(enabledUpload.body.uploadUrl),
      adminProductDetailComplete: Boolean(
        adminItem.productName
        && adminItem.variantName
        && adminItem.sku
        && adminItem.variant?.product?.brand?.name,
      ),
    }),
  );
} finally {
  await cleanup();
}
