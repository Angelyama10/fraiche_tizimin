import { Body, Controller, Post } from '@nestjs/common';
import { PresignTransferProofDto } from './payment.dto';
import { StorageService } from './storage.service';

@Controller('uploads')
export class UploadsController {
  constructor(private readonly storage: StorageService) {}

  @Post('transfer-proofs/presign')
  presignTransferProof(@Body() input: PresignTransferProofDto) {
    return this.storage.presignTransferProof(input);
  }
}
