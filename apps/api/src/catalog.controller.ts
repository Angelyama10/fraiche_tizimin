import { Controller, Get } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('scent-families')
  scentFamilies() {
    return this.catalog.scentFamilies();
  }

  @Get('promotions')
  promotions() {
    return this.catalog.promotions();
  }
}
