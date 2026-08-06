import {
  Body,
  Controller,
  HttpCode,
  Ip,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { CustomerAuthService } from './customer-auth.service';
import {
  ForgotCustomerPasswordDto,
  LoginCustomerDto,
  RegisterCustomerDto,
  ResetCustomerPasswordDto,
  VerifyCustomerEmailDto,
} from './customer-auth.dto';
import { CustomerJwtAuthGuard } from './customer-auth.guard';
import { AuthenticatedCustomer } from './customer-jwt.strategy';

type CustomerRequest = Request & { user: AuthenticatedCustomer };

@Controller('customer-auth')
export class CustomerAuthController {
  constructor(
    private readonly auth: CustomerAuthService,
    private readonly config: ConfigService,
  ) {}

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  async register(
    @Body() input: RegisterCustomerDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.register(input, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
    return this.withRefreshCookie(response, result);
  }

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() input: LoginCustomerDto,
    @Ip() ipAddress: string,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.login(input, {
      ipAddress,
      userAgent: request.headers['user-agent'],
    });
    return this.withRefreshCookie(response, result);
  }

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  @Post('refresh')
  @HttpCode(200)
  async refresh(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const refreshToken = request.cookies?.[this.cookieName()];
    if (!refreshToken) {
      response.clearCookie(this.cookieName(), this.cookieOptions());
      return { authenticated: false };
    }
    const result = await this.auth.refresh(refreshToken);
    return this.withRefreshCookie(response, result);
  }

  @Post('logout')
  @HttpCode(200)
  async logout(@Req() request: Request, @Res({ passthrough: true }) response: Response) {
    const result = await this.auth.logout(request.cookies?.[this.cookieName()]);
    response.clearCookie(this.cookieName(), this.cookieOptions());
    return result;
  }

  @UseGuards(CustomerJwtAuthGuard)
  @Post('logout-all')
  @HttpCode(200)
  async logoutAll(
    @Req() request: CustomerRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.auth.logoutAll(request.user.customerId);
    response.clearCookie(this.cookieName(), this.cookieOptions());
    return result;
  }

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 3, ttl: 60000 } })
  @Post('forgot-password')
  @HttpCode(200)
  forgotPassword(@Body() input: ForgotCustomerPasswordDto) {
    return this.auth.forgotPassword(input);
  }

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('reset-password')
  @HttpCode(200)
  resetPassword(@Body() input: ResetCustomerPasswordDto) {
    return this.auth.resetPassword(input);
  }

  @Post('verify-email')
  @HttpCode(200)
  verifyEmail(@Body() input: VerifyCustomerEmailDto) {
    return this.auth.verifyEmail(input);
  }

  @UseGuards(CustomerJwtAuthGuard)
  @Post('resend-verification')
  @HttpCode(200)
  resendVerification(@Req() request: CustomerRequest) {
    return this.auth.resendVerification(request.user.customerId);
  }

  private withRefreshCookie<T extends { refreshToken: string }>(
    response: Response,
    result: T,
  ) {
    response.cookie(this.cookieName(), result.refreshToken, {
      ...this.cookieOptions(),
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
    const { refreshToken: _refreshToken, ...publicResult } = result;
    return publicResult;
  }

  private cookieName() {
    return this.config.get<string>('CUSTOMER_REFRESH_COOKIE_NAME') ?? 'fraiche_refresh';
  }

  private cookieOptions() {
    return {
      httpOnly: true,
      secure: this.config.get<string>('NODE_ENV') === 'production',
      sameSite: 'lax' as const,
      path: '/api/v1/customer-auth',
    };
  }
}
