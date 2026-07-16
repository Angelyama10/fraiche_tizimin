import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { AddCartItemDto, UpdateCartItemDto } from './cart.dto';
import { CartsService } from './carts.service';

@Controller('carts')
export class CartsController {
  constructor(private readonly carts: CartsService) {}

  @Post()
  create() {
    return this.carts.create();
  }

  @Get(':publicToken')
  get(@Param('publicToken') publicToken: string) {
    return this.carts.get(publicToken);
  }

  @Post(':publicToken/items')
  addItem(@Param('publicToken') publicToken: string, @Body() input: AddCartItemDto) {
    return this.carts.addItem(publicToken, input);
  }

  @Patch(':publicToken/items/:itemId')
  updateItem(
    @Param('publicToken') publicToken: string,
    @Param('itemId') itemId: string,
    @Body() input: UpdateCartItemDto,
  ) {
    return this.carts.updateItem(publicToken, itemId, input);
  }

  @Delete(':publicToken/items/:itemId')
  removeItem(
    @Param('publicToken') publicToken: string,
    @Param('itemId') itemId: string,
  ) {
    return this.carts.removeItem(publicToken, itemId);
  }
}
