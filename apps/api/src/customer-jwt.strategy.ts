import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type AuthenticatedCustomer = {
  customerId: string;
  email: string;
};

type CustomerJwtPayload = {
  sub: string;
  email: string;
  tokenType: 'CUSTOMER';
};

@Injectable()
export class CustomerJwtStrategy extends PassportStrategy(Strategy, 'customer-jwt') {
  constructor(config: ConfigService) {
    const secret = config.get<string>('CUSTOMER_JWT_SECRET');
    if (!secret) {
      throw new ServiceUnavailableException('Falta configurar CUSTOMER_JWT_SECRET.');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: 'fraiche-api',
      audience: 'fraiche-customers',
    });
  }

  validate(payload: CustomerJwtPayload): AuthenticatedCustomer {
    if (payload.tokenType !== 'CUSTOMER' || !payload.sub || !payload.email) {
      throw new UnauthorizedException('Token de cliente invalido.');
    }
    return { customerId: payload.sub, email: payload.email };
  }
}
