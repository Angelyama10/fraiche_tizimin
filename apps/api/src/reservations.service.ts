import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  OrderStatus,
  PaymentStatus,
  Prisma,
  ReservationStatus,
  StockMovementType,
} from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class ReservationsService {
  private readonly logger = new Logger(ReservationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Interval(60000)
  async expireReservations() {
    const reservations = await this.prisma.inventoryReservation.findMany({
      where: { status: ReservationStatus.ACTIVE, expiresAt: { lte: new Date() } },
      select: { id: true },
      orderBy: { expiresAt: 'asc' },
      take: 100,
    });

    for (const { id } of reservations) {
      try {
        await this.expireOne(id);
      } catch (error) {
        this.logger.error(
          `No se pudo expirar la reserva ${id}: ${error instanceof Error ? error.message : 'unknown'}`,
        );
      }
    }
  }

  private async expireOne(id: string) {
    await this.prisma.$transaction(
      async (transaction) => {
        const reservation = await transaction.inventoryReservation.findUnique({
          where: { id },
          include: { orderItem: true },
        });
        if (!reservation || reservation.status !== ReservationStatus.ACTIVE) return;

        const claimed = await transaction.inventoryReservation.updateMany({
          where: { id, status: ReservationStatus.ACTIVE, expiresAt: { lte: new Date() } },
          data: { status: ReservationStatus.EXPIRED, releasedAt: new Date() },
        });
        if (!claimed.count) return;

        await transaction.inventoryLevel.update({
          where: { id: reservation.inventoryLevelId },
          data: {
            available: { increment: reservation.quantity },
            reserved: { decrement: reservation.quantity },
            version: { increment: 1 },
          },
        });
        await transaction.stockMovement.create({
          data: {
            variantId: reservation.variantId,
            locationId: reservation.locationId,
            type: StockMovementType.RELEASE,
            quantity: reservation.quantity,
            referenceId: reservation.orderItem.orderId,
            reason: 'Reserva expirada',
          },
        });

        const activeReservations = await transaction.inventoryReservation.count({
          where: {
            orderItem: { orderId: reservation.orderItem.orderId },
            status: ReservationStatus.ACTIVE,
          },
        });
        if (!activeReservations) {
          await transaction.order.updateMany({
            where: {
              id: reservation.orderItem.orderId,
              status: OrderStatus.PENDING_PAYMENT,
            },
            data: {
              status: OrderStatus.EXPIRED,
              paymentStatus: PaymentStatus.CANCELLED,
            },
          });
          await transaction.payment.updateMany({
            where: {
              orderId: reservation.orderItem.orderId,
              status: { in: [PaymentStatus.PENDING, PaymentStatus.IN_PROCESS] },
            },
            data: { status: PaymentStatus.CANCELLED },
          });
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }
}
