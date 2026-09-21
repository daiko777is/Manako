import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  LessonVideoRef,
  SignedPlayback,
  VideoProvider,
} from './video-provider.interface';

/**
 * Proveedor "direct": sirve la URL mp4 guardada en la lección tal cual.
 * SOLO PARA DESARROLLO / contenido gratuito sin protección (spec §3.4:
 * Supabase Storage / URLs directas no son recomendables para contenido pago).
 */
@Injectable()
export class DirectProvider implements VideoProvider {
  readonly kind = 'direct' as const;

  async playbackUrl(lesson: LessonVideoRef): Promise<SignedPlayback> {
    if (!lesson.videoUrl) {
      throw new BadRequestException('La lección no tiene video configurado (provider=direct)');
    }
    return { url: lesson.videoUrl, expiresAt: null };
  }
}
