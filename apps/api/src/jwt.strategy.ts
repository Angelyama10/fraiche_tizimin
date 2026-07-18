import { Injectable, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { UserRole } from '@prisma/client';
import { ExtractJwt, Strategy } from 'passport-jwt';

export type AuthenticatedUser = {
  userId: string;
  email: string;
  role: UserRole;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(config: ConfigService) {
    const secret = config.get<string>('JWT_SECRET');
    if (!secret) throw new ServiceUnavailableException('Falta configurar JWT_SECRET.');
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
      issuer: 'fraiche-api',
      audience: 'fraiche-staff',
    });
  }

  validate(payload: {
    sub: string;
    email: string;
    role: UserRole;
    tokenType: 'STAFF';
  }): AuthenticatedUser {
    if (payload.tokenType !== 'STAFF') {
      throw new UnauthorizedException('Token de personal invalido.');
    }
    return { userId: payload.sub, email: payload.email, role: payload.role };
  }
}
