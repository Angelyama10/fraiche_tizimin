import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PaymentMethod } from '@prisma/client';
import { ConfirmTransferProofDto } from './payment.dto';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  @Post('mercado-pago/orders/:orderToken/preference')
  createMercadoPagoPreference(@Param('orderToken') orderToken: string) {
    return this.payments.createMercadoPagoPreference(orderToken);
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

  @Get('instructions/:method')
  instructions(@Param('method') method: PaymentMethod) {
    return this.payments.instructions(method);
  }

  @Post('orders/:orderToken/transfer-proof')
  confirmTransferProof(
    @Param('orderToken') orderToken: string,
    @Body() input: ConfirmTransferProofDto,
  ) {
    return this.payments.confirmTransferProof(orderToken, input);
  }
}
