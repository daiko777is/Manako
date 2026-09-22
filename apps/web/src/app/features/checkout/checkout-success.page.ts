import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { EnrollmentsService } from '../../core/enrollments/enrollments.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EnrollmentSummary } from '@manako/shared';
import { IconComponent } from '../../shared/components/icon.component';

/**
 * Landing de retorno de Stripe Checkout. El acceso real lo concede el
 * webhook en el backend (spec §3.6); esta página refleja el estado
 * consultando inscripciones con reintentos (backoff).
 */
@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relative flex min-h-[70vh] items-center justify-center overflow-hidden px-4 py-24">
      <div class="absolute inset-0 bg-mesh-hero opacity-30" aria-hidden="true"></div>
      <div class="absolute left-1/4 top-10 h-72 w-72 animate-blob rounded-full bg-emerald-400/20 blur-3xl" aria-hidden="true"></div>
      <div class="absolute bottom-0 right-1/4 h-64 w-64 animate-blob rounded-full bg-brand-500/20 blur-3xl [animation-delay:-5s]" aria-hidden="true"></div>

      <div class="card relative w-full max-w-lg animate-pop-in p-10 text-center">
        @if (enrollment(); as e) {
          <span class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-emerald-400 to-teal-600 text-white shadow-glow">
            <app-icon name="check" [size]="38" />
          </span>
          <h1 class="mt-6 font-heading text-3xl font-bold text-slate-900">¡Pago confirmado!</h1>
          <p class="mt-3 text-slate-600">
            Ya estás inscrito en
            <strong class="font-semibold text-slate-900">{{ e.course.title }}</strong>.
          </p>
          <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <a [routerLink]="['/aprender', e.courseId]" class="btn-primary btn-lg">
              <app-icon name="play" [size]="17" /> Empezar ahora
            </a>
            <a routerLink="/mi-aprendizaje" class="btn-secondary btn-lg">Mi aprendizaje</a>
          </div>
          <p class="mt-6 text-xs text-slate-400">
            Recibirás el recibo de Stripe por email. Puedes pedir factura desde allí.
          </p>
        } @else {
          <span class="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow">
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></span>
          </span>
          <h1 class="mt-6 font-heading text-2xl font-bold text-slate-900">Confirmando tu pago…</h1>
          <p class="mt-3 text-sm leading-relaxed text-slate-500">
            Estamos esperando la confirmación de Stripe (unos segundos). Tu acceso
            aparecerá automáticamente y te avisaremos por email.
          </p>
          <div class="mt-8">
            <a routerLink="/mi-aprendizaje" class="btn-secondary">Ir a mi aprendizaje</a>
          </div>
        }
      </div>
    </div>
  `,
})
export class CheckoutSuccessPage {
  private readonly enrollments = inject(EnrollmentsService);
  private readonly route = inject(ActivatedRoute);
  private readonly auth = inject(AuthService);

  protected readonly enrollment = signal<EnrollmentSummary | null>(null);

  constructor() {
    const sessionId = this.route.snapshot.queryParamMap.get('session_id');
    this.poll(0, sessionId);
  }

  private poll(attempt: number, sessionId: string | null): void {
    if (attempt >= 5) return;
    this.enrollments
      .mine()
      .pipe(takeUntilDestroyed())
      .subscribe((list) => {
        const recent = list[0];
        if (recent && (!sessionId || this.isRecent(recent.enrolledAt))) {
          this.enrollment.set(recent);
        } else {
          setTimeout(() => this.poll(attempt + 1, sessionId), 2000);
        }
      });
    void this.auth.refreshProfile();
  }

  private isRecent(enrolledAt: string): boolean {
    return Date.now() - new Date(enrolledAt).getTime() < 10 * 60 * 1000;
  }
}
