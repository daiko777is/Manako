import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CourseService } from '../course/course.service';
import { ToastService } from '../toast/toast.service';

/**
 * Acceso al reproductor: exige inscripción activa, ser el dueño del curso
 * o admin. Si no hay acceso → redirect a la página del curso (donde está
 * el CTA de compra). La autorización real ocurre en la API al pedir la
 * URL firmada del video; este guard solo mejora la UX.
 */
export const enrollmentGuard: CanActivateFn = (route) => {
  const courses = inject(CourseService);
  const router = inject(Router);
  const toast = inject(ToastService);
  const courseId = route.paramMap.get('courseId') ?? '';

  return courses.checkAccess(courseId).pipe(
    map((access) => {
      if (access.enrolled || access.isOwner || access.isAdmin) return true;
      toast.info('Inscríbete en el curso para acceder a las lecciones');
      return router.createUrlTree(['/cursos', access.slug ?? courseId]);
    }),
    catchError(() => {
      toast.error('No pudimos verificar tu acceso al curso');
      return of(router.createUrlTree(['/']));
    }),
  );
};
