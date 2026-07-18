import { Module } from '@nestjs/common';
import { CustomerAuthModule } from './customer-auth.module';
import { StorageService } from './storage.service';
import { UploadsController } from './uploads.controller';

@Module({
  imports: [CustomerAuthModule],
  controllers: [UploadsController],
  providers: [StorageService],
})
export class UploadsModule {}
