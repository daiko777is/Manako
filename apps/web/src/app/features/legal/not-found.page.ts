import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-[70vh] items-center justify-center px-4 py-24">
      <div class="text-center">
        <p class="font-heading text-[110px] font-bold leading-none text-slate-900 sm:text-[140px]">
          4<span class="relative inline-block text-brand-600">0</span>4
        </p>
        <h1 class="mt-2 font-heading text-2xl font-bold text-slate-900">Esta lección no existe</h1>
        <p class="mx-auto mt-2 max-w-sm text-slate-500">
          La página que buscas no está en el currículo. Pero hay mucho más por aprender.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a routerLink="/" class="btn-primary">Ir al inicio</a>
          <a routerLink="/cursos" class="btn-secondary">Ver catálogo</a>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
