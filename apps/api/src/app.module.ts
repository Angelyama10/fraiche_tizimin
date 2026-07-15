import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { PrismaModule } from './prisma.module';
import { ProductsModule } from './products.module';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule, ProductsModule],
  controllers: [HealthController],
})
export class AppModule {}
