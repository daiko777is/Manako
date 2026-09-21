import {
  BadRequestException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SignJWT, importPKCS8 } from 'jose';
import type {
  LessonVideoRef,
  SignedPlayback,
  UploadInit,
  VideoProvider,
  WebhookResult,
} from './video-provider.interface';

interface CfStreamUploadResponse {
  result?: { uid: string };
  errors?: { message: string }[];
}

interface CfWebhookBody {
  type?: string;
  uid?: string;
  status?: { state?: string };
}

/**
 * Cloudflare Stream (spec §3.4 — alternativa económica con CDN global):
 *  - Playback firmado: JWT RS256 con la Customer Key/Sub private key,
 *    servido desde videodelivery.net (HLS adaptativo).
 *  - La subida requiere el API token del servidor → modo 'relay': el
 *    navegador sube el archivo a la API y la API lo retransmite a CF.
 *    (Para archivos muy grandes, preferir Mux Direct Uploads.)
 *  - Webhook con header X-Webhook-Secret configurado en el dashboard.
 */
@Injectable()
export class CloudflareStreamProvider implements VideoProvider {
  readonly kind = 'cloudflare' as const;
  private readonly logger = new Logger(CloudflareStreamProvider.name);

  constructor(private readonly config: ConfigService) {}

  private require(key: string): string {
    const v = this.config.get<string>(key);
    if (!v) throw new BadRequestException(`${key} no configurado`);
    return v;
  }

  async playbackUrl(lesson: LessonVideoRef, ttlSeconds: number): Promise<SignedPlayback> {
    const uid = lesson.videoAssetId;
    if (!uid) {
      throw new BadRequestException('La lección no tiene video subido a Cloudflare Stream');
    }
    const customerKey = this.require('CF_STREAM_CUSTOMER_KEY');
    const pem = this.require('CF_STREAM_PRIVATE_KEY_PEM').replace(/\\n/g, '\n');
    const privateKey = await importPKCS8(pem, 'RS256');

    const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
    const token = await new SignJWT({ sub: uid })
      .setProtectedHeader({ alg: 'RS256', kid: customerKey })
      .setExpirationTime(exp)
      .sign(privateKey);

    return {
      url: `https://videodelivery.net/${uid}/manifest/video.m3u8?token=${token}`,
      expiresAt: new Date(exp * 1000).toISOString(),
    };
  }

  /** CF requiere el API token en servidor → la subida va vía relay por la API. */
  async createUpload(): Promise<UploadInit> {
    return { mode: 'relay', relayEndpoint: 'relay' };
  }

  async uploadFile(file: Buffer, filename: string): Promise<{ assetId: string }> {
    const accountId = this.require('CF_STREAM_ACCOUNT_ID');
    const apiToken = this.require('CF_STREAM_API_TOKEN');

    const form = new FormData();
    form.append('file', new Blob([file]), filename);

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/stream`,
      { method: 'POST', headers: { Authorization: `Bearer ${apiToken}` }, body: form },
    );
    const body = (await res.json()) as CfStreamUploadResponse;
    if (!res.ok || !body.result?.uid) {
      this.logger.error(`CF Stream upload falló: ${JSON.stringify(body.errors ?? res.status)}`);
      throw new BadRequestException('No se pudo subir el video a Cloudflare Stream');
    }
    return { assetId: body.result.uid };
  }

  async handleWebhook(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult | null> {
    const expectedSecret = this.config.get<string>('CF_STREAM_WEBHOOK_SECRET');
    const header = headers['x-webhook-secret'];
    const received = Array.isArray(header) ? header[0] : header;
    if (expectedSecret && received !== expectedSecret) {
      throw new UnauthorizedException('Webhook secret de Cloudflare inválido');
    }

    const event = JSON.parse(rawBody.toString('utf8')) as CfWebhookBody;
    if (!event.uid) return null;
    const state = event.status?.state;
    return {
      assetId: event.uid,
      playbackId: event.uid, // en CF el uid sirve como id de reproducción
      status: state === 'ready' ? 'ready' : state === 'error' ? 'failed' : 'processing',
    };
  }
}
