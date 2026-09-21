import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { InstructorAnalytics, InstructorCourseRow, UploadInitResponse } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { Roles } from '../common/roles.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PlaybackService } from '../playback/playback.service';
import { CurriculumService } from './curriculum.service';
import { CreateCourseDto } from './dto/create-course.dto';
import { UpdateCourseDto } from './dto/update-course.dto';
import { CreateModuleDto } from './dto/create-module.dto';
import { CreateLessonDto } from './dto/create-lesson.dto';
import { UpdateLessonDto, UpdateModuleDto } from './dto/update-curriculum.dto';

/**
 * Rutas del panel de instructor (RBAC: rol 'instructor' o 'admin',
 * validado SIEMPRE en backend — spec §6.1).
 */
@ApiTags('instructor')
@ApiBearerAuth()
@Roles('instructor')
@Controller({ path: 'instructor', version: '1' })
export class CurriculumController {
  constructor(
    private readonly curriculum: CurriculumService,
    private readonly playback: PlaybackService,
  ) {}

  // ── Cursos ──────────────────────────────────────────────────────────────

  @Get('courses')
  @ApiOperation({ summary: 'Mis cursos (todos los estados) con ingresos y módulos' })
  listCourses(@CurrentUser() user: RequestUser): Promise<InstructorCourseRow[]> {
    return this.curriculum.listMyCourses(user);
  }

  @Post('courses')
  @ApiOperation({ summary: 'Crear curso (nace como borrador)' })
  createCourse(@CurrentUser() user: RequestUser, @Body() dto: CreateCourseDto) {
    return this.curriculum.createCourse(user, dto);
  }

  @Get('courses/:id')
  @ApiOperation({ summary: 'Curso completo para el editor (módulos + lecciones + video)' })
  getCourse(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.getCourseForEditor(user, id);
  }

  @Patch('courses/:id')
  @ApiOperation({ summary: 'Actualizar metadatos del curso' })
  updateCourse(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCourseDto,
  ) {
    return this.curriculum.updateCourse(user, id, dto);
  }

  @Delete('courses/:id')
  @ApiOperation({ summary: 'Archivar curso (no se borra: conserva inscripciones)' })
  archiveCourse(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.archiveCourse(user, id);
  }

  @Post('courses/:id/publish')
  @HttpCode(200)
  @ApiOperation({ summary: 'Publicar curso (valida que toda lección tenga video)' })
  publishCourse(@CurrentUser() user: RequestUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.curriculum.publishCourse(user, id);
  }

  @Get('courses/:id/analytics')
  @ApiOperation({ summary: 'Analíticas: inscripciones, ingresos, retención por lección' })
  analytics(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<InstructorAnalytics> {
    return this.curriculum.getAnalytics(user, id);
  }

  // ── Módulos ─────────────────────────────────────────────────────────────

  @Post('courses/:id/modules')
  @ApiOperation({ summary: 'Añadir módulo al curso' })
  createModule(
    @CurrentUser() user: RequestUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateModuleDto,
  ) {
    return this.curriculum.createModule(user, id, dto);
  }

  @Patch('modules/:moduleId')
  @ApiOperation({ summary: 'Actualizar módulo' })
  updateModule(
    @CurrentUser() user: RequestUser,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: UpdateModuleDto,
  ) {
    return this.curriculum.updateModule(user, moduleId, dto);
  }

  @Delete('modules/:moduleId')
  @ApiOperation({ summary: 'Eliminar módulo (y sus lecciones)' })
  deleteModule(@CurrentUser() user: RequestUser, @Param('moduleId', ParseUUIDPipe) moduleId: string) {
    return this.curriculum.deleteModule(user, moduleId);
  }

  // ── Lecciones ───────────────────────────────────────────────────────────

  @Post('modules/:moduleId/lessons')
  @ApiOperation({ summary: 'Añadir lección a un módulo' })
  createLesson(
    @CurrentUser() user: RequestUser,
    @Param('moduleId', ParseUUIDPipe) moduleId: string,
    @Body() dto: CreateLessonDto,
  ) {
    return this.curriculum.createLesson(user, moduleId, dto);
  }

  @Patch('lessons/:lessonId')
  @ApiOperation({ summary: 'Actualizar lección (título, duración, preview, videoUrl…)' })
  updateLesson(
    @CurrentUser() user: RequestUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @Body() dto: UpdateLessonDto,
  ) {
    return this.curriculum.updateLesson(user, lessonId, dto);
  }

  @Delete('lessons/:lessonId')
  @ApiOperation({ summary: 'Eliminar lección' })
  deleteLesson(@CurrentUser() user: RequestUser, @Param('lessonId', ParseUUIDPipe) lessonId: string) {
    return this.curriculum.deleteLesson(user, lessonId);
  }

  // ── Subida de video (spec §3.4) ─────────────────────────────────────────

  @Post('lessons/:lessonId/upload')
  @ApiOperation({
    summary: 'Iniciar subida del video (Mux: URL directa; Cloudflare: relay por la API)',
  })
  initUpload(
    @CurrentUser() user: RequestUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<UploadInitResponse> {
    return this.playback.initUpload(user, lessonId);
  }

  @Post('lessons/:lessonId/upload/relay')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 * 1024 } }))
  @ApiConsumes('multipart/form-data')
  @Throttle({ default: { ttl: 60_000, limit: 5 } })
  @ApiOperation({ summary: 'Subida retransmitida (Cloudflare Stream)' })
  relayUpload(
    @CurrentUser() user: RequestUser,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) throw new BadRequestException('Archivo no recibido (campo multipart: "file")');
    return this.playback.relayUpload(user, lessonId, {
      buffer: file.buffer,
      originalname: file.originalname,
      mimetype: file.mimetype,
    });
  }
}
