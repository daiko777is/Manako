import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <div class="card w-full max-w-lg animate-pop-in p-10 text-center">
        <span class="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <app-icon name="credit-card" [size]="30" />
        </span>
        <h1 class="mt-6 font-heading text-3xl font-bold text-slate-900">Pago cancelado</h1>
        <p class="mt-3 leading-relaxed text-slate-500">
          No se ha realizado ningún cargo. Puedes volver al curso cuando quieras —
          el precio se mantiene y las lecciones de muestra siguen gratis.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a routerLink="/cursos" class="btn-primary">
            <app-icon name="search" [size]="16" /> Volver al catálogo
          </a>
        </div>
        <p class="mt-6 text-xs text-slate-400">
          ¿Problemas con el pago? Consulta la
          <a routerLink="/legal/reembolsos" class="font-semibold text-brand-700 underline decoration-dotted underline-offset-2">política de reembolsos</a>.
        </p>
      </div>
    </div>
  `,
})
export class CheckoutCancelPage {}
