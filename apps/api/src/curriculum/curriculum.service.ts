import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { InstructorAnalytics, InstructorCourseRow, LessonRetentionRow } from '@manako/shared';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateCourseDto } from './dto/create-course.dto';
import type { UpdateCourseDto } from './dto/update-course.dto';
import type { CreateModuleDto } from './dto/create-module.dto';
import type { UpdateModuleDto, UpdateLessonDto } from './dto/update-curriculum.dto';
import type { CreateLessonDto } from './dto/create-lesson.dto';

/** slug url-safe + sufijo corto para garantizar unicidad. */
function slugify(title: string): string {
  const base = title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '')
    .slice(0, 60);
  return `${base || 'curso'}-${Math.random().toString(36).slice(2, 8)}`;
}

@Injectable()
export class CurriculumService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  private defaultProvider(): 'mux' | 'cloudflare' | 'direct' {
    return (this.config.get<string>('VIDEO_PROVIDER') ?? 'direct') as
      | 'mux'
      | 'cloudflare'
      | 'direct';
  }

  private async assertOwnership(user: RequestUser, courseId: string) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    if (course.instructorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Este curso pertenece a otro instructor');
    }
    return course;
  }

  // ── Cursos ───────────────────────────────────────────────────────────────

  async listMyCourses(user: RequestUser): Promise<InstructorCourseRow[]> {
    const rows = await this.prisma.course.findMany({
      where: { instructorId: user.id },
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        priceCents: true,
        currency: true,
        level: true,
        thumbnailUrl: true,
        status: true,
        publishedAt: true,
        avgRating: true,
        reviewsCount: true,
        totalEnrollments: true,
        updatedAt: true,
        category: { select: { id: true, name: true, slug: true } },
        instructor: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
        payments: { where: { status: 'succeeded' }, select: { amountCents: true } },
      },
      orderBy: { updatedAt: 'desc' },
    });

    const modulesCount = await this.prisma.courseModule.groupBy({
      by: ['courseId'],
      where: { courseId: { in: rows.map((r) => r.id) } },
      _count: { _all: true },
    });
    const modCount = new Map(modulesCount.map((m) => [m.courseId, m._count._all]));

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      subtitle: r.subtitle,
      priceCents: r.priceCents,
      currency: r.currency.trim(),
      level: r.level,
      thumbnailUrl: r.thumbnailUrl,
      status: r.status,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      avgRating: Number(r.avgRating),
      reviewsCount: r.reviewsCount,
      totalEnrollments: r.totalEnrollments,
      lessonsCount: 0, // se rellena en detalle; en lista mostramos módulos
      totalSeconds: 0,
      modulesCount: modCount.get(r.id) ?? 0,
      revenueCents: r.payments.reduce((acc, p) => acc + p.amountCents, 0),
      category: r.category,
      instructor: r.instructor?.user
        ? { id: r.instructor.user.id, fullName: r.instructor.user.fullName, avatarUrl: r.instructor.user.avatarUrl }
        : null,
    }));
  }

  async createCourse(user: RequestUser, dto: CreateCourseDto) {
    const category = dto.categorySlug
      ? await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } })
      : null;
    if (dto.categorySlug && !category) {
      throw new BadRequestException(`Categoría no encontrada: ${dto.categorySlug}`);
    }
    // Asegurar fila de instructor (RLS/consistencia)
    await this.prisma.instructor.upsert({
      where: { userId: user.id },
      create: { userId: user.id },
      update: {},
    });
    return this.prisma.course.create({
      data: {
        instructorId: user.id,
        categoryId: category?.id,
        title: dto.title,
        slug: slugify(dto.title),
        subtitle: dto.subtitle,
        description: dto.description ?? '',
        priceCents: dto.priceCents ?? 0,
        currency: (dto.currency ?? 'USD').toUpperCase(),
        level: dto.level ?? 'beginner',
        thumbnailUrl: dto.thumbnailUrl,
        status: 'draft',
      },
    });
  }

  /** Estructura completa para el editor (incluye campos de video). */
  async getCourseForEditor(user: RequestUser, courseId: string) {
    await this.assertOwnership(user, courseId);
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      include: {
        category: true,
        modules: {
          orderBy: { orderIndex: 'asc' },
          include: { lessons: { orderBy: { orderIndex: 'asc' } } },
        },
      },
    });
    return course;
  }

  async updateCourse(user: RequestUser, courseId: string, dto: UpdateCourseDto) {
    await this.assertOwnership(user, courseId);
    const data: Record<string, unknown> = {};
    if (dto.title !== undefined) data['title'] = dto.title;
    if (dto.subtitle !== undefined) data['subtitle'] = dto.subtitle;
    if (dto.description !== undefined) data['description'] = dto.description;
    if (dto.priceCents !== undefined) data['priceCents'] = dto.priceCents;
    if (dto.currency !== undefined) data['currency'] = dto.currency.toUpperCase();
    if (dto.level !== undefined) data['level'] = dto.level;
    if (dto.thumbnailUrl !== undefined) data['thumbnailUrl'] = dto.thumbnailUrl;
    if (dto.categorySlug !== undefined) {
      const category = await this.prisma.category.findUnique({ where: { slug: dto.categorySlug } });
      if (!category) throw new BadRequestException(`Categoría no encontrada: ${dto.categorySlug}`);
      data['categoryId'] = category.id;
    }
    return this.prisma.course.update({ where: { id: courseId }, data });
  }

  /** Archivar en lugar de borrar (conserva historial de inscripciones). */
  async archiveCourse(user: RequestUser, courseId: string) {
    await this.assertOwnership(user, courseId);
    return this.prisma.course.update({ where: { id: courseId }, data: { status: 'archived' } });
  }

  /** Publicación con validaciones mínimas de calidad (evita cursos vacíos). */
  async publishCourse(user: RequestUser, courseId: string) {
    const course = await this.assertOwnership(user, courseId);
    if (course.status === 'published') return course;

    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true, title: true, durationSeconds: true, videoProvider: true, videoAssetId: true, videoPlaybackId: true, videoUrl: true },
    });
    if (lessons.length === 0) {
      throw new BadRequestException('El curso necesita al menos una lección para publicarse');
    }
    const provider = this.defaultProvider();
    const withoutVideo = lessons.filter((l) => {
      const p = l.videoProvider ?? provider;
      if (p === 'mux') return !l.videoPlaybackId;
      if (p === 'cloudflare') return !l.videoAssetId;
      return !l.videoUrl;
    });
    if (withoutVideo.length > 0) {
      throw new BadRequestException(
        `Falta el video en ${withoutVideo.length} lección(es): ${withoutVideo
          .slice(0, 3)
          .map((l) => `"${l.title}"`)
          .join(', ')}${withoutVideo.length > 3 ? '…' : ''}`,
      );
    }
    return this.prisma.course.update({
      where: { id: courseId },
      data: { status: 'published', publishedAt: course.publishedAt ?? new Date() },
    });
  }

  // ── Módulos ──────────────────────────────────────────────────────────────

  async createModule(user: RequestUser, courseId: string, dto: CreateModuleDto) {
    await this.assertOwnership(user, courseId);
    const orderIndex =
      dto.orderIndex ??
      ((await this.prisma.courseModule.aggregate({
        where: { courseId },
        _max: { orderIndex: true },
      }))._max.orderIndex ?? -1) + 1;
    return this.prisma.courseModule.create({
      data: { courseId, title: dto.title, description: dto.description, orderIndex },
    });
  }

  private async assertModuleOwnership(user: RequestUser, moduleId: string) {
    const mod = await this.prisma.courseModule.findUnique({
      where: { id: moduleId },
      include: { course: { select: { id: true, instructorId: true } } },
    });
    if (!mod) throw new NotFoundException('Módulo no encontrado');
    if (mod.course.instructorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Este módulo pertenece a otro instructor');
    }
    return mod;
  }

  async updateModule(user: RequestUser, moduleId: string, dto: UpdateModuleDto) {
    await this.assertModuleOwnership(user, moduleId);
    return this.prisma.courseModule.update({
      where: { id: moduleId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
      },
    });
  }

  async deleteModule(user: RequestUser, moduleId: string) {
    await this.assertModuleOwnership(user, moduleId);
    await this.prisma.courseModule.delete({ where: { id: moduleId } });
    return { deleted: true };
  }

  // ── Lecciones ────────────────────────────────────────────────────────────

  async createLesson(user: RequestUser, moduleId: string, dto: CreateLessonDto) {
    const mod = await this.assertModuleOwnership(user, moduleId);
    const orderIndex =
      dto.orderIndex ??
      ((await this.prisma.lesson.aggregate({
        where: { moduleId },
        _max: { orderIndex: true },
      }))._max.orderIndex ?? -1) + 1;
    return this.prisma.lesson.create({
      data: {
        moduleId: mod.id,
        title: dto.title,
        description: dto.description,
        orderIndex,
        durationSeconds: dto.durationSeconds ?? 0,
        videoProvider: dto.videoProvider ?? this.defaultProvider(),
        videoUrl: dto.videoProvider === 'direct' || !dto.videoProvider ? dto.videoUrl : undefined,
        isPreview: dto.isPreview ?? false,
      },
    });
  }

  private async assertLessonOwnership(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { id: true, course: { select: { id: true, instructorId: true } } } } },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    if (lesson.module.course.instructorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('Esta lección pertenece a otro instructor');
    }
    return lesson;
  }

  async updateLesson(user: RequestUser, lessonId: string, dto: UpdateLessonDto) {
    await this.assertLessonOwnership(user, lessonId);
    return this.prisma.lesson.update({
      where: { id: lessonId },
      data: {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.durationSeconds !== undefined ? { durationSeconds: dto.durationSeconds } : {}),
        ...(dto.videoProvider !== undefined ? { videoProvider: dto.videoProvider } : {}),
        ...(dto.videoUrl !== undefined ? { videoUrl: dto.videoUrl } : {}),
        ...(dto.isPreview !== undefined ? { isPreview: dto.isPreview } : {}),
        ...(dto.orderIndex !== undefined ? { orderIndex: dto.orderIndex } : {}),
      },
    });
  }

  async deleteLesson(user: RequestUser, lessonId: string) {
    await this.assertLessonOwnership(user, lessonId);
    await this.prisma.lesson.delete({ where: { id: lessonId } });
    return { deleted: true };
  }

  // ── Analíticas del instructor (spec §14: retención, minutos, ingresos) ──

  async getAnalytics(user: RequestUser, courseId: string): Promise<InstructorAnalytics> {
    await this.assertOwnership(user, courseId);

    const enrollments = await this.prisma.enrollment.count({
      where: { courseId, status: 'active' },
    });
    const revenue = await this.prisma.payment.aggregate({
      where: { courseId, status: 'succeeded' },
      _sum: { amountCents: true },
    });
    const watched = await this.prisma.lessonProgress.aggregate({
      where: { lesson: { module: { courseId } } },
      _sum: { watchedSeconds: true },
    });

    // Progreso medio desde la vista SQL course_progress_view
    const progressRows = await this.prisma.$queryRaw<{ percent: number }[]>`
      select coalesce(avg(percent), 0)::float as percent
      from course_progress_view
      where course_id = ${courseId}::uuid`;

    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId } },
      include: { module: { select: { orderIndex: true } } },
      orderBy: [{ module: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
    });
    const progressByLesson = await this.prisma.lessonProgress.groupBy({
      by: ['lessonId'],
      where: { lesson: { module: { courseId } } },
      _count: { _all: true },
      _sum: { watchedSeconds: true },
    });
    const completedByLesson = await this.prisma.lessonProgress.groupBy({
      by: ['lessonId'],
      where: { lesson: { module: { courseId } }, completed: true },
      _count: { _all: true },
    });
    const startedMap = new Map(progressByLesson.map((p) => [p.lessonId, p]));
    const completedMap = new Map(completedByLesson.map((p) => [p.lessonId, p._count._all]));

    const retention: LessonRetentionRow[] = lessons.map((l) => {
      const started = startedMap.get(l.id)?._count._all ?? 0;
      const completed = completedMap.get(l.id) ?? 0;
      const avg = startedMap.get(l.id)?._sum.watchedSeconds ?? 0;
      return {
        lessonId: l.id,
        title: l.title,
        orderIndex: l.orderIndex,
        moduleOrderIndex: l.module.orderIndex,
        startedCount: started,
        completedCount: completed,
        avgWatchedSeconds: started > 0 ? Math.round(avg / started) : 0,
        retentionPercent: enrollments > 0 ? Math.round((100 * completed) / enrollments) : 0,
      };
    });

    return {
      courseId,
      enrollments,
      revenueCents: revenue._sum.amountCents ?? 0,
      avgProgressPercent: Math.round(progressRows[0]?.percent ?? 0),
      totalWatchedMinutes: Math.round((watched._sum.watchedSeconds ?? 0) / 60),
      retention,
    };
  }
}
