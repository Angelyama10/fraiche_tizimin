import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PricingMode, Prisma, ProductLine, StockMovementType } from '@prisma/client';
import {
  CreateProductDto,
  CreateProductVariantDto,
  UpdateInventoryDto,
  UpdateProductDto,
  UpdateSpecialRequestDto,
  UpdateVariantDto,
} from './admin.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async createProduct(input: CreateProductDto, actorId: string) {
    const policy = await this.prisma.linePricingPolicy.findUnique({ where: { line: input.line } });
    if (!policy) throw new BadRequestException('La linea no tiene politica de precios.');
    const brand = input.brandSlug
      ? await this.prisma.brand.findUnique({ where: { slug: input.brandSlug } })
      : null;
    if (input.brandSlug && !brand) throw new BadRequestException('La marca no existe.');

    const categories = await this.prisma.category.findMany({
      where: { slug: { in: [...new Set(input.categorySlugs)] }, isActive: true },
    });
    if (categories.length !== new Set(input.categorySlugs).size) {
      throw new BadRequestException('Una o mas categorias no existen.');
    }
    const scentFamilies = await this.prisma.scentFamily.findMany({
      where: { slug: { in: [...new Set(input.scentSlugs)] } },
    });
    if (scentFamilies.length !== new Set(input.scentSlugs).size) {
      throw new BadRequestException('Una o mas familias aromaticas no existen.');
    }
    for (const variant of input.variants) this.validateVariant(input.line, policy.pricingMode, variant);

    const location = await this.prisma.storeLocation.findFirst({
      where: { isDefault: true, isActive: true },
    });
    if (!location) throw new ConflictException('No existe una ubicacion de inventario activa.');

    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            slug: input.slug.trim().toLowerCase(),
            name: input.name.trim(),
            shortDescription: input.shortDescription?.trim(),
            description: input.description?.trim(),
            line: input.line,
            brandId: brand?.id,
            isFeatured: input.isFeatured ?? false,
            isNew: input.isNew ?? false,
            categories: {
              create: categories.map((category) => ({ categoryId: category.id })),
            },
            scentFamilies: {
              create: scentFamilies.map((scentFamily) => ({ scentFamilyId: scentFamily.id })),
            },
            images: {
              create: input.images.map((image, index) => ({
                url: image.url,
                altText: image.altText,
                isPrimary: image.isPrimary ?? index === 0,
                sortOrder: index,
              })),
            },
          },
        });

        for (const variantInput of input.variants) {
          const variant = await transaction.productVariant.create({
            data: {
              productId: product.id,
              sku: variantInput.sku.trim().toUpperCase(),
              name: variantInput.name.trim(),
              concentrationLabel: variantInput.concentrationLabel?.trim(),
              concentrationPercent: variantInput.concentrationPercent,
              volumeMl: variantInput.volumeMl,
              catalogPriceCents:
                policy.pricingMode === PricingMode.CATALOG
                  ? variantInput.catalogPriceCents
                  : null,
              compareAtPriceCents: variantInput.compareAtPriceCents,
            },
          });
          await transaction.inventoryLevel.create({
            data: {
              variantId: variant.id,
              locationId: location.id,
              onHand: variantInput.initialStock,
              available: variantInput.initialStock,
              lowStockThreshold: variantInput.lowStockThreshold ?? 3,
            },
          });
          if (variantInput.initialStock > 0) {
            await transaction.stockMovement.create({
              data: {
                variantId: variant.id,
                locationId: location.id,
                type: StockMovementType.PURCHASE,
                quantity: variantInput.initialStock,
                referenceId: product.id,
                reason: 'Inventario inicial',
              },
            });
          }
        }

        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'PRODUCT_CREATED',
            entityType: 'Product',
            entityId: product.id,
            after: { slug: product.slug, name: product.name, line: product.line },
          },
        });
        return { id: product.id, slug: product.slug };
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('El slug o SKU ya existe.');
      }
      throw error;
    }
  }

  async updateProduct(id: string, input: UpdateProductDto, actorId: string) {
    const before = await this.prisma.product.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Producto no encontrado.');
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.update({ where: { id }, data: input });
      await transaction.auditLog.create({
        data: {
          actorId,
          action: 'PRODUCT_UPDATED',
          entityType: 'Product',
          entityId: id,
          before: before as unknown as Prisma.InputJsonValue,
          after: product as unknown as Prisma.InputJsonValue,
        },
      });
      return product;
    });
  }

  async updateVariant(id: string, input: UpdateVariantDto, actorId: string) {
    const variant = await this.prisma.productVariant.findUnique({
      where: { id },
      include: { product: { include: { linePricingPolicy: true } } },
    });
    if (!variant) throw new NotFoundException('Variante no encontrada.');
    if (
      variant.product.linePricingPolicy.pricingMode === PricingMode.CATALOG &&
      input.isActive !== false &&
      input.catalogPriceCents === undefined &&
      variant.catalogPriceCents === null
    ) {
      throw new BadRequestException('Una variante activa de catalogo necesita precio.');
    }

    const updated = await this.prisma.productVariant.update({
      where: { id },
      data: {
        ...input,
        catalogPriceCents:
          variant.product.linePricingPolicy.pricingMode === PricingMode.CATALOG
            ? input.catalogPriceCents
            : undefined,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        actorId,
        action: 'VARIANT_UPDATED',
        entityType: 'ProductVariant',
        entityId: id,
        after: updated as unknown as Prisma.InputJsonValue,
      },
    });
    return updated;
  }

  async updateInventory(variantId: string, input: UpdateInventoryDto, actorId: string) {
    return this.prisma.$transaction(
      async (transaction) => {
        const location = await transaction.storeLocation.findFirst({
          where: { isDefault: true, isActive: true },
        });
        if (!location) throw new ConflictException('No existe una ubicacion activa.');
        const inventory = await transaction.inventoryLevel.findUnique({
          where: { variantId_locationId: { variantId, locationId: location.id } },
        });
        if (!inventory) throw new NotFoundException('Inventario no encontrado.');
        if (input.onHand < inventory.reserved) {
          throw new ConflictException('La existencia no puede ser menor que las unidades reservadas.');
        }

        const updated = await transaction.inventoryLevel.update({
          where: { id: inventory.id },
          data: {
            onHand: input.onHand,
            available: input.onHand - inventory.reserved,
            lowStockThreshold: input.lowStockThreshold,
            version: { increment: 1 },
          },
        });
        await transaction.stockMovement.create({
          data: {
            variantId,
            locationId: location.id,
            type: StockMovementType.ADJUSTMENT,
            quantity: input.onHand - inventory.onHand,
            referenceId: inventory.id,
            reason: input.reason ?? 'Ajuste administrativo',
          },
        });
        await transaction.auditLog.create({
          data: {
            actorId,
            action: 'INVENTORY_UPDATED',
            entityType: 'InventoryLevel',
            entityId: inventory.id,
            before: inventory as unknown as Prisma.InputJsonValue,
            after: updated as unknown as Prisma.InputJsonValue,
          },
        });
        return updated;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  updateSpecialRequest(publicToken: string, input: UpdateSpecialRequestDto) {
    return this.prisma.specialRequest.update({
      where: { publicToken },
      data: { status: input.status, quotedCents: input.quotedCents },
    });
  }

  listOrders() {
    return this.prisma.order.findMany({
      include: { items: true, payments: { include: { transferProofs: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
  }

  private validateVariant(
    line: ProductLine,
    pricingMode: PricingMode,
    variant: CreateProductVariantDto,
  ) {
    if (pricingMode === PricingMode.CATALOG && variant.catalogPriceCents === undefined) {
      throw new BadRequestException(`La variante ${variant.sku} necesita precio de catalogo.`);
    }
    if (line !== ProductLine.PERSONAL_CARE && variant.volumeMl !== 60) {
      throw new BadRequestException(`La linea ${line} requiere presentacion de 60 ml.`);
    }
    if (
      (line === ProductLine.DESIGNER_37 || line === ProductLine.PREMIUM) &&
      variant.concentrationPercent !== 37
    ) {
      throw new BadRequestException(`La linea ${line} requiere concentracion de 37%.`);
    }
  }
}
