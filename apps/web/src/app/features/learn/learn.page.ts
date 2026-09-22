import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subject, filter, throttleTime } from 'rxjs';
import type { CourseDetail, LessonNode, PlaybackResponse } from '@manako/shared';
import { CourseService } from '../../core/course/course.service';
import { PlaybackService } from '../../core/playback/playback.service';
import { ProgressTrackerService } from '../../core/progress/progress-tracker.service';
import { ToastService } from '../../core/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring.component';
import { IconComponent } from '../../shared/components/icon.component';
import { VideoPlayerComponent } from './video-player.component';
import { formatClock } from '../../shared/format';

interface LessonState {
  watchedSeconds: number;
  completed: boolean;
}

/**
 * Página del reproductor (spec §1 módulo 3-5) rediseñada:
 * sidebar con indicador activo, anillo de progreso, iconos SVG,
 * tracking throttleado (RxJS) y marca de agua sobre el video.
 */
@Component({
  selector: 'app-learn',
  standalone: true,
  imports: [RouterLink, VideoPlayerComponent, ProgressBarComponent, ProgressRingComponent, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (course(); as c) {
      <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[1fr_360px]">
        <!-- ═══════ Columna del reproductor ═══════ -->
        <div>
          @if (selectedLesson(); as lesson) {
            <div class="mb-4">
              <p class="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-600">
                <app-icon name="list" [size]="13" />
                {{ moduleTitleOf(lesson.id) }}
              </p>
              <h1 class="mt-1.5 font-heading text-2xl font-bold text-slate-900 sm:text-3xl">{{ lesson.title }}</h1>
            </div>

            @if (isLocked(lesson)) {
              <div class="card flex flex-col items-center gap-4 p-16 text-center">
                <span class="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-slate-400">
                  <app-icon name="lock" [size]="34" />
                </span>
                <h2 class="font-heading text-xl font-bold text-slate-900">Lección bloqueada</h2>
                <p class="max-w-md text-sm leading-relaxed text-slate-500">
                  Completa las lecciones anteriores en orden para desbloquear este contenido.
                  Así nos aseguramos de que nada se te escape.
                </p>
                <button type="button" class="btn-primary mt-2" (click)="goToNextUncompleted()">
                  <app-icon name="play" [size]="15" /> Ir a mi siguiente lección
                </button>
              </div>
            } @else {
              @if (playback(); as pb) {
                <div class="animate-fade-up">
                  <app-video-player
                    [src]="pb.url"
                    [watermark]="pb.watermark ?? ''"
                    [startAt]="startAtFor(lesson.id)"
                    (timeChanged)="onTimeUpdate(lesson.id, $event)"
                    (videoEnded)="onEnded(lesson.id)"
                    (failed)="onFailed($event)"
                  />
                </div>
                @if (playbackNotice(); as notice) {
                  <p class="mt-3 flex items-center gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 ring-1 ring-inset ring-amber-600/15">
                    <app-icon name="bolt" [size]="16" /> {{ notice }}
                  </p>
                }
              } @else if (playbackError()) {
                <div class="card p-12 text-center">
                  <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-3xl bg-rose-50 text-rose-500">
                    <app-icon name="bolt" [size]="28" />
                  </span>
                  <p class="mt-4 font-heading text-lg font-bold text-slate-900">{{ playbackError() }}</p>
                  <button type="button" class="btn-secondary mt-5" (click)="reloadPlayback()">
                    <app-icon name="refresh" [size]="15" /> Reintentar
                  </button>
                </div>
              } @else {
                <div class="relative aspect-video overflow-hidden rounded-2xl bg-slate-900">
                  <div class="absolute inset-0 bg-mesh-hero opacity-40" aria-hidden="true"></div>
                  <div class="absolute inset-0 flex flex-col items-center justify-center gap-3 text-slate-300">
                    <span class="h-8 w-8 animate-spin rounded-full border-2 border-brand-400 border-t-transparent"></span>
                    <span class="text-sm">Cargando reproductor…</span>
                  </div>
                </div>
              }
            }

            <!-- Acciones de la lección -->
            @if (!isLocked(lesson)) {
              <div class="mt-5 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2.5">
                  @if (stateOf(lesson.id).completed) {
                    <span class="badge-green animate-pop-in">
                      <app-icon name="check-circle" [size]="13" /> Completada
                    </span>
                  } @else {
                    <button type="button" class="btn-secondary btn-sm" (click)="markComplete(lesson.id)" [disabled]="busy()">
                      <app-icon name="check" [size]="14" /> Marcar como completada
                    </button>
                  }
                </div>
                <div class="flex gap-2">
                  @if (prevLessonId(lesson.id); as pid) {
                    <a [routerLink]="['/aprender', courseId, pid]" class="btn-secondary btn-sm">
                      <app-icon name="chevron-left" [size]="13" /> Anterior
                    </a>
                  }
                  @if (nextLessonId(lesson.id); as nid) {
                    <a [routerLink]="['/aprender', courseId, nid]" class="btn-primary btn-sm">
                      Siguiente <app-icon name="chevron-right" [size]="13" />
                    </a>
                  }
                </div>
              </div>
            }

            @if (lesson.description) {
              <section class="card mt-6 p-6">
                <h2 class="flex items-center gap-2 font-heading text-sm font-bold uppercase tracking-wider text-slate-400">
                  <app-icon name="book" [size]="15" /> Sobre esta lección
                </h2>
                <p class="mt-3 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {{ lesson.description }}
                </p>
              </section>
            }
          } @else {
            <div class="card flex flex-col items-center gap-4 p-20 text-center text-slate-500">
              <span class="flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-brand-50 text-brand-500">
                <app-icon name="play" [size]="28" />
              </span>
              <p class="font-medium">Selecciona una lección del panel para empezar</p>
            </div>
          }
        </div>

        <!-- ═══════ Panel lateral ═══════ -->
        <aside class="card h-fit overflow-hidden xl:sticky xl:top-24">
          <header class="relative overflow-hidden border-b border-slate-100 bg-gradient-to-br from-slate-950 to-brand-950 p-5 text-white">
            <div class="absolute inset-0 bg-mesh-hero opacity-40" aria-hidden="true"></div>
            <div class="relative">
              <a [routerLink]="['/cursos', c.slug]" class="inline-flex items-center gap-1 text-xs font-semibold text-brand-200 transition hover:text-white">
                <app-icon name="chevron-left" [size]="12" /> Volver al curso
              </a>
              <h2 class="mt-2 line-clamp-2 font-heading text-base font-bold">{{ c.title }}</h2>
              <div class="mt-4 flex items-center gap-4">
                <app-progress-ring [percent]="percent()" [size]="54" [strokeWidth]="5" trackColor="rgba(255,255,255,0.15)" valueClass="!text-white" />
                <div class="text-sm">
                  <p class="font-semibold">{{ completedCount() }} de {{ flatLessons().length }} lecciones</p>
                  <p class="mt-0.5 text-xs text-slate-300">
                    @if (percent() >= 100) {
                      ¡Curso completado!
                    } @else {
                      Te faltan {{ flatLessons().length - completedCount() }}
                    }
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div class="max-h-[60vh] overflow-y-auto">
            @for (mod of c.modules; track mod.id) {
              <section>
                <h3 class="sticky top-0 z-10 flex items-center gap-2 bg-slate-50/95 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
                  <span class="flex h-5 w-5 items-center justify-center rounded-md bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-bold text-white">
                    {{ mod.orderIndex + 1 }}
                  </span>
                  {{ mod.title }}
                </h3>
                <ul>
                  @for (lesson of mod.lessons; track lesson.id) {
                    <li>
                      <a
                        [routerLink]="['/aprender', courseId, lesson.id]"
                        class="relative flex items-center gap-3 px-4 py-3 text-sm transition-colors duration-200"
                        [class]="lesson.id === lessonId
                          ? 'bg-gradient-to-r from-brand-50 to-violet-50/60 font-semibold text-brand-800'
                          : isLocked(lesson) ? 'text-slate-400 hover:bg-slate-50' : 'text-slate-700 hover:bg-slate-50'"
                      >
                        @if (lesson.id === lessonId) {
                          <span class="absolute inset-y-0 left-0 w-1 rounded-r-full bg-gradient-to-b from-brand-500 to-violet-500" aria-hidden="true"></span>
                        }
                        <span class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition"
                              [class]="isLocked(lesson)
                                ? 'bg-slate-100 text-slate-400'
                                : stateOf(lesson.id).completed
                                  ? 'bg-emerald-100 text-emerald-600'
                                  : lesson.id === lessonId ? 'bg-brand-600 text-white shadow-glow' : 'bg-slate-100 text-slate-500'">
                          <app-icon
                            [name]="isLocked(lesson) ? 'lock' : stateOf(lesson.id).completed ? 'check' : 'play'"
                            [size]="13"
                          />
                        </span>
                        <span class="min-w-0 flex-1">
                          <span class="block truncate">{{ lesson.title }}</span>
                          @if (stateOf(lesson.id).watchedSeconds > 0 && !stateOf(lesson.id).completed && !isLocked(lesson)) {
                            <span class="mt-1 block h-1 w-full overflow-hidden rounded-full bg-slate-200">
                              <span class="block h-full rounded-full bg-brand-400"
                                    [style.width.%]="watchPercent(lesson)"></span>
                            </span>
                          }
                        </span>
                        <span class="shrink-0 text-[11px] font-medium text-slate-400">{{ clock(lesson.durationSeconds) }}</span>
                      </a>
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </aside>
      </div>
    } @else if (loadError()) {
      <div class="mx-auto max-w-3xl px-4 py-28 text-center">
        <span class="mx-auto flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-500">
          <app-icon name="search" [size]="34" />
        </span>
        <h1 class="mt-6 font-heading text-2xl font-bold text-slate-900">{{ loadError() }}</h1>
        <a routerLink="/mi-aprendizaje" class="btn-primary mt-8 inline-flex">
          Ir a mi aprendizaje <app-icon name="arrow-right" [size]="16" />
        </a>
      </div>
    }
  `,
})
export class LearnPage {
  @Input({ required: true }) courseId = '';
  @Input() lessonId: string | null = null;

  private readonly courses = inject(CourseService);
  private readonly playbackApi = inject(PlaybackService);
  private readonly tracker = inject(ProgressTrackerService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);

  protected readonly course = signal<CourseDetail | null>(null);
  protected readonly playback = signal<PlaybackResponse | null>(null);
  protected readonly playbackError = signal<string | null>(null);
  protected readonly playbackNotice = signal<string | null>(null);
  protected readonly loadError = signal<string | null>(null);
  protected readonly busy = signal(false);
  /** lessonId → estado de progreso local (fusiona servidor + optimista). */
  protected readonly states = signal<Record<string, LessonState>>({});

  protected readonly clock = formatClock;

  protected readonly flatLessons = computed<LessonNode[]>(() =>
    (this.course()?.modules ?? []).flatMap((m) => m.lessons),
  );

  protected readonly selectedLesson = computed<LessonNode | null>(() => {
    const id = this.lessonId;
    if (!id) return null;
    return this.flatLessons().find((l) => l.id === id) ?? null;
  });

  protected readonly completedCount = computed(
    () => Object.values(this.states()).filter((s) => s.completed).length,
  );

  protected readonly percent = computed(() => {
    const total = this.flatLessons().length;
    return total === 0 ? 0 : Math.round((100 * this.completedCount()) / total);
  });

  constructor() {
    // Patrón literal de la spec §7.4: throttleTime(5000) antes de persistir.
    this.timeUpdate$
      .pipe(
        throttleTime(5000, undefined, { leading: false, trailing: true }),
        takeUntilDestroyed(),
      )
      .subscribe(({ lessonId, seconds }) => this.tracker.record(lessonId, seconds));

    // Cargar estructura del curso + progreso inicial
    effect(() => {
      const courseId = this.courseId;
      if (!courseId) return;
      this.courses
        .getDetailById(courseId)
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (course) => {
            this.course.set(course);
            if (!this.lessonId) {
              const target = course.viewer?.nextLessonId ?? course.modules[0]?.lessons[0]?.id;
              if (target) {
                void this.router.navigate(['/aprender', courseId, target], { replaceUrl: true });
              }
            }
          },
          error: (err: Error) => this.loadError.set(err.message || 'Curso no disponible'),
        });

      this.playbackApi
        .courseProgress(courseId)
        .pipe(takeUntilDestroyed())
        .subscribe((progress) => {
          const map: Record<string, LessonState> = {};
          for (const l of progress.lessons) {
            map[l.lessonId] = { watchedSeconds: l.watchedSeconds, completed: l.completed };
          }
          this.states.set(map);
        });
    });

    // Al cambiar de lección: pedir URL firmada al backend (revalida acceso)
    effect(() => {
      const lesson = this.selectedLesson();
      const courseId = this.courseId;
      if (!lesson || !courseId) return;

      this.playback.set(null);
      this.playbackError.set(null);
      this.playbackNotice.set(null);

      if (this.isLocked(lesson)) return;

      this.playbackApi
        .getPlayback(courseId, lesson.id)
        .pipe(takeUntilDestroyed())
        .subscribe({
          next: (pb) => this.playback.set(pb),
          error: (err: { error?: { message?: string } }) =>
            this.playbackError.set(
              err?.error?.message ?? 'No se pudo obtener el video (¿lección bloqueada?)',
            ),
        });
    });

    // Fusionar las respuestas del tracker de progreso en el estado local
    effect(() => {
      const update = this.tracker.lastUpdate();
      if (!update) return;
      this.states.update((map) => {
        const next = { ...map };
        for (const l of update.lessons) {
          next[l.lessonId] = { watchedSeconds: l.watchedSeconds, completed: l.completed };
        }
        return next;
      });
    });

    // Sincronizar buffer cuando el usuario sale del reproductor
    this.router.events
      .pipe(
        filter((e) => e.constructor.name === 'NavigationStart'),
        takeUntilDestroyed(),
      )
      .subscribe(() => void this.tracker.flush());
  }

  // ── Estado de lecciones ──────────────────────────────────────────────────

  protected stateOf(lessonId: string): LessonState {
    return this.states()[lessonId] ?? { watchedSeconds: 0, completed: false };
  }

  protected watchPercent(lesson: LessonNode): number {
    const watched = this.stateOf(lesson.id).watchedSeconds;
    if (!lesson.durationSeconds) return 0;
    return Math.min(100, Math.round((100 * watched) / lesson.durationSeconds));
  }

  protected isLocked(lesson: LessonNode): boolean {
    const viewer = this.course()?.viewer;
    if (viewer?.isOwner || viewer?.isAdmin) return false;
    return !lesson.isPreview && lesson.unlocked !== true;
  }

  protected startAtFor(lessonId: string): number {
    const watched = this.stateOf(lessonId).watchedSeconds;
    const lesson = this.flatLessons().find((l) => l.id === lessonId);
    if (lesson && watched >= lesson.durationSeconds * 0.95) return 0;
    return this.stateOf(lessonId).completed ? 0 : watched;
  }

  protected moduleTitleOf(lessonId: string): string {
    const mod = this.course()?.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
    return mod?.title ?? '';
  }

  protected prevLessonId(lessonId: string): string | null {
    const flat = this.flatLessons();
    const i = flat.findIndex((l) => l.id === lessonId);
    return i > 0 ? (flat[i - 1]?.id ?? null) : null;
  }

  protected nextLessonId(lessonId: string): string | null {
    const flat = this.flatLessons();
    const i = flat.findIndex((l) => l.id === lessonId);
    return i >= 0 && i < flat.length - 1 ? (flat[i + 1]?.id ?? null) : null;
  }

  // ── Tracking de progreso (spec §7.4) ─────────────────────────────────────

  private readonly timeUpdate$ = new Subject<{ lessonId: string; seconds: number }>();

  protected onTimeUpdate(lessonId: string, seconds: number): void {
    this.timeUpdate$.next({ lessonId, seconds });
    // Estado optimista en la UI
    this.states.update((map) => ({
      ...map,
      [lessonId]: {
        watchedSeconds: Math.max(map[lessonId]?.watchedSeconds ?? 0, Math.floor(seconds)),
        completed: map[lessonId]?.completed ?? false,
      },
    }));
  }

  protected onEnded(lessonId: string): void {
    void this.markComplete(lessonId, true);
  }

  protected markComplete(lessonId: string, advance = false): void {
    this.busy.set(true);
    this.playbackApi
      .markComplete(lessonId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.states.update((map) => ({
            ...map,
            [lessonId]: { ...(map[lessonId] ?? { watchedSeconds: 0 }), completed: true },
          }));
          this.refreshCourse();
          if (advance) {
            this.toast.success('¡Lección completada!');
            const next = this.nextLessonId(lessonId);
            if (next) {
              setTimeout(() => void this.router.navigate(['/aprender', this.courseId, next]), 800);
            } else if (this.percent() >= 100) {
              this.toast.success('¡Has completado el curso!');
            }
          }
        },
        error: () => this.busy.set(false),
      });
  }

  protected onFailed(message: string): void {
    this.playbackNotice.set(
      message.includes('MEDIA_ERR_SRC_NOT_SUPPORTED') || message.toLowerCase().includes('format')
        ? 'El video aún se está procesando en el proveedor. Vuelve en unos minutos.'
        : `Error de reproducción: ${message}`,
    );
  }

  protected reloadPlayback(): void {
    const lesson = this.selectedLesson();
    if (!lesson) return;
    this.playbackError.set(null);
    this.playbackApi
      .getPlayback(this.courseId, lesson.id)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (pb) => this.playback.set(pb),
        error: () => this.playbackError.set('Sigue sin estar disponible, inténtalo más tarde'),
      });
  }

  protected goToNextUncompleted(): void {
    const target =
      this.course()?.viewer?.nextLessonId ??
      this.flatLessons().find((l) => !this.stateOf(l.id).completed)?.id;
    if (target) void this.router.navigate(['/aprender', this.courseId, target]);
  }

  private refreshCourse(): void {
    this.courses
      .getDetailById(this.courseId)
      .pipe(takeUntilDestroyed())
      .subscribe((course) => this.course.set(course));
  }
}
