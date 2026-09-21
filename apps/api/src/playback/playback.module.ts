import { Module } from '@nestjs/common';
import { CloudflareStreamProvider } from './providers/cloudflare.provider';
import { DirectProvider } from './providers/direct.provider';
import { MuxProvider } from './providers/mux.provider';
import { MediaWebhookController } from './media-webhook.controller';
import { PlaybackController } from './playback.controller';
import { PlaybackService } from './playback.service';
import { VideoProviderFactory } from './video-provider.factory';

@Module({
  controllers: [PlaybackController, MediaWebhookController],
  providers: [
    PlaybackService,
    VideoProviderFactory,
    MuxProvider,
    CloudflareStreamProvider,
    DirectProvider,
  ],
  exports: [PlaybackService, VideoProviderFactory],
})
export class PlaybackModule {}
