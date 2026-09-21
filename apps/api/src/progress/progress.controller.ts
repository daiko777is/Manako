import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { CourseProgress, LessonProgressState, ProgressUpdateResponse } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { ProgressService } from './progress.service';
import { UpdateProgressDto } from './dto/update-progress.dto';

@ApiTags('progress')
@ApiBearerAuth()
@Controller({ path: 'progress', version: '1' })
export class ProgressController {
  constructor(private readonly service: ProgressService) {}

  /**
   * Batch upsert del progreso (el frontend hace throttle a ~5s con RxJS,
   * spec §7.4). Devuelve estado actualizado + próxima lección desbloqueada.
   */
  @Put()
  @ApiOperation({ summary: 'Actualizar progreso (lote)' })
  update(
    @CurrentUser() user: RequestUser,
    @Body() dto: UpdateProgressDto,
  ): Promise<ProgressUpdateResponse> {
    return this.service.updateProgress(user.id, dto.items);
  }

  @Post('lessons/:lessonId/complete')
  @HttpCode(200)
  @ApiOperation({ summary: 'Marcar lección como completada explícitamente' })
  complete(
    @CurrentUser() user: RequestUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<LessonProgressState> {
    return this.service.markCompleted(user.id, lessonId);
  }

  @Get('course/:courseId')
  @ApiOperation({ summary: 'Progreso detallado de un curso' })
  byCourse(
    @CurrentUser() user: RequestUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
  ): Promise<CourseProgress> {
    return this.service.getCourseProgress(user.id, courseId);
  }

  @Get('me')
  @ApiOperation({ summary: 'Resumen de progreso de todos mis cursos' })
  me(@CurrentUser() user: RequestUser) {
    return this.service.getMyProgressSummary(user.id);
  }
}
