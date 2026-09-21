import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, tap } from 'rxjs';
import type { Category, CourseLevel, CourseQuery, CourseSort, CourseSummary } from '@manako/shared';
import { CatalogService } from '../../core/catalog/catalog.service';
import { CourseCardComponent } from '../../shared/components/course-card.component';

interface Filters {
  search: string;
  category: string;
  level: string;
  price: string; // '' | 'free' | 'paid'
  sort: CourseSort;
}

/**
 * Catálogo con búsqueda, filtros y orden (spec §1 módulo 2).
 * Patrón reactivo: signals para el estado del filtro + RxJS
 * (debounceTime + switchMap) para las peticiones — exactamente el enfoque
 * combinado que recomienda la especificación (§3.1).
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, CourseCardComponent, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header class="mb-8">
        <h1 class="text-3xl font-bold text-slate-900">Catálogo de cursos</h1>
        <p class="mt-1 text-slate-500">Encuentra tu próximo curso y aprende a tu ritmo</p>
      </header>

      <div class="grid gap-8 lg:grid-cols-[260px_1fr]">
        <!-- Filtros -->
        <aside class="space-y-6" aria-label="Filtros del catálogo">
          <div>
            <label for="search" class="label">Buscar</label>
            <input
              id="search"
              type="search"
              class="input"
              placeholder="Angular, NestJS, diseño…"
              [formControl]="searchControl"
            />
          </div>

          <fieldset>
            <legend class="label">Categoría</legend>
            <div class="space-y-1.5">
              <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                <input type="radio" name="cat" value="" [checked]="filters().category === ''"
                       (change)="patch({ category: '' })" class="accent-brand-600" />
                Todas
              </label>
              @for (cat of categories(); track cat.id) {
                <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="radio" name="cat" [value]="cat.slug"
                         [checked]="filters().category === cat.slug"
                         (change)="patch({ category: cat.slug })" class="accent-brand-600" />
                  {{ cat.name }}
                </label>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend class="label">Nivel</legend>
            <div class="space-y-1.5">
              @for (lvl of levels; track lvl.value) {
                <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="radio" name="level" [value]="lvl.value"
                         [checked]="filters().level === lvl.value"
                         (change)="patch({ level: lvl.value })" class="accent-brand-600" />
                  {{ lvl.label }}
                </label>
              }
            </div>
          </fieldset>

          <fieldset>
            <legend class="label">Precio</legend>
            <div class="space-y-1.5">
              @for (p of prices; track p.value) {
                <label class="flex cursor-pointer items-center gap-2 text-sm text-slate-600">
                  <input type="radio" name="price" [value]="p.value"
                         [checked]="filters().price === p.value"
                         (change)="patch({ price: p.value })" class="accent-brand-600" />
                  {{ p.label }}
                </label>
              }
            </div>
          </fieldset>

          <button type="button" class="btn-ghost btn-sm w-full" (click)="reset()">Limpiar filtros</button>
        </aside>

        <!-- Resultados -->
        <section>
          <div class="mb-4 flex items-center justify-between gap-4">
            <p class="text-sm text-slate-500" aria-live="polite">
              @if (loading()) {
                Buscando…
              } @else {
                {{ courses().length }} curso(s){{ nextCursor() ? '+' : '' }}
              }
            </p>
            <label class="flex items-center gap-2 text-sm text-slate-600">
              Ordenar por
              <select class="input w-44 py-1.5" [value]="filters().sort" (change)="onSortChange($event)">
                <option value="popular">Más populares</option>
                <option value="rating">Mejor valorados</option>
                <option value="newest">Más recientes</option>
                <option value="price_asc">Precio: menor a mayor</option>
                <option value="price_desc">Precio: mayor a menor</option>
              </select>
            </label>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            @for (course of courses(); track course.id) {
              <app-course-card [course]="course" />
            } @empty {
              @if (!loading()) {
                <div class="card col-span-full p-12 text-center">
                  <p class="text-4xl">🔎</p>
                  <p class="mt-3 font-medium text-slate-700">Sin resultados con esos filtros</p>
                  <p class="mt-1 text-sm text-slate-500">Prueba a limpiar la búsqueda o cambia de categoría.</p>
                </div>
              }
            }
          </div>

          @if (nextCursor()) {
            <div class="mt-8 text-center">
              <button type="button" class="btn-secondary" [disabled]="loading()" (click)="loadMore()">
                Cargar más cursos
              </button>
            </div>
          }
        </section>
      </div>
    </div>
  `,
})
export class CatalogPage {
  private readonly catalog = inject(CatalogService);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly searchControl = this.fb.nonNullable.control('');
  protected readonly levels = [
    { value: '', label: 'Todos' },
    { value: 'beginner', label: 'Principiante' },
    { value: 'intermediate', label: 'Intermedio' },
    { value: 'advanced', label: 'Avanzado' },
  ];
  protected readonly prices = [
    { value: '', label: 'Todos' },
    { value: 'free', label: 'Gratis' },
    { value: 'paid', label: 'De pago' },
  ];

  protected readonly filters = signal<Filters>({
    search: '',
    category: this.route.snapshot.queryParamMap.get('categoria') ?? '',
    level: '',
    price: '',
    sort: 'popular',
  });

  protected readonly categories = signal<Category[]>([]);
  protected readonly courses = signal<CourseSummary[]>([]);
  protected readonly nextCursor = signal<string | null>(null);
  protected readonly loading = signal(true);

  private readonly params = computed<CourseQuery>(() => {
    const f = this.filters();
    return {
      search: f.search || undefined,
      category: f.category || undefined,
      level: (f.level || undefined) as CourseLevel | undefined,
      minPrice: f.price === 'paid' ? 1 : undefined,
      maxPrice: f.price === 'free' ? 0 : undefined,
      sort: f.sort,
      limit: 12,
    };
  });

  constructor() {
    this.catalog.getCategories().pipe(takeUntilDestroyed()).subscribe((c) => this.categories.set(c));

    // Búsqueda con debounce (300 ms) → signal de filtros
    this.searchControl.valueChanges
      .pipe(debounceTime(300), takeUntilDestroyed())
      .subscribe((value) => this.patch({ search: value }));

    // Cada cambio de filtros relanza la consulta (switchMap cancela la anterior)
    toObservable(this.params)
      .pipe(
        tap(() => this.loading.set(true)),
        debounceTime(150),
        switchMap((params) => this.catalog.getCourses(params)),
        takeUntilDestroyed(),
      )
      .subscribe({
        next: (page) => {
          this.courses.set(page.data);
          this.nextCursor.set(page.nextCursor);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  protected patch(delta: Partial<Filters>): void {
    this.filters.update((f) => ({ ...f, ...delta }));
  }

  protected onSortChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as CourseSort;
    this.patch({ sort: value });
  }

  protected reset(): void {
    this.searchControl.setValue('', { emitEvent: false });
    this.filters.set({ search: '', category: '', level: '', price: '', sort: 'popular' });
  }

  protected loadMore(): void {
    const cursor = this.nextCursor();
    if (!cursor) return;
    this.loading.set(true);
    this.catalog
      .getCourses({ ...this.params(), cursor })
      .pipe(takeUntilDestroyed())
      .subscribe((page) => {
        this.courses.update((list) => [...list, ...page.data]);
        this.nextCursor.set(page.nextCursor);
        this.loading.set(false);
      });
  }
}
