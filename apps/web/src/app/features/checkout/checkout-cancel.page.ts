import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-checkout-cancel',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl px-4 py-24 text-center">
      <p class="text-6xl" aria-hidden="true">🤔</p>
      <h1 class="mt-4 text-3xl font-bold text-slate-900">Pago cancelado</h1>
      <p class="mt-2 text-slate-600">
        No se ha realizado ningún cargo. Puedes volver al curso cuando quieras —
        el precio se mantiene.
      </p>
      <div class="mt-8 flex justify-center gap-3">
        <a routerLink="/cursos" class="btn-primary">Volver al catálogo</a>
      </div>
      <p class="mt-6 text-xs text-slate-400">
        ¿Problemas con el pago? Consulta la
        <a routerLink="/legal/reembolsos" class="underline">política de reembolsos</a>.
      </p>
    </div>
  `,
})
export class CheckoutCancelPage {}
