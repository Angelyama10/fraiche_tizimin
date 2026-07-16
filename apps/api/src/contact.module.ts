import { Module } from '@nestjs/common';
import { CartsModule } from './carts.module';
import { ContactController } from './contact.controller';
import { ContactService } from './contact.service';
import { OrdersModule } from './orders.module';

@Module({
  imports: [CartsModule, OrdersModule],
  controllers: [ContactController],
  providers: [ContactService],
})
export class ContactModule {}
