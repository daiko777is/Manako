import { Routes } from '@angular/router';

export const INSTRUCTOR_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./instructor-dashboard.page').then((m) => m.InstructorDashboardPage),
  },
  {
    path: 'cursos/:courseId',
    loadComponent: () => import('./course-editor.component').then((m) => m.CourseEditorPage),
  },
];
