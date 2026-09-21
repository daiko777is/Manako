import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { VideoProviderKind } from '@manako/shared';
import { CloudflareStreamProvider } from './providers/cloudflare.provider';
import { DirectProvider } from './providers/direct.provider';
import { MuxProvider } from './providers/mux.provider';
import type { VideoProvider } from './providers/video-provider.interface';

/**
 * Selecciona el proveedor por lección (lessons.video_provider) con fallback
 * al VIDEO_PROVIDER global del servidor. Permite migrar de proveedor sin
 * tocar lecciones ya publicadas (cada una recuerda dónde vive su video).
 */
@Injectable()
export class VideoProviderFactory {
  private readonly providers: Map<VideoProviderKind, VideoProvider>;

  constructor(
    config: ConfigService,
    mux: MuxProvider,
    cloudflare: CloudflareStreamProvider,
    direct: DirectProvider,
  ) {
    this.providers = new Map<VideoProviderKind, VideoProvider>([
      ['mux', mux],
      ['cloudflare', cloudflare],
      ['direct', direct],
    ]);
    this.defaultKind = (config.get<VideoProviderKind>('VIDEO_PROVIDER') ?? 'direct') as VideoProviderKind;
  }

  private readonly defaultKind: VideoProviderKind;

  get default(): VideoProviderKind {
    return this.defaultKind;
  }

  get(kind: VideoProviderKind | null | undefined): VideoProvider {
    const provider = this.providers.get(kind ?? this.defaultKind);
    if (!provider) throw new BadRequestException(`Proveedor de video desconocido: ${String(kind)}`);
    return provider;
  }
}
