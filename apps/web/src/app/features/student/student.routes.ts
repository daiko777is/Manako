import { Routes } from '@angular/router';

export const STUDENT_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./student-dashboard.page').then((m) => m.StudentDashboardPage),
  },
];
