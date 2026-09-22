import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

const CONSENT_KEY = 'manako:cookie-consent';

/**
 * Banner de consentimiento (spec §10.1 — ePrivacy/GDPR). Solo cookies
 * técnicas de sesión; sin trackers de terceros en el MVP.
 */
@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div
        class="fixed inset-x-0 bottom-0 z-50 animate-fade-up px-4 pb-4"
        role="dialog"
        aria-label="Aviso de cookies"
      >
        <div class="glass mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-2xl p-5 sm:flex-row sm:items-center">
          <span class="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-500 to-violet-600 text-white shadow-glow">
            <app-icon name="shield" [size]="20" />
          </span>
          <p class="flex-1 text-sm leading-relaxed text-slate-600">
            Usamos <strong class="font-semibold text-slate-800">cookies técnicas</strong> para mantener
            tu sesión y recordar tu progreso. Sin trackers publicitarios.
            <a routerLink="/legal/cookies" class="font-semibold text-brand-700 underline decoration-dotted underline-offset-2">Más información</a>.
          </p>
          <div class="flex w-full gap-2 sm:w-auto">
            <button type="button" class="btn-secondary btn-sm flex-1 sm:flex-none" (click)="decide('rejected')">
              Solo necesarias
            </button>
            <button type="button" class="btn-primary btn-sm flex-1 sm:flex-none" (click)="decide('accepted')">
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
