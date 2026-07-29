import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProductStatus } from '@prisma/client';
import { PricingService } from './pricing.service';
import { PrismaService } from './prisma.service';
import { ProductQueryDto, SuggestionQueryDto } from './product-query.dto';

const productInclude = {
  brand: true,
  inspirationHouse: true,
  linePricingPolicy: true,
  images: { orderBy: { sortOrder: 'asc' as const } },
  categories: { include: { category: true } },
  catalogLines: { include: { catalogLine: { include: { section: true } } } },
  variants: {
    where: { isActive: true },
    include: { inventoryLevels: { where: { location: { isActive: true } } } },
    orderBy: { createdAt: 'asc' as const },
  },
} satisfies Prisma.ProductInclude;

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: typeof productInclude;
}>;

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  async findAll(query: ProductQueryDto) {
    const where: Prisma.ProductWhereInput = {
      status: ProductStatus.ACTIVE,
      ...(query.line ? { line: query.line } : {}),
      ...(query.featured !== undefined ? { isFeatured: query.featured } : {}),
      ...(query.category
        ? { categories: { some: { category: { slug: query.category, isActive: true } } } }
        : {}),
      ...(query.catalogSection
        ? {
            catalogLines: {
              some: {
                catalogLine: {
                  isActive: true,
                  section: { slug: query.catalogSection, isActive: true },
                },
              },
            },
          }
        : {}),
      ...(query.catalogLine
        ? { catalogLines: { some: { catalogLine: { slug: query.catalogLine, isActive: true } } } }
        : {}),
      ...(query.house
        ? { inspirationHouse: { slug: query.house, isActive: true } }
        : {}),
      ...(query.brand ? { brand: { slug: query.brand } } : {}),
      ...(query.q?.trim()
        ? {
            OR: [
              { name: { contains: query.q.trim(), mode: 'insensitive' } },
              { shortDescription: { contains: query.q.trim(), mode: 'insensitive' } },
              { brand: { name: { contains: query.q.trim(), mode: 'insensitive' } } },
              {
                inspirationHouse: {
                  name: { contains: query.q.trim(), mode: 'insensitive' },
                },
              },
            ],
          }
        : {}),
    };

    const products = await this.prisma.product.findMany({
      where,
      include: productInclude,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: query.take + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = products.length > query.take;
    const page = hasMore ? products.slice(0, query.take) : products;

    return {
      items: page.map((product) => this.serializeProduct(product)),
      nextCursor: hasMore ? page[page.length - 1]?.id ?? null : null,
    };
  }

  async findBySlug(slug: string) {
    const product = await this.prisma.product.findFirst({
      where: { slug, status: ProductStatus.ACTIVE },
      include: productInclude,
    });

    if (!product) {
      throw new NotFoundException('Producto no encontrado.');
    }

    return this.serializeProduct(product);
  }

  async suggestions(query: SuggestionQueryDto) {
    const q = query.q.trim();
    if (q.length < 2) return [];

    return this.prisma.product.findMany({
      where: {
        status: ProductStatus.ACTIVE,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { brand: { name: { contains: q, mode: 'insensitive' } } },
          { inspirationHouse: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      select: {
        slug: true,
        name: true,
        brand: { select: { name: true } },
        inspirationHouse: { select: { name: true } },
        images: {
          where: { isPrimary: true },
          select: { url: true, altText: true },
          take: 1,
        },
      },
      orderBy: { name: 'asc' },
      take: query.take,
    });
  }

  private serializeProduct(product: ProductWithRelations) {
    const variants = product.variants.map((variant) => {
      const price = this.pricing.resolveVariantPrice({ ...variant, product });
      const available = variant.inventoryLevels.reduce(
        (total, inventory) => total + inventory.available,
        0,
      );

      return {
        id: variant.id,
        sku: variant.sku,
        name: variant.name,
        concentrationLabel: variant.concentrationLabel,
        concentrationPercent: variant.concentrationPercent?.toString() ?? null,
        volumeMl: variant.volumeMl,
        priceCents: price.amountCents,
        compareAtPriceCents: variant.compareAtPriceCents,
        currency: price.currency,
        available,
        inStock: available > 0,
        attributes: variant.attributes,
      };
    });
    const prices = variants.map((variant) => variant.priceCents);

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      shortDescription: product.shortDescription,
      description: product.description,
      line: product.line,
      brand: product.brand,
      inspirationHouse: product.inspirationHouse,
      isFeatured: product.isFeatured,
      isNew: product.isNew,
      seoTitle: product.seoTitle,
      seoDescription: product.seoDescription,
      attributes: product.attributes,
      images: product.images,
      categories: product.categories.map(({ category }) => category),
      catalogLines: product.catalogLines.map(({ catalogLine }) => catalogLine),
      variants,
      priceRange: {
        minimumCents: prices.length ? Math.min(...prices) : null,
        maximumCents: prices.length ? Math.max(...prices) : null,
        currency: variants[0]?.currency ?? 'MXN',
      },
    };
  }
}
