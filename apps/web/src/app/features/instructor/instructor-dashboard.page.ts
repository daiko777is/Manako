import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { Category, InstructorCourseRow } from '@manako/shared';
import type { InstructorAnalytics } from '@manako/shared';
import { InstructorService } from '../../core/instructor/instructor.service';
import { CatalogService } from '../../core/catalog/catalog.service';
import { ToastService } from '../../core/toast/toast.service';
import { AuthService } from '../../core/auth/auth.service';
import { formatDate, formatDuration, formatMoney, levelLabel, statusLabel } from '../../shared/format';
import { IconComponent } from '../../shared/components/icon.component';
import { RevealDirective } from '../../shared/components/reveal.directive';

@Component({
  selector: 'app-instructor-dashboard',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, IconComponent, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header class="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p class="eyebrow"><app-icon name="presentation" [size]="13" /> Panel de instructor</p>
          <h1 class="mt-3 font-heading text-3xl font-bold text-slate-900">Tus cursos</h1>
          <p class="mt-1.5 text-slate-500">Gestiona tu contenido, publica y sigue tus ingresos.</p>
        </div>
        <button type="button" class="btn-primary" (click)="showCreate.set(true)">
          <app-icon name="plus" [size]="16" /> Nuevo curso
        </button>
      </header>

      @if (courses(); as list) {
        <div class="space-y-4">
          @for (course of list; track course.id) {
            <article class="card p-5">
              <div class="flex flex-wrap items-start justify-between gap-4">
                <div class="min-w-0">
                  <div class="flex flex-wrap items-center gap-2">
                    <h2 class="truncate text-lg font-semibold text-slate-900">
                      <a [routerLink]="['/instructor/cursos', course.id]" class="hover:text-brand-700">
                        {{ course.title }}
                      </a>
                    </h2>
                    <span
                      [class]="
                        course.status === 'published'
                          ? 'badge-green'
                          : course.status === 'draft'
                            ? 'badge-amber'
                            : 'badge-slate'
                      "
                    >
                      {{ statusLabel(course.status) }}
                    </span>
                  </div>
                  <p class="mt-1 text-sm text-slate-500">
                    {{ course.modulesCount }} módulo(s) · {{ levelLabel(course.level) }} ·
                    {{ formatMoney(course.priceCents, course.currency) }} ·
                    publicado {{ formatDate(course.publishedAt) }}
                  </p>
                </div>

                <dl class="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <dt class="text-xs text-slate-400">Inscritos</dt>
                    <dd class="text-lg font-bold text-slate-900">{{ course.totalEnrollments }}</dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-400">Ingresos</dt>
                    <dd class="text-lg font-bold text-slate-900">
                      {{ formatMoney(course.revenueCents, course.currency) }}
                    </dd>
                  </div>
                  <div>
                    <dt class="text-xs text-slate-400">Rating</dt>
                    <dd class="text-lg font-bold text-slate-900">
                      {{ course.reviewsCount > 0 ? course.avgRating.toFixed(1) + ' ⭐' : '—' }}
                    </dd>
                  </div>
                </dl>
              </div>

              <div class="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                <a [routerLink]="['/instructor/cursos', course.id]" class="btn-secondary btn-sm">
                  <app-icon name="pencil" [size]="14" /> Editar currículo
                </a>
                <button type="button" class="btn-secondary btn-sm" (click)="loadAnalytics(course.id)">
                  <app-icon name="chart-bar" [size]="14" /> Analíticas
                </button>
                <a [routerLink]="['/cursos', course.slug]" class="btn-ghost btn-sm" target="_blank">
                  <app-icon name="eye" [size]="14" /> Ver como alumno
                </a>
                @if (course.status !== 'archived') {
                  <button type="button" class="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" (click)="archive(course.id)">
                    <app-icon name="lock" [size]="14" /> Archivar
                  </button>
                }
              </div>
            </article>
          } @empty {
            <div class="card p-16 text-center">
              <span class="mx-auto flex h-20 w-20 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-500">
                <app-icon name="film" [size]="36" />
              </span>
              <h2 class="mt-6 font-heading text-xl font-bold text-slate-900">Crea tu primer curso</h2>
              <p class="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-slate-500">
                Sube videos organizados en módulos, publica y empieza a recibir alumnos.
              </p>
              <button type="button" class="btn-primary mt-7" (click)="showCreate.set(true)">
                <app-icon name="plus" [size]="16" /> Nuevo curso
              </button>
            </div>
          }
        </div>
      }

      <!-- Analíticas -->
      @if (analytics(); as a) {
        <section class="card mt-10 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">Analíticas del curso</h2>
            <button type="button" class="btn-ghost btn-sm" (click)="analytics.set(null)">Cerrar ✕</button>
          </div>
          <dl class="mt-4 grid gap-4 sm:grid-cols-4">
            <div class="rounded-lg bg-slate-50 p-4">
              <dt class="text-xs text-slate-500">Inscripciones activas</dt>
              <dd class="mt-1 text-2xl font-bold text-slate-900">{{ a.enrollments }}</dd>
            </div>
            <div class="rounded-lg bg-slate-50 p-4">
              <dt class="text-xs text-slate-500">Ingresos brutos</dt>
              <dd class="mt-1 text-2xl font-bold text-slate-900">{{ formatMoney(a.revenueCents) }}</dd>
            </div>
            <div class="rounded-lg bg-slate-50 p-4">
              <dt class="text-xs text-slate-500">Progreso medio</dt>
              <dd class="mt-1 text-2xl font-bold text-slate-900">{{ a.avgProgressPercent }}%</dd>
            </div>
            <div class="rounded-lg bg-slate-50 p-4">
              <dt class="text-xs text-slate-500">Minutos vistos</dt>
              <dd class="mt-1 text-2xl font-bold text-slate-900">{{ a.totalWatchedMinutes }}</dd>
            </div>
          </dl>

          <h3 class="mt-6 text-sm font-semibold text-slate-700">Retención por lección</h3>
          <div class="mt-3 space-y-2">
            @for (row of a.retention; track row.lessonId) {
              <div class="flex items-center gap-3 text-sm">
                <span class="w-64 truncate text-slate-600">{{ row.title }}</span>
                <div class="h-2.5 flex-1 rounded-full bg-slate-100">
                  <div
                    class="h-2.5 rounded-full"
                    [class]="row.retentionPercent >= 60 ? 'bg-emerald-500' : row.retentionPercent >= 30 ? 'bg-amber-400' : 'bg-rose-400'"
                    [style.width.%]="row.retentionPercent"
                  ></div>
                </div>
                <span class="w-10 text-right text-xs text-slate-500">{{ row.retentionPercent }}%</span>
                <span class="w-24 text-right text-xs text-slate-400">
                  {{ formatDuration(row.avgWatchedSeconds) }} prom.
                </span>
              </div>
            }
          </div>
        </section>
      }
    </div>

    <!-- Modal crear curso -->
    @if (showCreate()) {
      <div class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true">
        <form [formGroup]="createForm" (ngSubmit)="create()" class="card w-full max-w-lg space-y-4 p-6">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-bold text-slate-900">Nuevo curso</h2>
            <button type="button" class="btn-ghost btn-sm" (click)="showCreate.set(false)">✕</button>
          </div>

          <div>
            <label for="c-title" class="label">Título *</label>
            <input id="c-title" class="input" formControlName="title" placeholder="Ej.: Angular 18 desde cero" />
          </div>
          <div>
            <label for="c-subtitle" class="label">Subtítulo</label>
            <input id="c-subtitle" class="input" formControlName="subtitle" placeholder="Una frase que venda el curso" />
          </div>
          <div class="grid grid-cols-2 gap-4">
            <div>
              <label for="c-price" class="label">Precio (USD)</label>
              <input id="c-price" type="number" min="0" step="0.01" class="input" formControlName="price" />
            </div>
            <div>
              <label for="c-level" class="label">Nivel</label>
              <select id="c-level" class="input" formControlName="level">
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
          </div>
          <div>
            <label for="c-category" class="label">Categoría</label>
            <select id="c-category" class="input" formControlName="categorySlug">
              <option value="">Sin categoría</option>
              @for (cat of categories(); track cat.id) {
                <option [value]="cat.slug">{{ cat.name }}</option>
              }
            </select>
          </div>

          <div class="flex justify-end gap-2 pt-2">
            <button type="button" class="btn-secondary" (click)="showCreate.set(false)">Cancelar</button>
            <button type="submit" class="btn-primary" [disabled]="createForm.invalid || busy()">
              {{ busy() ? 'Creando…' : 'Crear borrador' }}
            </button>
          </div>
        </form>
      </div>
    }
  `,
})
export class InstructorDashboardPage {
  private readonly service = inject(InstructorService);
  private readonly catalog = inject(CatalogService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly courses = signal<InstructorCourseRow[] | null>(null);
  protected readonly categories = signal<Category[]>([]);
  protected readonly analytics = signal<InstructorAnalytics | null>(null);
  protected readonly showCreate = signal(false);
  protected readonly busy = signal(false);

  protected readonly formatMoney = formatMoney;
  protected readonly formatDate = formatDate;
  protected readonly formatDuration = formatDuration;
  protected readonly statusLabel = statusLabel;
  protected readonly levelLabel = levelLabel;

  protected readonly createForm = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.minLength(5)]],
    subtitle: [''],
    price: [0, [Validators.min(0)]],
    level: ['beginner'],
    categorySlug: [''],
  });

  constructor() {
    this.refresh();
    this.catalog.getCategories().pipe(takeUntilDestroyed()).subscribe((c) => this.categories.set(c));
  }

  private refresh(): void {
    this.service
      .listCourses()
      .pipe(takeUntilDestroyed())
      .subscribe((list) => this.courses.set(list));
  }

  protected create(): void {
    if (this.createForm.invalid) return;
    this.busy.set(true);
    const raw = this.createForm.getRawValue();
    this.service
      .createCourse({
        title: raw.title,
        subtitle: raw.subtitle || undefined,
        priceCents: Math.round((raw.price || 0) * 100),
        level: raw.level,
        categorySlug: raw.categorySlug || undefined,
      })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (course) => {
          this.busy.set(false);
          this.showCreate.set(false);
          this.toast.success('Borrador creado. Ahora añade módulos y lecciones.');
          void this.router.navigate(['/instructor/cursos', course.id]);
        },
        error: () => this.busy.set(false),
      });
  }

  protected loadAnalytics(courseId: string): void {
    this.service
      .analytics(courseId)
      .pipe(takeUntilDestroyed())
      .subscribe((a) => this.analytics.set(a));
  }

  protected archive(courseId: string): void {
    if (!confirm('¿Archivar este curso? Dejará de ser visible en el catálogo.')) return;
    this.service
      .archiveCourse(courseId)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.info('Curso archivado');
        this.refresh();
      });
  }
}
