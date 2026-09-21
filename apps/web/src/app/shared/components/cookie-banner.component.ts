import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

const CONSENT_KEY = 'manako:cookie-consent';

/**
 * Banner de consentimiento de cookies (spec §10.1 — obligatorio en UE por
 * ePrivacy/GDPR). Guarda la decisión en localStorage. Solo se usan cookies
 * técnicas de sesión (Supabase Auth); no hay trackers de terceros en el MVP.
 */
@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_16px_rgba(0,0,0,0.06)]"
        role="dialog"
        aria-label="Aviso de cookies"
      >
        <div class="mx-auto flex max-w-5xl flex-col items-start gap-4 sm:flex-row sm:items-center">
          <p class="flex-1 text-sm text-slate-600">
            Usamos cookies técnicas necesarias para mantener tu sesión y recordar tu progreso.
            No instalamos trackers publicitarios. Más información en la
            <a routerLink="/legal/cookies" class="font-medium text-brand-700 underline">política de cookies</a>.
          </p>
          <div class="flex gap-2">
            <button type="button" class="btn-secondary btn-sm" (click)="decide('rejected')">
              Solo necesarias
            </button>
            <button type="button" class="btn-primary btn-sm" (click)="decide('accepted')">
              Aceptar
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class CookieBannerComponent {
  protected readonly visible = signal(false);

  constructor() {
    try {
      this.visible.set(!localStorage.getItem(CONSENT_KEY));
    } catch {
      this.visible.set(false);
    }
  }

  protected decide(choice: 'accepted' | 'rejected'): void {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice, at: new Date().toISOString() }));
    } catch {
      /* almacenamiento no disponible */
    }
    this.visible.set(false);
  }
}
