import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseSummary } from '@manako/shared';
import { formatDuration, formatMoney, levelLabel } from '../format';

/**
 * Componente de presentación (dumb, spec §9): solo @Input, sin servicios.
 * OnPush porque se renderiza en listas largas del catálogo.
 */
@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="['/cursos', course.slug]"
      class="card group flex h-full flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div class="relative aspect-video bg-gradient-to-br from-brand-600 to-brand-800">
        @if (course.thumbnailUrl) {
          <img
            [src]="course.thumbnailUrl"
            [alt]="'Portada del curso ' + course.title"
            class="h-full w-full object-cover"
            loading="lazy"
          />
        } @else {
          <div class="flex h-full items-center justify-center p-4 text-center text-2xl font-bold text-white/90">
            {{ course.title.slice(0, 48) }}
          </div>
        }
        @if (course.priceCents === 0) {
          <span class="absolute left-3 top-3 badge-green">Gratis</span>
        }
      </div>

      <div class="flex flex-1 flex-col gap-2 p-4">
        @if (course.category) {
          <span class="text-xs font-semibold uppercase tracking-wide text-brand-600">
            {{ course.category.name }}
          </span>
        }
        <h3 class="line-clamp-2 font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
          {{ course.title }}
        </h3>
        @if (course.subtitle) {
          <p class="line-clamp-2 text-sm text-slate-500">{{ course.subtitle }}</p>
        }

        <div class="mt-auto space-y-2 pt-2">
          <div class="flex items-center justify-between text-xs text-slate-500">
            <span>{{ levelLabel(course.level) }}</span>
            <span>{{ course.lessonsCount }} lecciones · {{ duration }}</span>
          </div>
          <div class="flex items-center justify-between">
            @if (course.instructor) {
              <span class="truncate text-xs text-slate-500">{{ course.instructor.fullName }}</span>
            } @else {
              <span></span>
            }
            <span class="text-sm font-bold text-slate-900">{{ price }}</span>
          </div>
        </div>
      </div>
    </a>
  `,
})
export class CourseCardComponent {
  @Input({ required: true }) course!: CourseSummary;

  protected readonly levelLabel = levelLabel;

  get price(): string {
    return formatMoney(this.course.priceCents, this.course.currency);
  }

  get duration(): string {
    return formatDuration(this.course.totalSeconds);
  }
}
