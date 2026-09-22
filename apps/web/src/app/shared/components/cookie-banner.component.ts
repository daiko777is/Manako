import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { IconComponent } from './icon.component';

const CONSENT_KEY = 'manako:cookie-consent';

/** Banner de consentimiento (spec §10.1). Tarjeta blanca sobria, sin glass. */
@Component({
  selector: 'app-cookie-banner',
  standalone: true,
  imports: [RouterLink, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (visible()) {
      <div class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4" role="dialog" aria-label="Aviso de cookies">
        <div
          class="mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-xl border border-slate-200 bg-white p-5 shadow-[var(--shadow-md2)] sm:flex-row sm:items-center"
        >
          <span class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            <app-icon name="shield" [size]="19" />
          </span>
          <p class="flex-1 text-sm leading-relaxed text-slate-600">
            Usamos <strong class="font-semibold text-slate-900">cookies técnicas</strong> para mantener
            tu sesión y recordar tu progreso. Sin trackers publicitarios.
            <a routerLink="/legal/cookies" class="font-semibold text-brand-700 underline underline-offset-2 hover:text-brand-800">Más información</a>.
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
