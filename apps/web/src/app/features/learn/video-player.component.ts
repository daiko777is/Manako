import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  NgZone,
  OnChanges,
  OnDestroy,
  Output,
  SimpleChanges,
  inject,
  viewChild,
} from '@angular/core';
import videojs from 'video.js';
import type { VideoJsPlayer } from 'video.js';

function sourceType(url: string): string {
  if (url.includes('.m3u8')) return 'application/x-mpegURL';
  if (url.includes('.mpd')) return 'application/dash+xml';
  if (url.includes('.webm')) return 'video/webm';
  return 'video/mp4';
}

/**
 * Reproductor sobre video.js (spec §3.1):
 *  - HLS adaptativo vía VHS integrado de video.js (Mux/Cloudflare).
 *  - Emite timeupdate para el tracking de progreso (throttle en la página).
 *  - Marca de agua con el email del usuario (disuasión anti-piratería §6.4).
 *  - Clic derecho deshabilitado (medida disuasoria, no infalible).
 *  - Precarga solo metadata (no el video completo, spec §7.2).
 */
@Component({
  selector: 'app-video-player',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="relative overflow-hidden rounded-xl bg-black"
      (contextmenu)="$event.preventDefault()"
      data-context-disable
    >
      <video #video class="video-js vjs-big-play-centered w-full" playsinline></video>
      @if (watermark) {
        <div class="manako-watermark" aria-hidden="true">
          <span>{{ watermark }}</span>
        </div>
      }
    </div>
  `,
})
export class VideoPlayerComponent implements AfterViewInit, OnChanges, OnDestroy {
  /** URL HLS firmada o mp4 directo. */
  @Input({ required: true }) src = '';
  /** Texto de marca de agua (email del usuario). */
  @Input() watermark = '';
  /** Segundo inicial (retomar donde lo dejaste). */
  @Input() startAt = 0;

  /** Segundos reproducidos (para que la página haga throttle y persista). */
  @Output() readonly timeChanged = new EventEmitter<number>();
  @Output() readonly videoEnded = new EventEmitter<void>();
  @Output() readonly failed = new EventEmitter<string>();

  private readonly videoEl = viewChild.required<ElementRef<HTMLVideoElement>>('video');
  private readonly zone = inject(NgZone);
  private player: VideoJsPlayer | null = null;

  ngAfterViewInit(): void {
    // video.js toca mucho el DOM: lo inicializamos fuera de la zone de Angular
    // para no disparar detección de cambios en cada frame (rendimiento, §7.1).
    this.zone.runOutsideAngular(() => {
      this.player = videojs(
        this.videoEl().nativeElement,
        {
          controls: true,
          preload: 'metadata',
          fluid: true,
          playbackRates: [0.75, 1, 1.25, 1.5, 2],
          controlBar: { pictureInPictureToggle: false },
        },
        () => {
          this.loadSource();
        },
      );

      this.player.on('timeupdate', () => {
        const t = this.player?.currentTime() ?? 0;
        this.zone.run(() => this.timeChanged.emit(t));
      });
      this.player.on('ended', () => this.zone.run(() => this.videoEnded.emit()));
      this.player.on('error', () => {
        const err = this.player?.error();
        this.zone.run(() =>
          this.failed.emit(err?.message ?? 'No se pudo reproducir el video'),
        );
      });
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['src'] && this.player && !changes['src'].firstChange) {
      this.loadSource();
    }
    if (changes['startAt'] && this.player && !changes['startAt'].firstChange) {
      this.player.currentTime(this.startAt);
    }
  }

  private loadSource(): void {
    if (!this.player || !this.src) return;
    this.zone.runOutsideAngular(() => {
      this.player!.src({ src: this.src, type: sourceType(this.src) });
      if (this.startAt > 5) {
        // Reanudar donde lo dejaste (pequeño margen para no saltar el inicio)
        this.player!.one('loadedmetadata', () => {
          this.player!.currentTime(this.startAt);
          void (this.player!.play() as Promise<unknown> | undefined)?.catch?.(() => undefined);
        });
      }
    });
  }

  ngOnDestroy(): void {
    this.player?.dispose();
    this.player = null;
  }
}
