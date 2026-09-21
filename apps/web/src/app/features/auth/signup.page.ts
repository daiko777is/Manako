import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto flex max-w-md flex-col px-4 py-16">
      <h1 class="text-center text-2xl font-bold text-slate-900">Crea tu cuenta</h1>
      <p class="mt-1 text-center text-sm text-slate-500">Empieza a aprender gratis hoy mismo</p>

      @if (needsConfirmation()) {
        <div class="card mt-8 p-6 text-center" role="status">
          <p class="text-3xl">📬</p>
          <p class="mt-3 font-semibold text-slate-900">Revisa tu email</p>
          <p class="mt-1 text-sm text-slate-600">
            Te enviamos un enlace de confirmación. Cuando lo pulses, podrás iniciar sesión.
          </p>
          <a routerLink="/login" class="btn-primary mt-6 inline-flex">Ir a iniciar sesión</a>
        </div>
      } @else {
        <form [formGroup]="form" (ngSubmit)="submit()" class="card mt-8 space-y-4 p-6" novalidate>
          <div>
            <label for="fullName" class="label">Nombre completo</label>
            <input id="fullName" type="text" formControlName="fullName" class="input"
                   placeholder="Ana García" autocomplete="name" required />
          </div>
          <div>
            <label for="email" class="label">Email</label>
            <input id="email" type="email" formControlName="email" class="input"
                   placeholder="tu@email.com" autocomplete="email" required />
          </div>
          <div>
            <label for="password" class="label">Contraseña</label>
            <input id="password" type="password" formControlName="password" class="input"
                   placeholder="Mínimo 8 caracteres" autocomplete="new-password" required />
            <p class="mt-1 text-xs text-slate-400">Mínimo 8 caracteres (recomendado por seguridad).</p>
          </div>

          <label class="flex items-start gap-2 text-xs text-slate-500">
            <input type="checkbox" formControlName="terms" class="mt-0.5 accent-brand-600" required />
            <span>
              Acepto los
              <a routerLink="/legal/terminos" class="text-brand-700 underline" target="_blank">términos y condiciones</a>
              y la
              <a routerLink="/legal/privacidad" class="text-brand-700 underline" target="_blank">política de privacidad</a>.
            </span>
          </label>

          @if (error()) {
            <p class="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700" role="alert">{{ error() }}</p>
          }

          <button type="submit" class="btn-primary w-full" [disabled]="form.invalid || busy()">
            {{ busy() ? 'Creando cuenta…' : 'Crear cuenta' }}
          </button>

          <div class="relative py-2 text-center">
            <span class="relative z-10 bg-white px-2 text-xs text-slate-400">o</span>
            <span class="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true"></span>
          </div>

          <button type="button" class="btn-secondary w-full" (click)="google()" [disabled]="busy()">
            Registrarme con Google
          </button>

          <p class="text-center text-sm text-slate-500">
            ¿Ya tienes cuenta?
            <a routerLink="/login" class="font-semibold text-brand-700 hover:underline">Inicia sesión</a>
          </p>
        </form>
      }
    </div>
  `,
})
export class SignupPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly needsConfirmation = signal(false);

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    terms: [false, Validators.requiredTrue],
  });

  protected async submit(): Promise<void> {
    if (this.form.invalid) return;
    this.busy.set(true);
    this.error.set(null);
    const { fullName, email, password } = this.form.getRawValue();
    const result = await this.auth.signUp(email, password, fullName);
    this.busy.set(false);

    if (!result.ok) {
      this.error.set(result.error ?? 'No se pudo crear la cuenta');
      return;
    }
    if (result.error === 'confirm-email') {
      this.needsConfirmation.set(true);
      return;
    }
    void this.router.navigate(['/']);
  }

  protected async google(): Promise<void> {
    this.busy.set(true);
    await this.auth.signInWithGoogle();
  }
}
