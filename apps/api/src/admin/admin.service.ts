import { Injectable, NotFoundException } from '@nestjs/common';
import type { course_status } from '@prisma/client';
import type { AdminCourseRow, AdminMetrics, AdminUserRow, PaymentSummary, UserRole } from '@manako/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CoursesRepository } from '../courses/courses.repository';

/**
 * Panel de administración (spec §1: moderación, usuarios, métricas,
 * pagos/reembolsos). Todas las rutas exigen rol 'admin' (@Roles).
 */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repo: CoursesRepository,
  ) {}

  async getMetrics(): Promise<AdminMetrics> {
    const [byRole, courseCounts, enrollmentsActive, revenue, refunded, completedToday] =
      await Promise.all([
        this.prisma.profile.groupBy({ by: ['role'], _count: { _all: true } }),
        this.prisma.course.groupBy({ by: ['status'], _count: { _all: true } }),
        this.prisma.enrollment.count({ where: { status: 'active' } }),
        this.prisma.payment.aggregate({ where: { status: 'succeeded' }, _sum: { amountCents: true } }),
        this.prisma.payment.aggregate({ where: { status: 'refunded' }, _sum: { amountCents: true } }),
        this.prisma.lessonProgress.count({
          where: { completed: true, lastWatchedAt: { gte: startOfToday() } },
        }),
      ]);

    const roleCount = (role: string): number =>
      byRole.find((r) => r.role === role)?._count._all ?? 0;
    const courseCount = (status: string): number =>
      courseCounts.find((c) => c.status === status)?._count._all ?? 0;

    return {
      users: {
        total: byRole.reduce((acc, r) => acc + r._count._all, 0),
        students: roleCount('student'),
        instructors: roleCount('instructor'),
        admins: roleCount('admin'),
      },
      courses: {
        total: courseCounts.reduce((acc, c) => acc + c._count._all, 0),
        published: courseCount('published'),
        drafts: courseCount('draft'),
      },
      enrollmentsActive,
      revenueCents: revenue._sum.amountCents ?? 0,
      refundedCents: refunded._sum.amountCents ?? 0,
      lessonsCompletedToday: completedToday,
    };
  }

  async listUsers(opts: { search?: string; cursor?: string; limit?: number }): Promise<
    { data: AdminUserRow[]; nextCursor: string | null }
  > {
    const limit = Math.min(opts.limit ?? 20, 50);
    const rows = await this.prisma.profile.findMany({
      where: opts.search
        ? {
            OR: [
              { email: { contains: opts.search, mode: 'insensitive' } },
              { fullName: { contains: opts.search, mode: 'insensitive' } },
            ],
          }
        : undefined,
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        createdAt: true,
        _count: { select: { enrollments: true } },
        instructor: { select: { _count: { select: { courses: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((r) => ({
        id: r.id,
        email: r.email,
        fullName: r.fullName,
        role: r.role,
        createdAt: r.createdAt.toISOString(),
        enrollments: r._count.enrollments,
        coursesCreated: r.instructor?._count.courses ?? 0,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    };
  }

  async setUserRole(userId: string, role: UserRole): Promise<{ id: string; role: UserRole }> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Usuario no encontrado');
    await this.prisma.$transaction(async (tx) => {
      await tx.profile.update({ where: { id: userId }, data: { role } });
      if (role === 'instructor' || role === 'admin') {
        await tx.instructor.upsert({ where: { userId }, create: { userId }, update: {} });
      }
    });
    return { id: userId, role };
  }

  async listCourses(status?: course_status): Promise<AdminCourseRow[]> {
    const rows = await this.prisma.course.findMany({
      where: status ? { status } : undefined,
      select: {
        id: true,
        title: true,
        slug: true,
        subtitle: true,
        description: true,
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
      },
      orderBy: { updatedAt: 'desc' },
      take: 100,
    });
    return this.repo.toSummaries(rows) as Promise<AdminCourseRow[]>;
  }

  async setCourseStatus(courseId: string, status: course_status) {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course) throw new NotFoundException('Curso no encontrado');
    return this.prisma.course.update({
      where: { id: courseId },
      data: {
        status,
        ...(status === 'published' && !course.publishedAt ? { publishedAt: new Date() } : {}),
      },
    });
  }

  async listPayments(opts: { status?: string; cursor?: string; limit?: number }): Promise<
    { data: PaymentSummary[]; nextCursor: string | null }
  > {
    const limit = Math.min(opts.limit ?? 20, 50);
    const rows = await this.prisma.payment.findMany({
      where: opts.status
        ? { status: opts.status as PaymentSummary['status'] }
        : undefined,
      include: {
        course: { select: { id: true, title: true, slug: true } },
        user: { select: { id: true, email: true, fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: limit + 1,
      ...(opts.cursor ? { cursor: { id: opts.cursor }, skip: 1 } : {}),
    });
    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    return {
      data: page.map((p) => ({
        id: p.id,
        userId: p.userId,
        courseId: p.courseId,
        amountCents: p.amountCents,
        currency: p.currency.trim(),
        status: p.status,
        createdAt: p.createdAt.toISOString(),
        course: p.course,
        user: p.user,
      })),
      nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null,
    };
  }
}

function startOfToday(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}
