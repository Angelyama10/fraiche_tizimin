import { Injectable } from '@nestjs/common';
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

  scentFamilies() {
    return this.prisma.scentFamily.findMany({ orderBy: { name: 'asc' } });
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
