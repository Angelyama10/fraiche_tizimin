import assert from 'node:assert/strict';
import test from 'node:test';
import { CatalogService } from './catalog.service';
import { PrismaService } from './prisma.service';

function catalogHarness() {
  let lastQuery: unknown;
  const prisma = {
    promotion: {
      findMany(query: unknown) {
        lastQuery = query;
        return [];
      },
    },
  };

  return {
    service: new CatalogService(prisma as unknown as PrismaService),
    query: () => lastQuery as { where: Record<string, unknown> },
  };
}

test('las promociones publicas ocultan campañas futuras por defecto', () => {
  const harness = catalogHarness();

  harness.service.promotions();

  assert.ok('startsAt' in harness.query().where);
  const validity = harness.query().where.OR;
  assert.ok(Array.isArray(validity));
  assert.deepEqual(validity[0], { endsAt: null });
  assert.ok(validity[1].endsAt.gte instanceof Date);
});

test('el escaparate puede solicitar campañas próximas sin incluir campañas vencidas', () => {
  const harness = catalogHarness();

  harness.service.promotions(true);

  assert.equal('startsAt' in harness.query().where, false);
  assert.ok('OR' in harness.query().where);
  assert.equal(harness.query().where.isActive, true);
});
