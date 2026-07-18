import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { AuthenticatedCustomer } from './customer-jwt.strategy';
import { PresignTransferProofDto } from './payment.dto';
import { StorageService } from './storage.service';

type CustomerRequest = Request & { user: AuthenticatedCustomer };

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('transfer-proofs/presign')
  @UseGuards(CustomerJwtAuthGuard)
  presignTransferProof(@Body() input: PresignTransferProofDto, @Req() request: CustomerRequest) {
    return this.storage.presignTransferProof(input, request.user.customerId);
  }
}
