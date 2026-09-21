import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-16 border-t border-slate-200 bg-white">
      <div class="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:px-6 md:flex-row md:items-center md:justify-between">
        <div>
          <p class="text-sm font-semibold text-slate-900">Manakō</p>
          <p class="mt-1 max-w-md text-xs text-slate-500">
            Plataforma de cursos en video. Los certificados emitidos no constituyen titulación
            oficial ni acreditación gubernamental.
          </p>
        </div>
        <nav class="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600" aria-label="Enlaces legales">
          <a routerLink="/legal/terminos" class="hover:text-brand-700">Términos y condiciones</a>
          <a routerLink="/legal/privacidad" class="hover:text-brand-700">Privacidad</a>
          <a routerLink="/legal/cookies" class="hover:text-brand-700">Cookies</a>
          <a routerLink="/legal/reembolsos" class="hover:text-brand-700">Reembolsos</a>
          <a routerLink="/legal/instructores" class="hover:text-brand-700">Enseña en Manakō</a>
        </nav>
        <p class="text-xs text-slate-400">© {{ year }} Manakō</p>
      </div>
    </footer>
  `,
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
