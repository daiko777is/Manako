import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 top-4 z-[100] flex flex-col items-center gap-2 px-4">
      @for (toast of toasts.toasts(); track toast.id) {
        <div
          class="pointer-events-auto flex w-full max-w-md items-start gap-3 rounded-lg px-4 py-3 text-sm shadow-lg"
          [class]="
            toast.kind === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.kind === 'error'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-800 text-white'
          "
          role="status"
          aria-live="polite"
        >
          <span class="flex-1">{{ toast.message }}</span>
          <button
            type="button"
            class="rounded p-0.5 opacity-70 hover:opacity-100"
            (click)="toasts.dismiss(toast.id)"
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
}
