import { Injectable } from '@nestjs/common';
import { ProductKind } from '@prisma/client';
import { PrismaService } from './prisma.service';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(query?: string, kind?: ProductKind) {
    return this.prisma.product.findMany({
      where: {
        isActive: true,
        ...(kind ? { kind } : {}),
        ...(query
          ? {
              OR: [
                { name: { contains: query, mode: 'insensitive' } },
                { brand: { contains: query, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: { variants: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  findBySlug(slug: string) {
    return this.prisma.product.findUnique({
      where: { slug },
      include: { variants: true },
    });
  }
}
