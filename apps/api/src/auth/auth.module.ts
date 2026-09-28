import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { DemoAuthController } from './demo-auth.controller';
import { DemoAuthService } from './demo-auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Module({
  controllers: [AuthController, DemoAuthController],
  providers: [SupabaseJwtService, JwtAuthGuard, RolesGuard, AuthService, DemoAuthService],
  exports: [SupabaseJwtService, AuthService],
})
export class AuthModule {}
