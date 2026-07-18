import { Module } from '@nestjs/common';
import { CustomerAuthModule } from './customer-auth.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { PricingModule } from './pricing.module';

@Module({
  imports: [CustomerAuthModule, PricingModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
