import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { EnrollmentsService } from '../../core/enrollments/enrollments.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import type { EnrollmentSummary } from '@manako/shared';

/**
 * Landing de retorno de Stripe Checkout. Importante (spec §3.6): el acceso
 * real lo concede el webhook de Stripe en el backend; esta página solo
 * refleja el estado consultando las inscripciones del usuario (con reintentos
 * porque el webhook puede tardar unos segundos).
 */
@Component({
  selector: 'app-checkout-success',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-xl px-4 py-24 text-center">
      @if (enrollment(); as e) {
        <p class="text-6xl" aria-hidden="true">🎉</p>
        <h1 class="mt-4 text-3xl font-bold text-slate-900">¡Pago confirmado!</h1>
        <p class="mt-2 text-slate-600">
          Ya estás inscrito en <strong>{{ e.course.title }}</strong>.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a [routerLink]="['/aprender', e.courseId]" class="btn-primary">Empezar ahora →</a>
          <a routerLink="/mi-aprendizaje" class="btn-secondary">Mi aprendizaje</a>
        </div>
      } @else {
        <p class="text-5xl" aria-hidden="true">⏳</p>
        <h1 class="mt-4 text-2xl font-bold text-slate-900">Confirmando tu pago…</h1>
        <p class="mt-2 text-slate-600">
          Estamos esperando la confirmación de Stripe (unos segundos). Recibirás tu acceso
          automáticamente; también te avisaremos por email.
        </p>
        <div class="mt-8 flex justify-center gap-3">
          <a routerLink="/mi-aprendizaje" class="btn-secondary">Ir a mi aprendizaje</a>
        </div>
      }
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
    // El webhook puede ir unos segundos por delante/detrás del redirect:
    // reintentamos hasta 5 veces con backoff.
    this.poll(0, sessionId);
  }

  private poll(attempt: number, sessionId: string | null): void {
    if (attempt >= 5) return;
    this.enrollments
      .mine()
      .pipe(takeUntilDestroyed())
      .subscribe((list) => {
        // La inscripción más reciente suele ser la del checkout recién terminado
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
