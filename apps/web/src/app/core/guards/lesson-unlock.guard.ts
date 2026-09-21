import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CourseService } from '../course/course.service';
import { ToastService } from '../toast/toast.service';

/**
 * Bloqueo secuencial de lecciones (spec §6.2): la lección N+1 permanece
 * bloqueada hasta completar la N. Espejo del ejemplo de la especificación:
 *
 *   progressService.isLessonUnlocked(lessonId).pipe(
 *     map(unlocked => unlocked || router.createUrlTree([...]))
 *   )
 *
 * El estado `unlocked` por lección lo calcula el backend en el detalle del
 * curso (y se revalida al pedir la URL firmada del video).
 */
export const lessonUnlockGuard: CanActivateFn = (route) => {
  const courses = inject(CourseService);
  const router = inject(Router);
  const toast = inject(ToastService);

  const courseId = route.paramMap.get('courseId') ?? '';
  const lessonId = route.paramMap.get('lessonId');
  if (!lessonId) return true;

  return courses.isLessonUnlocked(courseId, lessonId).pipe(
    map((unlocked) => {
      if (unlocked) return true;
      toast.info('Completa las lecciones anteriores para desbloquear esta');
      return router.createUrlTree(['/aprender', courseId]);
    }),
    catchError(() => of(true)), // si falla la verificación, decide la API al pedir playback
  );
};
