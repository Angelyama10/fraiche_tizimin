import { createHash, randomBytes } from 'node:crypto';
import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Interval } from '@nestjs/schedule';
import { argon2id, hash, verify } from 'argon2';
import {
  ForgotCustomerPasswordDto,
  LoginCustomerDto,
  RegisterCustomerDto,
  ResetCustomerPasswordDto,
  VerifyCustomerEmailDto,
} from './customer-auth.dto';
import { PrismaService } from './prisma.service';

export type SessionMetadata = {
  ipAddress?: string;
  userAgent?: string;
};

type PasswordResetPayload = {
  sub: string;
  requestId: string;
  tokenType: 'PASSWORD_RESET';
};

type EmailVerificationPayload = {
  sub: string;
  email: string;
  tokenType: 'EMAIL_VERIFICATION';
};

const ACCESS_TOKEN_SECONDS = 15 * 60;
const REFRESH_TOKEN_DAYS = 30;

@Injectable()
export class CustomerAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async register(input: RegisterCustomerDto, metadata: SessionMetadata) {
    const email = this.normalizeEmail(input.email);
    const existing = await this.prisma.customer.findUnique({ where: { email } });
    if (existing) {
      throw new ConflictException(
        existing.passwordHash
          ? 'Ya existe una cuenta con este correo.'
          : 'Este correo tiene un historial previo. Usa recuperar contrasena para activar la cuenta.',
      );
    }

    const passwordHash = await this.hashPassword(input.password);
    const customer = await this.prisma.$transaction(async (transaction) => {
      const created = await transaction.customer.create({
        data: {
          email,
          passwordHash,
          passwordChangedAt: new Date(),
          firstName: input.firstName.trim(),
          lastName: input.lastName.trim(),
          phone: input.phone.trim(),
          marketingOptIn: input.marketingOptIn ?? false,
        },
      });
      await transaction.outboxEvent.create({
        data: {
          type: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
          aggregateType: 'Customer',
          aggregateId: created.id,
          deduplicationKey: `EMAIL_VERIFICATION:${created.id}:REGISTER`,
          payload: { customerId: created.id },
        },
      });
      return created;
    });

    return this.issueSession(customer, metadata);
  }

  async login(input: LoginCustomerDto, metadata: SessionMetadata) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: this.normalizeEmail(input.email) },
    });
    if (
      !customer?.passwordHash ||
      !customer.isActive ||
      !(await verify(customer.passwordHash, input.password))
    ) {
      throw new UnauthorizedException('Credenciales invalidas.');
    }

    await this.prisma.customer.update({
      where: { id: customer.id },
      data: { lastLoginAt: new Date() },
    });
    return this.issueSession(customer, metadata);
  }

  async refresh(refreshToken: string | undefined) {
    if (!refreshToken) throw new UnauthorizedException('La sesion no existe.');
    const tokenHash = this.hashRefreshToken(refreshToken);
    const session = await this.prisma.customerSession.findUnique({
      where: { refreshTokenHash: tokenHash },
      include: { customer: true },
    });
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= new Date() ||
      !session.customer.isActive ||
      !session.customer.passwordHash ||
      !session.customer.email
    ) {
      throw new UnauthorizedException('La sesion expiro o fue revocada.');
    }

    const nextRefreshToken = this.createRefreshToken();
    const rotated = await this.prisma.customerSession.updateMany({
      where: {
        id: session.id,
        refreshTokenHash: tokenHash,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      data: {
        refreshTokenHash: this.hashRefreshToken(nextRefreshToken),
        lastUsedAt: new Date(),
      },
    });
    if (!rotated.count) {
      throw new UnauthorizedException('La sesion ya fue renovada o revocada.');
    }

    return {
      ...(await this.buildAccessResponse(session.customer)),
      refreshToken: nextRefreshToken,
      refreshExpiresAt: session.expiresAt,
    };
  }

  async logout(refreshToken: string | undefined) {
    if (refreshToken) {
      await this.prisma.customerSession.updateMany({
        where: { refreshTokenHash: this.hashRefreshToken(refreshToken), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    return { loggedOut: true };
  }

  async logoutAll(customerId: string) {
    await this.prisma.customerSession.updateMany({
      where: { customerId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { loggedOut: true };
  }

  async forgotPassword(input: ForgotCustomerPasswordDto) {
    const customer = await this.prisma.customer.findUnique({
      where: { email: this.normalizeEmail(input.email) },
    });
    if (customer?.isActive && customer.email) {
      const expiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await this.prisma.$transaction(async (transaction) => {
        await transaction.passwordResetRequest.updateMany({
          where: { customerId: customer.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        const request = await transaction.passwordResetRequest.create({
          data: { customerId: customer.id, expiresAt },
        });
        await transaction.outboxEvent.create({
          data: {
            type: 'CUSTOMER_PASSWORD_RESET_REQUESTED',
            aggregateType: 'PasswordResetRequest',
            aggregateId: request.id,
            deduplicationKey: `PASSWORD_RESET:${request.id}`,
            payload: { customerId: customer.id },
          },
        });
      });
    }

    return {
      message: 'Si el correo existe, enviaremos instrucciones para recuperar la cuenta.',
    };
  }

  async resetPassword(input: ResetCustomerPasswordDto) {
    let payload: PasswordResetPayload;
    try {
      payload = await this.jwt.verifyAsync<PasswordResetPayload>(input.token, {
        secret: this.config.getOrThrow<string>('CUSTOMER_JWT_SECRET'),
        issuer: 'fraiche-api',
        audience: 'fraiche-password-reset',
      });
    } catch {
      throw new UnauthorizedException('El enlace de recuperacion es invalido o expiro.');
    }
    if (payload.tokenType !== 'PASSWORD_RESET') {
      throw new UnauthorizedException('El enlace de recuperacion es invalido.');
    }

    const request = await this.prisma.passwordResetRequest.findFirst({
      where: {
        id: payload.requestId,
        customerId: payload.sub,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!request) {
      throw new UnauthorizedException('El enlace de recuperacion ya no esta disponible.');
    }

    const passwordHash = await this.hashPassword(input.password);
    await this.prisma.$transaction(async (transaction) => {
      const claimed = await transaction.passwordResetRequest.updateMany({
        where: { id: request.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (!claimed.count) throw new UnauthorizedException('El enlace ya fue utilizado.');
      await transaction.customer.update({
        where: { id: request.customerId },
        data: { passwordHash, passwordChangedAt: new Date(), isActive: true },
      });
      await transaction.customerSession.updateMany({
        where: { customerId: request.customerId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
    return { passwordUpdated: true };
  }

  async verifyEmail(input: VerifyCustomerEmailDto) {
    let payload: EmailVerificationPayload;
    try {
      payload = await this.jwt.verifyAsync<EmailVerificationPayload>(input.token, {
        secret: this.config.getOrThrow<string>('CUSTOMER_JWT_SECRET'),
        issuer: 'fraiche-api',
        audience: 'fraiche-email-verification',
      });
    } catch {
      throw new UnauthorizedException('El enlace de verificacion es invalido o expiro.');
    }
    if (payload.tokenType !== 'EMAIL_VERIFICATION') {
      throw new UnauthorizedException('El enlace de verificacion es invalido.');
    }
    const updated = await this.prisma.customer.updateMany({
      where: { id: payload.sub, email: payload.email, isActive: true },
      data: { emailVerifiedAt: new Date() },
    });
    if (!updated.count) throw new UnauthorizedException('La cuenta ya no esta disponible.');
    return { emailVerified: true };
  }

  async resendVerification(customerId: string) {
    const customer = await this.prisma.customer.findFirst({
      where: { id: customerId, isActive: true },
    });
    if (!customer?.email) throw new UnauthorizedException('La cuenta no esta disponible.');
    if (customer.emailVerifiedAt) return { emailVerified: true };
    const day = new Date().toISOString().slice(0, 10);
    await this.prisma.outboxEvent.upsert({
      where: { deduplicationKey: `EMAIL_VERIFICATION:${customer.id}:${day}` },
      update: {},
      create: {
        type: 'CUSTOMER_EMAIL_VERIFICATION_REQUESTED',
        aggregateType: 'Customer',
        aggregateId: customer.id,
        deduplicationKey: `EMAIL_VERIFICATION:${customer.id}:${day}`,
        payload: { customerId: customer.id },
      },
    });
    return { verificationSent: true };
  }

  @Interval(60 * 60 * 1000)
  async cleanupExpiredSecurityRecords() {
    const now = new Date();
    const revokedBefore = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    await this.prisma.$transaction([
      this.prisma.customerSession.deleteMany({
        where: {
          OR: [
            { expiresAt: { lte: now } },
            { revokedAt: { not: null, lte: revokedBefore } },
          ],
        },
      }),
      this.prisma.passwordResetRequest.deleteMany({
        where: {
          OR: [{ expiresAt: { lte: now } }, { usedAt: { not: null, lte: revokedBefore } }],
        },
      }),
    ]);
  }

  private async issueSession(
    customer: {
      id: string;
      email: string | null;
      firstName: string | null;
      lastName: string | null;
      phone: string | null;
      marketingOptIn: boolean;
    },
    metadata: SessionMetadata,
  ) {
    if (!customer.email) throw new UnauthorizedException('La cuenta no tiene correo.');
    const refreshToken = this.createRefreshToken();
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60 * 1000);
    await this.prisma.customerSession.create({
      data: {
        customerId: customer.id,
        refreshTokenHash: this.hashRefreshToken(refreshToken),
        expiresAt,
        ipAddress: metadata.ipAddress?.slice(0, 64),
        userAgent: metadata.userAgent?.slice(0, 500),
      },
    });
    return {
      ...(await this.buildAccessResponse(customer)),
      refreshToken,
      refreshExpiresAt: expiresAt,
    };
  }

  private async buildAccessResponse(customer: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
    marketingOptIn: boolean;
  }) {
    if (!customer.email) throw new UnauthorizedException('La cuenta no tiene correo.');
    return {
      accessToken: await this.jwt.signAsync({
        sub: customer.id,
        email: customer.email,
        tokenType: 'CUSTOMER',
      }),
      expiresInSeconds: ACCESS_TOKEN_SECONDS,
      customer: {
        id: customer.id,
        email: customer.email,
        firstName: customer.firstName,
        lastName: customer.lastName,
        phone: customer.phone,
        marketingOptIn: customer.marketingOptIn,
      },
    };
  }

  private hashPassword(password: string) {
    return hash(password, {
      type: argon2id,
      memoryCost: 19456,
      timeCost: 2,
      parallelism: 1,
    });
  }

  private createRefreshToken() {
    return randomBytes(48).toString('base64url');
  }

  private hashRefreshToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }
}
