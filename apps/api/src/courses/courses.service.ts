import { Injectable, NotFoundException } from '@nestjs/common';
import type { CourseDetail, LessonNode, ModuleNode, Paginated } from '@manako/shared';
import { computeUnlockedSet, findNextLessonId } from '../common/unlock';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesRepository, type CourseRow, type CourseSummaryRow } from './courses.repository';
import type { QueryCoursesDto } from './dto/query-courses.dto';

@Injectable()
export class CoursesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CoursesRepository,
  ) {}

  getCatalog(query: QueryCoursesDto): Promise<Paginated<CourseSummaryRow>> {
    return this.repo.findCatalog(query);
  }

  getFeatured(limit = 8): Promise<CourseSummaryRow[]> {
    return this.repo.findFeatured(limit);
  }

  getCategories() {
    return this.repo.findCategories();
  }

  /**
   * Detalle público del curso + estado del viewer autenticado (si lo hay):
   * inscripción, progreso, y por-lección `unlocked` (para pintar candados
   * en el currículo — la validación real ocurre otra vez en /playback).
   */
  async getCourseDetail(slug: string, viewer?: RequestUser | null): Promise<CourseDetail> {
    const row = await this.repo.findBySlug(slug);
    if (!row || (row.status !== 'published' && viewer?.id !== row.instructor?.user?.id && viewer?.role !== 'admin')) {
      throw new NotFoundException('Curso no encontrado');
    }
    return this.buildDetail(row, viewer);
  }

  private async buildDetail(row: CourseRow, viewer?: RequestUser | null): Promise<CourseDetail> {
    const summary = (await this.repo.toSummaries([row]))[0]!;

    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: row.id },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        title: true,
        description: true,
        orderIndex: true,
        lessons: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            orderIndex: true,
            durationSeconds: true,
            isPreview: true,
            videoProvider: true,
            videoAssetId: true,
            videoPlaybackId: true,
            videoUrl: true,
          },
        },
      },
    });

    const isOwner = !!viewer && viewer.id === row.instructor?.user?.id;
    const isAdmin = viewer?.role === 'admin';

    // Inscripción + progreso del viewer
    let enrolled = false;
    let completedIds = new Set<string>();
    if (viewer && !isOwner && !isAdmin) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: viewer.id, courseId: row.id } },
      });
      enrolled = enrollment?.status === 'active';
      if (enrolled) {
        const progress = await this.prisma.lessonProgress.findMany({
          where: { userId: viewer.id, lesson: { module: { courseId: row.id } }, completed: true },
          select: { lessonId: true },
        });
        completedIds = new Set(progress.map((p) => p.lessonId));
      }
    }

    const ordered = modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        isPreview: l.isPreview,
        moduleOrderIndex: m.orderIndex,
        orderIndex: l.orderIndex,
      })),
    );
    const unlockedSet =
      isOwner || isAdmin
        ? new Set(ordered.map((l) => l.id))
        : computeUnlockedSet(ordered, completedIds);

    const moduleNodes: ModuleNode[] = modules.map((m) => ({
      id: m.id,
      title: m.title,
      description: m.description,
      orderIndex: m.orderIndex,
      lessons: m.lessons.map<LessonNode>((l) => ({
        id: l.id,
        title: l.title,
        description: l.description,
        orderIndex: l.orderIndex,
        durationSeconds: l.durationSeconds,
        isPreview: l.isPreview,
        unlocked: unlockedSet.has(l.id),
        // Campos de video SOLO para el dueño (panel de instructor)
        ...(isOwner || isAdmin
          ? {
              videoProvider: l.videoProvider,
              videoReady: this.hasPlayableVideo(l),
              hasVideo: this.hasPlayableVideo(l),
            }
          : {}),
      })),
    }));

    const totalLessons = ordered.length; // spec §4: completadas / totales (coherente con course_progress_view)
    const completedLessons = completedIds.size;
    const percent =
      totalLessons === 0 ? 0 : Math.round((100 * completedLessons) / Math.max(totalLessons, 1));

    const instructor = await this.prisma.instructor.findUnique({
      where: { userId: row.instructor?.user?.id ?? '' },
      include: { user: { select: { fullName: true, avatarUrl: true } } },
    });

    return {
      ...summary,
      description: row.description ?? '',
      modules: moduleNodes,
      instructor: instructor
        ? {
            id: instructor.userId,
            fullName: instructor.user.fullName,
            avatarUrl: instructor.user.avatarUrl,
            headline: instructor.headline,
            bio: instructor.bio,
          }
        : null,
      viewer: viewer
        ? {
            enrolled: enrolled || isOwner || isAdmin,
            isOwner,
            isAdmin,
            progressPercent: percent,
            completedLessons,
            nextLessonId: findNextLessonId(ordered, completedIds, unlockedSet),
          }
        : null,
    };
  }

  private hasPlayableVideo(l: {
    videoProvider: string;
    videoPlaybackId: string | null;
    videoAssetId: string | null;
    videoUrl: string | null;
  }): boolean {
    if (l.videoProvider === 'mux') return !!l.videoPlaybackId;
    if (l.videoProvider === 'cloudflare') return !!l.videoAssetId;
    return !!l.videoUrl;
  }

  /** Curso por id (uso interno de otros servicios). */
  async getSummaryById(id: string): Promise<CourseSummaryRow> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Curso no encontrado');
    return (await this.repo.toSummaries([row]))[0]!;
  }

  /** Detalle completo por id (usado por el reproductor: ruta /aprender/:courseId). */
  async getCourseDetailById(id: string, viewer?: RequestUser | null): Promise<CourseDetail> {
    const row = await this.repo.findById(id);
    if (!row) throw new NotFoundException('Curso no encontrado');
    return this.buildDetail(row, viewer);
  }
}
