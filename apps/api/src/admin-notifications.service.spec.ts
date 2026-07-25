import assert from 'node:assert/strict';
import test from 'node:test';
import { AdminNotificationsService } from './admin-notifications.service';
import { PrismaService } from './prisma.service';

test('limita las notificaciones al usuario autenticado y calcula no leidas', async () => {
  const capturedWhere: Array<Record<string, unknown>> = [];
  const prisma = {
    adminNotification: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        capturedWhere.push(where);
        return [];
      },
      count: async ({ where }: { where: Record<string, unknown> }) => {
        capturedWhere.push(where);
        return where.readAt === null ? 2 : 5;
      },
    },
  } as unknown as PrismaService;
  const service = new AdminNotificationsService(prisma);

  const result = await service.list('staff-1', { page: 1, pageSize: 25 });

  assert.equal(result.total, 5);
  assert.equal(result.unreadCount, 2);
  assert.ok(capturedWhere.every((where) => where.userId === 'staff-1'));
});
