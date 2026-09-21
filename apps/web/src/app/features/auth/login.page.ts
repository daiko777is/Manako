import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 class="text-center text-2xl font-bold text-slate-900">Bienvenido de vuelta</h1>
      <p class="mt-1 text-center text-sm text-slate-500">
        Continúa aprendiendo donde lo dejaste
      </p>

      <form [formGroup]="form" (ngSubmit)="submit()" class="card mt-8 space-y-4 p-6" novalidate>
        <div>
          <label for="email" class="label">Email</label>
          <input id="email" type="email" formControlName="email" class="input"
                 placeholder="tu@email.com" autocomplete="email" required />
        </div>
        <div>
          <label for="password" class="label">Contraseña</label>
          <input id="password" type="password" formControlName="password" class="input"
                 placeholder="••••••••" autocomplete="current-password" required />
        </div>

        @if (error()) {
          <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error() }}</p>
        }

        <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || busy()">
          {{ busy() ? 'Entrando…' : 'Iniciar sesión' }}
        </button>

        <div class="relative py-2 text-center">
          <span class="relative z-10 bg-white px-2 text-xs text-slate-400">o</span>
          <span class="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true"></span>
        </div>

        <button type="button" class="btn-secondary w-full" (click)="google()" [disabled]="busy()">
          Continuar con Google
        </button>

        <p class="text-center text-sm text-slate-500">
          ¿No tienes cuenta?
          <a routerLink="/registro" class="font-semibold text-brand-700 hover:underline">Regístrate gratis</a>
        </p>
      </form>
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
