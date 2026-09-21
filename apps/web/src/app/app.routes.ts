import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { rolesGuard } from './core/guards/roles.guard';
import { enrollmentGuard } from './core/guards/enrollment.guard';

/**
 * Rutas con lazy loading de TODOS los módulos de features (spec §7.1),
 * especialmente instructor/admin que un estudiante no debe descargar.
 */
export const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./features/home/home.page').then((m) => m.HomePage),
  },
  {
    path: 'cursos',
    loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage),
  },
  {
    path: 'cursos/:slug',
    loadComponent: () => import('./features/course/course-detail.page').then((m) => m.CourseDetailPage),
  },
  {
    path: '',
    loadChildren: () => import('./features/auth/auth.routes').then((m) => m.AUTH_ROUTES),
  },
  {
    path: 'checkout',
    loadChildren: () => import('./features/checkout/checkout.routes').then((m) => m.CHECKOUT_ROUTES),
  },
  {
    // Reproductor: requiere sesión + acceso (inscrito/dueño) + desbloqueo
    // secuencial de la lección (Guard — spec §6.2; el backend revalida).
    path: 'aprender/:courseId',
    canActivate: [authGuard, enrollmentGuard],
    loadChildren: () => import('./features/learn/learn.routes').then((m) => m.LEARN_ROUTES),
  },
  {
    path: 'mi-aprendizaje',
    canActivate: [authGuard],
    loadChildren: () => import('./features/student/student.routes').then((m) => m.STUDENT_ROUTES),
  },
  {
    path: 'instructor',
    canMatch: [rolesGuard('instructor')],
    canActivate: [authGuard, rolesGuard('instructor')],
    loadChildren: () => import('./features/instructor/instructor.routes').then((m) => m.INSTRUCTOR_ROUTES),
  },
  {
    path: 'admin',
    canMatch: [rolesGuard('admin')],
    canActivate: [authGuard, rolesGuard('admin')],
    loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES),
  },
  {
    path: 'legal/:doc',
    loadComponent: () => import('./features/legal/legal.page').then((m) => m.LegalPage),
  },
  {
    path: '**',
    loadComponent: () => import('./features/legal/not-found.page').then((m) => m.NotFoundPage),
  },
];
