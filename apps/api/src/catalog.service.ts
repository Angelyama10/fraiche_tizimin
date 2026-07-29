import { Injectable } from '@nestjs/common';
import { ProductStatus } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  async categories() {
    return this.prisma.category.findMany({
      where: { isActive: true, parentId: null },
      include: {
        children: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  brands() {
    return this.prisma.brand.findMany({ orderBy: { name: 'asc' } });
  }

  perfumeHouses() {
    return this.prisma.perfumeHouse.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async navigation() {
    const [sections, assignments] = await Promise.all([
      this.prisma.catalogSection.findMany({
        where: { isActive: true },
        include: {
          lines: {
            where: { isActive: true },
            include: {
              houses: {
                where: { perfumeHouse: { isActive: true } },
                include: { perfumeHouse: true },
                orderBy: { sortOrder: 'asc' },
              },
            },
            orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
          },
        },
        orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      }),
      this.prisma.productCatalogLine.findMany({
        where: { product: { status: ProductStatus.ACTIVE } },
        select: {
          catalogLineId: true,
          productId: true,
          product: {
            select: {
              inspirationHouse: {
                select: { id: true, slug: true, name: true, sortOrder: true },
              },
            },
          },
        },
      }),
    ]);

    const productIdsByLine = new Map<string, Set<string>>();
    const housesByLine = new Map<
      string,
      Map<string, { id: string; slug: string; name: string; sortOrder: number; productIds: Set<string> }>
    >();

    for (const section of sections) {
      for (const line of section.lines) {
        const lineHouses = new Map<
          string,
          { id: string; slug: string; name: string; sortOrder: number; productIds: Set<string> }
        >();
        for (const configuredHouse of line.houses) {
          lineHouses.set(configuredHouse.perfumeHouse.id, {
            id: configuredHouse.perfumeHouse.id,
            slug: configuredHouse.perfumeHouse.slug,
            name: configuredHouse.perfumeHouse.name,
            sortOrder: configuredHouse.sortOrder,
            productIds: new Set<string>(),
          });
        }
        housesByLine.set(line.id, lineHouses);
      }
    }

    for (const assignment of assignments) {
      const productIds = productIdsByLine.get(assignment.catalogLineId) ?? new Set<string>();
      productIds.add(assignment.productId);
      productIdsByLine.set(assignment.catalogLineId, productIds);

      const house = assignment.product.inspirationHouse;
      if (!house) continue;
      const lineHouses = housesByLine.get(assignment.catalogLineId) ?? new Map();
      const aggregate = lineHouses.get(house.id) ?? { ...house, productIds: new Set<string>() };
      aggregate.productIds.add(assignment.productId);
      lineHouses.set(house.id, aggregate);
      housesByLine.set(assignment.catalogLineId, lineHouses);
    }

    return {
      sections: sections.map((section) => ({
        id: section.id,
        slug: section.slug,
        name: section.name,
        description: section.description,
        iconKey: section.iconKey,
        sortOrder: section.sortOrder,
        lines: section.lines.map((line) => ({
          id: line.id,
          slug: line.slug,
          name: line.name,
          description: line.description,
          audience: line.audience,
          sortOrder: line.sortOrder,
          showInInspirations: line.showInInspirations,
          inspirationGroupSlug: line.inspirationGroupSlug,
          inspirationGroupName: line.inspirationGroupName,
          inspirationSortOrder: line.inspirationSortOrder,
          productCount: productIdsByLine.get(line.id)?.size ?? 0,
          houses: [...(housesByLine.get(line.id)?.values() ?? [])]
            .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
            .map(({ productIds, ...house }) => ({ ...house, productCount: productIds.size })),
        })),
      })),
    };
  }

  async inspirations() {
    const navigation = await this.navigation();
    const groups = new Map<
      string,
      {
        slug: string;
        name: string;
        sortOrder: number;
        lines: (typeof navigation.sections)[number]['lines'];
      }
    >();

    for (const section of navigation.sections) {
      for (const line of section.lines) {
        if (!line.showInInspirations || !line.inspirationGroupSlug || !line.inspirationGroupName) {
          continue;
        }
        const group = groups.get(line.inspirationGroupSlug) ?? {
          slug: line.inspirationGroupSlug,
          name: line.inspirationGroupName,
          sortOrder: line.inspirationSortOrder ?? line.sortOrder,
          lines: [],
        };
        group.lines.push(line);
        groups.set(group.slug, group);
      }
    }

    return {
      groups: [...groups.values()].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'),
      ),
    };
  }

  promotions(includeUpcoming = false) {
    const now = new Date();
    return this.prisma.promotion.findMany({
      where: {
        isActive: true,
        ...(includeUpcoming ? {} : { startsAt: { lte: now } }),
        OR: [{ endsAt: null }, { endsAt: { gte: now } }],
      },
      select: {
        slug: true,
        code: true,
        name: true,
        description: true,
        imageUrl: true,
        type: true,
        value: true,
        minimumCents: true,
        startsAt: true,
        endsAt: true,
        isFeatured: true,
        placement: true,
        requiresCode: true,
        maximumDiscountCents: true,
        priority: true,
      },
      orderBy: [{ priority: 'desc' }, { isFeatured: 'desc' }, { startsAt: 'desc' }],
    });
  }
}
