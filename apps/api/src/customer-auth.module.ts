import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { CustomerAuthController } from './customer-auth.controller';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { CustomerAuthService } from './customer-auth.service';
import { CustomerJwtStrategy } from './customer-jwt.strategy';

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('CUSTOMER_JWT_SECRET'),
        signOptions: {
          expiresIn: '15m',
          issuer: 'fraiche-api',
          audience: 'fraiche-customers',
        },
      }),
    }),
  ],
  controllers: [CustomerAuthController],
  providers: [CustomerAuthService, CustomerJwtStrategy, CustomerJwtAuthGuard],
  exports: [JwtModule, CustomerJwtAuthGuard],
})
export class CustomerAuthModule {}
