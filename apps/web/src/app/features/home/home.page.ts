import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Category, CourseSummary } from '@manako/shared';
import { CatalogService } from '../../core/catalog/catalog.service';
import { AuthService } from '../../core/auth/auth.service';
import { CourseCardComponent } from '../../shared/components/course-card.component';
import { IconComponent } from '../../shared/components/icon.component';
import { RevealDirective } from '../../shared/components/reveal.directive';

const FEATURES = [
  {
    icon: 'lock',
    title: 'Desbloqueo secuencial',
    text: 'Cada lección se abre al completar la anterior. El curso marca el orden; tú marcas el ritmo.',
  },
  {
    icon: 'chart-bar',
    title: 'Progreso automático',
    text: 'El tiempo visto se guarda cada pocos segundos y sobrevive a cortes de conexión. Retomas donde lo dejaste.',
  },
  {
    icon: 'play',
    title: 'Muestras gratis',
    text: 'Las lecciones marcadas como muestra se ven sin inscripción: decide con el contenido delante.',
  },
  {
    icon: 'shield',
    title: 'Video protegido',
    text: 'Streaming HLS con URLs firmadas de corta duración y marca de agua. Tu compra, respetada.',
  },
  {
    icon: 'award',
    title: 'Certificado al 100%',
    text: 'Completa todas las lecciones y emite tu certificado de finalización.',
  },
  {
    icon: 'presentation',
    title: 'Instructores con datos',
    text: 'Quien crea el curso ve retención por lección e ingresos reales, no suposiciones.',
  },
] as const;

const STEPS = [
  { n: '01', title: 'Elige e inscríbete', text: 'Pago único por curso o muestras gratis. Sin suscripciones obligatorias.' },
  { n: '02', title: 'Avanza en orden', text: 'Una lección lleva a la siguiente. El progreso se sincroniza solo, en cualquier dispositivo.' },
  { n: '03', title: 'Termina y certifica', text: 'Al completar el 100% del currículo, tu certificado queda emitido en tu perfil.' },
] as const;

/**
 * Home v2 — dirección "calm craft" (skill ui-craft / Refactoring UI):
 * hero claro editorial, jerarquía por peso y color, cifras reales derivadas
 * de la API (data drives the UI), cero decoración gratuita.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [RouterLink, CourseCardComponent, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ═══════ Hero editorial claro ═══════ -->
    <section class="relative -mt-14 overflow-hidden border-b border-slate-200 bg-slate-50">
      <!-- Único adorno de fondo: retícula hairline al 40% (finishing.md) -->
      <div class="absolute inset-0 bg-grid-fade bg-grid opacity-40" aria-hidden="true"></div>

      <div class="relative mx-auto grid max-w-7xl items-center gap-16 px-4 py-20 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
        <div>
          <p class="eyebrow">Plataforma de cursos tech</p>
          <h1 class="mt-4 font-heading text-[40px] font-bold leading-[1.05] text-slate-900 sm:text-[56px]">
            Cursos que
            <span class="border-b-4 border-brand-600 pb-1 text-brand-700">se terminan</span>.
          </h1>
          <p class="mt-6 max-w-xl text-lg leading-relaxed text-slate-600">
            Manakō organiza cada curso en módulos secuenciales: completas una
            lección y se desbloquea la siguiente. Tu progreso se guarda solo y
            hay certificado al llegar al 100%.
          </p>

          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/cursos" class="btn-primary btn-lg">
              Explorar catálogo
            </a>
            @if (!auth.isAuthenticated()) {
              <a routerLink="/registro" class="btn-secondary btn-lg">Crear cuenta gratis</a>
            } @else {
              <a routerLink="/mi-aprendizaje" class="btn-secondary btn-lg">Continuar aprendiendo</a>
            }
          </div>

          <!-- Cifras reales del catálogo (no inventadas) -->
          @if (stats().courses > 0) {
            <dl class="mt-12 flex divide-x divide-slate-200 border-y border-slate-200 py-5 tnum">
              <div class="pr-8">
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Cursos publicados</dt>
                <dd class="mt-1 font-heading text-2xl font-semibold text-slate-900">{{ stats().coursesSuffix }}</dd>
              </div>
              <div class="px-8">
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Lecciones en video</dt>
                <dd class="mt-1 font-heading text-2xl font-semibold text-slate-900">{{ stats().lessons }}+</dd>
              </div>
              <div class="pl-8">
                <dt class="text-xs font-medium uppercase tracking-wide text-slate-400">Inscripciones</dt>
                <dd class="mt-1 font-heading text-2xl font-semibold text-slate-900">{{ stats().enrollments }}</dd>
              </div>
            </dl>
          }
        </div>

        <!-- Mock del producto real: panel de currículo (no un player inventado) -->
        <div class="relative hidden lg:block" aria-hidden="true" appReveal>
          <div class="card overflow-hidden shadow-[var(--shadow-md2)]">
            <div class="flex items-center gap-2 border-b border-slate-200 bg-white px-4 py-3">
              <span class="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-slate-200"></span>
              <span class="ml-3 text-xs text-slate-400">manako.app/aprender/angular-18-desde-cero</span>
            </div>
            <div class="bg-white p-5">
              <p class="text-[11px] font-bold uppercase tracking-wider text-slate-400">Módulo 2 · Reactividad avanzada</p>
              <ul class="mt-4 space-y-1">
                <li class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <app-icon name="check" [size]="12" />
                  </span>
                  <span class="flex-1 text-slate-500 line-through decoration-slate-300">Signals: estado local reactivo</span>
                  <span class="text-xs text-slate-400 tnum">08:12</span>
                </li>
                <li class="flex items-center gap-3 rounded-lg bg-brand-50/70 px-3 py-2.5 text-sm shadow-[inset_2px_0_0_0_var(--mk-brand-600)]">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-brand-600 text-white">
                    <app-icon name="play" [size]="12" />
                  </span>
                  <span class="flex-1 font-semibold text-slate-900">Signals vs RxJS: cuándo usar cada uno</span>
                  <span class="text-xs text-slate-500 tnum">12:14</span>
                </li>
                <li class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <app-icon name="lock" [size]="12" />
                  </span>
                  <span class="flex-1 text-slate-400">toSignal y toObservable en la práctica</span>
                  <span class="text-xs text-slate-300 tnum">15:40</span>
                </li>
                <li class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm">
                  <span class="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <app-icon name="lock" [size]="12" />
                  </span>
                  <span class="flex-1 text-slate-400">Proyecto final: tablero de cursos</span>
                  <span class="text-xs text-slate-300 tnum">21:05</span>
                </li>
              </ul>
              <div class="mt-5 border-t border-slate-100 pt-4">
                <div class="flex items-center justify-between text-xs">
                  <span class="font-medium text-slate-500">Progreso del curso</span>
                  <span class="font-semibold text-slate-700 tnum">1 / 4 · 25%</span>
                </div>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div class="h-full w-1/4 rounded-full bg-brand-600"></div>
                </div>
              </div>
            </div>
          </div>
          <p class="mt-3 text-center text-xs text-slate-400">Vista real del reproductor con desbloqueo secuencial</p>
        </div>
      </div>
    </section>

    <!-- ═══════ Cómo funciona ═══════ -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="grid gap-10 md:grid-cols-3">
        @for (step of steps; track step.n; let i = $index) {
          <div appReveal [appRevealDelay]="i * 90">
            <p class="font-heading text-5xl font-bold text-slate-200">{{ step.n }}</p>
            <h3 class="mt-3 font-heading text-lg font-semibold text-slate-900">{{ step.title }}</h3>
            <p class="mt-2 max-w-xs text-sm leading-relaxed text-slate-500">{{ step.text }}</p>
          </div>
        }
      </div>
    </section>

    <!-- ═══════ Features ═══════ -->
    <section class="border-y border-slate-200 bg-white py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div appReveal>
          <p class="eyebrow-muted">Por qué Manakō</p>
          <h2 class="mt-3 max-w-xl font-heading text-3xl font-bold text-slate-900">
            Menos ruido, más curso terminado
          </h2>
        </div>
        <div class="mt-12 grid gap-x-10 gap-y-9 sm:grid-cols-2 lg:grid-cols-3">
          @for (feature of features; track feature.title; let i = $index) {
            <div appReveal [appRevealDelay]="(i % 3) * 70">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <app-icon [name]="feature.icon" [size]="19" />
              </span>
              <h3 class="mt-4 font-heading text-[15px] font-semibold text-slate-900">{{ feature.title }}</h3>
              <p class="mt-1.5 text-sm leading-relaxed text-slate-500">{{ feature.text }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ═══════ Categorías ═══════ -->
    @if (categories().length > 0) {
      <section class="mx-auto max-w-7xl px-4 py-14 sm:px-6" appReveal>
        <p class="eyebrow-muted">Categorías</p>
        <div class="mt-4 flex flex-wrap gap-2">
          @for (cat of categories(); track cat.id) {
            <a [routerLink]="['/cursos']" [queryParams]="{ categoria: cat.slug }" class="chip">
              {{ cat.name }}
            </a>
          }
        </div>
      </section>
    }

    <!-- ═══════ Destacados ═══════ -->
    <section class="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <div class="mb-8 flex items-end justify-between gap-4" appReveal>
        <div>
          <p class="eyebrow-muted">Catálogo</p>
          <h2 class="mt-3 font-heading text-3xl font-bold text-slate-900">Cursos destacados</h2>
        </div>
        <a routerLink="/cursos" class="group flex items-center gap-1 text-sm font-semibold text-brand-700 transition-colors hover:text-brand-800">
          Ver todo
          <span class="transition-transform duration-200 group-hover:translate-x-0.5"><app-icon name="arrow-right" [size]="15" /></span>
        </a>
      </div>

      @if (featuredLoading()) {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (i of [1, 2, 3, 4]; track i) {
            <div class="card overflow-hidden">
              <div class="skeleton aspect-video !rounded-none"></div>
              <div class="space-y-3 p-4">
                <div class="skeleton h-3 w-1/2"></div>
                <div class="skeleton h-4 w-full"></div>
                <div class="skeleton h-4 w-2/3"></div>
                <div class="skeleton h-8 w-full"></div>
              </div>
            </div>
          }
        </div>
      } @else {
        <div class="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          @for (course of featured(); track course.id; let i = $index) {
            <div appReveal [appRevealDelay]="(i % 4) * 60" class="h-full">
              <app-course-card [course]="course" />
            </div>
          } @empty {
            <div class="card col-span-full p-14 text-center">
              <span class="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                <app-icon name="book" [size]="22" />
              </span>
              <h3 class="mt-4 font-heading text-lg font-semibold text-slate-900">Aún no hay cursos publicados</h3>
              <p class="mt-1 text-sm text-slate-500">Vuelve en unos días o publica tú el primero.</p>
            </div>
          }
        </div>
      }
    </section>

    <!-- ═══════ CTA instructores — plano, sin adornos ═══════ -->
    <section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6" appReveal>
      <div class="relative overflow-hidden rounded-2xl bg-slate-950 px-8 py-16 sm:px-16">
        <div class="absolute inset-0 bg-grid-fade bg-grid opacity-[0.04]" aria-hidden="true"></div>
        <div class="relative grid gap-8 lg:grid-cols-[1.4fr_1fr] lg:items-center">
          <div>
            <p class="text-xs font-bold uppercase tracking-[0.12em] text-slate-400">Para expertos</p>
            <h2 class="mt-3 max-w-xl font-heading text-3xl font-bold leading-tight text-white sm:text-4xl">
              Convierte tu conocimiento en ingresos recurrentes
            </h2>
            <p class="mt-4 max-w-lg leading-relaxed text-slate-400">
              Publica tus cursos, consulta la retención lección a lección y cobra
              con reparto transparente. Documentado en el acuerdo de instructor.
            </p>
          </div>
          <div class="flex flex-col items-start gap-3 lg:items-end">
            <a routerLink="/instructor" class="btn-primary btn-lg">Convertirme en instructor</a>
            <a routerLink="/legal/instructores" class="text-sm font-semibold text-slate-300 underline decoration-slate-600 underline-offset-4 transition-colors hover:text-white">
              Leer el acuerdo y el reparto
            </a>
          </div>
        </div>
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
  protected readonly stats = signal({ courses: 0, coursesSuffix: '0', lessons: 0, enrollments: 0 });

  protected readonly features = FEATURES;
  protected readonly steps = STEPS;

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

    // Cifras agregadas reales del catálogo (data drives the UI — ui-craft)
    this.catalog
      .getCourses({ limit: 50 })
      .pipe(takeUntilDestroyed())
      .subscribe((page) => {
        const courses = page.data;
        this.stats.set({
          courses: courses.length,
          coursesSuffix: page.nextCursor ? `${courses.length}+` : `${courses.length}`,
          lessons: courses.reduce((acc, c) => acc + c.lessonsCount, 0),
          enrollments: courses.reduce((acc, c) => acc + c.totalEnrollments, 0),
        });
      });
  }
}
