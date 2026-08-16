import 'reflect-metadata';
import assert from 'node:assert/strict';
import test from 'node:test';
import { plainToInstance } from 'class-transformer';
import { validate, type ValidationError } from 'class-validator';
import { DeliveryMethod } from '@prisma/client';
import { CreateOrderDto } from './order.dto';

const validAddress = {
  recipientName: 'Ana Pérez',
  phone: '9991234567',
  street: 'Calle 50',
  exteriorNumber: '120-A',
  neighborhood: 'Centro',
  city: 'Tizimín',
  municipality: 'Tizimín',
  state: 'Yucatán',
  postalCode: '97700',
  country: 'MX',
  reference: 'Frente al parque principal',
};

function messages(errors: ValidationError[]): string[] {
  return errors.flatMap((error) => [
    ...Object.values(error.constraints ?? {}),
    ...messages(error.children ?? []),
  ]);
}

test('permite reservar una entrega sin elegir forma de pago', async () => {
  const input = plainToInstance(CreateOrderDto, {
    cartToken: 'cart-token',
    deliveryMethod: DeliveryMethod.SHIPPING,
    shippingAddress: validAddress,
  });

  assert.deepEqual(messages(await validate(input)), []);
});

test('recoger en tienda sigue exigiendo una forma de pago', async () => {
  const input = plainToInstance(CreateOrderDto, {
    cartToken: 'cart-token',
    deliveryMethod: DeliveryMethod.STORE_PICKUP,
  });

  assert.ok(
    messages(await validate(input)).includes(
      'Selecciona una forma de pago para recoger en tienda.',
    ),
  );
});

test('la calle corta devuelve un mensaje claro en español', async () => {
  const input = plainToInstance(CreateOrderDto, {
    cartToken: 'cart-token',
    deliveryMethod: DeliveryMethod.LOCAL_DELIVERY,
    shippingAddress: { ...validAddress, street: 'a' },
  });

  assert.ok(
    messages(await validate(input)).includes(
      'La calle debe tener al menos 3 caracteres.',
    ),
  );
});
