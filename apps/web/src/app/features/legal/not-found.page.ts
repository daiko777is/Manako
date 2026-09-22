import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-not-found',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-24">
      <div class="absolute inset-0 bg-mesh-hero opacity-25" aria-hidden="true"></div>
      <div class="absolute left-1/4 top-16 h-64 w-64 animate-blob rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true"></div>
      <div class="absolute bottom-10 right-1/4 h-56 w-56 animate-blob rounded-full bg-fuchsia-500/15 blur-3xl [animation-delay:-6s]" aria-hidden="true"></div>

      <div class="relative text-center">
        <p class="animate-float font-heading text-[9rem] font-bold leading-none sm:text-[12rem]">
          <span class="bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">4</span>
          <span class="relative inline-block">
            <span class="bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">0</span>
            <span class="absolute inset-0 flex items-center justify-center text-white">
              <app-icon name="play" [size]="44" />
            </span>
          </span>
          <span class="bg-gradient-to-br from-brand-600 via-violet-600 to-fuchsia-500 bg-clip-text text-transparent">4</span>
        </p>
        <h1 class="mt-2 font-heading text-2xl font-bold text-slate-900">Esta lección no existe</h1>
        <p class="mx-auto mt-2 max-w-sm text-slate-500">
          La página que buscas no está en el currículo. Pero hay mucho más por aprender.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a routerLink="/" class="btn-primary">
            Ir al inicio <app-icon name="arrow-right" [size]="16" />
          </a>
          <a routerLink="/cursos" class="btn-secondary">Ver catálogo</a>
        </div>
      </div>
    </div>
  `,
})
export class NotFoundPage {}
