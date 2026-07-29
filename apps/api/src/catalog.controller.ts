import { Controller, DefaultValuePipe, Get, ParseBoolPipe, Query } from '@nestjs/common';
import { CatalogService } from './catalog.service';

@Controller()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('categories')
  categories() {
    return this.catalog.categories();
  }

  @Get('brands')
  brands() {
    return this.catalog.brands();
  }

  @Get('perfume-houses')
  perfumeHouses() {
    return this.catalog.perfumeHouses();
  }

  @Get('catalog/navigation')
  navigation() {
    return this.catalog.navigation();
  }

  @Get('catalog/inspirations')
  inspirations() {
    return this.catalog.inspirations();
  }

  @Get('promotions')
  promotions(
    @Query('includeUpcoming', new DefaultValuePipe(false), ParseBoolPipe)
    includeUpcoming: boolean,
  ) {
    return this.catalog.promotions(includeUpcoming);
  }
}
