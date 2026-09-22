import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/** Footer plano y sobrio: una línea de marca estática, columnas, sin adornos. */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="mt-20 border-t-2 border-brand-600 bg-slate-950 text-slate-300">
      <div class="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <div class="flex items-center gap-2">
            <span class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 font-heading text-sm font-bold text-white">M</span>
            <span class="font-heading text-[17px] font-bold text-white">Manakō</span>
          </div>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            Plataforma de cursos en video para profesionales tech: rutas
            secuenciales, progreso automático y certificados al terminar.
          </p>
          <p class="mt-4 text-xs leading-relaxed text-slate-500">
            Los certificados emitidos no constituyen titulación oficial ni
            acreditación gubernamental.
          </p>
        </div>

        <nav aria-label="Plataforma">
          <h3 class="footer-heading">Plataforma</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/cursos" class="footer-link">Catálogo</a></li>
            <li><a routerLink="/registro" class="footer-link">Crear cuenta</a></li>
            <li><a routerLink="/instructor" class="footer-link">Enseña en Manakō</a></li>
            <li><a routerLink="/mi-aprendizaje" class="footer-link">Mi aprendizaje</a></li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h3 class="footer-heading">Legal</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/legal/terminos" class="footer-link">Términos y condiciones</a></li>
            <li><a routerLink="/legal/privacidad" class="footer-link">Privacidad</a></li>
            <li><a routerLink="/legal/cookies" class="footer-link">Cookies</a></li>
            <li><a routerLink="/legal/reembolsos" class="footer-link">Reembolsos</a></li>
          </ul>
        </nav>

        <div>
          <h3 class="footer-heading">Recursos</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/legal/instructores" class="footer-link">Acuerdo de instructor</a></li>
            <li><span class="text-slate-500">Documentación API: <code class="text-slate-400">/api/docs</code></span></li>
          </ul>
        </div>
      </div>

      <div class="border-t border-white/10">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>© {{ year }} Manakō</p>
          <p>Angular · NestJS · Supabase · Stripe</p>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .footer-heading {
        @apply text-xs font-bold uppercase tracking-wider text-slate-500;
      }
      .footer-link {
        @apply text-slate-400 transition-colors duration-150 hover:text-white;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
