import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { CourseDetail } from '@manako/shared';
import { CourseService } from '../../core/course/course.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { formatDuration, formatMoney, levelLabel } from '../../shared/format';
import { IconComponent } from '../../shared/components/icon.component';
import { ProgressRingComponent } from '../../shared/components/progress-ring.component';
import { RevealDirective } from '../../shared/components/reveal.directive';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [RouterLink, IconComponent, ProgressRingComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (course(); as c) {
      <!-- ═══════ Hero cinematográfico ═══════ -->
      <section class="relative -mt-16 overflow-hidden bg-slate-950 pb-16 pt-28">
        <!-- Portada difuminada como fondo -->
        @if (c.thumbnailUrl) {
          <img [src]="c.thumbnailUrl" alt="" aria-hidden="true"
               class="absolute inset-0 h-full w-full scale-110 object-cover opacity-25 blur-2xl" />
        }
        <div class="absolute inset-0 bg-mesh-hero opacity-70" aria-hidden="true"></div>
        <div class="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent" aria-hidden="true"></div>

        <div class="relative mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-[1fr_380px]">
          <div>
            <nav class="mb-5 flex items-center gap-1.5 text-xs text-slate-400" aria-label="Miga de pan">
              <a routerLink="/" class="transition hover:text-white">Inicio</a>
              <app-icon name="chevron-right" [size]="12" />
              <a routerLink="/cursos" class="transition hover:text-white">Cursos</a>
              @if (c.category) {
                <app-icon name="chevron-right" [size]="12" />
                <a [routerLink]="['/cursos']" [queryParams]="{ categoria: c.category.slug }" class="text-brand-300 transition hover:text-white">
                  {{ c.category.name }}
                </a>
              }
            </nav>

            <div class="flex flex-wrap items-center gap-2">
              <span class="rounded-full bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-brand-200 backdrop-blur">
                {{ levelLabel(c.level) }}
              </span>
              @if (c.priceCents === 0) {
                <span class="rounded-full bg-emerald-500/90 px-3 py-1 text-xs font-bold uppercase tracking-wider text-white">Gratis</span>
              }
              @if (c.reviewsCount > 0) {
                <span class="flex items-center gap-1 rounded-full bg-amber-400/15 px-3 py-1 text-xs font-bold text-amber-300">
                  <app-icon name="star" [size]="12" /> {{ c.avgRating.toFixed(1) }} ({{ c.reviewsCount }})
                </span>
              }
            </div>

            <h1 class="mt-4 max-w-3xl font-heading text-3xl font-bold leading-tight text-white sm:text-5xl">
              {{ c.title }}
            </h1>
            @if (c.subtitle) {
              <p class="mt-4 max-w-2xl text-lg leading-relaxed text-slate-300">{{ c.subtitle }}</p>
            }

            <div class="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-300">
              <span class="flex items-center gap-1.5"><app-icon name="film" [size]="15" /> {{ c.lessonsCount }} lecciones</span>
              <span class="flex items-center gap-1.5"><app-icon name="clock" [size]="15" /> {{ duration(c.totalSeconds) }}</span>
              <span class="flex items-center gap-1.5"><app-icon name="users" [size]="15" /> {{ c.totalEnrollments }} estudiantes</span>
              @if (c.instructor) {
                <span class="flex items-center gap-2">
                  <span class="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-[10px] font-bold text-white">
                    {{ (c.instructor.fullName ?? '?').slice(0, 2).toUpperCase() }}
                  </span>
                  {{ c.instructor.fullName }}
                </span>
              }
            </div>

            @if (c.viewer?.enrolled) {
              <div class="glass-dark mt-8 inline-flex max-w-md items-center gap-4 rounded-2xl p-4">
                <app-progress-ring [percent]="c.viewer?.progressPercent ?? 0" [size]="56" trackColor="rgba(255,255,255,0.12)" valueClass="!text-white" />
                <div>
                  <p class="text-sm font-semibold text-white">
                    {{ (c.viewer?.progressPercent ?? 0) === 100 ? '¡Curso completado! 🎓' : 'Continúa donde lo dejaste' }}
                  </p>
                  <p class="mt-0.5 text-xs text-slate-400">
                    {{ c.viewer?.completedLessons }} de {{ totalLessons(c) }} lecciones completadas
                  </p>
                </div>
              </div>
            }
          </div>

          <!-- ═══════ Tarjeta de compra (glass, sticky) ═══════ -->
          <aside class="h-fit lg:sticky lg:top-24">
            <div class="glass-dark overflow-hidden rounded-3xl p-2">
              <div class="relative flex aspect-video items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600">
                @if (c.thumbnailUrl) {
                  <img [src]="c.thumbnailUrl" [alt]="'Portada de ' + c.title" class="h-full w-full object-cover" />
                } @else {
                  <div class="absolute inset-0 bg-grid-fade bg-grid opacity-30" aria-hidden="true"></div>
                  <app-icon name="film" [size]="44" />
                }
                <span class="absolute inset-0 flex items-center justify-center bg-slate-950/30 opacity-0 transition-opacity duration-300 hover:opacity-100">
                  <span class="flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-brand-700 shadow-glow">
                    <app-icon name="play" [size]="24" />
                  </span>
                </span>
              </div>

              <div class="p-5">
                <div class="flex items-baseline gap-2">
                  <p class="font-heading text-4xl font-bold text-white">{{ money(c.priceCents, c.currency) }}</p>
                  @if (c.priceCents > 0) {
                    <p class="text-xs text-slate-400">pago único · acceso de por vida</p>
                  }
                </div>

                <div class="mt-5 space-y-2.5">
                  @if (busy()) {
                    <button type="button" class="btn-primary w-full btn-lg" disabled>
                      <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                      Procesando…
                    </button>
                  } @else if (c.viewer?.enrolled || c.viewer?.isOwner || c.viewer?.isAdmin) {
                    <a [routerLink]="['/aprender', c.id, c.viewer?.nextLessonId ?? '']" class="btn-primary w-full btn-lg">
                      {{ (c.viewer?.progressPercent ?? 0) > 0 ? 'Continuar curso' : 'Empezar curso' }}
                      <app-icon name="arrow-right" [size]="17" />
                    </a>
                  } @else if (!auth.isAuthenticated()) {
                    <a [routerLink]="['/login']" [queryParams]="{ returnUrl: '/cursos/' + c.slug }" class="btn-primary w-full btn-lg">
                      Inicia sesión para inscribirte
                    </a>
                  } @else if (c.priceCents === 0) {
                    <button type="button" class="btn-primary w-full btn-lg" (click)="enrollFree(c.id)">
                      <app-icon name="bolt" [size]="17" /> Inscribirme gratis
                    </button>
                  } @else {
                    <button type="button" class="btn-primary w-full btn-lg" (click)="checkout(c.id)">
                      <app-icon name="credit-card" [size]="17" /> Comprar ahora
                    </button>
                  }
                </div>

                <ul class="mt-6 space-y-2.5 border-t border-white/10 pt-5 text-sm text-slate-300">
                  <li class="flex items-center gap-2.5"><span class="text-emerald-400"><app-icon name="check-circle" [size]="16" /></span> Acceso de por vida tras la compra</li>
                  <li class="flex items-center gap-2.5"><span class="text-emerald-400"><app-icon name="check-circle" [size]="16" /></span> Progreso sincronizado en todos tus dispositivos</li>
                  <li class="flex items-center gap-2.5"><span class="text-emerald-400"><app-icon name="check-circle" [size]="16" /></span> Lecciones de muestra gratis antes de comprar</li>
                  <li class="flex items-center gap-2.5">
                    <span class="text-emerald-400"><app-icon name="check-circle" [size]="16" /></span>
                    Reembolso según <a routerLink="/legal/reembolsos" class="text-brand-300 underline decoration-dotted underline-offset-2 transition hover:text-white">política</a>
                  </li>
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <!-- ═══════ Descripción + Currículo ═══════ -->
      <div class="mx-auto grid max-w-7xl gap-12 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_340px]">
        <div class="order-2 lg:order-1">
          <section appReveal>
            <h2 class="font-heading text-2xl font-bold text-slate-900">Sobre este curso</h2>
            <p class="mt-4 whitespace-pre-line leading-relaxed text-slate-600">{{ c.description }}</p>
          </section>

          <section class="mt-12" appReveal>
            <div class="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 class="font-heading text-2xl font-bold text-slate-900">Currículo</h2>
                <p class="mt-1.5 flex items-center gap-1.5 text-sm text-slate-500">
                  <app-icon name="lock" [size]="14" />
                  Desbloqueo secuencial: completa cada lección para abrir la siguiente
                </p>
              </div>
              <button type="button" class="btn-ghost btn-sm" (click)="toggleAll(c)">
                {{ allExpanded() ? 'Contraer todo' : 'Expandir todo' }}
              </button>
            </div>

            <div class="mt-5 space-y-3">
              @for (mod of c.modules; track mod.id) {
                <div class="card overflow-hidden transition-shadow duration-300 hover:shadow-lift">
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 bg-gradient-to-r from-slate-50 to-white px-5 py-4 text-left transition hover:from-brand-50/60"
                    (click)="toggleModule(mod.id)"
                    [attr.aria-expanded]="expanded()[mod.id] ?? false"
                  >
                    <span class="flex items-center gap-3">
                      <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white shadow-glow">
                        {{ mod.orderIndex + 1 }}
                      </span>
                      <span>
                        <span class="block font-heading font-bold text-slate-900">{{ mod.title }}</span>
                        <span class="mt-0.5 block text-xs text-slate-500">
                          {{ mod.lessons.length }} lecciones · {{ duration(moduleSeconds(mod.lessons)) }}
                        </span>
                      </span>
                    </span>
                    <span class="text-slate-400 transition-transform duration-300" [class.rotate-180]="expanded()[mod.id]">
                      <app-icon name="chevron-down" [size]="18" />
                    </span>
                  </button>

                  @if (expanded()[mod.id]) {
                    <ul class="divide-y divide-slate-100 border-t border-slate-100">
                      @for (lesson of mod.lessons; track lesson.id) {
                        <li class="group flex items-center gap-3 px-5 py-3.5 text-sm transition-colors hover:bg-brand-50/40">
                          @if (lesson.isPreview || lesson.unlocked) {
                            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600 transition-transform duration-200 group-hover:scale-110">
                              <app-icon name="play" [size]="14" />
                            </span>
                          } @else {
                            <span class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                              <app-icon name="lock" [size]="14" />
                            </span>
                          }
                          <span class="flex-1" [class.text-slate-400]="!lesson.isPreview && !lesson.unlocked">
                            {{ lesson.title }}
                            @if (lesson.isPreview) {
                              <span class="badge-green ml-2 !text-[10px]">muestra gratis</span>
                            }
                          </span>
                          <span class="flex items-center gap-1 text-xs text-slate-400">
                            <app-icon name="clock" [size]="12" /> {{ clock(lesson.durationSeconds) }}
                          </span>
                          @if (lesson.isPreview || lesson.unlocked) {
                            <a [routerLink]="['/aprender', c.id, lesson.id]" class="btn-ghost btn-sm opacity-0 transition-opacity group-hover:opacity-100">
                              Ver <app-icon name="arrow-right" [size]="12" />
                            </a>
                          }
                        </li>
                      }
                    </ul>
                  }
                </div>
              }
            </div>
          </section>
        </div>

        <!-- ═══════ Instructor ═══════ -->
        <aside class="order-1 lg:order-2" appReveal>
          @if (c.instructor) {
            <div class="card overflow-hidden lg:sticky lg:top-24">
              <div class="h-20 bg-gradient-to-r from-brand-600 via-violet-600 to-fuchsia-500"></div>
              <div class="-mt-9 px-6 pb-6">
                <span class="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 font-heading text-xl font-bold text-white shadow-glow ring-4 ring-white">
                  {{ (c.instructor.fullName ?? '?').slice(0, 2).toUpperCase() }}
                </span>
                <h3 class="mt-3 font-heading text-lg font-bold text-slate-900">{{ c.instructor.fullName }}</h3>
                @if (c.instructor.headline) {
                  <p class="mt-1 text-xs font-medium text-brand-600">{{ c.instructor.headline }}</p>
                }
                @if (c.instructor.bio) {
                  <p class="mt-3 text-sm leading-relaxed text-slate-600">{{ c.instructor.bio }}</p>
                }
                <div class="mt-4 flex items-center gap-4 border-t border-slate-100 pt-4 text-xs text-slate-500">
                  <span class="flex items-center gap-1.5"><app-icon name="users" [size]="14" /> {{ c.totalEnrollments }} estudiantes</span>
                  @if (c.reviewsCount > 0) {
                    <span class="flex items-center gap-1.5 text-amber-500"><app-icon name="star" [size]="14" /> {{ c.avgRating.toFixed(1) }}</span>
                  }
                </div>
              </div>
            </div>
          }
        </aside>
      </div>
    } @else if (notFound()) {
      <div class="mx-auto max-w-3xl px-4 py-28 text-center">
        <span class="mx-auto flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-500">
          <app-icon name="search" [size]="34" />
        </span>
        <h1 class="mt-6 font-heading text-3xl font-bold text-slate-900">Curso no encontrado</h1>
        <p class="mt-2 text-slate-500">Puede que se haya archivado o que la URL sea incorrecta.</p>
        <a routerLink="/cursos" class="btn-primary mt-8 inline-flex">
          Volver al catálogo <app-icon name="arrow-right" [size]="16" />
        </a>
      </div>
    }
  `,
})
export class CourseDetailPage {
  private readonly courses = inject(CourseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(ToastService);
  protected readonly auth = inject(AuthService);

  protected readonly course = signal<CourseDetail | null>(null);
  protected readonly notFound = signal(false);
  protected readonly busy = signal(false);
  /** Módulos expandidos del acordeón (el primero abre por defecto). */
  protected readonly expanded = signal<Record<string, boolean>>({});

  protected readonly duration = formatDuration;
  protected readonly clock = formatDuration;
  protected readonly money = formatMoney;
  protected readonly levelLabel = levelLabel;

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.courses
      .getDetailBySlug(slug)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (course) => {
          this.course.set(course);
          if (course.modules[0]) {
            this.expanded.set({ [course.modules[0].id]: true });
          }
        },
        error: () => this.notFound.set(true),
      });
  }

  protected moduleSeconds(lessons: { durationSeconds: number }[]): number {
    return lessons.reduce((acc, l) => acc + l.durationSeconds, 0);
  }

  protected totalLessons(c: CourseDetail): number {
    return c.modules.reduce((acc, m) => acc + m.lessons.length, 0);
  }

  protected toggleModule(id: string): void {
    this.expanded.update((map) => ({ ...map, [id]: !map[id] }));
  }

  protected allExpanded(): boolean {
    const c = this.course();
    if (!c) return false;
    return c.modules.every((m) => this.expanded()[m.id]);
  }

  protected toggleAll(c: CourseDetail): void {
    const expand = !this.allExpanded();
    this.expanded.set(Object.fromEntries(c.modules.map((m) => [m.id, expand])));
  }

  protected enrollFree(courseId: string): void {
    this.busy.set(true);
    this.courses.checkout(courseId).pipe(takeUntilDestroyed()).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.enrolled) {
          this.toast.success('¡Te has inscrito! Empieza cuando quieras');
          void this.router.navigate(['/aprender', courseId]);
        }
      },
      error: () => this.busy.set(false),
    });
  }

  /** Curso de pago → redirect a Stripe Checkout (spec §3.6). */
  protected checkout(courseId: string): void {
    this.busy.set(true);
    this.courses.checkout(courseId).pipe(takeUntilDestroyed()).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.url) window.location.href = res.url;
        else if (res.enrolled) void this.router.navigate(['/aprender', courseId]);
      },
      error: () => this.busy.set(false),
    });
  }
}
