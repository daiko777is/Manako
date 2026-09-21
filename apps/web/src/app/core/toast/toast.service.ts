import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: number;
  kind: 'success' | 'error' | 'info';
  message: string;
}

/** Notificaciones globales simples (consumidas por el errorInterceptor y páginas). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly toasts = signal<Toast[]>([]);
  private seq = 0;

  success(message: string): void {
    this.push({ kind: 'success', message });
  }

  error(message: string): void {
    this.push({ kind: 'error', message });
  }

  info(message: string): void {
    this.push({ kind: 'info', message });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private push(t: Omit<Toast, 'id'>): void {
    const id = ++this.seq;
    this.toasts.update((list) => [...list, { ...t, id }]);
    setTimeout(() => this.dismiss(id), 4500);
  }
}
