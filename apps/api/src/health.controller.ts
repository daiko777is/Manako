import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Public } from './common/public.decorator';
import { PrismaService } from './prisma/prisma.service';

@ApiTags('health')
@Controller({ path: 'health', version: '1' })
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Smoke test usado por CI/CD y uptime monitors (spec §12). */
  @Public()
  @Get()
  async health(): Promise<{ status: string; db: string; uptime: number }> {
    let db = 'up';
    try {
      await this.prisma.$queryRaw`select 1`;
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db, uptime: Math.round(process.uptime()) };
  }
}
