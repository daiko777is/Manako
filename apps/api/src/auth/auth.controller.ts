import { Body, Controller, Get, HttpCode, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Profile as ProfileDto } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from './auth.types';
import { AuthService } from './auth.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('auth')
@ApiBearerAuth()
@Controller({ path: 'auth', version: '1' })
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * "Who am I": devuelve el profile de negocio del JWT presentado.
   * El login/signup en sí los gestiona Supabase Auth directamente
   * desde el cliente Angular (supabase-js) — la API no maneja passwords.
   */
  @Get('me')
  @ApiOperation({ summary: 'Perfil del usuario autenticado (rol de negocio incluido)' })
  async me(@CurrentUser() user: RequestUser): Promise<ProfileDto> {
    return this.authService.getProfile(user.id);
  }

  @Put('me')
  @HttpCode(200)
  @ApiOperation({ summary: 'Actualizar datos editables del propio perfil' })
  async updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProfileDto,
  ): Promise<ProfileDto> {
    return this.authService.updateProfile(user.id, dto);
  }
}
