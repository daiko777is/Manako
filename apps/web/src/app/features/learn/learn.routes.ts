import { Routes } from '@angular/router';
import { lessonUnlockGuard } from '../../core/guards/lesson-unlock.guard';

export const LEARN_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () => import('./learn.page').then((m) => m.LearnPage),
  },
  {
    path: ':lessonId',
    canActivate: [lessonUnlockGuard],
    loadComponent: () => import('./learn.page').then((m) => m.LearnPage),
  },
];
