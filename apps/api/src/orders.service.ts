import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CartStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  PromotionType,
  ReservationStatus,
  StockMovementType,
} from '@prisma/client';
import { CreateOrderDto } from './order.dto';
import { PricingService } from './pricing.service';
import { PrismaService } from './prisma.service';

const orderInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: {
    include: { transferProofs: { orderBy: { createdAt: 'desc' as const } } },
    orderBy: { createdAt: 'desc' as const },
  },
  promotions: true,
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async create(input: CreateOrderDto, idempotencyKey?: string) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('El encabezado Idempotency-Key es obligatorio.');
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const publicToken = await this.prisma.$transaction(
          (transaction) =>
            this.createInTransaction(transaction, input, idempotencyKey.trim()),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
        return this.get(publicToken);
      } catch (error) {
        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          error.code === 'P2034' &&
          attempt < 3
        ) {
          continue;
        }
        throw error;
      }
    }

    throw new ConflictException('No fue posible completar la orden. Intenta nuevamente.');
  }

  async get(publicToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicToken },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return this.serializeOrder(order);
  }

  async cancel(publicToken: string) {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { publicToken },
        });
        if (!order) throw new NotFoundException('Orden no encontrada.');
        if (order.paymentStatus === PaymentStatus.APPROVED) {
          throw new ConflictException('Una orden pagada requiere un proceso de reembolso.');
        }
        if (order.status === OrderStatus.CANCELLED || order.status === OrderStatus.EXPIRED) return;

        const reservations = await transaction.inventoryReservation.findMany({
          where: { orderItem: { orderId: order.id }, status: ReservationStatus.ACTIVE },
        });

        for (const reservation of reservations) {
          const released = await transaction.inventoryLevel.updateMany({
            where: {
              id: reservation.inventoryLevelId,
              reserved: { gte: reservation.quantity },
            },
            data: {
              available: { increment: reservation.quantity },
              reserved: { decrement: reservation.quantity },
              version: { increment: 1 },
            },
          });
          if (!released.count) {
            throw new ConflictException('No fue posible liberar el inventario reservado.');
          }
          await transaction.inventoryReservation.update({
            where: { id: reservation.id },
            data: { status: ReservationStatus.RELEASED, releasedAt: new Date() },
          });
          await transaction.stockMovement.create({
            data: {
              variantId: reservation.variantId,
              locationId: reservation.locationId,
              type: StockMovementType.RELEASE,
              quantity: reservation.quantity,
              referenceId: order.id,
              reason: 'Cancelacion de orden',
            },
          });
        }

        await transaction.payment.updateMany({
          where: { orderId: order.id, status: { in: [PaymentStatus.PENDING, PaymentStatus.IN_PROCESS] } },
          data: { status: PaymentStatus.CANCELLED },
        });
        await transaction.order.update({
          where: { id: order.id },
          data: {
            status: OrderStatus.CANCELLED,
            paymentStatus: PaymentStatus.CANCELLED,
            cancelledAt: new Date(),
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    return this.get(publicToken);
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    input: CreateOrderDto,
    idempotencyKey: string,
  ) {
    const existing = await transaction.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing.publicToken;

    const cart = await transaction.cart.findUnique({
      where: { publicToken: input.cartToken },
      include: {
        items: {
          include: {
            variant: {
              include: {
                product: {
                  include: {
                    linePricingPolicy: true,
                    images: {
                      where: { isPrimary: true },
                      orderBy: { sortOrder: 'asc' },
                      take: 1,
                    },
                    categories: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!cart || cart.status !== CartStatus.ACTIVE || cart.expiresAt <= new Date()) {
      throw new BadRequestException('El carrito no existe, expiro o ya fue procesado.');
    }
    if (!cart.items.length) throw new BadRequestException('El carrito esta vacio.');

    const location = await transaction.storeLocation.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!location) throw new ConflictException('No hay una ubicacion de inventario activa.');

    const pricedItems = cart.items.map((item) => {
      if (!item.variant.isActive || item.variant.product.status !== ProductStatus.ACTIVE) {
        throw new ConflictException(`El producto ${item.variant.product.name} ya no esta disponible.`);
      }
      const price = this.pricing.resolveVariantPrice({
        ...item.variant,
        product: item.variant.product,
      });
      return {
        cartItem: item,
        unitPriceCents: price.amountCents,
        lineTotalCents: price.amountCents * item.quantity,
      };
    });
    const subtotalCents = pricedItems.reduce((total, item) => total + item.lineTotalCents, 0);

    const promotion = input.promotionCode
      ? await transaction.promotion.findFirst({
          where: {
            code: input.promotionCode.trim().toUpperCase(),
            isActive: true,
            startsAt: { lte: new Date() },
            endsAt: { gte: new Date() },
            OR: [{ maximumUses: null }, { uses: { lt: transaction.promotion.fields.maximumUses } }],
          },
          include: { products: true, categories: true },
        })
      : null;

    if (input.promotionCode && !promotion) {
      throw new BadRequestException('La promocion no existe o ya no esta vigente.');
    }

    let discountCents = 0;
    if (promotion) {
      const productIds = new Set(promotion.products.map((entry) => entry.productId));
      const categoryIds = new Set(promotion.categories.map((entry) => entry.categoryId));
      const appliesToEverything = !productIds.size && !categoryIds.size;
      const eligibleSubtotal = pricedItems.reduce((total, item) => {
        const product = item.cartItem.variant.product;
        const eligible =
          appliesToEverything ||
          productIds.has(product.id) ||
          product.categories.some((entry) => categoryIds.has(entry.categoryId));
        return total + (eligible ? item.lineTotalCents : 0);
      }, 0);

      if (subtotalCents < promotion.minimumCents || eligibleSubtotal === 0) {
        throw new BadRequestException('La orden no cumple las condiciones de la promocion.');
      }
      discountCents =
        promotion.type === PromotionType.PERCENTAGE
          ? Math.floor((eligibleSubtotal * promotion.value) / 100)
          : Math.min(promotion.value, eligibleSubtotal);
    }

    const customerEmail = input.customerEmail.trim().toLowerCase();
    const [firstName, ...lastNameParts] = input.customerName.trim().split(/\s+/);
    const customer = await transaction.customer.upsert({
      where: { email: customerEmail },
      update: {
        firstName,
        lastName: lastNameParts.join(' ') || null,
        phone: input.customerPhone.trim(),
      },
      create: {
        email: customerEmail,
        firstName,
        lastName: lastNameParts.join(' ') || null,
        phone: input.customerPhone.trim(),
      },
    });

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const order = await transaction.order.create({
      data: {
        number: this.createOrderNumber(),
        idempotencyKey,
        customerId: customer.id,
        customerName: input.customerName.trim(),
        customerEmail,
        customerPhone: input.customerPhone.trim(),
        paymentMethod: input.paymentMethod,
        deliveryMethod: input.deliveryMethod,
        shippingAddress: input.shippingAddress as Prisma.InputJsonValue | undefined,
        subtotalCents,
        discountCents,
        shippingCents: 0,
        totalCents: subtotalCents - discountCents,
        customerNotes: input.customerNotes?.trim(),
        expiresAt,
      },
    });

    for (const pricedItem of pricedItems) {
      const item = pricedItem.cartItem;
      const inventory = await transaction.inventoryLevel.findUnique({
        where: {
          variantId_locationId: {
            variantId: item.variantId,
            locationId: location.id,
          },
        },
      });
      if (!inventory) {
        throw new ConflictException(`No hay inventario para ${item.variant.product.name}.`);
      }

      const reserved = await transaction.inventoryLevel.updateMany({
        where: { id: inventory.id, available: { gte: item.quantity } },
        data: {
          available: { decrement: item.quantity },
          reserved: { increment: item.quantity },
          version: { increment: 1 },
        },
      });
      if (!reserved.count) {
        throw new ConflictException(`Inventario insuficiente para ${item.variant.product.name}.`);
      }

      const orderItem = await transaction.orderItem.create({
        data: {
          orderId: order.id,
          variantId: item.variantId,
          productName: item.variant.product.name,
          productSlug: item.variant.product.slug,
          productLine: item.variant.product.line,
          variantName: item.variant.name,
          sku: item.variant.sku,
          concentrationLabel: item.variant.concentrationLabel,
          concentrationPercent: item.variant.concentrationPercent,
          volumeMl: item.variant.volumeMl,
          imageUrl: item.variant.product.images[0]?.url,
          quantity: item.quantity,
          unitPriceCents: pricedItem.unitPriceCents,
          lineTotalCents: pricedItem.lineTotalCents,
        },
      });

      await transaction.inventoryReservation.create({
        data: {
          orderItemId: orderItem.id,
          variantId: item.variantId,
          locationId: location.id,
          inventoryLevelId: inventory.id,
          quantity: item.quantity,
          expiresAt,
        },
      });
      await transaction.stockMovement.create({
        data: {
          variantId: item.variantId,
          locationId: location.id,
          type: StockMovementType.RESERVATION,
          quantity: item.quantity,
          referenceId: order.id,
        },
      });
    }

    await transaction.payment.create({
      data: {
        orderId: order.id,
        provider:
          input.paymentMethod === PaymentMethod.CARD ||
          input.paymentMethod === PaymentMethod.PAYMENT_LINK
          ? PaymentProvider.MERCADO_PAGO
          : PaymentProvider.MANUAL,
        method: input.paymentMethod,
        amountCents: order.totalCents,
      },
    });

    if (promotion) {
      await transaction.orderPromotion.create({
        data: {
          orderId: order.id,
          promotionId: promotion.id,
          promotionName: promotion.name,
          discountCents,
        },
      });
      await transaction.promotion.update({
        where: { id: promotion.id },
        data: { uses: { increment: 1 } },
      });
    }

    await transaction.cart.update({
      where: { id: cart.id },
      data: { status: CartStatus.CONVERTED },
    });
    await transaction.outboxEvent.create({
      data: {
        type: 'ORDER_CREATED',
        aggregateType: 'Order',
        aggregateId: order.id,
        payload: { orderId: order.id, publicToken: order.publicToken },
      },
    });

    return order.publicToken;
  }

  private createOrderNumber() {
    return `FTZ-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`;
  }

  private serializeOrder(order: Prisma.OrderGetPayload<{ include: typeof orderInclude }>) {
    return {
      publicToken: order.publicToken,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      fulfillmentStatus: order.fulfillmentStatus,
      paymentMethod: order.paymentMethod,
      deliveryMethod: order.deliveryMethod,
      currency: order.currency,
      subtotalCents: order.subtotalCents,
      discountCents: order.discountCents,
      shippingCents: order.shippingCents,
      totalCents: order.totalCents,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      items: order.items,
      promotions: order.promotions,
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        method: payment.method,
        status: payment.status,
        checkoutUrl: payment.checkoutUrl,
        transferProofs: payment.transferProofs,
      })),
      createdAt: order.createdAt,
    };
  }
}
