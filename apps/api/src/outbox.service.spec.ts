import assert from 'node:assert/strict';
import test from 'node:test';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OutboxStatus } from '@prisma/client';
import {
  EMAIL_NOTIFICATION_TYPES,
  isEmailNotificationType,
  OutboxService,
} from './outbox.service';
import { PrismaService } from './prisma.service';

test('solo autoriza correos de pedidos y correos funcionales de cuenta', () => {
  assert.equal(isEmailNotificationType('ORDER_CREATED'), true);
  assert.equal(isEmailNotificationType('SHIPPING_QUOTE_READY'), true);
  assert.equal(isEmailNotificationType('ORDER_PAYMENT_CONFIRMED'), true);
  assert.equal(isEmailNotificationType('SHIPMENT_UPDATED'), true);
  assert.equal(isEmailNotificationType('CUSTOMER_PASSWORD_RESET_REQUESTED'), true);

  assert.equal(isEmailNotificationType('LOW_STOCK_ALERT'), false);
  assert.equal(isEmailNotificationType('ORDER_CHECKOUT_UPDATED'), false);
  assert.equal(isEmailNotificationType('ORDER_PAYMENT_METHOD_SELECTED'), false);
  assert.equal(isEmailNotificationType('ORDER_CHECKOUT_REOPENED'), false);
  assert.equal(isEmailNotificationType('UNKNOWN_EVENT'), false);
});

test('suprime eventos no autorizados incluso si SMTP no esta configurado', async () => {
  let updateManyInput: Record<string, unknown> | undefined;
  const prisma = {
    outboxEvent: {
      updateMany: async (input: Record<string, unknown>) => {
        updateManyInput = input;
        return { count: 307 };
      },
    },
  } as unknown as PrismaService;
  const config = { get: () => undefined } as unknown as ConfigService;
  const service = new OutboxService(prisma, config, {} as JwtService);

  await service.process();

  const where = updateManyInput?.where as {
    status?: OutboxStatus;
    type?: { notIn?: string[] };
  };
  const data = updateManyInput?.data as {
    status?: OutboxStatus;
    lastError?: string;
  };
  assert.equal(where.status, OutboxStatus.PENDING);
  assert.deepEqual(where.type?.notIn, [...EMAIL_NOTIFICATION_TYPES]);
  assert.equal(data.status, OutboxStatus.FAILED);
  assert.match(data.lastError ?? '', /suprimido/);
});
