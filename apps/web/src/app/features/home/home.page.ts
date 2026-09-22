import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Category, CourseSummary } from '@manako/shared';
import { CatalogService } from '../../core/catalog/catalog.service';
import { AuthService } from '../../core/auth/auth.service';
import { CourseCardComponent } from '../../shared/components/course-card.component';
import { IconComponent } from '../../shared/components/icon.component';
import { RevealDirective } from '../../shared/components/reveal.directive';
import { StatsCounterComponent } from '../../shared/components/stats-counter.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring.component';

const TECH_MARQUEE = [
  'Angular', 'RxJS', 'Signals', 'NestJS', 'Supabase', 'PostgreSQL', 'Stripe',
  'Mux HLS', 'Tailwind CSS', 'Prisma', 'TypeScript', 'Docker',
];

const FEATURES = [
  {
    icon: 'chart-bar',
    title: 'Progreso que se siente',
    text: 'Cada segundo cuenta: el seguimiento se guarda solo y retomas exactamente donde lo dejaste, en cualquier dispositivo.',
  },
  {
    icon: 'lock',
    title: 'Ruta secuencial',
    text: 'Las lecciones se desbloquean a medida que avanzas. Sin saltos al vacío: el curso te lleva de la mano hasta el final.',
  },
  {
    icon: 'award',
    title: 'Certificado al terminar',
    text: 'Completa el 100% y obtén tu certificado para compartir en tu portafolio y redes profesionales.',
  },
  {
    icon: 'shield',
    title: 'Contenido protegido',
    text: 'Streaming adaptativo con URLs firmadas y marca de agua: calidad premium con protección anti-piratería.',
  },
  {
    icon: 'bolt',
    title: 'Previews antes de comprar',
    text: 'Prueba lecciones de muestra gratis en cada curso. Compra sabiendo exactamente qué te espera.',
  },
  {
    icon: 'fire',
    title: 'A tu ritmo, sin excusas',
    text: 'Acceso de por vida, velocidad de reproducción configurable y recordatorios suaves para mantener la racha.',
  },
] as const;

/**
 * Home rediseñada — patrón "Scroll-Triggered Storytelling" (skill
 * ui-ux-pro-max): hook → problema → solución → evidencia → CTA climático.
 * Elementos vivos: hero mesh-gradient con blobs, mock flotante de
 * reproductor, marquee de tecnologías, contadores animados, scroll reveal.
 */
@Component({
  selector: 'app-home',
  standalone: true,
  imports: [
    RouterLink,
    CourseCardComponent,
    IconComponent,
    RevealDirective,
    StatsCounterComponent,
    ProgressRingComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- ═══════════ HERO (hook) ═══════════ -->
    <section class="relative -mt-16 overflow-hidden bg-slate-950 pb-24 pt-32">
      <!-- Fondo: mesh + grid + blobs animados -->
      <div class="absolute inset-0 bg-mesh-hero opacity-90" aria-hidden="true"></div>
      <div class="absolute inset-0 bg-grid-fade bg-grid opacity-40" aria-hidden="true"></div>
      <div class="absolute -left-32 top-10 h-96 w-96 animate-blob rounded-full bg-brand-600/30 blur-3xl" aria-hidden="true"></div>
      <div class="absolute -right-24 top-40 h-80 w-80 animate-blob rounded-full bg-fuchsia-600/20 blur-3xl [animation-delay:-7s]" aria-hidden="true"></div>
      <div class="absolute bottom-0 left-1/3 h-72 w-72 animate-blob rounded-full bg-sky-500/20 blur-3xl [animation-delay:-3s]" aria-hidden="true"></div>

      <div class="relative mx-auto grid max-w-7xl items-center gap-14 px-4 sm:px-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div>
          <p class="eyebrow animate-fade-up border-white/15 bg-white/10 text-brand-200 backdrop-blur">
            <app-icon name="sparkles" [size]="13" />
            Plataforma de cursos para profesionales tech
          </p>
          <h1 class="mt-5 animate-fade-up font-heading text-4xl font-bold leading-[1.08] text-white [animation-delay:80ms] sm:text-6xl">
            Aprende a tu ritmo.<br />
            <span class="bg-gradient-to-r from-brand-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              Llega hasta el final.
            </span>
          </h1>
          <p class="mt-6 max-w-xl animate-fade-up text-lg leading-relaxed text-slate-300 [animation-delay:160ms]">
            Cursos en video organizados en módulos con desbloqueo secuencial,
            seguimiento automático de progreso y certificación. El 80% de abandonar
            un curso es fricción — Manakō la elimina.
          </p>

          <div class="mt-9 flex animate-fade-up flex-wrap gap-3 [animation-delay:240ms]">
            <a routerLink="/cursos" class="btn-primary btn-lg">
              Explorar catálogo
              <app-icon name="arrow-right" [size]="18" />
            </a>
            @if (!auth.isAuthenticated()) {
              <a routerLink="/registro" class="btn btn-lg border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20">
                Crear cuenta gratis
              </a>
            } @else {
              <a routerLink="/mi-aprendizaje" class="btn btn-lg border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20">
                <app-icon name="play" [size]="16" /> Continuar aprendiendo
              </a>
            }
          </div>

          <!-- Banda de estadísticas con contadores animados -->
          <dl class="mt-12 grid max-w-lg animate-fade-up grid-cols-3 gap-4 [animation-delay:320ms]">
            <div class="glass-dark rounded-2xl p-4 text-center">
              <dt class="order-2 mt-1 block text-[11px] uppercase tracking-wider text-slate-400">Cursos</dt>
              <dd class="order-1 font-heading text-2xl font-bold text-white">
                <app-stats-counter [target]="courseCount()" suffix="+" [durationMs]="1200" />
              </dd>
            </div>
            <div class="glass-dark rounded-2xl p-4 text-center">
              <dt class="mt-1 block text-[11px] uppercase tracking-wider text-slate-400">Progreso</dt>
              <dd class="font-heading text-2xl font-bold text-white">
                <app-stats-counter [target]="100" suffix="%" [durationMs]="1600" />
              </dd>
            </div>
            <div class="glass-dark rounded-2xl p-4 text-center">
              <dt class="mt-1 block text-[11px] uppercase tracking-wider text-slate-400">A tu ritmo</dt>
              <dd class="font-heading text-2xl font-bold text-white">24/7</dd>
            </div>
          </dl>
        </div>

        <!-- Mock flotante del reproductor (liquid glass) -->
        <div class="relative hidden animate-fade-up [animation-delay:400ms] lg:block" aria-hidden="true">
          <div class="absolute -inset-6 rounded-[2rem] bg-gradient-to-br from-brand-500/30 via-violet-500/20 to-fuchsia-500/30 blur-2xl"></div>
          <div class="glass-dark relative animate-float-slow rounded-3xl p-3">
            <!-- Barra de ventana -->
            <div class="flex items-center gap-1.5 px-2 pb-3 pt-1">
              <span class="h-2.5 w-2.5 rounded-full bg-rose-400/80"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-amber-400/80"></span>
              <span class="h-2.5 w-2.5 rounded-full bg-emerald-400/80"></span>
              <span class="ml-3 text-xs text-slate-400">manako.app/aprender</span>
            </div>
            <!-- Video -->
            <div class="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-brand-950">
              <div class="absolute inset-0 bg-mesh-hero opacity-40"></div>
              <button type="button" tabindex="-1" class="relative flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-glow transition hover:scale-110">
                <app-icon name="play" [size]="26" />
              </button>
              <span class="absolute bottom-3 right-3 rounded-md bg-slate-950/70 px-2 py-0.5 text-[11px] font-semibold text-white">12:04 / 18:30</span>
            </div>
            <!-- Progreso + siguiente lección -->
            <div class="flex items-center gap-4 p-4">
              <app-progress-ring [percent]="65" [size]="52" [strokeWidth]="5" trackColor="rgba(255,255,255,0.12)" valueClass="!text-white" />
              <div class="min-w-0 flex-1">
                <p class="text-[11px] font-semibold uppercase tracking-wider text-brand-300">Módulo 3 · Lección 2</p>
                <p class="truncate text-sm font-semibold text-white">Signals vs RxJS: cuándo usar cada uno</p>
                <div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                  <div class="h-full w-[65%] rounded-full bg-gradient-to-r from-brand-400 to-fuchsia-400"></div>
                </div>
              </div>
              <span class="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-1 text-[11px] font-bold text-emerald-300">
                <app-icon name="check" [size]="11" /> 2/4
              </span>
            </div>
          </div>

          <!-- Chips flotantes -->
          <div class="glass absolute -left-10 top-24 flex animate-float items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 [animation-delay:-2s]">
            <span class="flex h-7 w-7 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600"><app-icon name="check-circle" [size]="15" /></span>
            Lección completada +1
          </div>
          <div class="glass absolute -right-6 bottom-16 flex animate-float items-center gap-2 rounded-2xl px-3.5 py-2.5 text-xs font-semibold text-slate-800 [animation-delay:-5s]">
            <span class="flex h-7 w-7 items-center justify-center rounded-xl bg-amber-100 text-amber-600"><app-icon name="lock" [size]="15" /></span>
            Siguiente: se desbloquea al terminar
          </div>
        </div>
      </div>
    </section>

    <!-- ═══════════ MARQUEE de tecnologías ═══════════ -->
    <section class="border-y border-slate-200 bg-white py-5" aria-label="Tecnologías que aprenderás">
      <div class="marquee-mask overflow-hidden">
        <div class="flex w-max animate-marquee items-center gap-10 px-5">
          @for (tech of marqueeItems; track $index) {
            <span class="flex items-center gap-2.5 whitespace-nowrap text-sm font-semibold text-slate-400">
              <span class="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-brand-500 to-violet-500"></span>
              {{ tech }}
            </span>
          }
        </div>
      </div>
    </section>

    <!-- ═══════════ PROBLEMA → SOLUCIÓN ═══════════ -->
    <section class="mx-auto max-w-7xl px-4 py-20 sm:px-6">
      <div class="grid gap-12 lg:grid-cols-2 lg:items-center">
        <div appReveal>
          <p class="eyebrow">El problema</p>
          <h2 class="mt-4 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
            El 90% de quienes empiezan un curso online
            <span class="relative whitespace-nowrap text-rose-500">
              no lo termina
              <svg class="absolute -bottom-1.5 left-0 w-full" height="8" viewBox="0 0 200 8" preserveAspectRatio="none" aria-hidden="true">
                <path d="M0 5 Q50 1 100 5 T200 4" stroke="#f43f5e" stroke-width="2.5" fill="none" stroke-linecap="round" opacity="0.5"/>
              </svg>
            </span>
          </h2>
          <p class="mt-5 text-lg leading-relaxed text-slate-600">
            Videos sueltos, sin orden, sin feedback, sin meta. La motivación
            se evapora cuando nada te dice cuánto te falta ni qué sigue.
          </p>
        </div>
        <div class="space-y-4" appReveal [appRevealDelay]="120">
          @for (step of solutionSteps; track step.title) {
            <div class="card flex items-start gap-4 p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-brand-200 hover:shadow-lift">
              <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-glow" [style.background]="step.bg">
                <app-icon [name]="step.icon" [size]="20" />
              </span>
              <div>
                <h3 class="font-heading font-bold text-slate-900">{{ step.title }}</h3>
                <p class="mt-1 text-sm leading-relaxed text-slate-600">{{ step.text }}</p>
              </div>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ═══════════ FEATURES ═══════════ -->
    <section class="border-y border-slate-200 bg-white py-20">
      <div class="mx-auto max-w-7xl px-4 sm:px-6">
        <div class="mx-auto max-w-2xl text-center" appReveal>
          <p class="eyebrow">Por qué Manakō</p>
          <h2 class="mt-4 font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
            Todo lo que necesitas para <span class="text-gradient">terminar</span> lo que empiezas
          </h2>
        </div>
        <div class="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          @for (feature of features; track feature.title; let i = $index) {
            <div class="gradient-border group p-6" appReveal [appRevealDelay]="i * 80">
              <span class="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3">
                <app-icon [name]="feature.icon" [size]="22" />
              </span>
              <h3 class="mt-5 font-heading text-lg font-bold text-slate-900">{{ feature.title }}</h3>
              <p class="mt-2 text-sm leading-relaxed text-slate-600">{{ feature.text }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- ═══════════ CATEGORÍAS ═══════════ -->
    @if (categories().length > 0) {
      <section class="mx-auto max-w-7xl px-4 py-16 sm:px-6" appReveal>
        <h2 class="font-heading text-xl font-bold text-slate-900">Explora por categoría</h2>
        <div class="mt-5 flex flex-wrap gap-2.5">
          @for (cat of categories(); track cat.id) {
            <a [routerLink]="['/cursos']" [queryParams]="{ categoria: cat.slug }" class="chip group">
              <app-icon name="sparkles" [size]="14" />
              {{ cat.name }}
              <span class="text-slate-300 transition-transform duration-200 group-hover:translate-x-0.5">→</span>
            </a>
          }
        </div>
      </section>
    }

    <!-- ═══════════ DESTACADOS (evidencia) ═══════════ -->
    <section class="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
      <div class="mb-8 flex items-end justify-between gap-4" appReveal>
        <div>
          <p class="eyebrow">Empieza hoy</p>
          <h2 class="mt-4 font-heading text-3xl font-bold text-slate-900">Cursos destacados</h2>
        </div>
        <a routerLink="/cursos" class="group hidden items-center gap-1.5 text-sm font-bold text-brand-700 transition hover:text-violet-600 sm:flex">
          Ver todo el catálogo
          <app-icon name="arrow-right" [size]="16" />
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
            <div appReveal [appRevealDelay]="i * 70" class="h-full">
              <app-course-card [course]="course" />
            </div>
          } @empty {
            <div class="card col-span-full p-14 text-center">
              <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
                <app-icon name="book" [size]="26" />
              </span>
              <h3 class="mt-4 font-heading text-lg font-bold text-slate-900">Aún no hay cursos publicados</h3>
              <p class="mt-1 text-sm text-slate-500">Estamos cocinando contenido increíble. Vuelve pronto.</p>
            </div>
          }
        </div>
      }
    </section>

    <!-- ═══════════ CTA INSTRUCTORES (clímax) ═══════════ -->
    <section class="mx-auto max-w-7xl px-4 pb-24 sm:px-6" appReveal>
      <div class="relative overflow-hidden rounded-3xl bg-slate-950 px-6 py-16 text-center sm:px-16">
        <div class="absolute inset-0 bg-mesh-hero opacity-80" aria-hidden="true"></div>
        <div class="absolute -left-20 -top-20 h-72 w-72 animate-blob rounded-full bg-violet-600/30 blur-3xl" aria-hidden="true"></div>
        <div class="absolute -bottom-24 -right-16 h-72 w-72 animate-blob rounded-full bg-brand-500/30 blur-3xl [animation-delay:-6s]" aria-hidden="true"></div>

        <div class="relative">
          <p class="eyebrow border-white/15 bg-white/10 text-brand-200 backdrop-blur">Para expertos</p>
          <h2 class="mx-auto mt-5 max-w-2xl font-heading text-3xl font-bold leading-tight text-white sm:text-5xl">
            Convierte tu conocimiento en
            <span class="bg-gradient-to-r from-brand-300 via-violet-300 to-fuchsia-300 bg-clip-text text-transparent">ingresos recurrentes</span>
          </h2>
          <p class="mx-auto mt-5 max-w-xl text-lg text-slate-300">
            Publica tus cursos, sigue la retención de tus alumnos en tiempo real
            y recibe pagos automáticamente. Tú enseñas; Manakō se encarga del resto.
          </p>
          <div class="mt-9 flex flex-wrap justify-center gap-3">
            <a routerLink="/instructor" class="btn-primary btn-lg">
              Convertirme en instructor <app-icon name="arrow-right" [size]="18" />
            </a>
            <a routerLink="/legal/instructores" class="btn btn-lg border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20">
              Ver el acuerdo
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
  protected readonly courseCount = signal(0);

  protected readonly marqueeItems = [...TECH_MARQUEE, ...TECH_MARQUEE]; // duplicado para loop infinito
  protected readonly features = FEATURES;

  protected readonly solutionSteps = [
    {
      icon: 'list',
      bg: 'linear-gradient(135deg,#4f46e5,#7c3aed)',
      title: 'Ruta clara, paso a paso',
      text: 'Módulos ordenados con lecciones cortas. Siempre sabes qué sigue y cuánto te falta.',
    },
    {
      icon: 'chart-bar',
      bg: 'linear-gradient(135deg,#0ea5e9,#4f46e5)',
      title: 'Feedback constante',
      text: 'Tu progreso se sincroniza segundo a segundo y ves tu porcentaje crecer en cada sesión.',
    },
    {
      icon: 'award',
      bg: 'linear-gradient(135deg,#d946ef,#7c3aed)',
      title: 'Meta a la vista',
      text: 'El certificado te espera al final — una razón concreta para no soltar el curso a medias.',
    },
  ];

  constructor() {
    this.catalog
      .getFeatured(8)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (courses) => {
          this.featured.set(courses);
          this.courseCount.set(courses.length);
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
