import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ScheduleModule } from '@nestjs/schedule';
import { AdminModule } from './admin.module';
import { AuthModule } from './auth.module';
import { CartsModule } from './carts.module';
import { CatalogModule } from './catalog.module';
import { ContactModule } from './contact.module';
import { CustomerAuthModule } from './customer-auth.module';
import { CustomersModule } from './customers.module';
import { HealthController } from './health.controller';
import { OrdersModule } from './orders.module';
import { OutboxModule } from './outbox.module';
import { PaymentsModule } from './payments.module';
import { PricingModule } from './pricing.module';
import { PrismaModule } from './prisma.module';
import { ProductsModule } from './products.module';
import { ReservationsModule } from './reservations.module';
import { SpecialRequestsModule } from './special-requests.module';
import { UploadsModule } from './uploads.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    ScheduleModule.forRoot(),
    PrismaModule,
    PricingModule,
    ProductsModule,
    CatalogModule,
    CartsModule,
    OrdersModule,
    PaymentsModule,
    UploadsModule,
    ContactModule,
    CustomerAuthModule,
    CustomersModule,
    SpecialRequestsModule,
    AuthModule,
    AdminModule,
    ReservationsModule,
    OutboxModule,
  ],
  controllers: [HealthController],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
