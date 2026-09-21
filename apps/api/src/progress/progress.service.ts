import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  CourseProgress,
  LessonProgressState,
  ProgressItemInput,
  ProgressUpdateResponse,
} from '@manako/shared';
import { findNextLessonId, isCompletedByThreshold } from '../common/unlock';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Persistencia del progreso de video (spec §4 y §7.4).
 * - Umbral de completado configurable (default 90% de la duración).
 * - El cliente NO envía updates por segundo: llega en lotes cada ~5-10s
 *   (throttle en el frontend con RxJS + buffer en localStorage).
 * - watched_seconds nunca decrece (protege contra rebobinados falsos).
 */
@Injectable()
export class ProgressService {
  private readonly logger = new Logger(ProgressService.name);
  private readonly threshold: number;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    this.threshold = config.get<number>('PROGRESS_COMPLETION_THRESHOLD') ?? 0.9;
  }

  /** Aplica un lote de updates de progreso y devuelve el estado resultante. */
  async updateProgress(
    userId: string,
    items: ProgressItemInput[],
  ): Promise<ProgressUpdateResponse> {
    if (items.length === 0) return { lessons: [] };

    // Validar que las lecciones existan y obtener duraciones
    const lessonIds = items.map((i) => i.lessonId);
    const lessons = await this.prisma.lesson.findMany({
      where: { id: { in: lessonIds } },
      select: {
        id: true,
        durationSeconds: true,
        module: { select: { courseId: true } },
      },
    });
    const lessonMap = new Map(lessons.map((l) => [l.id, l]));

    const results: LessonProgressState[] = [];
    const touchedCourseIds = new Set<string>();

    for (const item of items) {
      const lesson = lessonMap.get(item.lessonId);
      if (!lesson) continue; // lección inexistente: se ignora silenciosamente
      touchedCourseIds.add(lesson.module.courseId);

      const watched = Math.max(0, Math.floor(item.watchedSeconds));
      const completed = isCompletedByThreshold(watched, lesson.durationSeconds, this.threshold);

      const existing = await this.prisma.lessonProgress.findUnique({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
      });

      // watched_seconds es monótono creciente; completed nunca vuelve a false
      const nextWatched = Math.max(existing?.watchedSeconds ?? 0, watched);
      const nextCompleted = existing?.completed || completed;

      const row = await this.prisma.lessonProgress.upsert({
        where: { userId_lessonId: { userId, lessonId: lesson.id } },
        create: {
          userId,
          lessonId: lesson.id,
          watchedSeconds: nextWatched,
          completed: nextCompleted,
          lastWatchedAt: new Date(),
        },
        update: {
          watchedSeconds: nextWatched,
          completed: nextCompleted,
          lastWatchedAt: new Date(),
        },
      });
      results.push({
        lessonId: row.lessonId,
        watchedSeconds: row.watchedSeconds,
        completed: row.completed,
        lastWatchedAt: row.lastWatchedAt.toISOString(),
      });

      if (completed && !existing?.completed) {
        this.logger.log(`Lección completada: user=${userId} lesson=${lesson.id}`);
      }
    }

    // Progreso agregado del/los curso(s) tocado(s)
    const courseId = [...touchedCourseIds][0];
    const course = courseId ? await this.getCourseProgress(userId, courseId) : undefined;

    // Siguiente lección desbloqueada (para auto-avance en el reproductor)
    let nextUnlockedLessonId: string | null = null;
    if (courseId) {
      nextUnlockedLessonId = await this.findNextLesson(userId, courseId);
    }

    return { lessons: results, course, nextUnlockedLessonId };
  }

  /** Marcar explícitamente una lección como completada (botón "Completar"). */
  async markCompleted(userId: string, lessonId: string): Promise<LessonProgressState> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      select: { id: true, durationSeconds: true },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    const row = await this.prisma.lessonProgress.upsert({
      where: { userId_lessonId: { userId, lessonId } },
      create: {
        userId,
        lessonId,
        watchedSeconds: lesson.durationSeconds,
        completed: true,
        lastWatchedAt: new Date(),
      },
      update: {
        watchedSeconds: lesson.durationSeconds,
        completed: true,
        lastWatchedAt: new Date(),
      },
    });
    return {
      lessonId: row.lessonId,
      watchedSeconds: row.watchedSeconds,
      completed: row.completed,
      lastWatchedAt: row.lastWatchedAt.toISOString(),
    };
  }

  /** Progreso por curso: estado de cada lección + porcentaje (spec §4). */
  async getCourseProgress(userId: string, courseId: string): Promise<CourseProgress> {
    const lessons = await this.prisma.lesson.findMany({
      where: { module: { courseId } },
      select: { id: true, durationSeconds: true, module: { select: { orderIndex: true } }, orderIndex: true },
      orderBy: [{ module: { orderIndex: 'asc' } }, { orderIndex: 'asc' }],
    });
    const progress = await this.prisma.lessonProgress.findMany({
      where: { userId, lessonId: { in: lessons.map((l) => l.id) } },
    });
    const byLesson = new Map(progress.map((p) => [p.lessonId, p]));

    const completedLessons = lessons.filter((l) => byLesson.get(l.id)?.completed).length;
    const percent =
      lessons.length === 0 ? 0 : Math.round((100 * completedLessons) / lessons.length);

    return {
      courseId,
      totalLessons: lessons.length,
      completedLessons,
      percent,
      lessons: lessons.map((l) => {
        const p = byLesson.get(l.id);
        return {
          lessonId: l.id,
          watchedSeconds: p?.watchedSeconds ?? 0,
          completed: p?.completed ?? false,
          lastWatchedAt: (p?.lastWatchedAt ?? new Date(0)).toISOString(),
        };
      }),
    };
  }

  /** Progreso de todos los cursos del usuario (dashboard del estudiante). */
  async getMyProgressSummary(userId: string): Promise<
    { courseId: string; totalLessons: number; completedLessons: number; percent: number }[]
  > {
    const rows = await this.prisma.$queryRaw<
      { course_id: string; total_lessons: number; completed_lessons: number; percent: number }[]
    >`
      select course_id::text, total_lessons, completed_lessons, percent
      from course_progress_view
      where user_id = ${userId}::uuid`;
    return rows.map((r) => ({
      courseId: r.course_id,
      totalLessons: r.total_lessons,
      completedLessons: r.completed_lessons,
      percent: Number(r.percent),
    }));
  }

  private async findNextLesson(userId: string, courseId: string): Promise<string | null> {
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId },
      select: {
        orderIndex: true,
        lessons: { orderBy: { orderIndex: 'asc' }, select: { id: true, isPreview: true, orderIndex: true } },
      },
      orderBy: { orderIndex: 'asc' },
    });
    const ordered = modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        isPreview: l.isPreview,
        moduleOrderIndex: m.orderIndex,
        orderIndex: l.orderIndex,
      })),
    );
    const progress = await this.getCourseProgress(userId, courseId);
    const completed = new Set(
      progress.lessons.filter((l) => l.completed).map((l) => l.lessonId),
    );
    return findNextLessonId(ordered, completed);
  }
}
