import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';
import type { CourseSummary } from '@manako/shared';
import { formatDuration, formatMoney, levelLabel } from '../format';
import { IconComponent } from './icon.component';

/**
 * Tarjeta de curso (dumb component, spec §9) rediseñada:
 * zoom de portada al hover, elevación con sombra de marca, badges con ring,
 * meta con iconos SVG y precio con píldora degradada.
 * Patrón de tarjeta de catálogo inspirado en hyperui.dev / flowbite.
 */
@Component({
  selector: 'app-course-card',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a
      [routerLink]="['/cursos', course.slug]"
      class="card-interactive group flex h-full flex-col overflow-hidden"
    >
      <!-- Portada -->
      <div class="relative aspect-video overflow-hidden bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-600">
        @if (course.thumbnailUrl) {
          <img
            [src]="course.thumbnailUrl"
            [alt]="'Portada del curso ' + course.title"
            class="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-105"
            loading="lazy"
          />
        } @else {
          <div class="absolute inset-0 bg-grid-fade bg-grid opacity-30" aria-hidden="true"></div>
          <div class="flex h-full items-center justify-center p-5 text-center">
            <span class="font-heading text-lg font-bold leading-snug text-white/95 transition-transform duration-300 group-hover:scale-[1.03]">
              {{ course.title.slice(0, 52) }}
            </span>
          </div>
        }

        <!-- Badges sobre la portada -->
        <div class="absolute left-3 top-3 flex gap-2">
          @if (course.priceCents === 0) {
            <span class="rounded-full bg-emerald-500/95 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg backdrop-blur">
              GRATIS
            </span>
          }
          @if (course.totalEnrollments > 0) {
            <span class="flex items-center gap-1 rounded-full bg-slate-950/60 px-2.5 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <app-icon name="users" [size]="12" /> {{ course.totalEnrollments }}
            </span>
          }
        </div>

        <!-- Play flotante al hover -->
        <span
          class="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          aria-hidden="true"
        >
          <span class="flex h-12 w-12 items-center justify-center rounded-full bg-white/90 text-brand-700 shadow-glow">
            <app-icon name="play" [size]="20" />
          </span>
        </span>
      </div>

      <!-- Cuerpo -->
      <div class="flex flex-1 flex-col gap-2.5 p-4">
        <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide">
          @if (course.category) {
            <span class="text-gradient">{{ course.category.name }}</span>
          }
          <span class="text-slate-300">•</span>
          <span class="text-slate-500">{{ levelLabel(course.level) }}</span>
        </div>

        <h3 class="line-clamp-2 font-heading text-[15px] font-bold leading-snug text-slate-900 transition-colors group-hover:text-brand-700">
          {{ course.title }}
        </h3>
        @if (course.subtitle) {
          <p class="line-clamp-2 text-[13px] leading-relaxed text-slate-500">{{ course.subtitle }}</p>
        }

        <div class="mt-auto space-y-3 pt-2">
          <div class="flex items-center gap-3 text-xs text-slate-500">
            <span class="flex items-center gap-1"><app-icon name="film" [size]="13" /> {{ course.lessonsCount }} lecciones</span>
            <span class="flex items-center gap-1"><app-icon name="clock" [size]="13" /> {{ duration }}</span>
            @if (course.reviewsCount > 0) {
              <span class="flex items-center gap-1 text-amber-500">
                <app-icon name="star" [size]="13" /> {{ course.avgRating.toFixed(1) }}
              </span>
            }
          </div>

          <div class="flex items-center justify-between border-t border-slate-100 pt-3">
            @if (course.instructor) {
              <span class="flex min-w-0 items-center gap-2">
                <span class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[10px] font-bold text-brand-700">
                  {{ (course.instructor.fullName ?? '?').slice(0, 2).toUpperCase() }}
                </span>
                <span class="truncate text-xs text-slate-500">{{ course.instructor.fullName }}</span>
              </span>
            } @else {
              <span></span>
            }
            <span
              class="rounded-full px-3 py-1 text-sm font-extrabold"
              [class]="course.priceCents === 0
                ? 'bg-emerald-50 text-emerald-700'
                : 'bg-gradient-to-r from-brand-600 to-violet-600 bg-clip-text text-transparent'"
            >
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
