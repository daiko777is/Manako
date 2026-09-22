import {
  AfterViewInit,
  Directive,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  inject,
} from '@angular/core';

/**
 * Scroll reveal (patrón "scroll-triggered storytelling" de la skill
 * ui-ux-pro-max): añade .reveal-visible cuando el elemento entra en
 * viewport. Fallback sin IntersectionObserver → visible directo.
 * prefers-reduced-motion se respeta vía CSS global (.reveal queda visible).
 *
 * Uso: <div appReveal [appRevealDelay]="120">…</div>
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
})
export class RevealDirective implements AfterViewInit, OnDestroy {
  @Input() appRevealDelay = 0;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  private observer: IntersectionObserver | null = null;

  ngAfterViewInit(): void {
    const native = this.el.nativeElement;
    native.classList.add('reveal');
    if (this.appRevealDelay > 0) {
      native.style.setProperty('--reveal-delay', `${this.appRevealDelay}ms`);
    }

    if (typeof IntersectionObserver === 'undefined') {
      native.classList.add('reveal-visible');
      return;
    }

    // El observer vive fuera de la zone de Angular (rendimiento)
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (entry.isIntersecting) {
              entry.target.classList.add('reveal-visible');
              this.observer?.unobserve(entry.target);
            }
          }
        },
        { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
      );
      this.observer.observe(native);
    });
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
    this.observer = null;
  }
}
