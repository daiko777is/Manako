import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl px-4 py-28 text-center">
      <p class="text-7xl font-black text-brand-200">404</p>
      <h1 class="mt-2 text-2xl font-bold text-slate-900">Página no encontrada</h1>
      <p class="mt-2 text-slate-500">La página que buscas no existe o se ha movido.</p>
      <div class="mt-8 flex justify-center gap-3">
        <a routerLink="/" class="btn-primary">Ir al inicio</a>
        <a routerLink="/cursos" class="btn-secondary">Ver catálogo</a>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
