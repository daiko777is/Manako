/** Utilidades puras de formato (precio, duración, fechas). */

export function formatMoney(cents: number, currency = 'USD'): string {
  if (cents === 0) return 'Gratis';
  try {
    return new Intl.NumberFormat('es-ES', { style: 'currency', currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

export function formatDuration(totalSeconds: number): string {
  if (!totalSeconds || totalSeconds < 0) return '0 min';
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.round((totalSeconds % 3600) / 60);
  if (hours > 0) return `${hours} h ${minutes.toString().padStart(2, '0')} min`;
  return `${minutes} min`;
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = m.toString().padStart(2, '0');
  const ss = sec.toString().padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '—';
  }
}

export function levelLabel(level: string): string {
  const map: Record<string, string> = {
    beginner: 'Principiante',
    intermediate: 'Intermedio',
    advanced: 'Avanzado',
  };
  return map[level] ?? level;
}

export function statusLabel(status: string): string {
  const map: Record<string, string> = {
    draft: 'Borrador',
    published: 'Publicado',
    archived: 'Archivado',
  };
  return map[status] ?? status;
}
