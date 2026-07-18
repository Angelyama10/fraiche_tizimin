import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminCommerceService } from './admin-commerce.service';
import { AdminService } from './admin.service';
import { AuthModule } from './auth.module';
import { PaymentsModule } from './payments.module';
import { RolesGuard } from './roles.guard';
import { OrdersModule } from './orders.module';
import { ShipmentsModule } from './shipments.module';
import { InventoryAlertsModule } from './inventory-alerts.module';

@Module({
  imports: [
    AuthModule,
    PaymentsModule,
    OrdersModule,
    ShipmentsModule,
    InventoryAlertsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminCommerceService, RolesGuard],
})
export class AdminModule {}
