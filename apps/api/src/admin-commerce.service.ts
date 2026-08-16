import { randomUUID } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AdminNotificationType,
  DeliveryMethod,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PricingMode,
  Prisma,
  ProductLine,
  ProductStatus,
  PromotionType,
  ReservationStatus,
  ShippingQuoteStatus,
} from '@prisma/client';
import {
  BulkUpdatePricesDto,
  CreatePromotionDto,
  ListAdminInventoryDto,
  ListAdminOrdersDto,
  ListAdminProductsDto,
  ListPriceAdjustmentsDto,
  ListPromotionsDto,
  PercentagePriceAdjustmentDto,
  SetShippingQuoteDto,
  UpdateOrderStatusDto,
  UpdatePricingPolicyDto,
  UpdatePromotionDto,
} from './admin-commerce.dto';
import {
  canTransitionOrder,
  fulfillmentForOrderStatus,
  reservationLifetimeMs,
} from './commerce-rules';
import { OrdersService } from './orders.service';
import {
  calculateAdjustedPriceCents,
  PriceAdjustmentDirection,
  PriceAdjustmentScope,
} from './price-adjustment';
import { PrismaService } from './prisma.service';
import { SHIPPING_QUOTE_RESERVATION_MS } from './shipping-quote';

type RevenueRow = {
  todayRevenueCents: bigint;
  monthRevenueCents: bigint;
  todayOrders: bigint;
  monthOrders: bigint;
};

type InventorySummaryRow = {
  onHand: bigint;
  available: bigint;
  reserved: bigint;
  lowStock: bigint;
  outOfStock: bigint;
};

type VariantPriceAdjustment = {
  kind: 'VARIANT';
  id: string;
  productId: string;
  productName: string;
  sku: string;
  line: ProductLine;
  currentPriceCents: number;
  nextPriceCents: number;
  currentCompareAtPriceCents: number | null;
  nextCompareAtPriceCents: number | null;
};

type PolicyPriceAdjustment = {
  kind: 'POLICY';
  id: string;
  line: ProductLine;
  currentPriceCents: number;
  nextPriceCents: number;
};

type PriceAdjustmentChange = VariantPriceAdjustment | PolicyPriceAdjustment;

type PriceAdjustmentPlan = {
  changes: PriceAdjustmentChange[];
  response: {
    generatedAt: Date;
    summary: {
      affectedProducts: number;
      affectedVariants: number;
      affectedFixedVariants: number;
      affectedFixedPolicies: number;
      skippedFixedVariants: number;
      skippedMissingPrices: number;
      unchanged: number;
      currentMinimumCents: number | null;
      currentMaximumCents: number | null;
      nextMinimumCents: number | null;
      nextMaximumCents: number | null;
      totalDeltaCents: number;
    };
    sample: Array<{
      kind: 'VARIANT' | 'POLICY';
      id: string;
      label: string;
      sku: string | null;
      line: ProductLine;
      currentPriceCents: number;
      nextPriceCents: number;
      differenceCents: number;
    }>;
    warnings: string[];
  };
};

@Injectable()
export class AdminCommerceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrdersService,
  ) {}

  async dashboard() {
    const timezone = process.env.STORE_TIME_ZONE ?? 'America/Merida';
    const [
      productGroups,
      variantCount,
      inventoryRows,
      orderGroups,
      paymentGroups,
      revenueRows,
      openAlerts,
      recentOrders,
    ] = await Promise.all([
      this.prisma.product.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.productVariant.count({ where: { isActive: true } }),
      this.prisma.$queryRaw<InventorySummaryRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM("onHand"), 0)::bigint AS "onHand",
          COALESCE(SUM(available), 0)::bigint AS available,
          COALESCE(SUM(reserved), 0)::bigint AS reserved,
          COUNT(*) FILTER (WHERE available <= "lowStockThreshold")::bigint AS "lowStock",
          COUNT(*) FILTER (WHERE available <= 0)::bigint AS "outOfStock"
        FROM "InventoryLevel"
      `),
      this.prisma.order.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.order.groupBy({ by: ['paymentStatus'], _count: { _all: true } }),
      this.prisma.$queryRaw<RevenueRow[]>(Prisma.sql`
        SELECT
          COALESCE(SUM("totalCents") FILTER (
            WHERE "paymentStatus" = 'APPROVED'::"PaymentStatus"
              AND "paidAt" >= (date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})
          ), 0)::bigint AS "todayRevenueCents",
          COALESCE(SUM("totalCents") FILTER (
            WHERE "paymentStatus" = 'APPROVED'::"PaymentStatus"
              AND "paidAt" >= (date_trunc('month', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})
          ), 0)::bigint AS "monthRevenueCents",
          COUNT(*) FILTER (
            WHERE "paymentStatus" = 'APPROVED'::"PaymentStatus"
              AND "paidAt" >= (date_trunc('day', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})
          )::bigint AS "todayOrders",
          COUNT(*) FILTER (
            WHERE "paymentStatus" = 'APPROVED'::"PaymentStatus"
              AND "paidAt" >= (date_trunc('month', NOW() AT TIME ZONE ${timezone}) AT TIME ZONE ${timezone})
          )::bigint AS "monthOrders"
        FROM "Order"
      `),
      this.prisma.inventoryAlert.count({ where: { activeKey: { not: null } } }),
      this.prisma.order.findMany({
        select: {
          publicToken: true,
          number: true,
          customerName: true,
          status: true,
          paymentStatus: true,
          fulfillmentStatus: true,
          totalCents: true,
          currency: true,
          deliveryMethod: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

    const revenue = revenueRows[0];
    const inventory = inventoryRows[0];
    return {
      generatedAt: new Date(),
      timezone,
      products: {
        byStatus: Object.fromEntries(
          productGroups.map((entry) => [entry.status, entry._count._all]),
        ),
        activeVariants: variantCount,
      },
      inventory: {
        onHand: Number(inventory?.onHand ?? 0),
        available: Number(inventory?.available ?? 0),
        reserved: Number(inventory?.reserved ?? 0),
        lowStock: Number(inventory?.lowStock ?? 0),
        outOfStock: Number(inventory?.outOfStock ?? 0),
        openAlerts,
      },
      orders: {
        byStatus: Object.fromEntries(orderGroups.map((entry) => [entry.status, entry._count._all])),
        byPaymentStatus: Object.fromEntries(
          paymentGroups.map((entry) => [entry.paymentStatus, entry._count._all]),
        ),
      },
      revenue: {
        todayCents: Number(revenue?.todayRevenueCents ?? 0),
        monthCents: Number(revenue?.monthRevenueCents ?? 0),
        todayOrders: Number(revenue?.todayOrders ?? 0),
        monthOrders: Number(revenue?.monthOrders ?? 0),
        currency: 'MXN',
      },
      recentOrders,
    };
  }

  async listProducts(query: ListAdminProductsDto) {
    const where: Prisma.ProductWhereInput = {
      status: query.status,
      line: query.line,
      ...(query.search?.trim()
        ? {
            OR: [
              { name: { contains: query.search.trim(), mode: 'insensitive' } },
              { slug: { contains: query.search.trim(), mode: 'insensitive' } },
              {
                variants: {
                  some: { sku: { contains: query.search.trim(), mode: 'insensitive' } },
                },
              },
            ],
          }
        : {}),
    };
    const [products, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        include: {
          brand: true,
          inspirationHouse: true,
          linePricingPolicy: true,
          images: { orderBy: { sortOrder: 'asc' } },
          categories: { include: { category: true } },
          catalogLines: { include: { catalogLine: { include: { section: true } } } },
          variants: {
            include: { inventoryLevels: { include: { location: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);
    return this.page(products, total, query.page, query.pageSize);
  }

  async listInventory(query: ListAdminInventoryDto) {
    const where: Prisma.InventoryLevelWhereInput = {
      ...(query.lowStock
        ? { available: { lte: this.prisma.inventoryLevel.fields.lowStockThreshold } }
        : {}),
      ...(query.outOfStock ? { available: { lte: 0 } } : {}),
      ...(query.search?.trim()
        ? {
            variant: {
              OR: [
                { sku: { contains: query.search.trim(), mode: 'insensitive' } },
                {
                  product: { name: { contains: query.search.trim(), mode: 'insensitive' } },
                },
              ],
            },
          }
        : {}),
    };
    const [levels, total] = await this.prisma.$transaction([
      this.prisma.inventoryLevel.findMany({
        where,
        include: {
          location: true,
          variant: { include: { product: true } },
          alerts: {
            where: { activeKey: { not: null } },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
        orderBy: [{ available: 'asc' }, { updatedAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.inventoryLevel.count({ where }),
    ]);
    return this.page(levels, total, query.page, query.pageSize);
  }

  async listOrders(query: ListAdminOrdersDto) {
    const where: Prisma.OrderWhereInput = {
      status: query.status,
      paymentStatus: query.paymentStatus,
      fulfillmentStatus: query.fulfillmentStatus,
      ...(query.search?.trim()
        ? {
            OR: [
              { number: { contains: query.search.trim(), mode: 'insensitive' } },
              { customerName: { contains: query.search.trim(), mode: 'insensitive' } },
              { customerEmail: { contains: query.search.trim(), mode: 'insensitive' } },
              { customerPhone: { contains: query.search.trim(), mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        include: {
          _count: { select: { items: true, shipments: true } },
          payments: {
            include: {
              transferProofs: {
                orderBy: { createdAt: 'desc' },
                take: 3,
              },
            },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          shipments: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.order.count({ where }),
    ]);
    return this.page(orders, total, query.page, query.pageSize);
  }

  async getOrder(publicToken: string) {
    const order = await this.prisma.order.findUnique({
      where: { publicToken },
      include: {
        customer: {
          select: { id: true, email: true, firstName: true, lastName: true, phone: true },
        },
        items: {
          include: {
            variant: {
              select: {
                attributes: true,
                product: {
                  select: {
                    name: true,
                    shortDescription: true,
                    description: true,
                    attributes: true,
                    brand: { select: { name: true } },
                    inspirationHouse: { select: { name: true } },
                    images: {
                      select: { url: true, altText: true },
                      orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
                      take: 1,
                    },
                    categories: {
                      select: { category: { select: { name: true } } },
                      orderBy: { category: { sortOrder: 'asc' } },
                    },
                    catalogLines: {
                      select: {
                        catalogLine: {
                          select: {
                            name: true,
                            section: { select: { name: true } },
                          },
                        },
                      },
                      orderBy: { catalogLine: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
        payments: {
          include: { transferProofs: { orderBy: { createdAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
        promotions: true,
        shipments: {
          include: { events: { orderBy: { occurredAt: 'desc' } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    return order;
  }

  async setShippingQuote(
    publicToken: string,
    input: SetShippingQuoteDto,
    actorId: string,
  ) {
    await this.prisma.$transaction(
      async (transaction) => {
        const order = await transaction.order.findUnique({
          where: { publicToken },
          include: {
            items: { include: { reservation: true } },
            payments: { orderBy: { createdAt: 'desc' } },
          },
        });
        if (!order) throw new NotFoundException('Orden no encontrada.');
        if (order.status !== OrderStatus.PENDING_PAYMENT) {
          throw new ConflictException('Solo se puede cotizar una orden pendiente de pago.');
        }
        if (order.deliveryMethod === DeliveryMethod.STORE_PICKUP) {
          throw new BadRequestException('Esta orden no requiere un costo de entrega.');
        }
        if (
          order.shippingQuoteStatus !== ShippingQuoteStatus.PENDING &&
          order.shippingQuoteStatus !== ShippingQuoteStatus.QUOTED
        ) {
          throw new ConflictException('La orden no esta esperando una cotizacion de envio.');
        }
        if (
          new Set<PaymentStatus>([
            PaymentStatus.IN_PROCESS,
            PaymentStatus.APPROVED,
            PaymentStatus.REFUNDED,
            PaymentStatus.CHARGED_BACK,
          ]).has(order.paymentStatus)
        ) {
          throw new ConflictException('El envio no puede cambiarse despues de iniciar el cobro.');
        }

        const activePayment = order.payments.find(
          (payment) =>
            !new Set<PaymentStatus>([
              PaymentStatus.CANCELLED,
              PaymentStatus.REFUNDED,
              PaymentStatus.CHARGED_BACK,
            ]).has(payment.status),
        );
        if (!activePayment && order.paymentMethod) {
          throw new ConflictException('La orden no tiene un pago pendiente que pueda actualizarse.');
        }
        if (
          activePayment?.providerPaymentId ||
          activePayment?.providerPreferenceId ||
          activePayment?.checkoutUrl
        ) {
          throw new ConflictException(
            'El cobro ya fue iniciado. Cancela el intento antes de cambiar el envio.',
          );
        }

        const now = new Date();
        const activeReservations = order.items.flatMap((item) =>
          item.reservation?.status === ReservationStatus.ACTIVE ? [item.reservation] : [],
        );
        if (
          activeReservations.length !== order.items.length ||
          activeReservations.some((reservation) => reservation.expiresAt <= now)
        ) {
          throw new ConflictException(
            'La reserva de inventario vencio. Pide al cliente crear nuevamente el pedido.',
          );
        }

        const shippingCents = input.shippingCents;
        const totalCents = Math.max(
          0,
          order.subtotalCents - order.discountCents + shippingCents,
        );
        const expiresAt = new Date(
          now.getTime() +
            (order.paymentMethod
              ? reservationLifetimeMs(order.paymentMethod)
              : SHIPPING_QUOTE_RESERVATION_MS),
        );

        await transaction.inventoryReservation.updateMany({
          where: { id: { in: activeReservations.map((reservation) => reservation.id) } },
          data: { expiresAt },
        });
        if (activePayment) {
          await transaction.payment.update({
            where: { id: activePayment.id },
            data: { amountCents: totalCents },
          });
        }
        await transaction.order.update({
          where: { id: order.id },
          data: {
            shippingCents,
            totalCents,
            shippingQuoteStatus: ShippingQuoteStatus.QUOTED,
            shippingQuotedAt: now,
            shippingQuoteNotes: input.notes?.trim() || null,
            expiresAt,
          },
        });
        await transaction.adminNotification.updateMany({
          where: {
            orderId: order.id,
            type: AdminNotificationType.SHIPPING_QUOTE_REQUESTED,
            readAt: null,
          },
          data: { readAt: now },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'ORDER_SHIPPING_QUOTED',
            entityType: 'Order',
            entityId: order.id,
            before: {
              shippingCents: order.shippingCents,
              totalCents: order.totalCents,
              shippingQuoteStatus: order.shippingQuoteStatus,
            },
            after: {
              shippingCents,
              totalCents,
              shippingQuoteStatus: ShippingQuoteStatus.QUOTED,
              expiresAt,
            },
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    return this.getOrder(publicToken);
  }

  async updateOrderStatus(
    publicToken: string,
    input: UpdateOrderStatusDto,
    actorId: string,
  ) {
    const order = await this.prisma.order.findUnique({ where: { publicToken } });
    if (!order) throw new NotFoundException('Orden no encontrada.');
    if (input.status === OrderStatus.CANCELLED) {
      const cancelled = await this.orders.cancelByAdmin(publicToken);
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_CANCELLED',
          entityType: 'Order',
          entityId: order.id,
          before: { status: order.status },
          after: { status: OrderStatus.CANCELLED },
        },
      });
      return cancelled;
    }

    if (!canTransitionOrder(order.status, input.status)) {
      throw new ConflictException(`La orden no puede pasar de ${order.status} a ${input.status}.`);
    }
    if (
      input.status !== order.status &&
      order.paymentStatus !== PaymentStatus.APPROVED &&
      !(
        order.paymentMethod === PaymentMethod.CASH &&
        (input.status === OrderStatus.PROCESSING || input.status === OrderStatus.READY)
      )
    ) {
      throw new ConflictException('La orden necesita pago aprobado para avanzar.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const fulfillmentStatus = fulfillmentForOrderStatus(
        input.status,
        order.deliveryMethod,
        order.fulfillmentStatus,
      );
      await transaction.order.update({
        where: { id: order.id },
        data: {
          status: input.status,
          fulfillmentStatus,
          internalNotes: input.internalNotes?.trim(),
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'ORDER_STATUS_UPDATED',
          entityType: 'Order',
          entityId: order.id,
          before: { status: order.status, fulfillmentStatus: order.fulfillmentStatus },
          after: { status: input.status, fulfillmentStatus },
        },
      });
      if (input.status !== order.status) {
        await transaction.outboxEvent.create({
          data: {
            type: 'ORDER_STATUS_UPDATED',
            aggregateType: 'Order',
            aggregateId: order.id,
            deduplicationKey: `ORDER_STATUS:${order.id}:${input.status}`,
            payload: { orderId: order.id, status: input.status },
          },
        });
      }
    });
    return this.getOrder(publicToken);
  }

  async listPromotions(query: ListPromotionsDto) {
    const where: Prisma.PromotionWhereInput = {
      isActive: query.active,
      placement: query.placement,
    };
    const [promotions, total] = await this.prisma.$transaction([
      this.prisma.promotion.findMany({
        where,
        include: {
          products: { include: { product: { select: { id: true, name: true, slug: true } } } },
          categories: { include: { category: { select: { id: true, name: true, slug: true } } } },
          _count: { select: { orders: true } },
        },
        orderBy: [{ isActive: 'desc' }, { startsAt: 'desc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.promotion.count({ where }),
    ]);
    return this.page(promotions, total, query.page, query.pageSize);
  }

  async createPromotion(input: CreatePromotionDto, actorId: string) {
    this.validatePromotion(input);
    const references = await this.validatePromotionReferences(
      input.productIds ?? [],
      input.categoryIds ?? [],
    );
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const promotion = await transaction.promotion.create({
          data: {
            slug: input.slug.trim().toLowerCase(),
            code: input.code?.trim().toUpperCase() || null,
            name: input.name.trim(),
            description: input.description?.trim(),
            imageUrl: input.imageUrl?.trim(),
            type: input.type,
            value: input.value,
            minimumCents: input.minimumCents ?? 0,
            maximumDiscountCents: input.maximumDiscountCents,
            maximumUses: input.maximumUses,
            perCustomerLimit: input.perCustomerLimit,
            startsAt: new Date(input.startsAt),
            endsAt: input.endsAt ? new Date(input.endsAt) : null,
            isActive: input.isActive ?? true,
            isFeatured: input.isFeatured ?? false,
            placement: input.placement,
            requiresCode: input.requiresCode ?? Boolean(input.code),
            isStackable: input.isStackable ?? false,
            priority: input.priority ?? 0,
            products: { create: references.productIds.map((productId) => ({ productId })) },
            categories: {
              create: references.categoryIds.map((categoryId) => ({ categoryId })),
            },
          },
          include: { products: true, categories: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PROMOTION_CREATED',
            entityType: 'Promotion',
            entityId: promotion.id,
            after: { slug: promotion.slug, name: promotion.name, placement: promotion.placement },
          },
        });
        return promotion;
      });
    } catch (error) {
      this.handlePromotionConflict(error);
    }
  }

  async updatePromotion(id: string, input: UpdatePromotionDto, actorId: string) {
    const before = await this.prisma.promotion.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Promocion no encontrada.');
    this.validatePromotion({
      type: input.type ?? before.type,
      value: input.value ?? before.value,
      startsAt: input.startsAt ?? before.startsAt.toISOString(),
      endsAt:
        input.endsAt === undefined
          ? before.endsAt?.toISOString() ?? null
          : input.endsAt,
      requiresCode: input.requiresCode ?? before.requiresCode,
      code: input.code ?? before.code ?? undefined,
    });
    const references = await this.validatePromotionReferences(
      input.productIds ?? [],
      input.categoryIds ?? [],
    );

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const promotion = await transaction.promotion.update({
          where: { id },
          data: {
            slug: input.slug?.trim().toLowerCase(),
            code:
              input.code === undefined ? undefined : input.code.trim().toUpperCase() || null,
            name: input.name?.trim(),
            description: input.description?.trim(),
            imageUrl: input.imageUrl?.trim(),
            type: input.type,
            value: input.value,
            minimumCents: input.minimumCents,
            maximumDiscountCents: input.maximumDiscountCents,
            maximumUses: input.maximumUses,
            perCustomerLimit: input.perCustomerLimit,
            startsAt: input.startsAt ? new Date(input.startsAt) : undefined,
            endsAt:
              input.endsAt === undefined
                ? undefined
                : input.endsAt
                  ? new Date(input.endsAt)
                  : null,
            isActive: input.isActive,
            isFeatured: input.isFeatured,
            placement: input.placement,
            requiresCode: input.requiresCode,
            isStackable: input.isStackable,
            priority: input.priority,
            products:
              input.productIds === undefined
                ? undefined
                : {
                    deleteMany: {},
                    create: references.productIds.map((productId) => ({ productId })),
                  },
            categories:
              input.categoryIds === undefined
                ? undefined
                : {
                    deleteMany: {},
                    create: references.categoryIds.map((categoryId) => ({ categoryId })),
                  },
          },
          include: { products: true, categories: true },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PROMOTION_UPDATED',
            entityType: 'Promotion',
            entityId: id,
            before: before as unknown as Prisma.InputJsonValue,
            after: promotion as unknown as Prisma.InputJsonValue,
          },
        });
        return promotion;
      });
    } catch (error) {
      this.handlePromotionConflict(error);
    }
  }

  async updatePricingPolicy(
    line: ProductLine,
    input: UpdatePricingPolicyDto,
    actorId: string,
  ) {
    if (input.pricingMode === PricingMode.FIXED_BY_LINE && input.fixedPriceCents === undefined) {
      throw new BadRequestException('Una linea de precio fijo necesita fixedPriceCents.');
    }
    const before = await this.prisma.linePricingPolicy.findUnique({ where: { line } });
    if (!before) throw new NotFoundException('Politica de precios no encontrada.');
    return this.prisma.$transaction(async (transaction) => {
      const policy = await transaction.linePricingPolicy.update({
        where: { line },
        data: {
          pricingMode: input.pricingMode,
          fixedPriceCents:
            input.pricingMode === PricingMode.FIXED_BY_LINE ? input.fixedPriceCents : null,
          isActive: input.isActive,
        },
      });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'PRICING_POLICY_UPDATED',
          entityType: 'LinePricingPolicy',
          entityId: policy.id,
          before: before as unknown as Prisma.InputJsonValue,
          after: policy as unknown as Prisma.InputJsonValue,
        },
      });
      return policy;
    });
  }

  async bulkUpdatePrices(input: BulkUpdatePricesDto, actorId: string) {
    if (!input.updates.length) throw new BadRequestException('Agrega al menos una actualizacion.');
    const ids = [...new Set(input.updates.map((entry) => entry.variantId))];
    if (ids.length !== input.updates.length) {
      throw new BadRequestException('No repitas variantes en la actualizacion.');
    }
    const variants = await this.prisma.productVariant.findMany({
      where: { id: { in: ids } },
      include: { product: { include: { linePricingPolicy: true } } },
    });
    if (variants.length !== ids.length) throw new NotFoundException('Una o mas variantes no existen.');
    const fixed = variants.find(
      (variant) => variant.product.linePricingPolicy.pricingMode === PricingMode.FIXED_BY_LINE,
    );
    if (fixed) {
      throw new BadRequestException(
        `${fixed.product.name} usa precio fijo por linea; actualiza la politica de precios.`,
      );
    }

    const inputById = new Map(input.updates.map((entry) => [entry.variantId, entry]));
    await this.prisma.$transaction(async (transaction) => {
      for (const variant of variants) {
        const update = inputById.get(variant.id)!;
        const after = await transaction.productVariant.update({
          where: { id: variant.id },
          data: {
            catalogPriceCents: update.catalogPriceCents,
            compareAtPriceCents: update.compareAtPriceCents,
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'VARIANT_PRICE_UPDATED',
            entityType: 'ProductVariant',
            entityId: variant.id,
            before: {
              catalogPriceCents: variant.catalogPriceCents,
              compareAtPriceCents: variant.compareAtPriceCents,
            },
            after: {
              catalogPriceCents: after.catalogPriceCents,
              compareAtPriceCents: after.compareAtPriceCents,
            },
          },
        });
      }
    });
    return { updated: variants.length };
  }

  async previewPercentagePriceAdjustment(input: PercentagePriceAdjustmentDto) {
    this.validatePercentagePriceAdjustment(input);
    const plan = await this.prisma.$transaction((transaction) =>
      this.preparePercentagePriceAdjustment(input, transaction),
    );
    return plan.response;
  }

  async applyPercentagePriceAdjustment(
    input: PercentagePriceAdjustmentDto,
    actorId: string,
  ) {
    this.validatePercentagePriceAdjustment(input);
    if (input.confirmed !== true) {
      throw new BadRequestException(
        'Confirma explicitamente la actualizacion despues de revisar la vista previa.',
      );
    }

    return this.prisma.$transaction(
      async (transaction) => {
        const plan = await this.preparePercentagePriceAdjustment(input, transaction);
        if (!plan.changes.length) {
          throw new BadRequestException('No hay precios que cambiar con esta seleccion.');
        }

        const variantChanges = plan.changes.filter(
          (change): change is VariantPriceAdjustment => change.kind === 'VARIANT',
        );
        const policyChanges = plan.changes.filter(
          (change): change is PolicyPriceAdjustment => change.kind === 'POLICY',
        );

        for (const chunk of this.chunk(variantChanges, 300)) {
          const rows = chunk.map((change) =>
            Prisma.sql`(
              ${change.id},
              ${change.nextPriceCents},
              ${change.nextCompareAtPriceCents}
            )`,
          );
          await transaction.$executeRaw(Prisma.sql`
            UPDATE "ProductVariant" AS target
            SET
              "catalogPriceCents" = changes."catalogPriceCents"::integer,
              "compareAtPriceCents" = changes."compareAtPriceCents"::integer,
              "updatedAt" = NOW()
            FROM (
              VALUES ${Prisma.join(rows)}
            ) AS changes("id", "catalogPriceCents", "compareAtPriceCents")
            WHERE target."id" = changes."id"::text
          `);
        }

        for (const change of policyChanges) {
          await transaction.linePricingPolicy.update({
            where: { id: change.id },
            data: { fixedPriceCents: change.nextPriceCents },
          });
        }

        const batchId = randomUUID();
        const requestSnapshot = this.priceAdjustmentRequestSnapshot(input);
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PRICE_PERCENTAGE_ADJUSTMENT_APPLIED',
            entityType: 'PriceAdjustmentBatch',
            entityId: batchId,
            before: requestSnapshot,
            after: {
              summary: plan.response.summary,
              warnings: plan.response.warnings,
              changes: plan.changes,
            } as Prisma.InputJsonValue,
          },
        });

        return {
          ...plan.response,
          batchId,
          appliedAt: new Date(),
        };
      },
      { maxWait: 5_000, timeout: 30_000 },
    );
  }

  async listPriceAdjustments(query: ListPriceAdjustmentsDto) {
    const where: Prisma.AuditLogWhereInput = {
      action: 'PRICE_PERCENTAGE_ADJUSTMENT_APPLIED',
      entityType: 'PriceAdjustmentBatch',
    };
    const [entries, total] = await this.prisma.$transaction([
      this.prisma.auditLog.findMany({
        where,
        include: {
          actor: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return this.page(
      entries.map((entry) => {
        const request = this.jsonRecord(entry.before);
        const result = this.jsonRecord(entry.after);
        return {
          id: entry.id,
          batchId: entry.entityId,
          createdAt: entry.createdAt,
          actor: entry.actor,
          reason: typeof request.reason === 'string' ? request.reason : '',
          request,
          summary: this.jsonRecord(result.summary),
          warnings: Array.isArray(result.warnings) ? result.warnings : [],
        };
      }),
      total,
      query.page,
      query.pageSize,
    );
  }

  private async preparePercentagePriceAdjustment(
    input: PercentagePriceAdjustmentDto,
    transaction: Prisma.TransactionClient,
  ): Promise<PriceAdjustmentPlan> {
    await this.validatePriceAdjustmentReference(input, transaction);
    const productWhere = this.priceAdjustmentProductWhere(input);
    const variants = await transaction.productVariant.findMany({
      where: {
        isActive: true,
        product: { is: productWhere },
      },
      select: {
        id: true,
        productId: true,
        sku: true,
        catalogPriceCents: true,
        compareAtPriceCents: true,
        product: {
          select: {
            name: true,
            line: true,
            linePricingPolicy: {
              select: {
                id: true,
                line: true,
                pricingMode: true,
                fixedPriceCents: true,
                isActive: true,
              },
            },
          },
        },
      },
      orderBy: { sku: 'asc' },
      take: 5_001,
    });
    if (variants.length > 5_000) {
      throw new BadRequestException(
        'La seleccion supera 5000 variantes. Divide la actualizacion por linea, marca o categoria.',
      );
    }

    const warnings: string[] = [];
    const changes: PriceAdjustmentChange[] = [];
    const affectedProductIds = new Set<string>();
    const fixedLines = new Map<
      ProductLine,
      {
        id: string;
        currentPriceCents: number;
        productIds: Set<string>;
        variantCount: number;
      }
    >();
    const effectivePrices: Array<{ current: number; next: number }> = [];
    let skippedFixedVariants = 0;
    let skippedMissingPrices = 0;
    let unchanged = 0;
    let affectedFixedVariants = 0;

    for (const variant of variants) {
      const policy = variant.product.linePricingPolicy;
      if (
        policy.isActive &&
        policy.pricingMode === PricingMode.FIXED_BY_LINE &&
        policy.fixedPriceCents !== null
      ) {
        const existing = fixedLines.get(policy.line) ?? {
          id: policy.id,
          currentPriceCents: policy.fixedPriceCents,
          productIds: new Set<string>(),
          variantCount: 0,
        };
        existing.productIds.add(variant.productId);
        existing.variantCount += 1;
        fixedLines.set(policy.line, existing);
        continue;
      }

      if (variant.catalogPriceCents === null || variant.catalogPriceCents <= 0) {
        skippedMissingPrices += 1;
        continue;
      }
      const nextPriceCents = calculateAdjustedPriceCents({
        currentPriceCents: variant.catalogPriceCents,
        direction: input.direction,
        percentage: input.percentage,
        rounding: input.rounding,
      });
      const nextCompareAtPriceCents =
        variant.compareAtPriceCents === null
          ? null
          : Math.max(
              nextPriceCents,
              calculateAdjustedPriceCents({
                currentPriceCents: variant.compareAtPriceCents,
                direction: input.direction,
                percentage: input.percentage,
                rounding: input.rounding,
              }),
            );
      effectivePrices.push({ current: variant.catalogPriceCents, next: nextPriceCents });
      if (
        nextPriceCents === variant.catalogPriceCents &&
        nextCompareAtPriceCents === variant.compareAtPriceCents
      ) {
        unchanged += 1;
        continue;
      }
      affectedProductIds.add(variant.productId);
      changes.push({
        kind: 'VARIANT',
        id: variant.id,
        productId: variant.productId,
        productName: variant.product.name,
        sku: variant.sku,
        line: variant.product.line,
        currentPriceCents: variant.catalogPriceCents,
        nextPriceCents,
        currentCompareAtPriceCents: variant.compareAtPriceCents,
        nextCompareAtPriceCents,
      });
    }

    const canUpdateFixedPolicies =
      input.includeFixedPolicies !== false &&
      (input.scope === PriceAdjustmentScope.ALL ||
        input.scope === PriceAdjustmentScope.LINE);
    for (const [line, policy] of fixedLines) {
      if (!canUpdateFixedPolicies) {
        skippedFixedVariants += policy.variantCount;
        continue;
      }
      const nextPriceCents = calculateAdjustedPriceCents({
        currentPriceCents: policy.currentPriceCents,
        direction: input.direction,
        percentage: input.percentage,
        rounding: input.rounding,
      });
      for (let index = 0; index < policy.variantCount; index += 1) {
        effectivePrices.push({ current: policy.currentPriceCents, next: nextPriceCents });
      }
      if (nextPriceCents === policy.currentPriceCents) {
        unchanged += policy.variantCount;
        continue;
      }
      policy.productIds.forEach((productId) => affectedProductIds.add(productId));
      affectedFixedVariants += policy.variantCount;
      changes.push({
        kind: 'POLICY',
        id: policy.id,
        line,
        currentPriceCents: policy.currentPriceCents,
        nextPriceCents,
      });
    }

    if (fixedLines.size && !canUpdateFixedPolicies) {
      warnings.push(
        input.scope === PriceAdjustmentScope.BRAND ||
          input.scope === PriceAdjustmentScope.CATEGORY
          ? 'Se omitieron productos con precio fijo por linea: cambiar su politica afectaria productos fuera de este filtro.'
          : 'Se omitieron productos con precio fijo por linea porque la opcion correspondiente esta desactivada.',
      );
    }
    if (skippedMissingPrices) {
      warnings.push(
        `${skippedMissingPrices} variantes sin precio de catalogo valido fueron omitidas.`,
      );
    }

    const variantChanges = changes.filter(
      (change): change is VariantPriceAdjustment => change.kind === 'VARIANT',
    );
    const policyChanges = changes.filter(
      (change): change is PolicyPriceAdjustment => change.kind === 'POLICY',
    );
    const currentPrices = effectivePrices.map((price) => price.current);
    const nextPrices = effectivePrices.map((price) => price.next);
    const summary = {
      affectedProducts: affectedProductIds.size,
      affectedVariants: variantChanges.length,
      affectedFixedVariants,
      affectedFixedPolicies: policyChanges.length,
      skippedFixedVariants,
      skippedMissingPrices,
      unchanged,
      currentMinimumCents: currentPrices.length ? Math.min(...currentPrices) : null,
      currentMaximumCents: currentPrices.length ? Math.max(...currentPrices) : null,
      nextMinimumCents: nextPrices.length ? Math.min(...nextPrices) : null,
      nextMaximumCents: nextPrices.length ? Math.max(...nextPrices) : null,
      totalDeltaCents: effectivePrices.reduce(
        (total, price) => total + price.next - price.current,
        0,
      ),
    };
    const sample = changes.slice(0, 12).map((change) => ({
      kind: change.kind,
      id: change.id,
      label:
        change.kind === 'VARIANT'
          ? change.productName
          : `Politica de linea ${change.line}`,
      sku: change.kind === 'VARIANT' ? change.sku : null,
      line: change.line,
      currentPriceCents: change.currentPriceCents,
      nextPriceCents: change.nextPriceCents,
      differenceCents: change.nextPriceCents - change.currentPriceCents,
    }));

    return {
      changes,
      response: {
        generatedAt: new Date(),
        summary,
        sample,
        warnings,
      },
    };
  }

  private validatePercentagePriceAdjustment(input: PercentagePriceAdjustmentDto) {
    if (
      input.direction === PriceAdjustmentDirection.DECREASE &&
      input.percentage >= 100
    ) {
      throw new BadRequestException('Una reduccion debe ser menor a 100%.');
    }
    if (input.reason.trim().length < 5) {
      throw new BadRequestException('Describe brevemente el motivo del cambio.');
    }
    if (input.scope === PriceAdjustmentScope.LINE && !input.line) {
      throw new BadRequestException('Selecciona la linea que deseas actualizar.');
    }
    if (input.scope === PriceAdjustmentScope.BRAND && !input.brandId) {
      throw new BadRequestException('Selecciona la marca que deseas actualizar.');
    }
    if (input.scope === PriceAdjustmentScope.CATEGORY && !input.categoryId) {
      throw new BadRequestException('Selecciona la categoria que deseas actualizar.');
    }
  }

  private async validatePriceAdjustmentReference(
    input: PercentagePriceAdjustmentDto,
    transaction: Prisma.TransactionClient,
  ) {
    if (
      input.scope === PriceAdjustmentScope.BRAND &&
      input.brandId &&
      !(await transaction.brand.findUnique({ where: { id: input.brandId }, select: { id: true } }))
    ) {
      throw new NotFoundException('Marca no encontrada.');
    }
    if (
      input.scope === PriceAdjustmentScope.CATEGORY &&
      input.categoryId &&
      !(await transaction.category.findUnique({
        where: { id: input.categoryId },
        select: { id: true },
      }))
    ) {
      throw new NotFoundException('Categoria no encontrada.');
    }
  }

  private priceAdjustmentProductWhere(
    input: PercentagePriceAdjustmentDto,
  ): Prisma.ProductWhereInput {
    return {
      status: input.includeDrafts
        ? { in: [ProductStatus.ACTIVE, ProductStatus.DRAFT] }
        : ProductStatus.ACTIVE,
      ...(input.scope === PriceAdjustmentScope.LINE ? { line: input.line } : {}),
      ...(input.scope === PriceAdjustmentScope.BRAND ? { brandId: input.brandId } : {}),
      ...(input.scope === PriceAdjustmentScope.CATEGORY
        ? { categories: { some: { categoryId: input.categoryId } } }
        : {}),
    };
  }

  private priceAdjustmentRequestSnapshot(
    input: PercentagePriceAdjustmentDto,
  ): Prisma.InputJsonValue {
    return {
      direction: input.direction,
      percentage: input.percentage,
      scope: input.scope,
      line: input.line ?? null,
      brandId: input.brandId ?? null,
      categoryId: input.categoryId ?? null,
      includeDrafts: input.includeDrafts ?? false,
      includeFixedPolicies: input.includeFixedPolicies ?? true,
      rounding: input.rounding,
      reason: input.reason.trim(),
    };
  }

  private jsonRecord(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  }

  private chunk<T>(values: T[], size: number) {
    const chunks: T[][] = [];
    for (let index = 0; index < values.length; index += size) {
      chunks.push(values.slice(index, index + size));
    }
    return chunks;
  }

  private validatePromotion(input: {
    type: PromotionType;
    value: number;
    startsAt: string;
    endsAt?: string | null;
    requiresCode?: boolean;
    code?: string;
  }) {
    if (input.endsAt && new Date(input.endsAt) <= new Date(input.startsAt)) {
      throw new BadRequestException('La promocion debe terminar despues de iniciar.');
    }
    if (input.type === PromotionType.PERCENTAGE && input.value > 100) {
      throw new BadRequestException('El porcentaje no puede ser mayor a 100.');
    }
    if (input.requiresCode && !input.code?.trim()) {
      throw new BadRequestException('La promocion requiere un codigo.');
    }
  }

  private async validatePromotionReferences(productIds: string[], categoryIds: string[]) {
    const uniqueProductIds = [...new Set(productIds)];
    const uniqueCategoryIds = [...new Set(categoryIds)];
    const [products, categories] = await Promise.all([
      this.prisma.product.count({ where: { id: { in: uniqueProductIds } } }),
      this.prisma.category.count({ where: { id: { in: uniqueCategoryIds } } }),
    ]);
    if (products !== uniqueProductIds.length) {
      throw new BadRequestException('Uno o mas productos de la promocion no existen.');
    }
    if (categories !== uniqueCategoryIds.length) {
      throw new BadRequestException('Una o mas categorias de la promocion no existen.');
    }
    return { productIds: uniqueProductIds, categoryIds: uniqueCategoryIds };
  }

  private handlePromotionConflict(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw new ConflictException('El slug o codigo de la promocion ya existe.');
    }
    throw error;
  }

  private page<T>(data: T[], total: number, page: number, pageSize: number) {
    return {
      data,
      pagination: { page, pageSize, total, pageCount: Math.ceil(total / pageSize) },
    };
  }
}
