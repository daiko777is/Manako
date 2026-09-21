import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { PlaybackResponse, UploadInitResponse } from '@manako/shared';
import type { RequestUser } from '../auth/auth.types';
import { computeUnlockedSet } from '../common/unlock';
import { FeatureFlagsService } from '../feature-flags/feature-flags.service';
import { PrismaService } from '../prisma/prisma.service';
import { VideoProviderFactory } from './video-provider.factory';

/**
 * Autoridad de acceso al video (spec §6.2 y §6.4):
 * "la lógica de lección bloqueada debe validarse en el backend, nunca
 * confiar solo en el Guard del frontend". Este servicio es el ÚNICO punto
 * que emite URLs de reproducción, y lo hace tras verificar:
 *   1. visibilidad del curso (publicado / dueño / admin),
 *   2. inscripción activa (enrollment) si no es preview,
 *   3. desbloqueo secuencial (feature flag `sequential_lock`),
 * y entrega URLs firmadas con TTL corto + watermark del usuario.
 */
@Injectable()
export class PlaybackService {
  private readonly logger = new Logger(PlaybackService.name);
  private readonly ttl: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: VideoProviderFactory,
    private readonly flags: FeatureFlagsService,
    config: ConfigService,
  ) {
    this.ttl = config.get<number>('PLAYBACK_URL_TTL_SECONDS') ?? 600;
  }

  async getPlayback(user: RequestUser, courseId: string, lessonId: string): Promise<PlaybackResponse> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { include: { course: true } } },
    });
    if (!lesson || lesson.module.courseId !== courseId) {
      throw new NotFoundException('Lección no encontrada en este curso');
    }
    const course = lesson.module.course;
    const isOwner = course.instructorId === user.id;
    const isAdmin = user.role === 'admin';

    if (course.status !== 'published' && !isOwner && !isAdmin) {
      throw new NotFoundException('Curso no encontrado');
    }

    if (!lesson.isPreview && !isOwner && !isAdmin) {
      const enrollment = await this.prisma.enrollment.findUnique({
        where: { userId_courseId: { userId: user.id, courseId: course.id } },
      });
      if (!enrollment || enrollment.status !== 'active') {
        throw new ForbiddenException('Debes inscribirte en el curso para ver esta lección');
      }
      // Bloqueo secuencial validado en backend (réplica de lesson_is_unlocked SQL)
      if (await this.flags.isEnabled('sequential_lock', true)) {
        const unlocked = await this.computeUnlockedForUser(user.id, course.id);
        if (!unlocked.has(lesson.id)) {
          throw new ForbiddenException('Completa las lecciones anteriores para desbloquear esta');
        }
      }
    }

    const provider = this.providers.get(lesson.videoProvider);
    const signed = await provider.playbackUrl(
      {
        lessonId: lesson.id,
        videoAssetId: lesson.videoAssetId,
        videoPlaybackId: lesson.videoPlaybackId,
        videoUrl: lesson.videoUrl,
      },
      this.ttl,
    );

    return {
      lessonId: lesson.id,
      provider: provider.kind,
      url: signed.url,
      expiresAt: signed.expiresAt,
      // Marca de agua disuasoria anti-piratería (spec §6.4)
      watermark: user.email,
    };
  }

  /** Conjunto de lecciones desbloqueadas para un usuario inscrito. */
  private async computeUnlockedForUser(userId: string, courseId: string): Promise<Set<string>> {
    const modules = await this.prisma.courseModule.findMany({
      where: { courseId },
      orderBy: { orderIndex: 'asc' },
      select: {
        orderIndex: true,
        lessons: { orderBy: { orderIndex: 'asc' }, select: { id: true, isPreview: true, orderIndex: true } },
      },
    });
    const ordered = modules.flatMap((m) =>
      m.lessons.map((l) => ({
        id: l.id,
        isPreview: l.isPreview,
        moduleOrderIndex: m.orderIndex,
        orderIndex: l.orderIndex,
      })),
    );
    const completed = await this.prisma.lessonProgress.findMany({
      where: { userId, completed: true, lesson: { module: { courseId } } },
      select: { lessonId: true },
    });
    return computeUnlockedSet(ordered, new Set(completed.map((c) => c.lessonId)));
  }

  // ── Uploads (panel de instructor) ────────────────────────────────────────

  private async assertLessonOwnership(user: RequestUser, lessonId: string) {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
      include: { module: { select: { course: { select: { id: true, instructorId: true } } } } },
    });
    if (!lesson) throw new NotFoundException('Lección no encontrada');
    const course = lesson.module.course;
    if (course.instructorId !== user.id && user.role !== 'admin') {
      throw new ForbiddenException('No eres el dueño de esta lección');
    }
    return lesson;
  }

  /**
   * Inicia la subida del video de una lección:
   *  - mux → URL de Direct Upload (el navegador hace PUT directo a Mux)
   *  - cloudflare → relay (el navegador sube a la API)
   *  - direct → sin subida (el instructor pega la URL en el PATCH de lección)
   */
  async initUpload(user: RequestUser, lessonId: string): Promise<UploadInitResponse> {
    const lesson = await this.assertLessonOwnership(user, lessonId);
    const provider = this.providers.get(lesson.videoProvider);

    if (provider.kind === 'direct') {
      throw new NotFoundException(
        'El proveedor "direct" no usa subidas: edita la lección e informa videoUrl',
      );
    }
    if (!provider.createUpload) {
      throw new NotFoundException('El proveedor no soporta subidas');
    }

    const init = await provider.createUpload('video', 'video/mp4');
    if (init.mode === 'url') {
      // Persistimos el asset id para correlacionar el webhook del proveedor
      if (init.assetId) {
        await this.prisma.lesson.update({
          where: { id: lessonId },
          data: { videoAssetId: init.assetId, videoPlaybackId: null },
        });
      }
      return {
        lessonId,
        provider: provider.kind,
        mode: 'url',
        uploadUrl: init.uploadUrl,
        method: init.method,
      };
    }
    return {
      lessonId,
      provider: provider.kind,
      mode: 'relay',
      relayEndpoint: `/api/v1/instructor/lessons/${lessonId}/upload/relay`,
    };
  }

  /** Subida retransmitida (Cloudflare Stream): multipart → API → CF. */
  async relayUpload(
    user: RequestUser,
    lessonId: string,
    file: { buffer: Buffer; originalname: string; mimetype: string },
  ): Promise<{ lessonId: string; status: 'processing' }> {
    const lesson = await this.assertLessonOwnership(user, lessonId);
    const provider = this.providers.get(lesson.videoProvider);
    if (!provider.uploadFile) {
      throw new NotFoundException('El proveedor no soporta subida por relay');
    }
    const { assetId } = await provider.uploadFile(file.buffer, file.originalname, file.mimetype);
    await this.prisma.lesson.update({
      where: { id: lessonId },
      data: { videoAssetId: assetId, videoPlaybackId: null },
    });
    return { lessonId, status: 'processing' };
  }

  // ── Webhooks de proveedores de video ─────────────────────────────────────

  async handleProviderWebhook(
    kind: 'mux' | 'cloudflare',
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<{ received: boolean }> {
    const provider = this.providers.get(kind);
    if (!provider.handleWebhook) return { received: false };

    const result = await provider.handleWebhook(headers, rawBody);
    if (!result) return { received: true };

    const lesson = await this.prisma.lesson.findFirst({ where: { videoAssetId: result.assetId } });
    if (!lesson) {
      this.logger.warn(`Webhook ${kind}: asset ${result.assetId} no corresponde a ninguna lección`);
      return { received: true };
    }
    await this.prisma.lesson.update({
      where: { id: lesson.id },
      data: {
        ...(result.playbackId ? { videoPlaybackId: result.playbackId } : {}),
        ...(result.status === 'failed' ? { videoAssetId: null, videoPlaybackId: null } : {}),
      },
    });
    this.logger.log(`Webhook ${kind}: lección ${lesson.id} → ${result.status}`);
    return { received: true };
  }
}
