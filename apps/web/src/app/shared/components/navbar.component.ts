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
 * Navbar sobria: blanca con hairline inferior al hacer scroll, estado activo
 * con acento lateral (ui-craft/finishing.md: accent border > relleno llamativo).
 */
@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [RouterLink, RouterLinkActive, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <header
      class="fixed inset-x-0 top-0 z-40 border-b border-transparent bg-white/95 backdrop-blur transition-colors duration-200"
      [class.border-slate-200]="scrolled()"
    >
      <div class="mx-auto flex h-14 max-w-7xl items-center gap-6 px-4 sm:px-6">
        <!-- Logo -->
        <a routerLink="/" class="flex items-center gap-2" aria-label="Manakō — inicio">
          <span
            class="flex h-7 w-7 items-center justify-center rounded-md bg-brand-600 font-heading text-sm font-bold text-white"
          >M</span>
          <span class="font-heading text-[17px] font-bold tracking-tight text-slate-900">Manakō</span>
        </a>

        <!-- Nav desktop -->
        <nav class="hidden items-center gap-0.5 md:flex" aria-label="Navegación principal">
          <a routerLink="/cursos" routerLinkActive="nav-active" class="nav-link !rounded-md">Catálogo</a>
          @if (auth.isAuthenticated()) {
            <a routerLink="/mi-aprendizaje" routerLinkActive="nav-active" class="nav-link !rounded-md">Mi aprendizaje</a>
          }
          @if (auth.role() === 'instructor' || auth.role() === 'admin') {
            <a routerLink="/instructor" routerLinkActive="nav-active" class="nav-link !rounded-md">Instructor</a>
          }
          @if (auth.role() === 'admin') {
            <a routerLink="/admin" routerLinkActive="nav-active" class="nav-link !rounded-md">Admin</a>
          }
        </nav>

        <div class="flex-1"></div>

        @if (!auth.isAuthenticated()) {
          <div class="hidden items-center gap-2 md:flex">
            <a routerLink="/login" class="btn-ghost btn-sm">Iniciar sesión</a>
            <a routerLink="/registro" class="btn-primary btn-sm">Crear cuenta</a>
          </div>
        } @else {
          <div class="relative hidden items-center md:flex">
            <button
              type="button"
              class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-slate-100"
              (click)="menuOpen.set(!menuOpen())"
              aria-haspopup="menu"
              [attr.aria-expanded]="menuOpen()"
            >
              <span class="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-[11px] font-bold text-white">
                {{ initials() }}
              </span>
              <span class="max-w-36 truncate font-medium text-slate-700">
                {{ auth.profile()?.fullName || auth.profile()?.email }}
              </span>
              <span class="text-slate-400"><app-icon name="chevron-down" [size]="14" /></span>
            </button>

            @if (menuOpen()) {
              <div
                class="absolute right-0 top-11 w-56 animate-pop-in rounded-xl border border-slate-200 bg-white p-1.5 shadow-[var(--shadow-md2)]"
                role="menu"
              >
                <a
                  routerLink="/mi-aprendizaje"
                  (click)="menuOpen.set(false)"
                  class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                  role="menuitem"
                >
                  <span class="text-slate-400"><app-icon name="book" [size]="15" /></span> Mi aprendizaje
                </a>
                @if (auth.role() === 'instructor' || auth.role() === 'admin') {
                  <a
                    routerLink="/instructor"
                    (click)="menuOpen.set(false)"
                    class="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors hover:bg-slate-50"
                    role="menuitem"
                  >
                    <span class="text-slate-400"><app-icon name="presentation" [size]="15" /></span> Panel de instructor
                  </a>
                }
                <div class="my-1.5 h-px bg-slate-100" role="separator"></div>
                <button
                  type="button"
                  (click)="logout()"
                  class="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition-colors hover:bg-rose-50"
                  role="menuitem"
                >
                  <app-icon name="logout" [size]="15" /> Cerrar sesión
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
          <app-icon [name]="mobileOpen() ? 'x' : 'menu'" [size]="20" />
        </button>
      </div>

      @if (mobileOpen()) {
        <nav class="border-t border-slate-200 bg-white px-4 py-3 md:hidden" aria-label="Navegación móvil">
          <div class="flex flex-col gap-0.5">
            <a routerLink="/cursos" (click)="mobileOpen.set(false)" class="mobile-link">Catálogo</a>
            @if (auth.isAuthenticated()) {
              <a routerLink="/mi-aprendizaje" (click)="mobileOpen.set(false)" class="mobile-link">Mi aprendizaje</a>
              @if (auth.role() === 'instructor' || auth.role() === 'admin') {
                <a routerLink="/instructor" (click)="mobileOpen.set(false)" class="mobile-link">Panel de instructor</a>
              }
              @if (auth.role() === 'admin') {
                <a routerLink="/admin" (click)="mobileOpen.set(false)" class="mobile-link">Admin</a>
              }
              <button type="button" (click)="logout()" class="mobile-link text-rose-600">Cerrar sesión</button>
            } @else {
              <a routerLink="/login" (click)="mobileOpen.set(false)" class="mobile-link">Iniciar sesión</a>
              <a routerLink="/registro" (click)="mobileOpen.set(false)" class="btn-primary mt-2 w-full">Crear cuenta</a>
            }
          </div>
        </nav>
      }
    </header>
    <div class="h-14" aria-hidden="true"></div>
  `,
  styles: [
    `
      .mobile-link {
        @apply flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50;
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
    this.scrolled.set(window.scrollY > 8);
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
