import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EnrollmentSummary } from '@manako/shared';
import { EnrollmentsService } from '../../core/enrollments/enrollments.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProgressRingComponent } from '../../shared/components/progress-ring.component';
import { IconComponent } from '../../shared/components/icon.component';
import { RevealDirective } from '../../shared/components/reveal.directive';
import { levelLabel } from '../../shared/format';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [RouterLink, ProgressRingComponent, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header con wash de gradiente -->
    <section class="relative -mt-16 overflow-hidden bg-slate-950 pb-12 pt-28">
      <div class="absolute inset-0 bg-mesh-hero opacity-70" aria-hidden="true"></div>
      <div class="absolute inset-0 bg-grid-fade bg-grid opacity-30" aria-hidden="true"></div>
      <div class="relative mx-auto flex max-w-7xl flex-wrap items-end justify-between gap-4 px-4 sm:px-6">
        <div>
          <h1 class="animate-fade-up font-heading text-3xl font-bold text-white sm:text-4xl">
            Hola, {{ firstName() }}
            <span class="ml-1 inline-block animate-wiggle origin-bottom-right text-brand-300 align-middle">
              <app-icon name="sparkles" [size]="24" />
            </span>
          </h1>
          <p class="mt-2 animate-fade-up text-slate-300 [animation-delay:80ms]">
            @if (enrollments().length > 0) {
              Tienes {{ enrollments().length }} curso(s) en marcha — continúa donde lo dejaste.
            } @else {
              Tu próximo curso te está esperando.
            }
          </p>
        </div>
        <a routerLink="/cursos" class="btn-primary animate-fade-up [animation-delay:160ms]">
          <app-icon name="search" [size]="16" /> Explorar catálogo
        </a>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <!-- Tarjetas de resumen -->
      <div class="mb-8 grid gap-4 sm:grid-cols-3">
        <div class="card flex items-center gap-4 p-5" appReveal>
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow">
            <app-icon name="book" [size]="22" />
          </span>
          <div>
            <p class="font-heading text-2xl font-bold text-slate-900">{{ enrollments().length }}</p>
            <p class="text-xs text-slate-500">Cursos inscritos</p>
          </div>
        </div>
        <div class="card flex items-center gap-4 p-5" appReveal [appRevealDelay]="80">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-glow">
            <app-icon name="check-circle" [size]="22" />
          </span>
          <div>
            <p class="font-heading text-2xl font-bold text-slate-900">{{ completedLessons() }}</p>
            <p class="text-xs text-slate-500">Lecciones completadas</p>
          </div>
        </div>
        <div class="card flex items-center gap-4 p-5" appReveal [appRevealDelay]="160">
          <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-glow">
            <app-icon name="fire" [size]="22" />
          </span>
          <div>
            <p class="font-heading text-2xl font-bold text-slate-900">{{ inProgress() }}</p>
            <p class="text-xs text-slate-500">En progreso ahora</p>
          </div>
        </div>
      </div>

      @if (loading()) {
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card overflow-hidden p-4">
              <div class="flex gap-4">
                <div class="skeleton h-20 w-28 shrink-0"></div>
                <div class="flex-1 space-y-2.5 py-1">
                  <div class="skeleton h-4 w-3/4"></div>
                  <div class="skeleton h-3 w-1/2"></div>
                  <div class="skeleton h-2 w-full"></div>
                </div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          @for (enrollment of enrollments(); track enrollment.id; let i = $index) {
            <article class="card-interactive group flex flex-col overflow-hidden" appReveal [appRevealDelay]="(i % 3) * 80">
              <div class="flex items-start gap-4 p-5">
                <div class="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-brand-600 to-violet-700">
                  @if (enrollment.course.thumbnailUrl) {
                    <img
                      [src]="enrollment.course.thumbnailUrl"
                      [alt]="'Portada de ' + enrollment.course.title"
                      class="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                      loading="lazy"
                    />
                  } @else {
                    <span class="absolute inset-0 flex items-center justify-center text-white/80">
                      <app-icon name="film" [size]="26" />
                    </span>
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <h2 class="line-clamp-2 font-heading text-[15px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
                    <a [routerLink]="['/cursos', enrollment.course.slug]">{{ enrollment.course.title }}</a>
                  </h2>
                  <p class="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    {{ levelLabel(enrollment.course.level) }}
                    @if (enrollment.course.instructor) {
                      <span class="text-slate-300">•</span>
                      <span class="truncate">{{ enrollment.course.instructor.fullName }}</span>
                    }
                  </p>
                </div>
                <app-progress-ring [percent]="enrollment.progress?.percent ?? 0" [size]="48" [strokeWidth]="4.5" />
              </div>

              <div class="mt-auto flex items-center justify-between gap-3 border-t border-slate-100 px-5 py-4">
                <p class="text-xs text-slate-500">
                  {{ enrollment.progress?.completedLessons ?? 0 }}/{{ enrollment.progress?.totalLessons ?? 0 }} lecciones
                </p>
                <a [routerLink]="['/aprender', enrollment.courseId]" class="btn-primary btn-sm">
                  <app-icon name="play" [size]="13" />
                  {{ (enrollment.progress?.percent ?? 0) > 0 ? 'Continuar' : 'Empezar' }}
                </a>
              </div>
            </article>
          } @empty {
            <div class="card col-span-full p-16 text-center" appReveal>
              <span class="mx-auto flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-500">
                <app-icon name="book" [size]="36" />
              </span>
              <h2 class="mt-6 font-heading text-xl font-bold text-slate-900">Todavía no tienes cursos</h2>
              <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Explora el catálogo e inscríbete en tu primer curso — hay varios
                totalmente gratis para empezar hoy mismo.
              </p>
              <a routerLink="/cursos" class="btn-primary mt-7 inline-flex">
                Ver catálogo <app-icon name="arrow-right" [size]="16" />
              </a>
            </div>
          }
        </div>
      }
    </div>
  `,
})
export class StudentDashboardPage {
  private readonly enrollmentsApi = inject(EnrollmentsService);
  protected readonly auth = inject(AuthService);

  protected readonly enrollments = signal<EnrollmentSummary[]>([]);
  protected readonly loading = signal(true);

  protected readonly levelLabel = levelLabel;

  protected firstName(): string {
    const name = this.auth.profile()?.fullName ?? '';
    return name.split(' ')[0] || '¡hey!';
  }

  protected completedLessons(): number {
    return this.enrollments().reduce((acc, e) => acc + (e.progress?.completedLessons ?? 0), 0);
  }

  protected inProgress(): number {
    return this.enrollments().filter((e) => {
      const p = e.progress?.percent ?? 0;
      return p > 0 && p < 100;
    }).length;
  }

  constructor() {
    this.enrollmentsApi
      .mine()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (list) => {
          this.enrollments.set(list);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
