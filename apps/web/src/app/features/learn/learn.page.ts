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
import { VideoPlayerComponent } from './video-player.component';
import { formatClock } from '../../shared/format';

interface LessonState {
  watchedSeconds: number;
  completed: boolean;
}

/**
 * Página del reproductor (spec §1 módulo 3-5):
 *  - Reproductor con tracking de progreso (RxJS: el tracker hace flush ~5s).
 *  - Currículo lateral con bloqueo secuencial (candados) y checks.
 *  - Barra de progreso por curso.
 *  - Marca de agua con el email del usuario sobre el video.
 */
@Component({
  selector: 'app-learn',
  standalone: true,
  imports: [RouterLink, VideoPlayerComponent, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (course(); as c) {
      <div class="mx-auto grid max-w-[1600px] gap-6 px-4 py-6 sm:px-6 xl:grid-cols-[1fr_360px]">
        <!-- Columna del reproductor -->
        <div>
          @if (selectedLesson(); as lesson) {
            <div class="mb-4">
              <p class="text-xs font-semibold uppercase tracking-wide text-brand-600">
                {{ moduleTitleOf(lesson.id) }}
              </p>
              <h1 class="mt-1 text-2xl font-bold text-slate-900">{{ lesson.title }}</h1>
            </div>

            @if (isLocked(lesson)) {
              <div class="card flex flex-col items-center gap-3 p-16 text-center">
                <span class="text-5xl" aria-hidden="true">🔒</span>
                <h2 class="text-lg font-semibold text-slate-900">Lección bloqueada</h2>
                <p class="max-w-md text-sm text-slate-500">
                  Completa las lecciones anteriores en orden para desbloquear este contenido.
                </p>
                <button type="button" class="btn-primary mt-2" (click)="goToNextUncompleted()">
                  Ir a mi siguiente lección
                </button>
              </div>
            } @else {
              @if (playback(); as pb) {
                <app-video-player
                  [src]="pb.url"
                  [watermark]="pb.watermark ?? ''"
                  [startAt]="startAtFor(lesson.id)"
                  (timeChanged)="onTimeUpdate(lesson.id, $event)"
                  (videoEnded)="onEnded(lesson.id)"
                  (failed)="onFailed($event)"
                />
                @if (playbackNotice(); as notice) {
                  <p class="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">{{ notice }}</p>
                }
              } @else if (playbackError()) {
                <div class="card p-10 text-center">
                  <p class="text-3xl" aria-hidden="true">⚠️</p>
                  <p class="mt-2 font-medium text-slate-800">{{ playbackError() }}</p>
                  <button type="button" class="btn-secondary mt-4" (click)="reloadPlayback()">Reintentar</button>
                </div>
              } @else {
                <div class="card flex aspect-video animate-pulse items-center justify-center text-slate-400">
                  Cargando reproductor…
                </div>
              }
            }

            <!-- Acciones de la lección -->
            @if (!isLocked(lesson)) {
              <div class="mt-4 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2">
                  @if (stateOf(lesson.id).completed) {
                    <span class="badge-green">✓ Completada</span>
                  } @else {
                    <button type="button" class="btn-secondary btn-sm" (click)="markComplete(lesson.id)" [disabled]="busy()">
                      Marcar como completada
                    </button>
                  }
                </div>
                <div class="flex gap-2">
                  @if (prevLessonId(lesson.id); as pid) {
                    <a [routerLink]="['/aprender', courseId, pid]" class="btn-secondary btn-sm">← Anterior</a>
                  }
                  @if (nextLessonId(lesson.id); as nid) {
                    <a [routerLink]="['/aprender', courseId, nid]" class="btn-primary btn-sm">Siguiente →</a>
                  }
                </div>
              </div>
            }

            @if (lesson.description) {
              <section class="card mt-6 p-5">
                <h2 class="text-sm font-semibold text-slate-900">Sobre esta lección</h2>
                <p class="mt-2 whitespace-pre-line text-sm leading-relaxed text-slate-600">
                  {{ lesson.description }}
                </p>
              </section>
            }
          } @else {
            <div class="card p-16 text-center text-slate-500">Selecciona una lección del panel →</div>
          }
        </div>

        <!-- Panel lateral: progreso + currículo -->
        <aside class="card h-fit overflow-hidden xl:sticky xl:top-24">
          <header class="border-b border-slate-200 p-4">
            <a [routerLink]="['/cursos', c.slug]" class="text-xs text-slate-400 hover:text-brand-600">← Volver al curso</a>
            <h2 class="mt-1 line-clamp-2 font-bold text-slate-900">{{ c.title }}</h2>
            <div class="mt-3 flex items-center gap-3">
              <app-progress-bar [percent]="percent()" class="flex-1" />
              <span class="text-xs font-semibold text-slate-600">{{ percent() }}%</span>
            </div>
            <p class="mt-1 text-xs text-slate-400">
              {{ completedCount() }} de {{ flatLessons().length }} lecciones
            </p>
          </header>

          <div class="max-h-[60vh] overflow-y-auto">
            @for (mod of c.modules; track mod.id) {
              <section>
                <h3 class="bg-slate-50 px-4 py-2 text-xs font-bold uppercase tracking-wide text-slate-500">
                  {{ mod.title }}
                </h3>
                <ul>
                  @for (lesson of mod.lessons; track lesson.id) {
                    <li>
                      <a
                        [routerLink]="['/aprender', courseId, lesson.id]"
                        class="flex items-center gap-3 px-4 py-2.5 text-sm transition"
                        [class.bg-brand-50]="lesson.id === lessonId"
                        [class.font-semibold]="lesson.id === lessonId"
                        [class.text-slate-400]="isLocked(lesson)"
                      >
                        <span aria-hidden="true" class="w-5 text-center">
                          @if (isLocked(lesson)) { 🔒 }
                          @else if (stateOf(lesson.id).completed) { ✅ }
                          @else { ▶️ }
                        </span>
                        <span class="flex-1 truncate">{{ lesson.title }}</span>
                        <span class="text-xs text-slate-400">{{ clock(lesson.durationSeconds) }}</span>
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
      <div class="mx-auto max-w-3xl px-4 py-24 text-center">
        <p class="text-5xl" aria-hidden="true">😕</p>
        <h1 class="mt-4 text-2xl font-bold text-slate-900">{{ loadError() }}</h1>
        <a routerLink="/mi-aprendizaje" class="btn-primary mt-6 inline-flex">Ir a mi aprendizaje</a>
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
    // (El tracker además bufferiza en localStorage y hace flush periódico.)
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
            // Sin lección seleccionada → saltar a la siguiente del estudiante
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

  protected isLocked(lesson: LessonNode): boolean {
    const viewer = this.course()?.viewer;
    if (viewer?.isOwner || viewer?.isAdmin) return false;
    return !lesson.isPreview && lesson.unlocked !== true;
  }

  protected startAtFor(lessonId: string): number {
    const watched = this.stateOf(lessonId).watchedSeconds;
    const lesson = this.flatLessons().find((l) => l.id === lessonId);
    // No reanudar si ya estaba casi terminada
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
    // Stream throttleado a ~1 persistencia local cada 5s (ver constructor)
    this.timeUpdate$.next({ lessonId, seconds });
    // Estado optimista en la UI
    this.states.update((map) => ({
      ...map,
      [lessonId]: { watchedSeconds: Math.max(map[lessonId]?.watchedSeconds ?? 0, Math.floor(seconds)), completed: map[lessonId]?.completed ?? false },
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
          // La lección recién completada desbloquea la siguiente: refrescar
          this.refreshCourse();
          if (advance) {
            this.toast.success('¡Lección completada! 🎉');
            const next = this.nextLessonId(lessonId);
            if (next) {
              setTimeout(() => void this.router.navigate(['/aprender', this.courseId, next]), 800);
            } else if (this.percent() >= 100) {
              this.toast.success('¡Has completado el curso! 🎓');
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
