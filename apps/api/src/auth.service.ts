import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { compare } from 'bcrypt';
import { LoginDto } from './auth.dto';
import { PrismaService } from './prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: input.email.trim().toLowerCase() },
    });
    if (!user || !user.isActive || !(await compare(input.password, user.passwordHash))) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    return {
      accessToken: await this.jwt.signAsync({
        sub: user.id,
        email: user.email,
        role: user.role,
      }),
      expiresInSeconds: 3600,
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    };
  }
}
