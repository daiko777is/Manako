import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toObservable, takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap, tap } from 'rxjs';
import type { Category, CourseLevel, CourseQuery, CourseSort, CourseSummary } from '@manako/shared';
import { CatalogService } from '../../core/catalog/catalog.service';
import { CourseCardComponent } from '../../shared/components/course-card.component';
import { IconComponent } from '../../shared/components/icon.component';
import { RevealDirective } from '../../shared/components/reveal.directive';

interface Filters {
  search: string;
  category: string;
  level: string;
  price: string; // '' | 'free' | 'paid'
  sort: CourseSort;
}

const SORTS: { value: CourseSort; label: string }[] = [
  { value: 'popular', label: 'Populares' },
  { value: 'rating', label: 'Valorados' },
  { value: 'newest', label: 'Recientes' },
  { value: 'price_asc', label: 'Precio ↑' },
  { value: 'price_desc', label: 'Precio ↓' },
];

/**
 * Catálogo rediseñado: header con wash de gradiente, buscador con icono,
 * categorías como pills, filtros en tarjeta sticky y skeletons shimmer.
 * Lógica intacta: signals para estado + RxJS (debounce/switchMap) para red.
 */
@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [RouterLink, CourseCardComponent, IconComponent, ReactiveFormsModule, RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Header claro editorial -->
    <section class="border-b border-slate-200 bg-white">
      <div class="mx-auto max-w-7xl px-4 pb-10 pt-12 sm:px-6">
        <h1 class="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
          Catálogo de cursos
        </h1>
        <p class="mt-2 text-slate-500">
          Filtra por categoría, nivel y precio. Las lecciones de muestra son gratis.
        </p>

        <!-- Buscador -->
        <div class="relative mt-6 max-w-xl">
          <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
            <app-icon name="search" [size]="17" />
          </span>
          <input
            id="search"
            type="search"
            class="input !pl-10"
            placeholder="Buscar: Angular, NestJS, signals, diseño…"
            aria-label="Buscar cursos"
            [formControl]="searchControl"
          />
        </div>
      </div>
    </section>

    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <!-- Pills de categorías -->
      <div class="mb-8 flex flex-wrap items-center gap-2">
        <button type="button" class="chip" [class.chip-active]="filters().category === ''" (click)="patch({ category: '' })">
          Todas
        </button>
        @for (cat of categories(); track cat.id) {
          <button type="button" class="chip" [class.chip-active]="filters().category === cat.slug" (click)="patch({ category: cat.slug })">
            {{ cat.name }}
          </button>
        }
      </div>

      <div class="grid gap-8 lg:grid-cols-[250px_1fr]">
        <!-- Filtros (sticky) -->
        <aside class="space-y-5 lg:sticky lg:top-24 lg:h-fit" aria-label="Filtros del catálogo">
          <div class="card space-y-5 p-5">
            <fieldset>
              <legend class="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <app-icon name="adjustments" [size]="14" /> Nivel
              </legend>
              <div class="flex flex-wrap gap-1.5">
                @for (lvl of levels; track lvl.value) {
                  <button type="button" class="chip !px-3 !py-1 !text-xs"
                          [class.chip-active]="filters().level === lvl.value"
                          (click)="patch({ level: lvl.value })">
                    {{ lvl.label }}
                  </button>
                }
              </div>
            </fieldset>

            <fieldset>
              <legend class="mb-2.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400">
                <app-icon name="credit-card" [size]="14" /> Precio
              </legend>
              <div class="flex flex-wrap gap-1.5">
                @for (p of prices; track p.value) {
                  <button type="button" class="chip !px-3 !py-1 !text-xs"
                          [class.chip-active]="filters().price === p.value"
                          (click)="patch({ price: p.value })">
                    {{ p.label }}
                  </button>
                }
              </div>
            </fieldset>

            <button type="button" class="flex w-full items-center justify-center gap-1.5 rounded-xl border border-slate-200 py-2 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600" (click)="reset()">
              <app-icon name="refresh" [size]="13" /> Limpiar filtros
            </button>
          </div>
        </aside>

        <!-- Resultados -->
        <section>
          <div class="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p class="text-sm text-slate-500" aria-live="polite">
              @if (loading()) {
                <span class="inline-flex items-center gap-2">
                  <span class="h-2 w-2 animate-pulse-soft rounded-full bg-brand-500"></span>
                  Buscando cursos…
                </span>
              } @else {
                <strong class="font-semibold text-slate-700">{{ courses().length }}</strong>
                curso(s){{ nextCursor() ? '+' : '' }} encontrados
              }
            </p>
            <!-- Orden como control segmentado -->
            <div class="flex rounded-xl border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Ordenar resultados">
              @for (s of sorts; track s.value) {
                <button type="button"
                        class="rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-all duration-200"
                        [class]="filters().sort === s.value ? 'bg-slate-900 text-white' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'"
                        (click)="patch({ sort: s.value })">
                  {{ s.label }}
                </button>
              }
            </div>
          </div>

          <div class="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            @if (loading() && courses().length === 0) {
              @for (i of [1, 2, 3, 4, 5, 6]; track i) {
                <div class="card overflow-hidden">
                  <div class="skeleton aspect-video !rounded-none"></div>
                  <div class="space-y-3 p-4">
                    <div class="skeleton h-3 w-1/2"></div>
                    <div class="skeleton h-4 w-full"></div>
                    <div class="skeleton h-4 w-2/3"></div>
                    <div class="skeleton h-9 w-full"></div>
                  </div>
                </div>
              }
            } @else {
              @for (course of courses(); track course.id; let i = $index) {
                <div appReveal [appRevealDelay]="(i % 6) * 60" class="h-full">
                  <app-course-card [course]="course" />
                </div>
              } @empty {
                <div class="card col-span-full p-14 text-center" appReveal>
                  <span class="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
                    <app-icon name="search" [size]="28" />
                  </span>
                  <h3 class="mt-5 font-heading text-lg font-bold text-slate-900">Sin resultados con esos filtros</h3>
                  <p class="mt-1.5 text-sm text-slate-500">Prueba otra palabra clave o limpia los filtros.</p>
                  <button type="button" class="btn-secondary mt-6" (click)="reset()">
                    <app-icon name="refresh" [size]="15" /> Limpiar filtros
                  </button>
                </div>
              }
            }
          </div>

          @if (nextCursor()) {
            <div class="mt-10 text-center">
              <button type="button" class="btn-secondary btn-lg" [disabled]="loading()" (click)="loadMore()">
                @if (loading()) {
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></span>
                  Cargando…
                } @else {
                  Cargar más cursos <app-icon name="chevron-down" [size]="15" />
                }
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
  protected readonly sorts = SORTS;
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

    // Búsqueda con debounce (300 ms) → señal de filtros
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
