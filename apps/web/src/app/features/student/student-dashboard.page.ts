import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EnrollmentSummary } from '@manako/shared';
import { EnrollmentsService } from '../../core/enrollments/enrollments.service';
import { AuthService } from '../../core/auth/auth.service';
import { ProgressBarComponent } from '../../shared/components/progress-bar.component';
import { levelLabel } from '../../shared/format';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [RouterLink, ProgressBarComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 class="text-3xl font-bold text-slate-900">Mi aprendizaje</h1>
          <p class="mt-1 text-slate-500">
            Hola {{ auth.profile()?.fullName || '👋' }} — continúa donde lo dejaste.
          </p>
        </div>
        <a routerLink="/cursos" class="btn-primary">Explorar más cursos</a>
      </header>

      @if (loading()) {
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          @for (i of [1, 2, 3]; track i) {
            <div class="card h-40 animate-pulse"></div>
          }
        </div>
      } @else {
        <div class="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          @for (enrollment of enrollments(); track enrollment.id) {
            <article class="card flex flex-col overflow-hidden">
              <div class="flex items-start gap-4 p-4">
                <div
                  class="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-600 to-brand-800"
                >
                  @if (enrollment.course.thumbnailUrl) {
                    <img
                      [src]="enrollment.course.thumbnailUrl"
                      [alt]="'Portada de ' + enrollment.course.title"
                      class="h-full w-full object-cover"
                      loading="lazy"
                    />
                  } @else {
                    <span class="text-2xl text-white/80" aria-hidden="true">🎬</span>
                  }
                </div>
                <div class="min-w-0 flex-1">
                  <h2 class="truncate font-semibold text-slate-900">
                    <a [routerLink]="['/cursos', enrollment.course.slug]" class="hover:text-brand-700">
                      {{ enrollment.course.title }}
                    </a>
                  </h2>
                  <p class="mt-0.5 text-xs text-slate-500">
                    {{ levelLabel(enrollment.course.level) }}
                    @if (enrollment.course.instructor) {
                      · {{ enrollment.course.instructor.fullName }}
                    }
                  </p>
                </div>
              </div>

              <div class="px-4">
                <div class="flex items-center gap-3">
                  <app-progress-bar [percent]="enrollment.progress?.percent ?? 0" class="flex-1" />
                  <span class="text-xs font-semibold text-slate-600">
                    {{ enrollment.progress?.percent ?? 0 }}%
                  </span>
                </div>
                <p class="mt-1 text-xs text-slate-400">
                  {{ enrollment.progress?.completedLessons ?? 0 }}/{{ enrollment.progress?.totalLessons ?? 0 }} lecciones
                </p>
              </div>

              <div class="mt-auto p-4">
                <a [routerLink]="['/aprender', enrollment.courseId]" class="btn-primary btn-sm w-full">
                  {{ (enrollment.progress?.percent ?? 0) > 0 ? 'Continuar' : 'Empezar' }}
                </a>
              </div>
            </article>
          } @empty {
            <div class="card col-span-full p-14 text-center">
              <p class="text-5xl" aria-hidden="true">📚</p>
              <h2 class="mt-4 text-lg font-semibold text-slate-900">Todavía no tienes cursos</h2>
              <p class="mt-1 text-sm text-slate-500">
                Explora el catálogo e inscríbete en tu primer curso — hay varios gratis.
              </p>
              <a routerLink="/cursos" class="btn-primary mt-6 inline-flex">Ver catálogo</a>
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
