import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  DeliveryMethod,
  FulfillmentStatus,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ShipmentStatus,
} from '@prisma/client';
import { CreateShipmentDto, UpdateShipmentDto } from './admin-commerce.dto';
import { canTransitionShipment } from './commerce-rules';
import { PrismaService } from './prisma.service';

const shipmentInclude = {
  events: { orderBy: { occurredAt: 'desc' as const } },
  order: { select: { publicToken: true, number: true, customerEmail: true } },
} satisfies Prisma.ShipmentInclude;

@Injectable()
export class ShipmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(orderToken: string, input: CreateShipmentDto, actorId: string) {
    const order = await this.prisma.order.findUnique({ where: { publicToken: orderToken } });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    if (order.deliveryMethod === DeliveryMethod.STORE_PICKUP) {
      throw new ConflictException('Una orden para recoger en tienda no utiliza guia de envio.');
    }
    if (
      new Set<OrderStatus>([
        OrderStatus.CANCELLED,
        OrderStatus.EXPIRED,
        OrderStatus.COMPLETED,
      ]).has(order.status)
    ) {
      throw new ConflictException('La orden ya no admite nuevos envios.');
    }
    if (
      order.paymentStatus !== PaymentStatus.APPROVED &&
      order.paymentMethod !== PaymentMethod.CASH
    ) {
      throw new ConflictException('La orden debe estar pagada antes de generar el envio.');
    }

    const status = input.status ?? ShipmentStatus.LABEL_CREATED;
    if (status === ShipmentStatus.DELIVERED && order.paymentStatus !== PaymentStatus.APPROVED) {
      throw new ConflictException('Confirma el pago antes de marcar el envio como entregado.');
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const shipment = await transaction.shipment.create({
          data: {
            orderId: order.id,
            carrier: input.carrier.trim().toUpperCase(),
            service: input.service?.trim(),
            trackingNumber: input.trackingNumber.trim().toUpperCase(),
            trackingUrl: input.trackingUrl?.trim(),
            status,
            estimatedDeliveryAt: input.estimatedDeliveryAt
              ? new Date(input.estimatedDeliveryAt)
              : undefined,
            shippedAt: this.hasLeftStore(status) ? new Date() : undefined,
            deliveredAt: status === ShipmentStatus.DELIVERED ? new Date() : undefined,
            notes: input.notes?.trim(),
            createdById: actorId,
          },
        });
        const shipmentEvent = await transaction.shipmentEvent.create({
          data: {
            shipmentId: shipment.id,
            status,
            description: input.notes?.trim() ?? 'Guia de envio registrada.',
            createdById: actorId,
          },
        });
        await this.updateOrderFromShipment(transaction, order.id, order.status, status);
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'SHIPMENT_CREATED',
            entityType: 'Shipment',
            entityId: shipment.id,
            after: {
              orderId: order.id,
              carrier: shipment.carrier,
              trackingNumber: shipment.trackingNumber,
              status: shipment.status,
            },
          },
        });
        await this.enqueueCustomerUpdate(
          transaction,
          order.id,
          shipment.id,
          status,
          shipmentEvent.id,
        );
        return transaction.shipment.findUniqueOrThrow({
          where: { id: shipment.id },
          include: shipmentInclude,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Esta guia ya fue registrada para la paqueteria.');
      }
      throw error;
    }
  }

  async update(shipmentId: string, input: UpdateShipmentDto, actorId: string) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { order: true },
    });
    if (!shipment) throw new NotFoundException('Envio no encontrado.');

    const nextStatus = input.status ?? shipment.status;
    if (!canTransitionShipment(shipment.status, nextStatus)) {
      throw new ConflictException(
        `El envio no puede pasar de ${shipment.status} a ${nextStatus}.`,
      );
    }
    if (
      nextStatus === ShipmentStatus.DELIVERED &&
      shipment.order.paymentStatus !== PaymentStatus.APPROVED
    ) {
      throw new ConflictException('Confirma el pago antes de marcar el envio como entregado.');
    }

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const updated = await transaction.shipment.update({
          where: { id: shipment.id },
          data: {
            carrier: input.carrier?.trim().toUpperCase(),
            service: input.service?.trim(),
            trackingNumber: input.trackingNumber?.trim().toUpperCase(),
            trackingUrl: input.trackingUrl?.trim(),
            status: nextStatus,
            estimatedDeliveryAt: input.estimatedDeliveryAt
              ? new Date(input.estimatedDeliveryAt)
              : undefined,
            shippedAt:
              !shipment.shippedAt && this.hasLeftStore(nextStatus) ? new Date() : undefined,
            deliveredAt:
              nextStatus === ShipmentStatus.DELIVERED && !shipment.deliveredAt
                ? new Date()
                : undefined,
            notes: input.notes?.trim(),
          },
        });

        const shouldCreateEvent =
          nextStatus !== shipment.status ||
          Boolean(input.eventDescription || input.eventLocation || input.occurredAt);
        if (shouldCreateEvent) {
          const shipmentEvent = await transaction.shipmentEvent.create({
            data: {
              shipmentId: shipment.id,
              status: nextStatus,
              description: input.eventDescription?.trim(),
              location: input.eventLocation?.trim(),
              occurredAt: input.occurredAt ? new Date(input.occurredAt) : new Date(),
              createdById: actorId,
            },
          });
          if (nextStatus !== shipment.status) {
            await this.updateOrderFromShipment(
              transaction,
              shipment.orderId,
              shipment.order.status,
              nextStatus,
            );
          }
          await this.enqueueCustomerUpdate(
            transaction,
            shipment.orderId,
            shipment.id,
            nextStatus,
            shipmentEvent.id,
          );
        }

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'SHIPMENT_UPDATED',
            entityType: 'Shipment',
            entityId: shipment.id,
            before: {
              carrier: shipment.carrier,
              trackingNumber: shipment.trackingNumber,
              status: shipment.status,
            },
            after: {
              carrier: updated.carrier,
              trackingNumber: updated.trackingNumber,
              status: updated.status,
            },
          },
        });
        return transaction.shipment.findUniqueOrThrow({
          where: { id: shipment.id },
          include: shipmentInclude,
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Esta guia ya fue registrada para la paqueteria.');
      }
      throw error;
    }
  }

  private async updateOrderFromShipment(
    transaction: Prisma.TransactionClient,
    orderId: string,
    currentOrderStatus: OrderStatus,
    shipmentStatus: ShipmentStatus,
  ) {
    if (shipmentStatus === ShipmentStatus.DELIVERED) {
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status: OrderStatus.COMPLETED,
          fulfillmentStatus: FulfillmentStatus.DELIVERED,
        },
      });
      return;
    }
    if (this.isShipped(shipmentStatus)) {
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status:
            currentOrderStatus === OrderStatus.CONFIRMED
              ? OrderStatus.PROCESSING
              : currentOrderStatus,
          fulfillmentStatus: FulfillmentStatus.SHIPPED,
        },
      });
      return;
    }
    if (
      shipmentStatus === ShipmentStatus.PENDING ||
      shipmentStatus === ShipmentStatus.LABEL_CREATED
    ) {
      await transaction.order.update({
        where: { id: orderId },
        data: {
          status:
            currentOrderStatus === OrderStatus.CONFIRMED
              ? OrderStatus.PROCESSING
              : currentOrderStatus,
          fulfillmentStatus: FulfillmentStatus.PREPARING,
        },
      });
    }
  }

  private enqueueCustomerUpdate(
    transaction: Prisma.TransactionClient,
    orderId: string,
    shipmentId: string,
    status: ShipmentStatus,
    shipmentEventId: string,
  ) {
    return transaction.outboxEvent.create({
      data: {
        type: 'SHIPMENT_UPDATED',
        aggregateType: 'Order',
        aggregateId: orderId,
        deduplicationKey: `SHIPMENT_EVENT:${shipmentEventId}`,
        payload: { orderId, shipmentId, shipmentEventId, status },
      },
    });
  }

  private isShipped(status: ShipmentStatus) {
    return status === ShipmentStatus.IN_TRANSIT || status === ShipmentStatus.OUT_FOR_DELIVERY;
  }

  private hasLeftStore(status: ShipmentStatus) {
    return this.isShipped(status) || status === ShipmentStatus.DELIVERED;
  }
}
