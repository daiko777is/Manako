import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <!-- Panel de marca: plano, retícula sutil -->
      <aside class="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div class="absolute inset-0 bg-grid-fade bg-grid opacity-[0.05]" aria-hidden="true"></div>

        <div class="relative flex h-full flex-col justify-between p-12">
          <a routerLink="/" class="flex w-fit items-center gap-2.5">
            <span class="flex h-8 w-8 items-center justify-center rounded-md bg-brand-600 font-heading text-base font-bold text-white">M</span>
            <span class="font-heading text-lg font-bold text-white">Manakō</span>
          </a>

          <div>
            <h2 class="max-w-sm font-heading text-3xl font-bold leading-snug text-white">
              Retoma el curso justo donde lo dejaste.
            </h2>
            <ul class="mt-8 space-y-4 text-sm text-slate-300">
              <li class="flex items-center gap-3">
                <span class="text-emerald-400"><app-icon name="check-circle" [size]="17" /></span>
                Progreso guardado automáticamente, segundo a segundo
              </li>
              <li class="flex items-center gap-3">
                <span class="text-emerald-400"><app-icon name="check-circle" [size]="17" /></span>
                Lecciones desbloqueadas en orden, sin perderte nada
              </li>
              <li class="flex items-center gap-3">
                <span class="text-emerald-400"><app-icon name="check-circle" [size]="17" /></span>
                Certificado al completar el 100% del currículo
              </li>
            </ul>
          </div>

          <p class="text-xs text-slate-500">© {{ year }} Manakō</p>
        </div>
      </aside>

      <!-- Formulario -->
      <main class="flex items-center justify-center px-4 py-16 sm:px-8">
        <div class="w-full max-w-md">
          <div class="mb-8 flex items-center gap-2.5 lg:hidden">
            <span class="flex h-9 w-9 items-center justify-center rounded-md bg-brand-600 font-heading text-lg font-bold text-white">M</span>
            <span class="font-heading text-lg font-bold text-slate-900">Manakō</span>
          </div>

          <h1 class="font-heading text-3xl font-bold text-slate-900">Bienvenido de vuelta</h1>
          <p class="mt-2 text-slate-500">Continúa aprendiendo donde lo dejaste.</p>

          <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-5" novalidate>
            <div>
              <label for="email" class="label">Email</label>
              <div class="relative">
                <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <app-icon name="envelope" [size]="17" />
                </span>
                <input id="email" type="email" formControlName="email" class="input !pl-11"
                       placeholder="tu@email.com" autocomplete="email" required />
              </div>
            </div>
            <div>
              <label for="password" class="label">Contraseña</label>
              <div class="relative">
                <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                  <app-icon name="lock" [size]="17" />
                </span>
                <input id="password" type="password" formControlName="password" class="input !pl-11"
                       placeholder="••••••••" autocomplete="current-password" required />
              </div>
            </div>

            @if (error()) {
              <p class="flex animate-fade-up items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/15" role="alert">
                <app-icon name="shield" [size]="16" /> {{ error() }}
              </p>
            }

            <button type="submit" class="btn-primary w-full btn-lg" [disabled]="form.invalid || busy()">
              @if (busy()) {
                <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                Entrando…
              } @else {
                Iniciar sesión <app-icon name="arrow-right" [size]="16" />
              }
            </button>

            <div class="relative py-1 text-center">
              <span class="relative z-10 bg-slate-50 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">o</span>
              <span class="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true"></span>
            </div>

            <button type="button" class="btn-secondary w-full btn-lg" (click)="google()" [disabled]="busy()">
              <app-icon name="google" [size]="18" /> Continuar con Google
            </button>

            <p class="text-center text-sm text-slate-500">
              ¿No tienes cuenta?
              <a routerLink="/registro" class="font-bold text-brand-700 transition hover:text-violet-600">Regístrate gratis</a>
            </p>
          </form>
        </div>
      </main>
    </div>
  `,
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly fb = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly year = new Date().getFullYear();

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { email, password } = this.form.getRawValue();
    const result = await this.auth.signIn(email, password);
    this.busy.set(false);
    if (result.ok) {
      const returnUrl = this.route.snapshot.queryParamMap.get('returnUrl') ?? '/';
      void this.router.navigateByUrl(returnUrl);
    } else {
      this.error.set(result.error ?? 'No se pudo iniciar sesión');
    }
  }

  protected async google(): Promise<void> {
    this.busy.set(true);
    await this.auth.signInWithGoogle();
  }
}
