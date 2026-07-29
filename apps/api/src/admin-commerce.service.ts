import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PricingMode,
  Prisma,
  ProductLine,
  PromotionType,
} from '@prisma/client';
import {
  BulkUpdatePricesDto,
  CreatePromotionDto,
  ListAdminInventoryDto,
  ListAdminOrdersDto,
  ListAdminProductsDto,
  ListPromotionsDto,
  UpdateOrderStatusDto,
  UpdatePricingPolicyDto,
  UpdatePromotionDto,
} from './admin-commerce.dto';
import { canTransitionOrder, fulfillmentForOrderStatus } from './commerce-rules';
import { OrdersService } from './orders.service';
import { PrismaService } from './prisma.service';

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
          linePricingPolicy: true,
          images: { orderBy: { sortOrder: 'asc' } },
          categories: { include: { category: true } },
          scentFamilies: { include: { scentFamily: true } },
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
        items: { orderBy: { createdAt: 'asc' } },
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
