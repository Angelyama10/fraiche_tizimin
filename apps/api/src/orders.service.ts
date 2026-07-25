import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AdminNotificationType,
  CartStatus,
  OrderStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
  Prisma,
  ProductStatus,
  ReservationStatus,
  StockMovementType,
  UserRole,
} from '@prisma/client';
import { CreateOrderDto, ListCustomerOrdersDto } from './order.dto';
import { calculatePromotionDiscount, selectAppliedPromotions } from './commerce-rules';
import { PricingService } from './pricing.service';
import { PrismaService } from './prisma.service';

const orderInclude = {
  items: { orderBy: { createdAt: 'asc' as const } },
  payments: {
    include: { transferProofs: { orderBy: { createdAt: 'desc' as const } } },
    orderBy: { createdAt: 'desc' as const },
  },
  promotions: true,
  shipments: {
    include: { events: { orderBy: { occurredAt: 'desc' as const } } },
    orderBy: { createdAt: 'desc' as const },
  },
} satisfies Prisma.OrderInclude;

@Injectable()
export class OrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
    private readonly config: ConfigService,
  ) {}

  async create(input: CreateOrderDto, idempotencyKey: string | undefined, customerId: string) {
    if (!idempotencyKey?.trim()) {
      throw new BadRequestException('El encabezado Idempotency-Key es obligatorio.');
    }

    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const publicToken = await this.prisma.$transaction(
          (transaction) =>
            this.createInTransaction(transaction, input, idempotencyKey.trim(), customerId),
          {
            isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
            maxWait: 5000,
            timeout: 15000,
          },
        );
        return this.getForCustomer(publicToken, customerId);
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

  async getForCustomer(publicToken: string, customerId: string) {
    const order = await this.prisma.order.findFirst({
      where: { publicToken, customerId },
      include: orderInclude,
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return this.serializeOrder(order);
  }

  async listForCustomer(customerId: string, query: ListCustomerOrdersDto) {
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where: { customerId },
        include: orderInclude,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where: { customerId } }),
    ]);
    return {
      data: orders.map((order) => this.serializeOrder(order)),
      pagination: {
        page: query.page,
        pageSize: query.pageSize,
        total,
        pageCount: Math.ceil(total / query.pageSize),
      },
    };
  }

  async cancel(publicToken: string, customerId: string) {
    await this.cancelOrder(publicToken, customerId);
    return this.getForCustomer(publicToken, customerId);
  }

  async cancelByAdmin(publicToken: string) {
    await this.cancelOrder(publicToken);
    return this.get(publicToken);
  }

  private async cancelOrder(publicToken: string, customerId?: string) {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findFirst({
          where: { publicToken, ...(customerId ? { customerId } : {}) },
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
        const appliedPromotions = await transaction.orderPromotion.findMany({
          where: { orderId: order.id, releasedAt: null },
        });
        for (const applied of appliedPromotions) {
          await transaction.promotion.updateMany({
            where: { id: applied.promotionId, uses: { gt: 0 } },
            data: { uses: { decrement: 1 } },
          });
          await transaction.orderPromotion.update({
            where: {
              orderId_promotionId: {
                orderId: order.id,
                promotionId: applied.promotionId,
              },
            },
            data: { releasedAt: new Date() },
          });
        }
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
  }

  private async createInTransaction(
    transaction: Prisma.TransactionClient,
    input: CreateOrderDto,
    idempotencyKey: string,
    customerId: string,
  ) {
    const existing = await transaction.order.findUnique({ where: { idempotencyKey } });
    if (existing) return existing.publicToken;

    const customer = await transaction.customer.findFirst({
      where: { id: customerId, isActive: true, passwordHash: { not: null } },
    });
    if (!customer?.email || !customer.firstName || !customer.phone) {
      throw new BadRequestException('Completa los datos de tu cuenta antes de comprar.');
    }
    if (
      this.config.get<string>('REQUIRE_EMAIL_VERIFICATION') === 'true' &&
      !customer.emailVerifiedAt
    ) {
      throw new BadRequestException('Verifica tu correo antes de completar la compra.');
    }

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
    if (cart.customerId && cart.customerId !== customerId) {
      throw new ConflictException('El carrito pertenece a otra cuenta.');
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

    const now = new Date();
    const promotionCandidates = await transaction.promotion.findMany({
      where: {
        ...(input.promotionCode
          ? { code: input.promotionCode.trim().toUpperCase() }
          : { requiresCode: false }),
        isActive: true,
        startsAt: { lte: now },
        endsAt: { gte: now },
      },
      include: { products: true, categories: true },
      orderBy: [{ priority: 'desc' }, { startsAt: 'desc' }],
      take: input.promotionCode ? 1 : 50,
    });

    if (input.promotionCode && !promotionCandidates.length) {
      throw new BadRequestException('La promocion no existe o ya no esta vigente.');
    }

    const customerPromotionUsage = promotionCandidates.length
      ? await transaction.orderPromotion.groupBy({
          by: ['promotionId'],
          where: {
            promotionId: { in: promotionCandidates.map((entry) => entry.id) },
            releasedAt: null,
            order: { customerId },
          },
          _count: { _all: true },
        })
      : [];
    const usageByPromotion = new Map(
      customerPromotionUsage.map((entry) => [entry.promotionId, entry._count._all]),
    );
    const evaluatedPromotions = promotionCandidates.flatMap((candidate) => {
      if (candidate.maximumUses !== null && candidate.uses >= candidate.maximumUses) return [];
      if (
        candidate.perCustomerLimit !== null &&
        (usageByPromotion.get(candidate.id) ?? 0) >= candidate.perCustomerLimit
      ) {
        return [];
      }
      const productIds = new Set(candidate.products.map((entry) => entry.productId));
      const categoryIds = new Set(candidate.categories.map((entry) => entry.categoryId));
      const appliesToEverything = !productIds.size && !categoryIds.size;
      const eligibleSubtotal = pricedItems.reduce((total, item) => {
        const product = item.cartItem.variant.product;
        const eligible =
          appliesToEverything ||
          productIds.has(product.id) ||
          product.categories.some((entry) => categoryIds.has(entry.categoryId));
        return total + (eligible ? item.lineTotalCents : 0);
      }, 0);
      if (subtotalCents < candidate.minimumCents || eligibleSubtotal === 0) return [];
      const discountCents = calculatePromotionDiscount({
        type: candidate.type,
        value: candidate.value,
        eligibleSubtotalCents: eligibleSubtotal,
        maximumDiscountCents: candidate.maximumDiscountCents,
      });
      return [{ promotion: candidate, discountCents }];
    });

    if (input.promotionCode && !evaluatedPromotions.length) {
      throw new BadRequestException(
        'La orden no cumple las condiciones o el limite de la promocion.',
      );
    }
    evaluatedPromotions.sort(
      (left, right) =>
        right.discountCents - left.discountCents ||
        right.promotion.priority - left.promotion.priority,
    );
    const appliedPromotions = selectAppliedPromotions(
      evaluatedPromotions,
      Boolean(input.promotionCode),
      subtotalCents,
    );
    const discountCents = appliedPromotions.reduce(
      (total, entry) => total + entry.discountCents,
      0,
    );

    const shippingAddress = await this.resolveShippingAddress(
      transaction,
      customerId,
      input,
    );
    const customerName = [customer.firstName, customer.lastName].filter(Boolean).join(' ');
    const paymentProvider = this.resolvePaymentProvider(input);

    const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
    const order = await transaction.order.create({
      data: {
        number: this.createOrderNumber(),
        idempotencyKey,
        customerId: customer.id,
        customerName,
        customerEmail: customer.email,
        customerPhone: customer.phone,
        paymentMethod: input.paymentMethod,
        deliveryMethod: input.deliveryMethod,
        shippingAddress,
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
        provider: paymentProvider,
        method: input.paymentMethod,
        amountCents: order.totalCents,
      },
    });

    for (const applied of appliedPromotions) {
      await transaction.orderPromotion.create({
        data: {
          orderId: order.id,
          promotionId: applied.promotion.id,
          promotionName: applied.promotion.name,
          discountCents: applied.discountCents,
        },
      });
      await transaction.promotion.update({
        where: { id: applied.promotion.id },
        data: { uses: { increment: 1 } },
      });
    }

    await transaction.cart.update({
      where: { id: cart.id },
      data: { status: CartStatus.CONVERTED, customerId },
    });

    const notificationRecipients = await transaction.user.findMany({
      where: {
        isActive: true,
        role: { in: [UserRole.ADMIN, UserRole.STAFF] },
      },
      select: { id: true },
    });
    if (notificationRecipients.length) {
      await transaction.adminNotification.createMany({
        data: notificationRecipients.map((recipient) => ({
          userId: recipient.id,
          type: AdminNotificationType.ORDER_CREATED,
          title: 'Nuevo pedido recibido',
          message: `${order.number} · ${customerName} · ${(order.totalCents / 100).toLocaleString('es-MX', { style: 'currency', currency: order.currency })}`,
          orderId: order.id,
        })),
        skipDuplicates: true,
      });
    }

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

  private resolvePaymentProvider(input: CreateOrderDto) {
    if (input.paymentMethod === PaymentMethod.CARD) {
      const provider = input.paymentProvider ?? PaymentProvider.MERCADO_PAGO;
      if (
        provider !== PaymentProvider.MERCADO_PAGO &&
        provider !== PaymentProvider.STRIPE
      ) {
        throw new BadRequestException('Selecciona una pasarela valida para pagar con tarjeta.');
      }
      if (
        provider === PaymentProvider.MERCADO_PAGO &&
        (!this.config.get<string>('MERCADOPAGO_PUBLIC_KEY') ||
          !this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN') ||
          !this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET'))
      ) {
        throw new BadRequestException('Mercado Pago no esta disponible temporalmente.');
      }
      if (
        provider === PaymentProvider.STRIPE &&
        (!this.config.get<string>('STRIPE_PUBLISHABLE_KEY') ||
          !this.config.get<string>('STRIPE_SECRET_KEY') ||
          !this.config.get<string>('STRIPE_WEBHOOK_SECRET'))
      ) {
        throw new BadRequestException('Stripe no esta disponible temporalmente.');
      }
      return provider;
    }

    if (input.paymentMethod === PaymentMethod.PAYMENT_LINK) {
      if (
        input.paymentProvider &&
        input.paymentProvider !== PaymentProvider.MERCADO_PAGO
      ) {
        throw new BadRequestException('El link de pago utiliza Mercado Pago.');
      }
      if (
        !this.config.get<string>('MERCADOPAGO_ACCESS_TOKEN') ||
        !this.config.get<string>('MERCADOPAGO_WEBHOOK_SECRET')
      ) {
        throw new BadRequestException('El link de Mercado Pago no esta disponible temporalmente.');
      }
      return PaymentProvider.MERCADO_PAGO;
    }

    if (input.paymentProvider && input.paymentProvider !== PaymentProvider.MANUAL) {
      throw new BadRequestException('Este metodo de pago no utiliza una pasarela.');
    }
    return PaymentProvider.MANUAL;
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
      shippingAddress: order.shippingAddress,
      customerNotes: order.customerNotes,
      expiresAt: order.expiresAt,
      paidAt: order.paidAt,
      items: order.items,
      promotions: order.promotions,
      shipments: order.shipments,
      payments: order.payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        method: payment.method,
        status: payment.status,
        checkoutUrl: payment.checkoutUrl,
        transferProofs: payment.transferProofs,
      })),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private async resolveShippingAddress(
    transaction: Prisma.TransactionClient,
    customerId: string,
    input: CreateOrderDto,
  ): Promise<Prisma.InputJsonValue | undefined> {
    if (input.deliveryMethod === 'STORE_PICKUP') return undefined;

    if (input.shippingAddressId) {
      const address = await transaction.customerAddress.findFirst({
        where: { id: input.shippingAddressId, customerId },
      });
      if (!address) throw new BadRequestException('La direccion seleccionada no existe.');
      return {
        recipientName: address.recipientName,
        phone: address.phone,
        street: address.street,
        exteriorNumber: address.exteriorNumber,
        interiorNumber: address.interiorNumber,
        neighborhood: address.neighborhood,
        city: address.city,
        municipality: address.municipality,
        state: address.state,
        postalCode: address.postalCode,
        country: address.country,
        reference: address.reference,
      };
    }

    if (!input.shippingAddress) {
      throw new BadRequestException('Selecciona o captura una direccion de entrega.');
    }
    return {
      recipientName: input.shippingAddress.recipientName,
      phone: input.shippingAddress.phone,
      street: input.shippingAddress.street,
      exteriorNumber: input.shippingAddress.exteriorNumber,
      interiorNumber: input.shippingAddress.interiorNumber,
      neighborhood: input.shippingAddress.neighborhood,
      city: input.shippingAddress.city,
      municipality: input.shippingAddress.municipality,
      state: input.shippingAddress.state,
      postalCode: input.shippingAddress.postalCode,
      country: input.shippingAddress.country,
      reference: input.shippingAddress.reference,
    };
  }
}
