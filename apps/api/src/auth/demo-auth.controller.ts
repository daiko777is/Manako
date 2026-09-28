import { Body, Controller, Get, HttpCode, NotFoundException, Post } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { ConfigService } from '@nestjs/config';
import { Public } from '../common/public.decorator';
import { DemoAuthService } from './demo-auth.service';
import { DemoLoginDto } from './dto/demo-login.dto';

/**
 * Endpoints DEMO (404 cuando DEMO_MODE no está activo).
 */
@ApiTags('auth-demo')
@Controller({ path: 'auth/demo', version: '1' })
export class DemoAuthController {
  constructor(
    private readonly demoAuth: DemoAuthService,
    private readonly config: ConfigService,
  ) {}

  private assertDemo(): void {
    if (!this.config.get<boolean>('DEMO_MODE')) {
      throw new NotFoundException();
    }
  }

  @Public()
  @Get('users')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  @ApiOperation({ summary: '[DEMO] Cuentas disponibles para iniciar sesión' })
  users() {
    this.assertDemo();
    return this.demoAuth.listDemoUsers();
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: '[DEMO] Login/registro simulado (JWT compatible con Supabase)' })
  login(@Body() dto: DemoLoginDto) {
    this.assertDemo();
    return this.demoAuth.login(dto.email, dto.fullName);
  }
}
