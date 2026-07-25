import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  ParseEnumPipe,
  Post,
  Query,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentMethod } from '@prisma/client';
import type { Request } from 'express';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { AuthenticatedCustomer } from './customer-jwt.strategy';
import {
  ConfirmTransferProofDto,
  ProcessMercadoPagoCardDto,
} from './payment.dto';
import { PaymentsService } from './payments.service';

type CustomerRequest = Request & { user: AuthenticatedCustomer };

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Get('configuration')
  configuration() {
    return this.payments.paymentConfiguration();
  }

  @Post('mercado-pago/orders/:orderToken/preference')
  @UseGuards(CustomerJwtAuthGuard)
  createMercadoPagoPreference(
    @Param('orderToken') orderToken: string,
    @Req() request: CustomerRequest,
  ) {
    return this.payments.createMercadoPagoPreference(orderToken, request.user.customerId);
  }

  @Post('mercado-pago/orders/:orderToken/card')
  @UseGuards(CustomerJwtAuthGuard)
  processMercadoPagoCard(
    @Param('orderToken') orderToken: string,
    @Body() input: ProcessMercadoPagoCardDto,
    @Req() request: CustomerRequest,
  ) {
    return this.payments.processMercadoPagoCard(
      orderToken,
      input,
      request.user.customerId,
    );
  }

  @SkipThrottle()
  @Post('mercado-pago/webhook')
  @HttpCode(200)
  receiveMercadoPagoWebhook(
    @Headers('x-signature') xSignature: string | undefined,
    @Headers('x-request-id') xRequestId: string | undefined,
    @Query('data.id') dataId: string | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    return this.payments.receiveMercadoPagoWebhook({ xSignature, xRequestId, dataId, body });
  }

  @Post('stripe/orders/:orderToken/intent')
  @UseGuards(CustomerJwtAuthGuard)
  createStripePaymentIntent(
    @Param('orderToken') orderToken: string,
    @Req() request: CustomerRequest,
  ) {
    return this.payments.createStripePaymentIntent(
      orderToken,
      request.user.customerId,
    );
  }

  @Post('stripe/orders/:orderToken/sync')
  @UseGuards(CustomerJwtAuthGuard)
  syncStripePayment(
    @Param('orderToken') orderToken: string,
    @Req() request: CustomerRequest,
  ) {
    return this.payments.syncStripePayment(orderToken, request.user.customerId);
  }

  @SkipThrottle()
  @Post('stripe/webhook')
  @HttpCode(200)
  receiveStripeWebhook(
    @Headers('stripe-signature') signature: string | undefined,
    @Req() request: RawBodyRequest<Request>,
  ) {
    return this.payments.receiveStripeWebhook(request.rawBody, signature);
  }

  @Get('instructions/:method')
  instructions(@Param('method', new ParseEnumPipe(PaymentMethod)) method: PaymentMethod) {
    return this.payments.instructions(method);
  }

  @Post('orders/:orderToken/transfer-proof')
  @UseGuards(CustomerJwtAuthGuard)
  confirmTransferProof(
    @Param('orderToken') orderToken: string,
    @Body() input: ConfirmTransferProofDto,
    @Req() request: CustomerRequest,
  ) {
    return this.payments.confirmTransferProof(orderToken, input, request.user.customerId);
  }
}
