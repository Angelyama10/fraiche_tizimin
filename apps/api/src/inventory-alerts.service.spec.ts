import assert from 'node:assert/strict';
import test from 'node:test';
import { InventoryAlertStatus } from '@prisma/client';
import { InventoryAlertsService } from './inventory-alerts.service';
import { PrismaService } from './prisma.service';

test('mantiene la alerta de inventario en el panel sin crear correo', async () => {
  let panelAlertsCreated = 0;
  let emailEventsCreated = 0;
  const prisma = {
    inventoryLevel: {
      fields: { lowStockThreshold: 'lowStockThreshold' },
      findMany: async () => [
        {
          id: 'level-1',
          available: 1,
          lowStockThreshold: 3,
          location: { id: 'location-1' },
          variant: { id: 'variant-1', product: { id: 'product-1' } },
        },
      ],
    },
    inventoryAlert: {
      findMany: async () => [],
      findUnique: async () => null,
      create: async () => {
        panelAlertsCreated += 1;
        return { id: 'alert-1', status: InventoryAlertStatus.OPEN };
      },
      updateMany: async () => ({ count: 0 }),
    },
    outboxEvent: {
      create: async () => {
        emailEventsCreated += 1;
      },
    },
  } as unknown as PrismaService;

  const service = new InventoryAlertsService(prisma);
  await service.scan();

  assert.equal(panelAlertsCreated, 1);
  assert.equal(emailEventsCreated, 0);
});
