import { Routes } from '@angular/router';
import { authGuard } from '../../core/guards/auth.guard';

export const CHECKOUT_ROUTES: Routes = [
  {
    path: 'success',
    canActivate: [authGuard],
    loadComponent: () => import('./checkout-success.page').then((m) => m.CheckoutSuccessPage),
  },
  {
    path: 'cancel',
    loadComponent: () => import('./checkout-cancel.page').then((m) => m.CheckoutCancelPage),
  },
];
