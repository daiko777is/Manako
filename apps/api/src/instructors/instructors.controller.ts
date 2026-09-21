import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { InstructorProfile } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { InstructorsService } from './instructors.service';
import { ApplyInstructorDto } from './dto/apply-instructor.dto';
import { UpdateInstructorDto } from './dto/update-instructor.dto';

@ApiTags('instructors')
@Controller({ path: 'instructors', version: '1' })
export class InstructorsController {
  constructor(private readonly service: InstructorsService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Lista pública de instructores' })
  list() {
    return this.service.listPublic();
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mi perfil de instructor (null si aún no lo eres)' })
  me(@CurrentUser() user: RequestUser): Promise<InstructorProfile | null> {
    return this.service.getMe(user.id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Perfil público de un instructor' })
  publicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.getPublic(id);
  }

  /**
   * Auto-promoción a instructor: crea la fila en `instructors` y cambia el
   * rol del profile. En un marketplace con curaduría, sustituir por un flujo
   * de solicitud + aprobación admin (ver docs/contrato-instructor-marketplace.md).
   */
  @Post('apply')
  @ApiBearerAuth()
  @HttpCode(201)
  @ApiOperation({ summary: 'Convertirse en instructor' })
  apply(
    @CurrentUser() user: RequestUser,
    @Body() dto: ApplyInstructorDto,
  ): Promise<InstructorProfile> {
    return this.service.apply(user.id, dto);
  }

  @Patch('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Actualizar mi bio/headline' })
  updateMe(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateInstructorDto,
  ): Promise<InstructorProfile> {
    return this.service.updateMe(user.id, dto);
  }
}
