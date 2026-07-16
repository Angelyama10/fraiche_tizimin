import { Body, Controller, Post } from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { LoginDto } from './auth.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @SkipThrottle({ default: true })
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  login(@Body() input: LoginDto) {
    return this.auth.login(input);
  }
}
