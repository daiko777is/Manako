import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { CourseDetail } from '@manako/shared';
import { CourseService } from '../../core/course/course.service';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../core/toast/toast.service';
import { formatDuration, formatMoney, levelLabel } from '../../shared/format';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (course(); as c) {
      <div class="bg-slate-900 text-white">
        <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px]">
          <!-- Columna principal -->
          <div>
            <nav class="mb-4 text-sm text-slate-400" aria-label="Miga de pan">
              <a routerLink="/" class="hover:text-white">Inicio</a> ·
              <a routerLink="/cursos" class="hover:text-white">Cursos</a>
              @if (c.category) { · <a [routerLink]="['/cursos']" [queryParams]="{ categoria: c.category.slug }" class="hover:text-white">{{ c.category.name }}</a> }
            </nav>
            <h1 class="text-3xl font-bold leading-tight sm:text-4xl">{{ c.title }}</h1>
            @if (c.subtitle) {
              <p class="mt-3 max-w-2xl text-lg text-slate-300">{{ c.subtitle }}</p>
            }
            <div class="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-300">
              <span class="badge bg-slate-700 text-slate-200">{{ levelLabel(c.level) }}</span>
              <span>{{ c.lessonsCount }} lecciones · {{ duration(c.totalSeconds) }}</span>
              <span>{{ c.totalEnrollments }} estudiante(s)</span>
              @if (c.reviewsCount > 0) {
                <span>⭐ {{ c.avgRating.toFixed(1) }} ({{ c.reviewsCount }})</span>
              }
            </div>
            @if (c.instructor) {
              <p class="mt-4 text-sm text-slate-300">
                Por <span class="font-semibold text-white">{{ c.instructor.fullName }}</span>
              </p>
            }
            @if (c.viewer?.enrolled) {
              <div class="mt-6 max-w-md rounded-xl bg-slate-800 p-4">
                <div class="flex items-center justify-between text-sm">
                  <span class="text-slate-300">Tu progreso</span>
                  <span class="font-semibold">{{ c.viewer?.progressPercent }}%</span>
                </div>
                <div class="mt-2 h-2 rounded-full bg-slate-700">
                  <div class="h-2 rounded-full bg-brand-500" [style.width.%]="c.viewer?.progressPercent ?? 0"></div>
                </div>
              </div>
            }
          </div>

          <!-- Tarjeta de compra -->
          <aside class="card h-fit p-6 text-slate-900 shadow-2xl lg:sticky lg:top-24">
            <div class="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-brand-600 to-brand-800">
              @if (c.thumbnailUrl) {
                <img [src]="c.thumbnailUrl" [alt]="'Portada de ' + c.title" class="h-full w-full object-cover" />
              } @else {
                <span class="text-4xl text-white/80">🎬</span>
              }
            </div>

            <p class="mt-4 text-3xl font-extrabold">{{ money(c.priceCents, c.currency) }}</p>

            <div class="mt-4 space-y-2">
              @if (busy()) {
                <button type="button" class="btn-primary w-full" disabled>Procesando…</button>
              } @else if (c.viewer?.enrolled || c.viewer?.isOwner || c.viewer?.isAdmin) {
                <a [routerLink]="['/aprender', c.id, c.viewer?.nextLessonId ?? '']" class="btn-primary w-full">
                  {{ (c.viewer?.progressPercent ?? 0) > 0 ? 'Continuar curso' : 'Empezar curso' }} →
                </a>
              } @else if (!auth.isAuthenticated()) {
                <a [routerLink]="['/login']" [queryParams]="{ returnUrl: '/cursos/' + c.slug }" class="btn-primary w-full">
                  Inicia sesión para inscribirte
                </a>
              } @else if (c.priceCents === 0) {
                <button type="button" class="btn-primary w-full" (click)="enrollFree(c.id)">
                  Inscribirme gratis
                </button>
              } @else {
                <button type="button" class="btn-primary w-full" (click)="checkout(c.id)">
                  Comprar e inscribirme
                </button>
              }
            </div>

            <ul class="mt-6 space-y-2 text-sm text-slate-600">
              <li>✓ Acceso de por vida tras la compra</li>
              <li>✓ Progreso sincronizado en todos tus dispositivos</li>
              <li>✓ Lecciones de muestra gratis antes de comprar</li>
              <li>✓ Reembolso según <a routerLink="/legal/reembolsos" class="text-brand-700 underline">política</a></li>
            </ul>
          </aside>
        </div>
      </div>

      <!-- Descripción + currículo -->
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1fr_360px]">
        <div class="order-2 lg:order-1">
          <h2 class="text-xl font-bold text-slate-900">Sobre este curso</h2>
          <p class="mt-3 whitespace-pre-line leading-relaxed text-slate-600">{{ c.description }}</p>

          <h2 class="mt-10 text-xl font-bold text-slate-900">Currículo</h2>
          <p class="mt-1 text-sm text-slate-500">
            Las lecciones se desbloquean secuencialmente al completar las anteriores.
            Las marcadas como <span class="badge-green">muestra</span> son gratis.
          </p>
          <div class="mt-4 space-y-3">
            @for (mod of c.modules; track mod.id) {
              <section class="card overflow-hidden">
                <header class="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                  <h3 class="font-semibold text-slate-800">{{ mod.title }}</h3>
                  <span class="text-xs text-slate-500">{{ mod.lessons.length }} lecciones</span>
                </header>
                <ul class="divide-y divide-slate-100">
                  @for (lesson of mod.lessons; track lesson.id) {
                    <li class="flex items-center gap-3 px-4 py-3 text-sm">
                      <span class="text-slate-400" aria-hidden="true">
                        {{ lesson.isPreview || lesson.unlocked ? '▶' : '🔒' }}
                      </span>
                      <span class="flex-1" [class.text-slate-400]="!lesson.isPreview && !lesson.unlocked">
                        {{ lesson.title }}
                        @if (lesson.isPreview) {
                          <span class="badge-green ml-2">muestra</span>
                        }
                      </span>
                      <span class="text-xs text-slate-500">{{ clock(lesson.durationSeconds) }}</span>
                      @if (lesson.isPreview || lesson.unlocked) {
                        <a [routerLink]="['/aprender', c.id, lesson.id]" class="btn-ghost btn-sm">Ver</a>
                      }
                    </li>
                  }
                </ul>
              </section>
            }
          </div>
        </div>

        <!-- Instructor -->
        <aside class="order-1 lg:order-2">
          @if (c.instructor) {
            <div class="card p-6">
              <h2 class="font-bold text-slate-900">Instructor</h2>
              <div class="mt-4 flex items-center gap-3">
                <span class="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700">
                  {{ (c.instructor.fullName ?? '?').slice(0, 2).toUpperCase() }}
                </span>
                <div>
                  <p class="font-semibold text-slate-900">{{ c.instructor.fullName }}</p>
                  @if (c.instructor.headline) {
                    <p class="text-xs text-slate-500">{{ c.instructor.headline }}</p>
                  }
                </div>
              </div>
              @if (c.instructor.bio) {
                <p class="mt-4 text-sm leading-relaxed text-slate-600">{{ c.instructor.bio }}</p>
              }
            </div>
          }
        </aside>
      </div>
    } @else if (notFound()) {
      <div class="mx-auto max-w-3xl px-4 py-24 text-center">
        <p class="text-5xl">😕</p>
        <h1 class="mt-4 text-2xl font-bold text-slate-900">Curso no encontrado</h1>
        <a routerLink="/cursos" class="btn-primary mt-6 inline-flex">Volver al catálogo</a>
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

  protected readonly duration = formatDuration;
  protected readonly clock = (s: number) => formatDuration(s);
  protected readonly money = formatMoney;
  protected readonly levelLabel = levelLabel;

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.courses
      .getDetailBySlug(slug)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (course) => this.course.set(course),
        error: () => this.notFound.set(true),
      });
  }

  protected enrollFree(courseId: string): void {
    this.busy.set(true);
    this.courses.checkout(courseId).pipe(takeUntilDestroyed()).subscribe({
      next: (res) => {
        this.busy.set(false);
        if (res.enrolled) {
          this.toast.success('¡Te has inscrito! Empieza cuando quieras 🎉');
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
