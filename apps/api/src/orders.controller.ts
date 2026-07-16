import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { CreateOrderDto } from './order.dto';
import { OrdersService } from './orders.service';

@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
  ) {
    return this.orders.create(input, idempotencyKey);
  }

  @Get(':publicToken')
  get(@Param('publicToken') publicToken: string) {
    return this.orders.get(publicToken);
  }

  @Post(':publicToken/cancel')
  cancel(@Param('publicToken') publicToken: string) {
    return this.orders.cancel(publicToken);
  }
}
