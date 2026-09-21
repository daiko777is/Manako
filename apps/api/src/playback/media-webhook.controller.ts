import { Body, Controller, Headers, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../common/public.decorator';
import { PlaybackService } from './playback.service';

/**
 * Webhooks de proveedores de video (spec §3.4): nos avisan cuándo terminó
 * de procesarse un upload. La autenticación es por firma HMAC (Mux) o
 * shared secret (Cloudflare) — verificados dentro de cada proveedor.
 */
@ApiTags('media-webhooks')
@Controller({ path: 'media/webhooks', version: '1' })
export class MediaWebhookController {
  constructor(private readonly playback: PlaybackService) {}

  @Public()
  @Post('mux')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Webhook de Mux (video.asset.ready / errored)' })
  mux(
    @Req() req: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() _body: unknown,
  ) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
    return this.playback.handleProviderWebhook('mux', headers, raw);
  }

  @Public()
  @Post('cloudflare')
  @Throttle({ default: { ttl: 60_000, limit: 60 } })
  @ApiOperation({ summary: 'Webhook de Cloudflare Stream' })
  cloudflare(
    @Req() req: Request,
    @Headers() headers: Record<string, string | string[] | undefined>,
    @Body() _body: unknown,
  ) {
    const raw = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
    return this.playback.handleProviderWebhook('cloudflare', headers, raw);
  }
}
