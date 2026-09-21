import { ConflictException, Injectable } from '@nestjs/common';
import type { EnrollmentSummary } from '@manako/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ProgressService } from '../progress/progress.service';

/**
 * Inscripciones. Reglas (spec §6):
 *  - Cursos GRATIS: inscripción inmediata (también posible vía RLS en BD).
 *  - Cursos de PAGO: SOLO las crea el webhook de Stripe confirmado
 *    (PaymentsService) — nunca el frontend.
 */
@Injectable()
export class EnrollmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly progress: ProgressService,
  ) {}

  async enrollFree(userId: string, courseId: string): Promise<EnrollmentSummary> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== 'published') {
      throw new ConflictException('Curso no disponible');
    }
    if (course.priceCents > 0) {
      throw new ConflictException('Este curso es de pago: usa el checkout (POST /courses/:id/checkout)');
    }
    const enrollment = await this.prisma.enrollment.upsert({
      where: { userId_courseId: { userId, courseId } },
      create: { userId, courseId, status: 'active' },
      update: { status: 'active' }, // reactiva una inscripción reembolsada→gratis
    });
    return this.toSummary(enrollment.id);
  }

  async listMine(userId: string): Promise<EnrollmentSummary[]> {
    const enrollments = await this.prisma.enrollment.findMany({
      where: { userId, status: 'active' },
      orderBy: { enrolledAt: 'desc' },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            level: true,
            priceCents: true,
            currency: true,
            instructor: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
          },
        },
      },
    });
    const progress = await this.progress.getMyProgressSummary(userId);
    const progressByCourse = new Map(progress.map((p) => [p.courseId, p]));

    return enrollments.map((e) => ({
      id: e.id,
      courseId: e.courseId,
      enrolledAt: e.enrolledAt.toISOString(),
      status: e.status,
      course: {
        id: e.course.id,
        title: e.course.title,
        slug: e.course.slug,
        thumbnailUrl: e.course.thumbnailUrl,
        level: e.course.level,
        priceCents: e.course.priceCents,
        currency: e.course.currency.trim(),
        instructor: e.course.instructor?.user
          ? {
              id: e.course.instructor.user.id,
              fullName: e.course.instructor.user.fullName,
              avatarUrl: e.course.instructor.user.avatarUrl,
            }
          : null,
      },
      progress: progressByCourse.get(e.courseId)
        ? {
            totalLessons: progressByCourse.get(e.courseId)!.totalLessons,
            completedLessons: progressByCourse.get(e.courseId)!.completedLessons,
            percent: progressByCourse.get(e.courseId)!.percent,
          }
        : null,
    }));
  }

  async isEnrolled(userId: string, courseId: string): Promise<boolean> {
    const e = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId } },
    });
    return e?.status === 'active';
  }

  /**
   * Comprobación de acceso para el reproductor (Guard enrollmentGuard):
   * inscrito, dueño del curso o admin. Incluye el slug para redirecciones.
   */
  async checkAccess(
    userId: string,
    courseId: string,
  ): Promise<{ enrolled: boolean; isOwner: boolean; isAdmin: boolean; slug: string | null }> {
    const course = await this.prisma.course.findUnique({
      where: { id: courseId },
      select: { slug: true, instructorId: true },
    });
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    return {
      enrolled: await this.isEnrolled(userId, courseId),
      isOwner: course?.instructorId === userId,
      isAdmin: profile?.role === 'admin',
      slug: course?.slug ?? null,
    };
  }

  private async toSummary(enrollmentId: string): Promise<EnrollmentSummary> {
    const e = await this.prisma.enrollment.findUniqueOrThrow({
      where: { id: enrollmentId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            slug: true,
            thumbnailUrl: true,
            level: true,
            priceCents: true,
            currency: true,
            instructor: { select: { user: { select: { id: true, fullName: true, avatarUrl: true } } } },
          },
        },
      },
    });
    return {
      id: e.id,
      courseId: e.courseId,
      enrolledAt: e.enrolledAt.toISOString(),
      status: e.status,
      course: {
        id: e.course.id,
        title: e.course.title,
        slug: e.course.slug,
        thumbnailUrl: e.course.thumbnailUrl,
        level: e.course.level,
        priceCents: e.course.priceCents,
        currency: e.course.currency.trim(),
        instructor: e.course.instructor?.user
          ? {
              id: e.course.instructor.user.id,
              fullName: e.course.instructor.user.fullName,
              avatarUrl: e.course.instructor.user.avatarUrl,
            }
          : null,
      },
      progress: { totalLessons: 0, completedLessons: 0, percent: 0 },
    };
  }
}
