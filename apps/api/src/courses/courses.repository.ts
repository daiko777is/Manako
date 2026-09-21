import { Injectable } from '@nestjs/common';
import { Prisma, type course_level, type course_status } from '@prisma/client';
import type { CourseSort, CourseSummary } from '@manako/shared';
import type { PaginatedResult } from '../common/pagination';
import { PrismaService } from '../prisma/prisma.service';
import type { QueryCoursesDto } from './dto/query-courses.dto';

const SORT_MAP: Record<CourseSort, Prisma.CourseOrderByWithRelationInput[]> = {
  popular: [{ totalEnrollments: 'desc' }, { publishedAt: 'desc' }],
  rating: [{ avgRating: 'desc' }, { reviewsCount: 'desc' }],
  newest: [{ publishedAt: 'desc' }],
  price_asc: [{ priceCents: 'asc' }, { publishedAt: 'desc' }],
  price_desc: [{ priceCents: 'desc' }, { publishedAt: 'desc' }],
};

export const courseSummarySelect = {
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
  instructor: {
    select: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
  },
} satisfies Prisma.CourseSelect;

export type CourseRow = Prisma.CourseGetPayload<{ select: typeof courseSummarySelect }>;

export type CourseSummaryRow = CourseSummary & { updatedAt?: string };

/**
 * Capa Repository (spec §8): acceso a datos puro, sin lógica de negocio.
 */
@Injectable()
export class CoursesRepository {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Enriquece filas de cursos con conteo de lecciones y duración total
   * (2 queries tipadas por página, sin N+1).
   */
  async toSummaries(rows: CourseRow[]): Promise<CourseSummaryRow[]> {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const modules = await this.prisma.courseModule.findMany({
      where: { courseId: { in: ids } },
      select: { id: true, courseId: true },
    });
    const moduleToCourse = new Map(modules.map((m) => [m.id, m.courseId]));
    const moduleIds = [...moduleToCourse.keys()];

    const grouped =
      moduleIds.length > 0
        ? await this.prisma.lesson.groupBy({
            by: ['moduleId'],
            where: { moduleId: { in: moduleIds } },
            _count: { _all: true },
            _sum: { durationSeconds: true },
          })
        : [];

    const perCourse = new Map<string, { count: number; seconds: number }>();
    for (const g of grouped) {
      const courseId = moduleToCourse.get(g.moduleId);
      if (!courseId) continue;
      const prev = perCourse.get(courseId) ?? { count: 0, seconds: 0 };
      perCourse.set(courseId, {
        count: prev.count + (g._count._all ?? 0),
        seconds: prev.seconds + (g._sum.durationSeconds ?? 0),
      });
    }

    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      slug: r.slug,
      subtitle: r.subtitle,
      priceCents: r.priceCents,
      currency: r.currency.trim(),
      level: r.level as course_level,
      thumbnailUrl: r.thumbnailUrl,
      status: r.status as course_status,
      publishedAt: r.publishedAt?.toISOString() ?? null,
      avgRating: Number(r.avgRating),
      reviewsCount: r.reviewsCount,
      totalEnrollments: r.totalEnrollments,
      lessonsCount: perCourse.get(r.id)?.count ?? 0,
      totalSeconds: perCourse.get(r.id)?.seconds ?? 0,
      category: r.category,
      instructor: r.instructor?.user
        ? {
            id: r.instructor.user.id,
            fullName: r.instructor.user.fullName,
            avatarUrl: r.instructor.user.avatarUrl,
          }
        : null,
      updatedAt: r.updatedAt.toISOString(),
    }));
  }

  /** Catálogo publicado con filtros + paginación cursor-based (spec §7.3). */
  async findCatalog(query: QueryCoursesDto): Promise<PaginatedResult<CourseSummaryRow>> {
    const limit = query.limit ?? 12;
    const where: Prisma.CourseWhereInput = {
      status: 'published',
      ...(query.search
        ? {
            OR: [
              { title: { contains: query.search, mode: 'insensitive' } },
              { subtitle: { contains: query.search, mode: 'insensitive' } },
              { description: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.level ? { level: query.level } : {}),
      ...(query.minPrice !== undefined || query.maxPrice !== undefined
        ? {
            priceCents: {
              ...(query.minPrice !== undefined ? { gte: query.minPrice } : {}),
              ...(query.maxPrice !== undefined ? { lte: query.maxPrice } : {}),
            },
          }
        : {}),
    };

    const rows = await this.prisma.course.findMany({
      where,
      select: courseSummarySelect,
      orderBy: SORT_MAP[query.sort ?? 'popular'],
      take: limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const data = await this.toSummaries(page);
    return { data, nextCursor: hasMore && page.length > 0 ? page[page.length - 1]!.id : null };
  }

  async findFeatured(limit = 8): Promise<CourseSummaryRow[]> {
    const rows = await this.prisma.course.findMany({
      where: { status: 'published' },
      select: courseSummarySelect,
      orderBy: [{ totalEnrollments: 'desc' }, { avgRating: 'desc' }],
      take: limit,
    });
    return this.toSummaries(rows);
  }

  async findBySlug(slug: string): Promise<CourseRow | null> {
    return this.prisma.course.findUnique({ where: { slug }, select: courseSummarySelect });
  }

  async findById(id: string): Promise<CourseRow | null> {
    return this.prisma.course.findUnique({ where: { id }, select: courseSummarySelect });
  }

  async findCategories(): Promise<{ id: string; name: string; slug: string; description: string | null }[]> {
    return this.prisma.category.findMany({
      select: { id: true, name: true, slug: true, description: true },
      orderBy: { name: 'asc' },
    });
  }
}
