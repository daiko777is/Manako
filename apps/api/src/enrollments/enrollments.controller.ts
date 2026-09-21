import { Controller, Get, HttpCode, Param, ParseUUIDPipe, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { EnrollmentSummary } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { EnrollmentsService } from './enrollments.service';

@ApiTags('enrollments')
@ApiBearerAuth()
@Controller({ path: 'enrollments', version: '1' })
export class EnrollmentsController {
  constructor(private readonly service: EnrollmentsService) {}

  @Get('me')
  @ApiOperation({ summary: 'Mis inscripciones con progreso (dashboard del estudiante)' })
  mine(@CurrentUser() user: RequestUser): Promise<EnrollmentSummary[]> {
    return this.service.listMine(user.id);
  }

  /**
   * Inscripción directa a curso GRATIS (los de pago van por
   * POST /payments/checkout y se confirman vía webhook de Stripe).
   */
  @Post('free/:courseId')
  @HttpCode(201)
  @ApiOperation({ summary: 'Inscribirme en un curso gratuito' })
  enrollFree(
    @CurrentUser() user: RequestUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ): Promise<EnrollmentSummary> {
    return this.service.enrollFree(user.id, courseId);
  }

  @Get('check/:courseId')
  @ApiOperation({ summary: '¿Tengo acceso al reproductor de este curso?' })
  checkAccess(@CurrentUser() user: RequestUser, @Param('courseId', ParseUUIDPipe) courseId: string) {
    return this.service.checkAccess(user.id, courseId);
  }
}
