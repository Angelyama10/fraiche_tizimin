import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { OutboxService } from './outbox.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('CUSTOMER_JWT_SECRET'),
      }),
    }),
  ],
  providers: [OutboxService],
})
export class OutboxModule {}
