import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductKind } from '@prisma/client';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query('q') query?: string, @Query('kind') kind?: ProductKind) {
    return this.products.findAll(query, kind);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}
