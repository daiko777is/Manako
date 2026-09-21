import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header class="sticky top-0 z-40 border-b border-slate-200 bg-white/85 backdrop-blur">
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <a routerLink="/" class="flex items-center gap-2" aria-label="Manakō — inicio">
          <span
            class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-lg font-bold text-white"
            >M</span
          >
          <span class="text-lg font-bold tracking-tight text-slate-900">Manakō</span>
        </a>

        <nav class="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          <a routerLink="/cursos" routerLinkActive="text-brand-700 bg-brand-50"
             class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
            Catálogo
          </a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/mi-aprendizaje" routerLinkActive="text-brand-700 bg-brand-50"
               class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Mi aprendizaje
            </a>
          }
          @if (auth.role() === 'instructor' || auth.role() === 'admin') {
            <a routerLink="/instructor" routerLinkActive="text-brand-700 bg-brand-50"
               class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Panel instructor
            </a>
          }
          @if (auth.role() === 'admin') {
            <a routerLink="/admin" routerLinkActive="text-brand-700 bg-brand-50"
               class="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900">
              Admin
            </a>
          }
        </nav>

        <div class="flex-1"></div>

        @if (!auth.isAuthenticated()) {
          <div class="flex items-center gap-2">
            <a routerLink="/login" class="btn-ghost btn-sm">Iniciar sesión</a>
            <a routerLink="/registro" class="btn-primary btn-sm">Crear cuenta</a>
          </div>
        } @else {
          <div class="relative flex items-center gap-2">
            <button
              type="button"
              class="flex items-center gap-2 rounded-full border border-slate-200 bg-white py-1 pl-1 pr-3 text-sm hover:bg-slate-50"
              (click)="menuOpen.set(!menuOpen())"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                {{ initials() }}
              </span>
              <span class="hidden max-w-32 truncate text-slate-700 sm:block">
                {{ auth.profile()?.fullName || auth.profile()?.email }}
              </span>
            </button>

            @if (menuOpen()) {
              <div class="absolute right-0 top-11 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg" role="menu">
                <a routerLink="/mi-aprendizaje" (click)="menuOpen.set(false)"
                   class="block rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100" role="menuitem">
                  Mi aprendizaje
                </a>
                <button type="button" (click)="logout()"
                        class="block w-full rounded-lg px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50" role="menuitem">
                  Cerrar sesión
                </button>
              </div>
            }
          </div>
        }
      </div>
    </header>
  `,
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  private readonly router = inject(Router);

  protected initials(): string {
    const name = this.auth.profile()?.fullName || this.auth.profile()?.email || '?';
    return name.slice(0, 2).toUpperCase();
  }

  protected async logout(): Promise<void> {
    this.menuOpen.set(false);
    await this.auth.signOut();
    void this.router.navigate(['/']);
  }
}
