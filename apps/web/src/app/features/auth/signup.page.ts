import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { IconComponent } from '../../shared/components/icon.component';

@Component({
  selector: 'app-signup',
  standalone: true,
  imports: [ReactiveFormsModule, RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid min-h-[calc(100vh-4rem)] lg:grid-cols-2">
      <!-- Panel de marca -->
      <aside class="relative hidden overflow-hidden bg-slate-950 lg:block">
        <div class="absolute inset-0 bg-mesh-hero opacity-90" aria-hidden="true"></div>
        <div class="absolute inset-0 bg-grid-fade bg-grid opacity-30" aria-hidden="true"></div>
        <div class="absolute -right-20 top-16 h-80 w-80 animate-blob rounded-full bg-violet-600/30 blur-3xl" aria-hidden="true"></div>
        <div class="absolute -left-16 bottom-0 h-72 w-72 animate-blob rounded-full bg-sky-500/25 blur-3xl [animation-delay:-6s]" aria-hidden="true"></div>

        <div class="relative flex h-full flex-col justify-between p-12">
          <a routerLink="/" class="flex w-fit items-center gap-2.5">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-500 font-heading text-lg font-bold text-white shadow-glow">M</span>
            <span class="font-heading text-lg font-bold text-white">Manakō</span>
          </a>

          <div>
            <h2 class="font-heading text-3xl font-bold leading-snug text-white">
              Tu cuenta gratis incluye
            </h2>
            <ul class="mt-8 space-y-5">
              @for (perk of perks; track perk.title) {
                <li class="flex items-start gap-4">
                  <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-glow" [style.background]="perk.bg">
                    <app-icon [name]="perk.icon" [size]="20" />
                  </span>
                  <div>
                    <p class="font-semibold text-white">{{ perk.title }}</p>
                    <p class="mt-0.5 text-sm text-slate-400">{{ perk.text }}</p>
                  </div>
                </li>
              }
            </ul>
          </div>

          <p class="text-xs text-slate-500">© {{ year }} Manakō · Sin tarjeta para empezar</p>
        </div>
      </aside>

      <!-- Formulario -->
      <main class="flex items-center justify-center px-4 py-16 sm:px-8">
        <div class="w-full max-w-md">
          <div class="mb-8 flex items-center gap-2.5 lg:hidden">
            <span class="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-brand-500 via-violet-600 to-fuchsia-500 font-heading text-lg font-bold text-white">M</span>
            <span class="font-heading text-lg font-bold text-slate-900">Manakō</span>
          </div>

          @if (needsConfirmation()) {
            <div class="card animate-pop-in p-8 text-center">
              <span class="mx-auto flex h-16 w-16 animate-float items-center justify-center rounded-3xl bg-gradient-to-br from-brand-50 to-violet-50 text-brand-600">
                <app-icon name="envelope" [size]="30" />
              </span>
              <h1 class="mt-5 font-heading text-2xl font-bold text-slate-900">Revisa tu email</h1>
              <p class="mt-2 text-sm leading-relaxed text-slate-500">
                Te enviamos un enlace de confirmación. Cuando lo pulses, podrás
                iniciar sesión y empezar tu primer curso.
              </p>
              <a routerLink="/login" class="btn-primary mt-7 inline-flex">
                Ir a iniciar sesión <app-icon name="arrow-right" [size]="16" />
              </a>
            </div>
          } @else {
            <h1 class="font-heading text-3xl font-bold text-slate-900">Crea tu cuenta</h1>
            <p class="mt-2 text-slate-500">Empieza a aprender gratis hoy mismo.</p>

            <form [formGroup]="form" (ngSubmit)="submit()" class="mt-8 space-y-5" novalidate>
              <div>
                <label for="fullName" class="label">Nombre completo</label>
                <div class="relative">
                  <span class="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400">
                    <app-icon name="user" [size]="17" />
                  </span>
                  <input id="fullName" type="text" formControlName="fullName" class="input !pl-11"
                         placeholder="Ana García" autocomplete="name" required />
                </div>
              </div>
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
                         placeholder="Mínimo 8 caracteres" autocomplete="new-password" required />
                </div>
                <!-- Medidor de fuerza de contraseña -->
                <div class="mt-2 flex items-center gap-2">
                  <div class="flex h-1.5 flex-1 gap-1" aria-hidden="true">
                    @for (seg of [1, 2, 3, 4]; track seg) {
                      <span class="flex-1 rounded-full transition-colors duration-300"
                            [class]="seg <= passwordStrength() ? strengthColor() : 'bg-slate-200'"></span>
                    }
                  </div>
                  <span class="text-[11px] font-semibold" [class]="strengthTextClass()">{{ strengthLabel() }}</span>
                </div>
              </div>

              <label class="flex cursor-pointer items-start gap-2.5 text-xs leading-relaxed text-slate-500">
                <input type="checkbox" formControlName="terms" class="mt-0.5 h-4 w-4 rounded accent-brand-600" required />
                <span>
                  Acepto los
                  <a routerLink="/legal/terminos" class="font-semibold text-brand-700 underline decoration-dotted underline-offset-2" target="_blank">términos y condiciones</a>
                  y la
                  <a routerLink="/legal/privacidad" class="font-semibold text-brand-700 underline decoration-dotted underline-offset-2" target="_blank">política de privacidad</a>.
                </span>
              </label>

              @if (error()) {
                <p class="flex animate-fade-up items-center gap-2 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 ring-1 ring-inset ring-rose-600/15" role="alert">
                  <app-icon name="shield" [size]="16" /> {{ error() }}
                </p>
              }

              <button type="submit" class="btn-primary w-full btn-lg" [disabled]="form.invalid || busy()">
                @if (busy()) {
                  <span class="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
                  Creando cuenta…
                } @else {
                  Crear cuenta gratis <app-icon name="arrow-right" [size]="16" />
                }
              </button>

              <div class="relative py-1 text-center">
                <span class="relative z-10 bg-slate-50 px-3 text-xs font-medium uppercase tracking-wider text-slate-400">o</span>
                <span class="absolute inset-x-0 top-1/2 h-px bg-slate-200" aria-hidden="true"></span>
              </div>

              <button type="button" class="btn-secondary w-full btn-lg" (click)="google()" [disabled]="busy()">
                <app-icon name="google" [size]="18" /> Registrarme con Google
              </button>

              <p class="text-center text-sm text-slate-500">
                ¿Ya tienes cuenta?
                <a routerLink="/login" class="font-bold text-brand-700 transition hover:text-violet-600">Inicia sesión</a>
              </p>
            </form>
          }
        </div>
      </main>
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
  protected readonly year = new Date().getFullYear();

  protected readonly perks = [
    { icon: 'play', bg: 'linear-gradient(135deg,#4f46e5,#7c3aed)', title: 'Lecciones de muestra gratis', text: 'Prueba cualquier curso antes de comprometerte.' },
    { icon: 'chart-bar', bg: 'linear-gradient(135deg,#0ea5e9,#4f46e5)', title: 'Progreso automático', text: 'Retoma cada curso exactamente donde lo dejaste.' },
    { icon: 'award', bg: 'linear-gradient(135deg,#d946ef,#7c3aed)', title: 'Certificados', text: 'Al completar el 100% de las lecciones.' },
    { icon: 'fire', bg: 'linear-gradient(135deg,#f59e0b,#ef4444)', title: 'A tu ritmo', text: 'Acceso de por vida, sin horarios ni presiones.' },
  ];

  protected readonly form = this.fb.nonNullable.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    terms: [false, Validators.requiredTrue],
  });

  /** Fuerza de contraseña (0-4) para el medidor visual. */
  protected passwordStrength(): number {
    const v = this.form.controls.password.value;
    if (!v) return 0;
    let score = 0;
    if (v.length >= 8) score++;
    if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
    if (/\d/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    return score;
  }

  protected strengthColor(): string {
    const colors = ['bg-rose-400', 'bg-amber-400', 'bg-lime-400', 'bg-emerald-500'];
    return colors[this.passwordStrength() - 1] ?? 'bg-slate-200';
  }

  protected strengthLabel(): string {
    const labels = ['', 'Débil', 'Aceptable', 'Buena', 'Excelente'];
    return labels[this.passwordStrength()] ?? '';
  }

  protected strengthTextClass(): string {
    const classes = ['text-slate-400', 'text-rose-500', 'text-amber-500', 'text-lime-600', 'text-emerald-600'];
    return classes[this.passwordStrength()] ?? 'text-slate-400';
  }

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
