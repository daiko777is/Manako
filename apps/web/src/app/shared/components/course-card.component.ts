import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseSummary } from '@manako/shared';
import { formatDuration, formatMoney, levelLabel } from '../format';
import { IconComponent } from './icon.component';

/**
 * Tarjeta de curso (dumb component, spec §9). Estilo calmado según ui-craft:
 * hairline border, hover con elevación sutil, jerarquía por peso/color,
 * números en tabular-nums, precio sólido (sin degradados).
 */
@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="['/cursos', course.slug]"
      class="card-hover group flex h-full flex-col overflow-hidden"
    >
      <!-- Portada -->
      <div class="relative aspect-video overflow-hidden bg-slate-900">
        @if (course.thumbnailUrl) {
          <img
            [src]="course.thumbnailUrl"
            [alt]="'Portada del curso ' + course.title"
            class="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]"
            loading="lazy"
          />
        } @else {
          <div class="flex h-full items-center justify-center bg-slate-900 p-5 text-center">
            <span class="font-heading text-base font-semibold leading-snug text-white">
              {{ course.title.slice(0, 52) }}
            </span>
          </div>
        }
        @if (course.priceCents === 0) {
          <span class="absolute left-3 top-3 rounded-md bg-emerald-600 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            Gratis
          </span>
        }
      </div>

      <!-- Cuerpo -->
      <div class="flex flex-1 flex-col p-4">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
          @if (course.category) {
            <span class="text-brand-700">{{ course.category.name }}</span>
            <span aria-hidden="true">·</span>
          }
          <span>{{ levelLabel(course.level) }}</span>
        </div>

        <h3 class="mt-1.5 line-clamp-2 font-heading text-[15px] font-semibold leading-snug text-slate-900 group-hover:text-brand-700">
          {{ course.title }}
        </h3>
        @if (course.subtitle) {
          <p class="mt-1.5 line-clamp-2 text-[13px] leading-relaxed text-slate-500">{{ course.subtitle }}</p>
        }

        <div class="mt-auto pt-4">
          <div class="flex items-center gap-3 text-xs text-slate-500 tnum">
            <span class="flex items-center gap-1">
              <span class="text-slate-400"><app-icon name="film" [size]="13" /></span>
              {{ course.lessonsCount }} lecciones
            </span>
            <span class="flex items-center gap-1">
              <span class="text-slate-400"><app-icon name="clock" [size]="13" /></span>
              {{ duration }}
            </span>
            @if (course.reviewsCount > 0) {
              <span class="flex items-center gap-1">
                <span class="text-amber-500"><app-icon name="star" [size]="13" /></span>
                {{ course.avgRating.toFixed(1) }}
              </span>
            }
          </div>

          <div class="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
            @if (course.instructor) {
              <span class="flex min-w-0 items-center gap-2">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-bold text-slate-600">
                  {{ (course.instructor.fullName ?? '?').slice(0, 2).toUpperCase() }}
                </span>
                <span class="truncate text-xs text-slate-500">{{ course.instructor.fullName }}</span>
              </span>
            } @else {
              <span></span>
            }
            <span class="tnum text-sm font-bold text-slate-900">
              {{ price }}
            </span>
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
