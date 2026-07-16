import { Controller, Get, Param, Query } from '@nestjs/common';
import { ProductQueryDto, SuggestionQueryDto } from './product-query.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findAll(@Query() query: ProductQueryDto) {
    return this.products.findAll(query);
  }

  @Get('search/suggestions')
  suggestions(@Query() query: SuggestionQueryDto) {
    return this.products.suggestions(query);
  }

  @Get(':slug')
  findBySlug(@Param('slug') slug: string) {
    return this.products.findBySlug(slug);
  }
}
