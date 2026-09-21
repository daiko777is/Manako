import { Controller, Get, Param, ParseUUIDPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Category, CourseDetail, CourseSummary, Paginated } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { CoursesService } from './courses.service';
import { QueryCoursesDto } from './dto/query-courses.dto';

@ApiTags('courses')
@Controller({ path: 'courses', version: '1' })
export class CoursesController {
  constructor(private readonly service: CoursesService) {}

  /**
   * Catálogo público con búsqueda, filtros y paginación cursor.
   * Si se envía JWT, la respuesta sigue siendo pública (el estado del
   * viewer vive en el detalle del curso).
   */
  @Public()
  @Get()
  @ApiOperation({ summary: 'Catálogo de cursos publicados (búsqueda + filtros)' })
  getCatalog(@Query() query: QueryCoursesDto): Promise<Paginated<CourseSummary>> {
    return this.service.getCatalog(query);
  }

  @Public()
  @Get('featured')
  @ApiOperation({ summary: 'Cursos destacados para la home' })
  getFeatured(@Query('limit') limit?: string): Promise<CourseSummary[]> {
    const n = Math.min(Math.max(Number(limit ?? 8) || 8, 1), 24);
    return this.service.getFeatured(n);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'Categorías del catálogo' })
  getCategories(): Promise<Category[]> {
    return this.service.getCategories();
  }

  /** Debe ir ANTES de ':slug' para no colisionar con el slug dinámico. */
  @Public()
  @Get('id/:id')
  @ApiOperation({ summary: 'Detalle del curso por id (usado por el reproductor)' })
  getDetailById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() viewer?: RequestUser,
  ): Promise<CourseDetail> {
    return this.service.getCourseDetailById(id, viewer ?? null);
  }

  @Public()
  @Get(':slug')
  @ApiOperation({
    summary: 'Detalle público del curso (currículo + estado del viewer si hay JWT)',
  })
  getDetail(
    @Param('slug') slug: string,
    @CurrentUser() viewer?: RequestUser,
  ): Promise<CourseDetail> {
    return this.service.getCourseDetail(slug, viewer ?? null);
  }
}
