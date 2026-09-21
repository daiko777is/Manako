import { Injectable, NotFoundException } from '@nestjs/common';
import type { Profile as ProfileDto } from '@manako/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { UpdateProfileDto } from './dto/update-profile.dto';

function toDto(p: {
  id: string;
  email: string;
  fullName: string | null;
  role: 'student' | 'instructor' | 'admin';
  avatarUrl: string | null;
  createdAt: Date;
}): ProfileDto {
  return {
    id: p.id,
    email: p.email,
    fullName: p.fullName,
    role: p.role,
    avatarUrl: p.avatarUrl,
    createdAt: p.createdAt.toISOString(),
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string): Promise<ProfileDto> {
    const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
    if (!profile) throw new NotFoundException('Perfil no encontrado');
    return toDto(profile);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto): Promise<ProfileDto> {
    // El trigger prevent_role_escalation de BD bloquea cambios de rol no-admin
    const profile = await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined ? { fullName: dto.fullName } : {}),
        ...(dto.avatarUrl !== undefined ? { avatarUrl: dto.avatarUrl } : {}),
      },
    });
    return toDto(profile);
  }
}
