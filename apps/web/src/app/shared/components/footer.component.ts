import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

/**
 * Footer oscuro de marca con banda superior de gradiente animado, columnas
 * de enlaces y aviso legal de certificados (spec §10.3).
 */
@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <footer class="relative mt-20 overflow-hidden bg-slate-950 text-slate-300">
      <!-- Banda de gradiente animado -->
      <div
        class="h-1 w-full animate-gradient-x bg-gradient-to-r from-brand-500 via-violet-500 to-fuchsia-500 bg-[length:200%_auto]"
        aria-hidden="true"
      ></div>
      <!-- Blobs decorativos -->
      <div class="pointer-events-none absolute -left-24 top-10 h-64 w-64 rounded-full bg-brand-600/20 blur-3xl" aria-hidden="true"></div>
      <div class="pointer-events-none absolute -right-16 bottom-0 h-56 w-56 rounded-full bg-fuchsia-600/10 blur-3xl" aria-hidden="true"></div>

      <div class="relative mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <div class="flex items-center gap-2.5">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-500 font-heading text-lg font-bold text-white">M</span>
            <span class="font-heading text-lg font-bold text-white">Manakō</span>
          </div>
          <p class="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            La plataforma donde los profesionales tech aprenden a su ritmo:
            cursos en video, progreso secuencial y certificados al terminar.
          </p>
          <p class="mt-4 text-xs text-slate-500">
            Los certificados emitidos no constituyen titulación oficial ni
            acreditación gubernamental.
          </p>
        </div>

        <nav aria-label="Plataforma">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-white">Plataforma</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/cursos" class="footer-link">Catálogo</a></li>
            <li><a routerLink="/registro" class="footer-link">Crear cuenta</a></li>
            <li><a routerLink="/instructor" class="footer-link">Enseña en Manakō</a></li>
            <li><a routerLink="/mi-aprendizaje" class="footer-link">Mi aprendizaje</a></li>
          </ul>
        </nav>

        <nav aria-label="Legal">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-white">Legal</h3>
          <ul class="mt-4 space-y-2.5 text-sm">
            <li><a routerLink="/legal/terminos" class="footer-link">Términos y condiciones</a></li>
            <li><a routerLink="/legal/privacidad" class="footer-link">Privacidad</a></li>
            <li><a routerLink="/legal/cookies" class="footer-link">Cookies</a></li>
            <li><a routerLink="/legal/reembolsos" class="footer-link">Reembolsos</a></li>
          </ul>
        </nav>

        <div>
          <h3 class="text-sm font-semibold uppercase tracking-wider text-white">Stack</h3>
          <ul class="mt-4 space-y-2.5 text-sm text-slate-400">
            <li class="flex items-center gap-2"><app-icon name="code" [size]="15" /> Angular · RxJS · Signals</li>
            <li class="flex items-center gap-2"><app-icon name="bolt" [size]="15" /> NestJS · Prisma</li>
            <li class="flex items-center gap-2"><app-icon name="shield" [size]="15" /> Supabase · RLS</li>
            <li class="flex items-center gap-2"><app-icon name="credit-card" [size]="15" /> Stripe · Mux</li>
          </ul>
        </div>
      </div>

      <div class="relative border-t border-white/10">
        <div class="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>© {{ year }} Manakō. Hecho con Angular + Tailwind.</p>
          <p class="flex items-center gap-1.5">
            <app-icon name="sparkles" [size]="13" />
            Aprende algo nuevo hoy
          </p>
        </div>
      </div>
    </footer>
  `,
  styles: [
    `
      .footer-link {
        @apply inline-flex items-center gap-1.5 text-slate-400 transition-colors duration-200 hover:text-white;
      }
    `,
  ],
})
export class FooterComponent {
  protected readonly year = new Date().getFullYear();
}
