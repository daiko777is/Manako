import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Category, CourseSummary } from '@manako/shared';
import { CatalogService } from '../../core/catalog/catalog.service';
import { AuthService } from '../../core/auth/auth.service';
import { CourseCardComponent } from '../../shared/components/course-card.component';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CourseCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hero -->
    <section class="bg-gradient-to-b from-brand-50 via-white to-white">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:items-center lg:py-24">
        <div>
          <p class="badge-brand mb-4">Plataforma de cursos en video</p>
          <h1 class="text-4xl font-extrabold tracking-tight text-slate-900 sm:text-5xl">
            Aprende a tu ritmo con
            <span class="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">Manakō</span>
          </h1>
          <p class="mt-4 max-w-xl text-lg text-slate-600">
            Cursos organizados en módulos y lecciones, con seguimiento de progreso,
            desbloqueo secuencial y certificación al terminar.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/cursos" class="btn-primary">Explorar catálogo</a>
            @if (!auth.isAuthenticated()) {
              <a routerLink="/registro" class="btn-secondary">Crear cuenta gratis</a>
            } @else {
              <a routerLink="/mi-aprendizaje" class="btn-secondary">Continuar aprendiendo</a>
            }
          </div>
          <dl class="mt-10 grid max-w-md grid-cols-3 gap-4 text-center">
            <div class="card p-3">
              <dt class="text-xs text-slate-500">Cursos</dt>
              <dd class="text-xl font-bold text-slate-900">{{ featured().length }}+</dd>
            </div>
            <div class="card p-3">
              <dt class="text-xs text-slate-500">Progreso</dt>
              <dd class="text-xl font-bold text-slate-900">100%</dd>
            </div>
            <div class="card p-3">
              <dt class="text-xs text-slate-500">A tu ritmo</dt>
              <dd class="text-xl font-bold text-slate-900">24/7</dd>
            </div>
          </dl>
        </div>

        <!-- Mock del reproductor -->
        <div class="card relative overflow-hidden p-2 shadow-xl" aria-hidden="true">
          <div class="flex aspect-video items-center justify-center rounded-lg bg-slate-900">
            <div class="flex flex-col items-center gap-3 text-slate-300">
              <span class="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 text-2xl text-white">▶</span>
              <span class="text-sm">Tu próxima lección te espera</span>
            </div>
          </div>
          <div class="space-y-2 p-4">
            <div class="flex items-center justify-between text-xs text-slate-500">
              <span>Módulo 2 · Lección 3</span><span>65%</span>
            </div>
            <div class="h-2 rounded-full bg-slate-200">
              <div class="h-2 w-[65%] rounded-full bg-brand-600"></div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Categorías -->
    <section class="mx-auto max-w-7xl px-4 sm:px-6">
      <div class="flex flex-wrap gap-2">
        @for (cat of categories(); track cat.id) {
          <a [routerLink]="['/cursos']" [queryParams]="{ categoria: cat.slug }"
             class="badge-slate hover:bg-brand-100 hover:text-brand-800">
            {{ cat.name }}
          </a>
        }
      </div>
    </section>

    <!-- Destacados -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-2xl font-bold text-slate-900">Cursos destacados</h2>
          <p class="mt-1 text-sm text-slate-500">Los más populares de la plataforma</p>
        </div>
        <a routerLink="/cursos" class="text-sm font-semibold text-brand-700 hover:underline">Ver todo →</a>
      </div>

      @if (featuredLoading()) {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card h-72 animate-pulse"></div>
          }
        </div>
      } @else {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (course of featured(); track course.id) {
            <app-course-card [course]="course" />
          } @empty {
            <p class="col-span-full py-10 text-center text-slate-500">
              Aún no hay cursos publicados. Vuelve pronto 🌱
            </p>
          }
        </div>
      }
    </section>

    <!-- Cómo funciona -->
    <section class="border-t border-slate-200 bg-white">
      <div class="mx-auto grid max-w-7xl gap-8 px-4 py-14 sm:px-6 md:grid-cols-3">
        <div class="card p-6">
          <span class="text-3xl">🔍</span>
          <h3 class="mt-3 font-semibold text-slate-900">1. Elige tu curso</h3>
          <p class="mt-2 text-sm text-slate-600">
            Explora el catálogo por categoría, nivel y precio. Prueba las lecciones de muestra gratis.
          </p>
        </div>
        <div class="card p-6">
          <span class="text-3xl">📈</span>
          <h3 class="mt-3 font-semibold text-slate-900">2. Avanza con seguimiento</h3>
          <p class="mt-2 text-sm text-slate-600">
            Tu progreso se guarda automáticamente. Las lecciones se desbloquean a medida que completas las anteriores.
          </p>
        </div>
        <div class="card p-6">
          <span class="text-3xl">🎓</span>
          <h3 class="mt-3 font-semibold text-slate-900">3. Certifícate</h3>
          <p class="mt-2 text-sm text-slate-600">
            Termina el curso y obtén tu certificado. Aprende a tu ritmo, desde cualquier dispositivo.
          </p>
        </div>
      </div>
    </section>

    <!-- CTA instructores -->
    <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6">
      <div class="card flex flex-col items-center gap-4 bg-gradient-to-r from-brand-700 to-brand-500 p-10 text-center text-white md:flex-row md:text-left">
        <div class="flex-1">
          <h2 class="text-2xl font-bold">¿Quieres enseñar en Manakō?</h2>
          <p class="mt-2 text-brand-100">
            Publica tus cursos en video, sigue la retención de tus alumnos y recibe pagos.
          </p>
        </div>
        <a routerLink="/instructor" class="btn bg-white text-brand-700 hover:bg-brand-50">
          Convertirme en instructor
        </a>
      </div>
    </section>
  `,
})
export class HomePage {
  private readonly catalog = inject(CatalogService);
  protected readonly auth = inject(AuthService);

  protected readonly featured = signal<CourseSummary[]>([]);
  protected readonly featuredLoading = signal(true);
  protected readonly categories = signal<Category[]>([]);

  constructor() {
    this.catalog
      .getFeatured(8)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (courses) => {
          this.featured.set(courses);
          this.featuredLoading.set(false);
        },
        error: () => this.featuredLoading.set(false),
      });

    this.catalog
      .getCategories()
      .pipe(takeUntilDestroyed())
      .subscribe((cats) => this.categories.set(cats));
  }
}
