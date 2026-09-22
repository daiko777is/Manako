import { ChangeDetectionStrategy, Component, Input } from '@angular/core';

/** Barra de progreso sobria: color sólido de marca (el degradado se reserva
 * para nada — ui-craft: el color comunica estado, no decoración). */
@Component({
  selector: 'app-progress-bar',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="h-1.5 w-full overflow-hidden rounded-full bg-slate-100"
      role="progressbar"
      [attr.aria-valuenow]="percent"
      aria-valuemin="0"
      aria-valuemax="100"
      [attr.aria-label]="label"
    >
      <div
        class="h-full rounded-full bg-brand-600 transition-[width] duration-500 ease-out"
        [style.width.%]="percent"
      ></div>
    </div>
  `,
})
export class ProgressBarComponent {
  @Input({ required: true }) percent = 0;
  @Input() label = 'Progreso del curso';
}
