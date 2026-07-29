import { Body, Controller, Get, Headers, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { AuthenticatedCustomer } from './customer-jwt.strategy';
import { CreateOrderDto, ListCustomerOrdersDto, UpdatePendingOrderDto } from './order.dto';
import { OrdersService } from './orders.service';

type CustomerRequest = Request & { user: AuthenticatedCustomer };

@Controller('orders')
@UseGuards(CustomerJwtAuthGuard)
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Post()
  create(
    @Body() input: CreateOrderDto,
    @Headers('idempotency-key') idempotencyKey?: string,
    @Req() request?: CustomerRequest,
  ) {
    return this.orders.create(input, idempotencyKey, request!.user.customerId);
  }

  @Get()
  list(@Query() query: ListCustomerOrdersDto, @Req() request: CustomerRequest) {
    return this.orders.listForCustomer(request.user.customerId, query);
  }

  @Get(':publicToken')
  get(@Param('publicToken') publicToken: string, @Req() request: CustomerRequest) {
    return this.orders.getForCustomer(publicToken, request.user.customerId);
  }

  @Patch(':publicToken/checkout')
  updatePendingCheckout(
    @Param('publicToken') publicToken: string,
    @Body() input: UpdatePendingOrderDto,
    @Req() request: CustomerRequest,
  ) {
    return this.orders.updatePendingCheckout(publicToken, input, request.user.customerId);
  }

  @Post(':publicToken/cancel')
  cancel(@Param('publicToken') publicToken: string, @Req() request: CustomerRequest) {
    return this.orders.cancel(publicToken, request.user.customerId);
  }
}
