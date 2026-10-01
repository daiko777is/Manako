import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon.component';
import type { UserRole } from '@manako/shared';

interface DemoUser {
  email: string;
  fullName: string | null;
  role: UserRole;
}

const ROLE_LABEL: Record<UserRole, string> = {
  student: 'Estudiante',
  instructor: 'Instructor',
  admin: 'Admin',
};

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 class="text-center font-heading text-2xl font-bold text-slate-900">Bienvenido de vuelta</h1>
      <p class="mt-1 text-center text-sm text-slate-500">
        Continúa aprendiendo donde lo dejaste
      </p>

      <!-- Modo demo: cuentas de un clic -->
      @if (auth.demoMode) {
        <div class="card mt-8 border-amber-200 bg-amber-50/60 p-5">
          <p class="flex items-center gap-2 text-sm font-semibold text-amber-800">
            <app-icon name="bolt" [size]="16" /> Modo demo activo
          </p>
          <p class="mt-1 text-xs leading-relaxed text-amber-700">
            Autenticación y pagos simulados sobre datos seed. Entra con un clic:
          </p>
          <div class="mt-4 grid gap-2">
            @for (user of demoUsers(); track user.email) {
              <button
                type="button"
                class="flex items-center justify-between rounded-lg border border-amber-200 bg-white px-3.5 py-2.5 text-left text-sm transition-colors hover:border-brand-300 hover:bg-brand-50/50"
                (click)="demoEnter(user.email)"
                [disabled]="busy()"
              >
                <span>
                  <span class="block font-semibold text-slate-800">{{ roleLabel(user.role) }}</span>
                  <span class="block text-xs text-slate-500">{{ user.email }}</span>
                </span>
                <span class="text-slate-400"><app-icon name="arrow-right" [size]="15" /></span>
              </button>
            } @empty {
              <p class="text-xs text-amber-700">Cargando cuentas demo… (requiere API + seed)</p>
            }
          </div>
        </div>
        <p class="mt-4 text-center text-xs text-slate-500">— o usa el formulario con cualquier cuenta demo —</p>
      }

      <form [formGroup]="form" (ngSubmit)="submit()" class="card mt-6 space-y-4 p-6" novalidate>
        <div>
          <label for="email" class="label">Email</label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <app-icon name="envelope" [size]="16" />
            </span>
            <input id="email" type="email" formControlName="email" class="input !pl-10"
                   placeholder="tu@email.com" autocomplete="email" required
                   [attr.aria-describedby]="emailError() ? 'email-error' : null"
                   [attr.aria-invalid]="emailError() ? true : null" />
          </div>
          @if (emailError(); as msg) {
            <p class="field-error" id="email-error" role="alert">{{ msg }}</p>
          }
        </div>
        <div>
          <label for="password" class="label">
            Contraseña
            @if (auth.demoMode) {
              <span class="ml-1 font-normal text-slate-400">(en demo se ignora)</span>
            }
          </label>
          <div class="relative">
            <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
              <app-icon name="lock" [size]="16" />
            </span>
            <input id="password" type="password" formControlName="password" class="input !pl-10"
                   placeholder="••••••••" autocomplete="current-password"
                   [required]="!auth.demoMode"
                   [attr.aria-describedby]="passwordError() ? 'password-error' : null"
                   [attr.aria-invalid]="passwordError() ? true : null" />
          </div>
          @if (passwordError(); as msg) {
            <p class="field-error" id="password-error" role="alert">{{ msg }}</p>
          }
        </div>

        @if (error()) {
          <p class="flex animate-fade-up items-center gap-2 rounded-lg bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/15" role="alert">
            <app-icon name="shield" [size]="15" /> {{ error() }}
          </p>
        }

        <button type="submit" class="btn-primary w-full btn-lg" [disabled]="form.invalid || busy()">
          @if (busy()) {
            <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
            Entrando…
          } @else {
            Iniciar sesión
          }
        </button>

        @if (!auth.demoMode) {
          <div class="relative py-1 text-center">
            <span class="relative z-10 bg-white px-3 text-xs font-medium uppercase tracking-wider text-slate-500">o</span>
            <span class="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true"></span>
          </div>

          <button type="button" class="btn-secondary w-full btn-lg" (click)="google()" [disabled]="busy()">
            <app-icon name="google" [size]="18" /> Continuar con Google
          </button>
        }

        <p class="text-center text-sm text-slate-500">
          ¿No tienes cuenta?
          <a routerLink="/registro" class="font-semibold text-brand-700 transition-colors hover:text-brand-800">Regístrate gratis</a>
        </p>
      </form>
    </div>
  `,
})
export class LoginPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);
  protected readonly auth = inject(AuthService);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly demoUsers = signal<DemoUser[]>([]);

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: [''],
  });

  /** Errores inline: visibles al tocar el campo (validación on-blur, ux §8). */
  protected emailError(): string | null {
    const c = this.form.controls.email;
    if (c.valid || !c.touched) return null;
    if (c.hasError('required')) return 'El email es obligatorio';
    if (c.hasError('email')) return 'Introduce un email válido';
    return null;
  }

  protected passwordError(): string | null {
    const c = this.form.controls.password;
    if (c.valid || !c.touched || this.auth.demoMode) return null;
    if (c.hasError('required')) return 'La contraseña es obligatoria';
    return null;
  }

  protected readonly roleLabel = (role: UserRole): string => ROLE_LABEL[role] ?? role;

  constructor() {
    if (this.auth.demoMode) {
      this.auth
        .demoUsers()
        .then((users) => this.demoUsers.set(users))
        .catch(() => this.demoUsers.set([]));
    }
  }

  protected async demoEnter(email: string): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    const result = await this.auth.demoLogin(email);
    this.busy.set(false);
    if (result.ok) this.afterLogin();
    else this.error.set(result.error ?? 'No se pudo iniciar la sesión demo');
  }

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email, password);
    this.busy.set(false);
    if (result.ok) this.afterLogin();
    else this.error.set(result.error ?? 'No se pudo iniciar sesión');
  }

  private afterLogin(): void {
    const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
    void this.router.navigateByUrl(returnUrl);
  }

  protected async google(): Promise<void> {
    this.busy.set(true);
    await this.auth.signInWithGoogle();
  }
}
