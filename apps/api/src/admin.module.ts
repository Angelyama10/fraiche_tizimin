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
import { AdminNotificationsService } from './admin-notifications.service';
import { ContentModule } from './content/content.module';
import { UploadsModule } from './uploads.module';

@Module({
  imports: [
    AuthModule,
    PaymentsModule,
    OrdersModule,
    ShipmentsModule,
    InventoryAlertsModule,
    ContentModule,
    UploadsModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminCommerceService, AdminNotificationsService, RolesGuard],
})
export class AdminModule {}
