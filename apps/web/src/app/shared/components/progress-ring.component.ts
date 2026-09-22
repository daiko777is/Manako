import { ChangeDetectionStrategy, Component, Input, computed } from '@angular/core';

/**
 * Anillo de progreso SVG — trazo sólido de marca, transición suave del
 * dashoffset. role="progressbar" + aria-valuenow (a11y).
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
        <circle
          [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius()"
          fill="none" [attr.stroke]="trackColor" [attr.stroke-width]="strokeWidth"
        />
        <circle
          [attr.cx]="size / 2" [attr.cy]="size / 2" [attr.r]="radius()"
          fill="none" [attr.stroke]="color" [attr.stroke-width]="strokeWidth"
          stroke-linecap="round"
          [attr.stroke-dasharray]="circumference()"
          [attr.stroke-dashoffset]="offset()"
          [attr.transform]="'rotate(-90 ' + size / 2 + ' ' + size / 2 + ')'"
          style="transition: stroke-dashoffset 0.6s cubic-bezier(0.22, 1, 0.36, 1)"
        />
      </svg>
      <span class="absolute text-xs font-bold tnum" [class]="valueClass">
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
  @Input() color = '#4f46e5';
  @Input() valueClass = 'text-slate-700';
  @Input() label = 'Progreso del curso';

  protected readonly clamped = computed(() => Math.max(0, Math.min(100, Math.round(this.percent))));
  protected readonly radius = computed(() => (this.size - this.strokeWidth) / 2);
  protected readonly circumference = computed(() => 2 * Math.PI * this.radius());
  protected readonly offset = computed(
    () => this.circumference() * (1 - this.clamped() / 100),
  );
}
