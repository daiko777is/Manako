import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  imports: [IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-16 z-[100] flex flex-col items-center gap-2 px-4">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full max-w-md animate-slide-in-right items-start gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3.5 text-sm shadow-[var(--shadow-md2)]"
          role="status"
          aria-live="polite"
        >
          <span
            class="mt-0.5 shrink-0"
            [class]="
              toast.kind === 'success'
                ? 'text-emerald-600'
                : toast.kind === 'error'
                  ? 'text-rose-600'
                  : 'text-brand-600'
            "
          >
            <app-icon [name]="toast.kind === 'success' ? 'check-circle' : toast.kind === 'error' ? 'bolt' : 'sparkles'" [size]="17" />
          </span>
          <span class="flex-1 font-medium text-slate-700">{{ toast.message }}</span>
          <button
            type="button"
            class="rounded-md p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Cerrar notificación"
          >
            <app-icon name="x" [size]="13" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
