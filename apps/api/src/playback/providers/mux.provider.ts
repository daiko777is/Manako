import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { SignJWT } from 'jose';
import type {
  LessonVideoRef,
  SignedPlayback,
  UploadInit,
  VideoProvider,
  WebhookResult,
} from './video-provider.interface';

interface MuxUploadResponse {
  data?: { id: string; url: string; asset_id: string };
  error?: { messages: string[] };
}

interface MuxAssetReadyEvent {
  type: string;
  data?: { id: string; status: string; playback_ids?: { id: string; policy: string }[] };
}

/**
 * Mux Video (spec §3.4 — recomendado para contenido pago):
 *  - Streaming adaptativo HLS automático.
 *  - Playback firmado: JWT HS256 con la Signing Key de Mux (kid en header,
 *    aud='vod', sub=playbackId, exp corta).
 *  - Direct Uploads: el navegador sube PUT a la URL firmada de Mux
 *    (la API nunca toca el binario del video).
 *  - Webhook video.asset.ready → persistimos el playback_id.
 */
@Injectable()
export class MuxProvider implements VideoProvider {
  readonly kind = 'mux' as const;
  private readonly logger = new Logger(MuxProvider.name);

  constructor(private readonly config: ConfigService) {}

  private get signingKeyId(): string {
    const v = this.config.get<string>('MUX_SIGNING_KEY_ID');
    if (!v) throw new BadRequestException('MUX_SIGNING_KEY_ID no configurado');
    return v;
  }

  private get signingKey(): Uint8Array {
    const v = this.config.get<string>('MUX_SIGNING_KEY_PRIVATE_KEY');
    if (!v) throw new BadRequestException('MUX_SIGNING_KEY_PRIVATE_KEY no configurado');
    return new TextEncoder().encode(v.replace(/\\n/g, '\n'));
  }

  async playbackUrl(lesson: LessonVideoRef, ttlSeconds: number): Promise<SignedPlayback> {
    if (!lesson.videoPlaybackId) {
      throw new BadRequestException('El video aún está procesándose en Mux (falta playback id)');
    }
    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = await new SignJWT({ aud: 'vod', sub: lesson.videoPlaybackId })
      .setProtectedHeader({ alg: 'HS256', kid: this.signingKeyId, typ: 'JWT' })
      .setExpirationTime(exp)
      .sign(this.signingKey);
    return {
      url: `https://stream.mux.com/${lesson.videoPlaybackId}.m3u8?token=${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** Crea un Direct Upload en Mux; el navegador hará PUT de el archivo. */
  async createUpload(): Promise<UploadInit> {
    const tokenId = this.config.get<string>('MUX_TOKEN_ID');
    const tokenSecret = this.config.get<string>('MUX_TOKEN_SECRET');
    if (!tokenId || !tokenSecret) {
      throw new BadRequestException('MUX_TOKEN_ID/MUX_TOKEN_SECRET no configurados');
    }
    const corsOrigin = this.config.get<string>('FRONTEND_URL') ?? '*';

    const res = await fetch('https://api.mux.com/video/v1/uploads', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${Buffer.from(`${tokenId}:${tokenSecret}`).toString('base64')}`,
      },
      body: JSON.stringify({
        cors_origin: corsOrigin,
        new_asset_settings: { playback_policy: ['signed'], normalize_audio: true },
      }),
    });
    const body = (await res.json()) as MuxUploadResponse;
    if (!res.ok || !body.data) {
      this.logger.error(`Mux create upload falló: ${JSON.stringify(body.error ?? res.status)}`);
      throw new BadRequestException('No se pudo crear la subida en Mux');
    }
    return { mode: 'url', uploadUrl: body.data.url, method: 'PUT', assetId: body.data.asset_id };
  }

  /** Webhook de Mux: verifica firma HMAC y extrae playback id cuando está listo. */
  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult | null> {
    const secret = this.config.get<string>('MUX_WEBHOOK_SECRET');
    const signatureHeader = headers['mux-signature'];
    const signature = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;

    if (secret) {
      if (!signature) throw new UnauthorizedException('Falta MUX-SIGNATURE');
      const [, hex] = signature.split('=');
      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      const a = Buffer.from(hex ?? '');
      const b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        throw new UnauthorizedException('Firma de webhook Mux inválida');
      }
    } else {
      this.logger.warn('MUX_WEBHOOK_SECRET no configurado: webhook sin verificación (solo dev)');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as MuxAssetReadyEvent;
    if (!event.data?.id) return null;

    if (event.type === 'video.asset.ready') {
      return {
        assetId: event.data.id,
        playbackId: event.data.playback_ids?.[0]?.id,
        status: 'ready',
      };
    }
    if (event.type === 'video.asset.errored') {
      return { assetId: event.data.id, status: 'failed' };
    }
    if (event.type === 'video.asset.created' || event.type === 'video.asset.uploading') {
      return { assetId: event.data.id, status: 'processing' };
    }
    return null;
  }
}
