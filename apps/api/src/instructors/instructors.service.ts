import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { InstructorProfile } from '@manako/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { ApplyInstructorDto } from './dto/apply-instructor.dto';
import type { UpdateInstructorDto } from './dto/update-instructor.dto';

function toDto(i: {
  userId: string;
  headline: string | null;
  bio: string | null;
  payoutsEnabled: boolean;
}): InstructorProfile {
  return { userId: i.userId, headline: i.headline, bio: i.bio, payoutsEnabled: i.payoutsEnabled };
}

@Injectable()
export class InstructorsService {
  constructor(private readonly prisma: PrismaService) {}

  async listPublic(): Promise<
    { id: string; fullName: string | null; avatarUrl: string | null; headline: string | null; courses: number }[]
  > {
    const rows = await this.prisma.instructor.findMany({
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
        courses: { where: { status: 'published' }, select: { id: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return rows.map((r) => ({
      id: r.userId,
      fullName: r.user.fullName,
      avatarUrl: r.user.avatarUrl,
      headline: r.headline,
      courses: r.courses.length,
    }));
  }

  async getMe(userId: string): Promise<InstructorProfile | null> {
    const row = await this.prisma.instructor.findUnique({ where: { userId } });
    return row ? toDto(row) : null;
  }

  async getPublic(id: string): Promise<InstructorProfile & { fullName: string | null }> {
    const row = await this.prisma.instructor.findUnique({
      where: { userId: id },
      include: { user: { select: { fullName: true } } },
    });
    if (!row) throw new NotFoundException('Instructor no encontrado');
    return { ...toDto(row), fullName: row.user.fullName };
  }

  /** Auto-promoción: transaction crea instructors + actualiza role. */
  async apply(userId: string, dto: ApplyInstructorDto): Promise<InstructorProfile> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    if (profile.role === 'student') {
      await this.prisma.$transaction([
        this.prisma.profile.update({ where: { id: userId }, data: { role: 'instructor' } }),
        this.prisma.instructor.upsert({
          where: { userId },
          create: { userId, bio: dto.bio ?? null, headline: dto.headline ?? null },
          update: { bio: dto.bio ?? undefined, headline: dto.headline ?? undefined },
        }),
      ]);
    } else if (profile.role === 'instructor') {
      await this.prisma.instructor.upsert({
        where: { userId },
        create: { userId, bio: dto.bio ?? null, headline: dto.headline ?? null },
        update: {},
      });
    } else {
      throw new ForbiddenException('Rol no elegible para instructor');
    }
    const row = await this.prisma.instructor.findUniqueOrThrow({ where: { userId } });
    return toDto(row);
  }

  async updateMe(userId: string, dto: UpdateInstructorDto): Promise<InstructorProfile> {
    const row = await this.prisma.instructor.findUnique({ where: { userId } });
    if (!row) throw new NotFoundException('Primero regístrate como instructor (POST /instructors/apply)');
    const updated = await this.prisma.instructor.update({
      where: { userId },
      data: {
        ...(dto.bio !== undefined ? { bio: dto.bio } : {}),
        ...(dto.headline !== undefined ? { headline: dto.headline } : {}),
      },
    });
    return toDto(updated);
  }
}
