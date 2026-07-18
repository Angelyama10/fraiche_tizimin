import { Module } from '@nestjs/common';
import { InventoryAlertsService } from './inventory-alerts.service';

@Module({
  providers: [InventoryAlertsService],
  exports: [InventoryAlertsService],
})
export class InventoryAlertsModule {}
