import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  PricingMode,
  Prisma,
  ProductLine,
  ProductStatus,
  StockMovementType,
} from '@prisma/client';
import {
  CreateBrandDto,
  CreateCategoryDto,
  CreatePerfumeHouseDto,
  CreateProductDto,
  CreateProductVariantDto,
  SkuAvailabilityQueryDto,
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
    const normalizedSlug = input.slug.trim().toLowerCase();
    const normalizedSkus = input.variants.map((variant) => this.normalizeSku(variant.sku));
    if (new Set(normalizedSkus).size !== normalizedSkus.length) {
      throw new ConflictException('Hay variantes con el mismo SKU dentro del formulario.');
    }
    const [existingProduct, existingVariants] = await Promise.all([
      this.prisma.product.findUnique({
        where: { slug: normalizedSlug },
        select: { id: true },
      }),
      this.prisma.productVariant.findMany({
        where: { sku: { in: normalizedSkus } },
        select: { sku: true },
      }),
    ]);
    if (existingProduct) throw new ConflictException('Ya existe un producto con este slug.');
    if (existingVariants.length) {
      throw new ConflictException(`El SKU ${existingVariants[0].sku} ya pertenece a otro articulo.`);
    }

    const policy = await this.prisma.linePricingPolicy.findUnique({ where: { line: input.line } });
    if (!policy) throw new BadRequestException('La linea no tiene politica de precios.');
    const brand = await this.prisma.brand.findUnique({ where: { slug: input.brandSlug } });
    if (!brand) throw new BadRequestException('La marca no existe.');

    const categories = await this.prisma.category.findMany({
      where: { slug: { in: [...new Set(input.categorySlugs)] }, isActive: true },
    });
    if (categories.length !== new Set(input.categorySlugs).size) {
      throw new BadRequestException('Una o mas categorias no existen.');
    }
    const catalogLineSlugs = [...new Set(input.catalogLineSlugs)];
    const catalogLines = await this.prisma.catalogLine.findMany({
      where: { slug: { in: catalogLineSlugs }, isActive: true, section: { isActive: true } },
    });
    if (catalogLines.length !== catalogLineSlugs.length) {
      throw new BadRequestException('Una o mas lineas de catalogo no existen.');
    }
    const inspirationHouse = input.inspirationHouseSlug
      ? await this.prisma.perfumeHouse.findFirst({
          where: { slug: input.inspirationHouseSlug, isActive: true },
        })
      : null;
    if (input.inspirationHouseSlug && !inspirationHouse) {
      throw new BadRequestException('La casa perfumera no existe.');
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
            slug: normalizedSlug,
            name: input.name.trim(),
            shortDescription: input.shortDescription?.trim(),
            description: input.description?.trim(),
            seoTitle: input.seoTitle?.trim(),
            seoDescription: input.seoDescription?.trim(),
            line: input.line,
            status: input.status ?? ProductStatus.DRAFT,
            brandId: brand.id,
            inspirationHouseId: inspirationHouse?.id,
            isFeatured: input.isFeatured ?? false,
            isNew: input.isNew ?? false,
            categories: {
              create: categories.map((category) => ({ categoryId: category.id })),
            },
            catalogLines: {
              create: catalogLines.map((catalogLine) => ({ catalogLineId: catalogLine.id })),
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

        if (inspirationHouse) {
          await transaction.catalogLineHouse.createMany({
            data: catalogLines.map((catalogLine) => ({
              catalogLineId: catalogLine.id,
              perfumeHouseId: inspirationHouse.id,
            })),
            skipDuplicates: true,
          });
        }

        for (const variantInput of input.variants) {
          const variant = await transaction.productVariant.create({
            data: {
              productId: product.id,
              sku: this.normalizeSku(variantInput.sku),
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
    const before = await this.prisma.product.findUnique({
      where: { id },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        categories: true,
        catalogLines: true,
        inspirationHouse: true,
      },
    });
    if (!before) throw new NotFoundException('Producto no encontrado.');

    const categorySlugs = input.categorySlugs
      ? [...new Set(input.categorySlugs)]
      : undefined;
    const categories = categorySlugs
      ? await this.prisma.category.findMany({
          where: { slug: { in: categorySlugs }, isActive: true },
        })
      : undefined;
    if (categories && categories.length !== categorySlugs?.length) {
      throw new BadRequestException('Una o más categorías no existen.');
    }
    const catalogLineSlugs = input.catalogLineSlugs
      ? [...new Set(input.catalogLineSlugs)]
      : undefined;
    const catalogLines = catalogLineSlugs
      ? await this.prisma.catalogLine.findMany({
          where: {
            slug: { in: catalogLineSlugs },
            isActive: true,
            section: { isActive: true },
          },
        })
      : undefined;
    if (catalogLines && catalogLines.length !== catalogLineSlugs?.length) {
      throw new BadRequestException('Una o más líneas de catálogo no existen.');
    }

    const brand = input.brandSlug
      ? await this.prisma.brand.findUnique({ where: { slug: input.brandSlug } })
      : undefined;
    if (input.brandSlug && !brand) throw new BadRequestException('La marca no existe.');
    const inspirationHouse =
      input.inspirationHouseSlug === undefined
        ? undefined
        : input.inspirationHouseSlug
          ? await this.prisma.perfumeHouse.findFirst({
              where: { slug: input.inspirationHouseSlug, isActive: true },
            })
          : null;
    if (input.inspirationHouseSlug && !inspirationHouse) {
      throw new BadRequestException('La casa perfumera no existe.');
    }

    const {
      categorySlugs: _categorySlugs,
      catalogLineSlugs: _catalogLineSlugs,
      brandSlug: _brandSlug,
      inspirationHouseSlug: _inspirationHouseSlug,
      images,
      ...productFields
    } = input;
    const normalizedProductFields = {
      ...productFields,
      ...(input.name !== undefined ? { name: input.name.trim() } : {}),
      ...(input.shortDescription !== undefined
        ? { shortDescription: input.shortDescription.trim() || null }
        : {}),
      ...(input.description !== undefined
        ? { description: input.description.trim() || null }
        : {}),
      ...(input.seoTitle !== undefined
        ? { seoTitle: input.seoTitle?.trim() || null }
        : {}),
      ...(input.seoDescription !== undefined
        ? { seoDescription: input.seoDescription?.trim() || null }
        : {}),
    };
    return this.prisma.$transaction(async (transaction) => {
      const product = await transaction.product.update({
        where: { id },
        data: {
          ...normalizedProductFields,
          ...(brand ? { brandId: brand.id } : {}),
          ...(inspirationHouse !== undefined
            ? { inspirationHouseId: inspirationHouse?.id ?? null }
            : {}),
          ...(categories
            ? {
                categories: {
                  deleteMany: {},
                  create: categories.map((category) => ({
                    categoryId: category.id,
                  })),
                },
              }
            : {}),
          ...(catalogLines
            ? {
                catalogLines: {
                  deleteMany: {},
                  create: catalogLines.map((catalogLine) => ({
                    catalogLineId: catalogLine.id,
                  })),
                },
              }
            : {}),
          ...(images
            ? {
                images: {
                  deleteMany: {},
                  create: images.map((image, index) => ({
                    url: image.url,
                    altText: image.altText,
                    isPrimary:
                      image.isPrimary ?? (!images.some((item) => item.isPrimary) && index === 0),
                    sortOrder: index,
                  })),
                },
              }
            : {}),
        },
        include: {
          images: { orderBy: { sortOrder: 'asc' } },
          brand: true,
          inspirationHouse: true,
          categories: { include: { category: true } },
          catalogLines: { include: { catalogLine: { include: { section: true } } } },
        },
      });
      const effectiveHouseId =
        inspirationHouse === undefined
          ? before.inspirationHouseId
          : inspirationHouse?.id ?? null;
      const effectiveCatalogLineIds =
        catalogLines?.map((catalogLine) => catalogLine.id) ??
        before.catalogLines.map((catalogLine) => catalogLine.catalogLineId);
      if (effectiveHouseId) {
        await transaction.catalogLineHouse.createMany({
          data: effectiveCatalogLineIds.map((catalogLineId) => ({
            catalogLineId,
            perfumeHouseId: effectiveHouseId,
          })),
          skipDuplicates: true,
        });
      }
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

  async skuAvailability(query: SkuAvailabilityQueryDto) {
    const sku = this.normalizeSku(query.sku);
    const variant = await this.prisma.productVariant.findUnique({
      where: { sku },
      select: {
        id: true,
        sku: true,
        product: { select: { id: true, name: true, slug: true } },
      },
    });
    return {
      sku,
      available: !variant,
      conflict: variant
        ? {
            variantId: variant.id,
            productId: variant.product.id,
            productName: variant.product.name,
            productSlug: variant.product.slug,
          }
        : null,
    };
  }

  async createBrand(input: CreateBrandDto, actorId: string) {
    const slug = input.slug?.trim() || this.toSlug(input.name);
    try {
      const brand = await this.prisma.brand.create({
        data: { name: input.name.trim(), slug },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'BRAND_CREATED',
          entityType: 'Brand',
          entityId: brand.id,
          after: brand as unknown as Prisma.InputJsonValue,
        },
      });
      return brand;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una marca con ese nombre o slug.');
      }
      throw error;
    }
  }

  async createCategory(input: CreateCategoryDto, actorId: string) {
    const slug = input.slug?.trim() || this.toSlug(input.name);
    const parent = input.parentSlug
      ? await this.prisma.category.findUnique({ where: { slug: input.parentSlug } })
      : null;
    if (input.parentSlug && !parent) {
      throw new BadRequestException('La categoria superior no existe.');
    }
    try {
      const category = await this.prisma.category.create({
        data: {
          name: input.name.trim(),
          slug,
          description: input.description?.trim() || null,
          parentId: parent?.id,
        },
        include: { parent: true, children: true },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'CATEGORY_CREATED',
          entityType: 'Category',
          entityId: category.id,
          after: category as unknown as Prisma.InputJsonValue,
        },
      });
      return category;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una categoria con ese nombre o slug.');
      }
      throw error;
    }
  }

  async createPerfumeHouse(input: CreatePerfumeHouseDto, actorId: string) {
    const slug = input.slug?.trim() || this.toSlug(input.name);
    try {
      const house = await this.prisma.perfumeHouse.create({
        data: {
          name: input.name.trim(),
          slug,
          description: input.description?.trim() || null,
        },
      });
      await this.prisma.auditLog.create({
        data: {
          actorId,
          action: 'PERFUME_HOUSE_CREATED',
          entityType: 'PerfumeHouse',
          entityId: house.id,
          after: house as unknown as Prisma.InputJsonValue,
        },
      });
      return house;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        throw new ConflictException('Ya existe una casa perfumera con ese nombre o slug.');
      }
      throw error;
    }
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
        const [location, variant] = await Promise.all([
          transaction.storeLocation.findFirst({
            where: { isDefault: true, isActive: true },
          }),
          transaction.productVariant.findUnique({
            where: { id: variantId },
            select: { id: true },
          }),
        ]);
        if (!location) throw new ConflictException('No existe una ubicacion activa.');
        if (!variant) throw new NotFoundException('Variante no encontrada.');

        const inventory = await transaction.inventoryLevel.findUnique({
          where: { variantId_locationId: { variantId, locationId: location.id } },
        });
        const reserved = inventory?.reserved ?? 0;
        if (input.onHand < reserved) {
          throw new ConflictException('La existencia no puede ser menor que las unidades reservadas.');
        }

        const updated = inventory
          ? await transaction.inventoryLevel.update({
              where: { id: inventory.id },
              data: {
                onHand: input.onHand,
                available: input.onHand - reserved,
                lowStockThreshold: input.lowStockThreshold,
                version: { increment: 1 },
              },
            })
          : await transaction.inventoryLevel.create({
              data: {
                variantId,
                locationId: location.id,
                onHand: input.onHand,
                available: input.onHand,
                lowStockThreshold: input.lowStockThreshold ?? 3,
              },
            });

        const quantity = input.onHand - (inventory?.onHand ?? 0);
        if (quantity !== 0) {
          await transaction.stockMovement.create({
            data: {
              variantId,
              locationId: location.id,
              type: StockMovementType.ADJUSTMENT,
              quantity,
              referenceId: updated.id,
              reason: input.reason ?? 'Ajuste administrativo',
            },
          });
        }
        await transaction.auditLog.create({
          data: {
            actorId,
            action: inventory ? 'INVENTORY_UPDATED' : 'INVENTORY_CREATED',
            entityType: 'InventoryLevel',
            entityId: updated.id,
            ...(inventory
              ? { before: inventory as unknown as Prisma.InputJsonValue }
              : {}),
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
    if (
      (line === ProductLine.DESIGNER_37 || line === ProductLine.PREMIUM) &&
      variant.concentrationPercent !== 37
    ) {
      throw new BadRequestException(`La linea ${line} requiere concentracion de 37%.`);
    }
  }

  private normalizeSku(sku: string) {
    return sku.trim().toUpperCase();
  }

  private toSlug(value: string) {
    const slug = value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    if (!slug) throw new BadRequestException('No fue posible generar un slug valido.');
    return slug;
  }
}
