import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { InventoryAlertStatus, Prisma, ProductStatus } from '@prisma/client';
import { PaginationDto } from './admin-commerce.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class InventoryAlertsService {
  private readonly logger = new Logger(InventoryAlertsService.name);
  private running = false;

  constructor(private readonly prisma: PrismaService) {}

  @Interval(5 * 60 * 1000)
  async scan() {
    if (this.running) return;
    this.running = true;
    try {
      await this.resolveRestockedAlerts();
      const levels = await this.prisma.inventoryLevel.findMany({
        where: {
          available: { lte: this.prisma.inventoryLevel.fields.lowStockThreshold },
          location: { isActive: true },
          variant: { isActive: true, product: { status: ProductStatus.ACTIVE } },
        },
        include: {
          location: true,
          variant: { include: { product: true } },
        },
        orderBy: { available: 'asc' },
        take: 500,
      });

      for (const level of levels) {
        try {
          await this.ensureAlert(level);
        } catch (error) {
          this.logger.error(
            `No se pudo actualizar la alerta de ${level.id}: ${
              error instanceof Error ? error.message : 'unknown'
            }`,
          );
        }
      }
    } finally {
      this.running = false;
    }
  }

  async list(query: PaginationDto) {
    const where = { status: { in: [InventoryAlertStatus.OPEN, InventoryAlertStatus.ACKNOWLEDGED] } };
    const [alerts, total] = await this.prisma.$transaction([
      this.prisma.inventoryAlert.findMany({
        where,
        include: {
          acknowledgedBy: { select: { id: true, name: true, email: true } },
          inventoryLevel: {
            include: {
              location: true,
              variant: { include: { product: true } },
            },
          },
        },
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryAlert.count({ where }),
    ]);
    return {
      data: alerts,
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async acknowledge(alertId: string, actorId: string) {
    const updated = await this.prisma.inventoryAlert.updateMany({
      where: { id: alertId, status: InventoryAlertStatus.OPEN, activeKey: { not: null } },
      data: {
        status: InventoryAlertStatus.ACKNOWLEDGED,
        acknowledgedAt: new Date(),
        acknowledgedById: actorId,
      },
    });
    if (!updated.count) throw new NotFoundException('La alerta ya no esta abierta.');
    return this.prisma.inventoryAlert.findUniqueOrThrow({ where: { id: alertId } });
  }

  private async ensureAlert(level: {
    id: string;
    available: number;
    lowStockThreshold: number;
  }) {
    const existing = await this.prisma.inventoryAlert.findUnique({
      where: { activeKey: level.id },
    });
    if (existing) return existing;

    try {
      return await this.prisma.inventoryAlert.create({
        data: {
          inventoryLevelId: level.id,
          activeKey: level.id,
          availableAtTrigger: level.available,
          thresholdAtTrigger: level.lowStockThreshold,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        return this.prisma.inventoryAlert.findUniqueOrThrow({
          where: { activeKey: level.id },
        });
      }
      throw error;
    }
  }

  private async resolveRestockedAlerts() {
    const alerts = await this.prisma.inventoryAlert.findMany({
      where: {
        activeKey: { not: null },
        status: { in: [InventoryAlertStatus.OPEN, InventoryAlertStatus.ACKNOWLEDGED] },
      },
      include: { inventoryLevel: true },
      take: 1000,
    });
    const resolvedIds = alerts
      .filter(
        (alert) =>
          alert.inventoryLevel.available > alert.inventoryLevel.lowStockThreshold,
      )
      .map((alert) => alert.id);
    if (resolvedIds.length) {
      await this.prisma.inventoryAlert.updateMany({
        where: { id: { in: resolvedIds } },
        data: {
          status: InventoryAlertStatus.RESOLVED,
          activeKey: null,
          resolvedAt: new Date(),
        },
      });
    }
  }
}
