import { Injectable, inject, signal } from '@angular/core';
import { fromEvent, interval, merge } from 'rxjs';
import { filter } from 'rxjs/operators';
import type { ProgressUpdateResponse } from '@manako/shared';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';
import { ApiClient } from '../http/api-client.service';

const STORAGE_KEY = 'manako:progress-buffer';
const FLUSH_INTERVAL_MS = 5_000;

/**
 * Tracking de progreso eficiente (spec §7.4):
 *  - El reproductor llama a `record()` en cada timeupdate (barato, local).
 *  - Un flujo RxJS hace flush al backend cada ~5s (equivalente funcional al
 *    throttleTime(5000) del ejemplo de la spec): nunca 1 request/segundo.
 *  - Buffer persistido en localStorage: si cae la red no se pierde progreso
 *    y se sincroniza al recuperar conexión (evento `online`).
 *  - Flush síncrono con fetch keepalive al cerrar/ocultar la pestaña.
 */
@Injectable({ providedIn: 'root' })
export class ProgressTrackerService {
  private readonly api = inject(ApiClient);
  private readonly auth = inject(AuthService);
  private buffer = new Map<string, number>();
  private flushing = false;

  /** Última respuesta del backend (completed flags + % del curso). */
  readonly lastUpdate = signal<ProgressUpdateResponse | null>(null);

  constructor() {
    this.restore();

    // Flush periódico + al recuperar conexión + al ocultar la pestaña
    merge(
      interval(FLUSH_INTERVAL_MS),
      fromEvent(window, 'online'),
      fromEvent(document, 'visibilitychange').pipe(filter(() => document.visibilityState === 'hidden')),
    ).subscribe(() => void this.flush());

    // Última oportunidad al cerrar (fetch keepalive sobrevive al unload)
    window.addEventListener('pagehide', () => this.flushSync());
  }

  /** Registrar tiempo visto (monótono creciente por lección). */
  record(lessonId: string, watchedSeconds: number): void {
    const seconds = Math.floor(watchedSeconds);
    if (seconds < 0) return;
    const current = this.buffer.get(lessonId) ?? this.readStored()[lessonId] ?? 0;
    if (seconds > current) {
      this.buffer.set(lessonId, seconds);
      this.persist();
    }
  }

  /** Forzar sincronización inmediata (fin de video, navegación…). */
  async flush(): Promise<void> {
    if (this.flushing || this.buffer.size === 0 || !navigator.onLine) return;
    if (!this.auth.isAuthenticated()) return;
    this.flushing = true;

    const items = [...this.buffer.entries()].map(([lessonId, watchedSeconds]) => ({
      lessonId,
      watchedSeconds,
    }));
    try {
      const response = await this.api.putAsync<ProgressUpdateResponse>('/progress', { items });
      // Solo descartar lo que efectivamente se envió
      for (const item of items) this.buffer.delete(item.lessonId);
      this.persist();
      this.lastUpdate.set(response);
    } catch {
      // Sin conexión/error: el buffer sigue en localStorage y se reintenta
    } finally {
      this.flushing = false;
    }
  }

  /** Flush de cierre de pestaña: fetch keepalive con el token actual. */
  private flushSync(): void {
    if (this.buffer.size === 0) return;
    const items = [...this.buffer.entries()].map(([lessonId, watchedSeconds]) => ({
      lessonId,
      watchedSeconds,
    }));
    void this.auth.getAccessToken().then((token) => {
      if (!token) return;
      void fetch(`${environment.apiUrl}/progress`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ items }),
        keepalive: true,
      });
      this.buffer.clear();
      this.persist();
    });
  }

  // ── Persistencia local (buffer resiliente a cortes de red) ───────────────

  private persist(): void {
    const stored = this.readStored();
    for (const [lessonId, seconds] of this.buffer) {
      stored[lessonId] = Math.max(stored[lessonId] ?? 0, seconds);
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(stored));
    } catch {
      /* almacenamiento lleno/no disponible: el buffer en memoria sigue vivo */
    }
  }

  private restore(): void {
    const stored = this.readStored();
    for (const [lessonId, seconds] of Object.entries(stored)) {
      this.buffer.set(lessonId, seconds);
    }
  }

  private readStored(): Record<string, number> {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, number>;
    } catch {
      return {};
    }
  }
}
