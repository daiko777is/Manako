import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Barra de progreso accesible (role progressbar + aria-valuenow). */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="h-2 w-full overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      [attr.aria-valuenow]="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label"
    >
      <div
        class="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-600 transition-all duration-500"
        [style.width.%]="percent"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input({ required: true }) percent = 0;
  @Input() label = 'Progreso del curso';
}
