import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-20 z-[100] flex flex-col items-center gap-2.5 px-4">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="glass pointer-events-auto flex w-full max-w-md animate-slide-in-right items-start gap-3 rounded-2xl px-4 py-3.5 text-sm shadow-glass"
          role="status"
          aria-live="polite"
        >
          <span
            class="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
            [class]="
              toast.kind === 'success'
                ? 'bg-gradient-to-br from-emerald-400 to-teal-600'
                : toast.kind === 'error'
                  ? 'bg-gradient-to-br from-rose-500 to-red-600'
                  : 'bg-gradient-to-br from-brand-500 to-violet-600'
            "
          >
            <app-icon [name]="toast.kind === 'success' ? 'check' : toast.kind === 'error' ? 'bolt' : 'sparkles'" [size]="15" />
          </span>
          <span class="flex-1 pt-1 font-medium text-slate-700">{{ toast.message }}</span>
          <button
            type="button"
            class="rounded-lg p-1 text-slate-400 transition hover:bg-slate-900/5 hover:text-slate-600"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Cerrar notificación"
          >
            <app-icon name="x" [size]="14" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
