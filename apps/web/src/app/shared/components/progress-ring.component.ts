import { ChangeDetectionStrategy, Component, Input, computed } from '@angular/core';

let ringSeq = 0;

/**
 * Anillo de progreso SVG con gradiente de marca y transición suave del
 * stroke-dashoffset (idioma Spartan/shadcn: feedback de progreso visible
 * y accesible). role="progressbar" + aria-valuenow.
 */
@Component({
  selector: 'app-progress-ring',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative inline-flex items-center justify-center" [style.width.px]="size" [style.height.px]="size">
      <svg [attr.width]="size" [attr.height]="size" [attr.viewBox]="'0 0 ' + size + ' ' + size"
           role="progressbar" [attr.aria-valuenow]="clamped()" aria-valuemin="0" aria-valuemax="100"
           [attr.aria-label]="label">
        <defs>
          <linearGradient [id]="gradId" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#4f46e5" />
            <stop offset="60%" stop-color="#7c3aed" />
            <stop offset="100%" stop-color="#d946ef" />
          </linearGradient>
        </defs>
        <circle
          [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius()"
          fill="none" [attr.stroke]="trackColor" [attr.stroke-width]="strokeWidth"
        />
        <circle
          [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius()"
          fill="none" [attr.stroke]="'url(#' + gradId + ')'" [attr.stroke-width]="strokeWidth"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
          style="transition: stroke-dashoffset 0.7s cubic-bezier(0.22, 1, 0.36, 1)"
        />
      </svg>
      <span class="absolute text-xs font-bold text-slate-700" [class]="valueClass">
        {{ clamped() }}%
      </span>
    </div>
  `,
})
export class ProgressRingComponent {
  @Input({ required: true }) percent = 0;
  @Input() size = 56;
  @Input() strokeWidth = 5;
  @Input() trackColor = '#e2e8f0';
  @Input() valueClass = '';
  @Input() label = 'Progreso del curso';

  private readonly id = ++ringSeq;
  protected readonly gradId = `mk-ring-grad-${this.id}`;

  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.percent))));
  protected readonly radius = computed(() => (this.size - this.strokeWidth) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly offset = computed(
    () => this.circumference() * (1 - this.clamped() / 100),
  );
}
