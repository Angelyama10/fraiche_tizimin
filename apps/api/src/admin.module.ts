import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { AuthModule } from './auth.module';
import { PaymentsModule } from './payments.module';
import { RolesGuard } from './roles.guard';

@Module({
  imports: [AuthModule, PaymentsModule],
  controllers: [AdminController],
  providers: [AdminService, RolesGuard],
})
export class AdminModule {}
