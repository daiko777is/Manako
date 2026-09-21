import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { NavbarComponent } from './shared/components/navbar.component';
import { FooterComponent } from './shared/components/footer.component';
import { ToastHostComponent } from './core/toast/toast-host.component';
import { CookieBannerComponent } from './shared/components/cookie-banner.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, NavbarComponent, FooterComponent, ToastHostComponent, CookieBannerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-screen flex-col">
      <app-navbar />
      <main class="flex-1">
        <router-outlet />
      </main>
      <app-footer />
      <app-cookie-banner />
      <app-toast-host />
    </div>
  `,
})
export class AppComponent {}
