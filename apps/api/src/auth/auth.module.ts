import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { SupabaseJwtService } from './supabase-jwt.service';

@Module({
  controllers: [AuthController],
  providers: [SupabaseJwtService, JwtAuthGuard, RolesGuard, AuthService],
  exports: [SupabaseJwtService, AuthService],
})
export class AuthModule {}
