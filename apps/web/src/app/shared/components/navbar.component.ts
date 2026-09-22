import {
  ChangeDetectionStrategy,
  Component,
  HostListener,
  inject,
  signal,
} from '@angular/core';
import { Router, RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from './icon.component';

/**
 * Navbar "liquid glass": transparente arriba, se condensa en vidrio esmerilado
 * al hacer scroll (skill ui-ux-pro-max, estilo Liquid Glass — uso moderado).
 * Menú móvil con animación, indicador activo con gradiente.
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="fixed inset-x-0 top-0 z-40 transition-all duration-300"
      [class]="scrolled() ? 'bg-white/80 shadow-soft backdrop-blur-xl' : 'bg-transparent'"
    >
      <div class="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <!-- Logo -->
        <a routerLink="/" class="group flex items-center gap-2.5" aria-label="Manakō — inicio">
          <span
            class="relative flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-500 font-heading text-lg font-bold text-white shadow-glow transition-transform duration-300 group-hover:scale-105 group-hover:rotate-3"
          >
            M
            <span class="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white"></span>
          </span>
          <span class="font-heading text-lg font-bold tracking-tight text-slate-900">
            Manak<span class="text-gradient">ō</span>
          </span>
        </a>

        <!-- Nav desktop -->
        <nav class="hidden items-center gap-1 md:flex" aria-label="Navegación principal">
          <a
            routerLink="/cursos"
            routerLinkActive="nav-active"
            class="nav-link"
          >
            <app-icon name="search" [size]="16" /> Catálogo
          </a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/mi-aprendizaje" routerLinkActive="nav-active" class="nav-link">
              <app-icon name="book" [size]="16" /> Mi aprendizaje
            </a>
          }
          @if (auth.role() === 'instructor' || auth.role() === 'admin') {
            <a routerLink="/instructor" routerLinkActive="nav-active" class="nav-link">
              <app-icon name="presentation" [size]="16" /> Instructor
            </a>
          }
          @if (auth.role() === 'admin') {
            <a routerLink="/admin" routerLinkActive="nav-active" class="nav-link">
              <app-icon name="shield" [size]="16" /> Admin
            </a>
          }
        </nav>

        <div class="flex-1"></div>

        @if (!auth.isAuthenticated()) {
          <div class="hidden items-center gap-2 md:flex">
            <a routerLink="/login" class="btn-ghost btn-sm">Iniciar sesión</a>
            <a routerLink="/registro" class="btn-primary btn-sm">
              Crear cuenta
              <app-icon name="arrow-right" [size]="14" />
            </a>
          </div>
        } @else {
          <div class="relative hidden items-center gap-2 md:flex">
            <button
              type="button"
              class="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/70 py-1 pl-1 pr-3 text-sm shadow-sm backdrop-blur transition hover:border-brand-300 hover:shadow-soft"
              (click)="menuOpen.set(!menuOpen())"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
            >
              <span class="relative flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand-500 to-violet-600 text-xs font-bold text-white">
                {{ initials() }}
              </span>
              <span class="max-w-32 truncate text-slate-700">
                {{ auth.profile()?.fullName || auth.profile()?.email }}
              </span>
              <app-icon name="chevron-down" [size]="14" />
            </button>

            @if (menuOpen()) {
              <div
                class="glass absolute right-0 top-12 w-56 animate-pop-in rounded-2xl p-1.5"
                role="menu"
              >
                <a
                  routerLink="/mi-aprendizaje"
                  (click)="menuOpen.set(false)"
                  class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
                  role="menuitem"
                >
                  <app-icon name="book" [size]="16" /> Mi aprendizaje
                </a>
                @if (auth.role() === 'instructor' || auth.role() === 'admin') {
                  <a
                    routerLink="/instructor"
                    (click)="menuOpen.set(false)"
                    class="flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-slate-700 transition hover:bg-brand-50 hover:text-brand-700"
                    role="menuitem"
                  >
                    <app-icon name="presentation" [size]="16" /> Panel de instructor
                  </a>
                }
                <button
                  type="button"
                  (click)="logout()"
                  class="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50"
                  role="menuitem"
                >
                  <app-icon name="logout" [size]="16" /> Cerrar sesión
                </button>
              </div>
            }
          </div>
        }

        <!-- Botón menú móvil -->
        <button
          type="button"
          class="btn-ghost btn-sm md:hidden"
          (click)="mobileOpen.set(!mobileOpen())"
          [attr.aria-expanded]="mobileOpen()"
          aria-label="Abrir menú"
        >
          <app-icon [name]="mobileOpen() ? 'x' : 'menu'" [size]="22" />
        </button>
      </div>

      <!-- Panel móvil -->
      @if (mobileOpen()) {
        <nav class="glass animate-fade-up border-t border-white/40 px-4 py-4 md:hidden" aria-label="Navegación móvil">
          <div class="flex flex-col gap-1">
            <a routerLink="/cursos" (click)="mobileOpen.set(false)" class="mobile-link">
              <app-icon name="search" [size]="18" /> Catálogo
            </a>
            @if (auth.isAuthenticated()) {
              <a routerLink="/mi-aprendizaje" (click)="mobileOpen.set(false)" class="mobile-link">
                <app-icon name="book" [size]="18" /> Mi aprendizaje
              </a>
              @if (auth.role() === 'instructor' || auth.role() === 'admin') {
                <a routerLink="/instructor" (click)="mobileOpen.set(false)" class="mobile-link">
                  <app-icon name="presentation" [size]="18" /> Panel de instructor
                </a>
              }
              @if (auth.role() === 'admin') {
                <a routerLink="/admin" (click)="mobileOpen.set(false)" class="mobile-link">
                  <app-icon name="shield" [size]="18" /> Admin
                </a>
              }
              <button type="button" (click)="logout()" class="mobile-link text-rose-600">
                <app-icon name="logout" [size]="18" /> Cerrar sesión
              </button>
            } @else {
              <a routerLink="/login" (click)="mobileOpen.set(false)" class="mobile-link">
                <app-icon name="user" [size]="18" /> Iniciar sesión
              </a>
              <a routerLink="/registro" (click)="mobileOpen.set(false)" class="btn-primary mt-2 w-full">
                Crear cuenta gratis
              </a>
            }
          </div>
        </nav>
      }
    </header>
    <!-- Spacer porque el header es fixed -->
    <div class="h-16" aria-hidden="true"></div>
  `,
  styles: [
    `
      .nav-link {
        @apply flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-slate-900/5 hover:text-slate-900;
      }
      .nav-link.nav-active {
        @apply bg-gradient-to-r from-brand-50 to-violet-50 text-brand-700 shadow-sm;
      }
      .mobile-link {
        @apply flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-white/70;
      }
    `,
  ],
})
export class NavbarComponent {
  protected readonly auth = inject(AuthService);
  protected readonly menuOpen = signal(false);
  protected readonly mobileOpen = signal(false);
  protected readonly scrolled = signal(false);
  private readonly router = inject(Router);

  @HostListener('window:scroll', ['passive'])
  onScroll(): void {
    this.scrolled.set(window.scrollY > 12);
  }

  protected initials(): string {
    const name = this.auth.profile()?.fullName || this.auth.profile()?.email || '?';
    return name.slice(0, 2).toUpperCase();
  }

  protected async logout(): Promise<void> {
    this.menuOpen.set(false);
    this.mobileOpen.set(false);
    await this.auth.signOut();
    void this.router.navigate(['/']);
  }
}
