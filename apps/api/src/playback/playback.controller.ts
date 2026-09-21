import { Controller, Get, Param, ParseUUIDPipe } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { PlaybackResponse } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PlaybackService } from './playback.service';

@ApiTags('playback')
@ApiBearerAuth()
@Controller({ version: '1' })
export class PlaybackController {
  constructor(private readonly playback: PlaybackService) {}

  /**
   * Única puerta de entrada al video: URL firmada de corta expiración.
   * Rate limit reforzado (spec §6.3) para dificultar el scraping de URLs.
   */
  @Get('courses/:courseId/playback/:lessonId')
  @Throttle({ default: { ttl: 60_000, limit: 20 } })
  @ApiOperation({ summary: 'URL de reproducción firmada (valida inscripción + desbloqueo)' })
  getPlayback(
    @CurrentUser() user: RequestUser,
    @Param('courseId', ParseUUIDPipe) courseId: string,
    @Param('lessonId', ParseUUIDPipe) lessonId: string,
  ): Promise<PlaybackResponse> {
    return this.playback.getPlayback(user, courseId, lessonId);
  }
}
