/**
 * Lógica pura de desbloqueo secuencial (spec §4/§6.2).
 * Espejo en TypeScript de la función SQL `lesson_is_unlocked` (migración 0002):
 * ambas capas deben coincidir — el frontend tiene Guards, pero la autoridad
 * final es el backend antes de emitir la URL firmada del video.
 */

export interface OrderedLessonRef {
  id: string;
  isPreview: boolean;
  /** orden global dentro del curso: (moduleOrder, lessonOrder) */
  moduleOrderIndex: number;
  orderIndex: number;
}

/**
 * Devuelve el conjunto de lessonIds desbloqueados para un usuario inscrito.
 * Regla: una lección está desbloqueada si todas las lecciones ANTERIORES
 * no-preview (en orden global del curso) están completadas.
 */
export function computeUnlockedSet(
  orderedLessons: OrderedLessonRef[],
  completedLessonIds: Set<string>,
): Set<string> {
  const sorted = [...orderedLessons].sort(
    (a, b) => a.moduleOrderIndex - b.moduleOrderIndex || a.orderIndex - b.orderIndex,
  );
  const unlocked = new Set<string>();
  let blocked = false;
  for (const lesson of sorted) {
    if (lesson.isPreview) {
      // Los previews siempre están accesibles y no bloquean la secuencia
      unlocked.add(lesson.id);
      continue;
    }
    if (!blocked) unlocked.add(lesson.id);
    if (!completedLessonIds.has(lesson.id)) blocked = true;
  }
  return unlocked;
}

/** Siguiente lección a continuar: primera no completada desbloqueada (o la última). */
export function findNextLessonId(
  orderedLessons: OrderedLessonRef[],
  completedLessonIds: Set<string>,
  unlockedIds?: Set<string>,
): string | null {
  const sorted = [...orderedLessons].sort(
    (a, b) => a.moduleOrderIndex - b.moduleOrderIndex || a.orderIndex - b.orderIndex,
  );
  const nonPreview = sorted.filter((l) => !l.isPreview);
  if (nonPreview.length === 0) return null;
  const next = nonPreview.find((l) => !completedLessonIds.has(l.id));
  if (next && (!unlockedIds || unlockedIds.has(next.id))) return next.id;
  if (next) return null; // aún bloqueada
  return nonPreview[nonPreview.length - 1]!.id; // curso completo → última
}

/** ¿Está completada la lección según el umbral de progreso? (spec §4: >= 90%) */
export function isCompletedByThreshold(
  watchedSeconds: number,
  durationSeconds: number,
  threshold: number,
): boolean {
  if (durationSeconds <= 0) return watchedSeconds > 0;
  return watchedSeconds >= durationSeconds * threshold;
}
