import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Input,
  NgZone,
  OnDestroy,
  inject,
  signal,
} from '@angular/core';

/**
 * Contador animado para bandas de estadísticas: cuenta de 0 al objetivo con
 * easing cuando entra en viewport (requestAnimationFrame, fuera de la zone).
 * Con prefers-reduced-motion muestra el valor final directamente.
 */
@Component({
  selector: 'app-stats-counter',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span>{{ display() }}{{ suffix }}</span>`,
})
export class StatsCounterComponent implements AfterViewInit, OnDestroy {
  @Input({ required: true }) target = 0;
  @Input() suffix = '';
  @Input() durationMs = 1400;
  @Input() decimals = 0;

  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly zone = inject(NgZone);
  protected readonly display = signal('0');
  private observer: IntersectionObserver | null = null;
  private raf = 0;

  ngAfterViewInit(): void {
    const reduce =
      typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || typeof IntersectionObserver === 'undefined') {
      this.display.set(this.format(this.target));
      return;
    }
    this.zone.runOutsideAngular(() => {
      this.observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            this.observer?.disconnect();
            this.animate();
          }
        },
        { threshold: 0.4 },
      );
      this.observer.observe(this.el.nativeElement);
    });
  }

  private animate(): void {
    const start = performance.now();
    const step = (now: number): void => {
      const t = Math.min(1, (now - start) / this.durationMs);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      const value = this.target * eased;
      this.zone.run(() => this.display.set(this.format(value)));
      if (t < 1) this.raf = requestAnimationFrame(step);
    };
    this.raf = requestAnimationFrame(step);
  }

  private format(value: number): string {
    return value.toLocaleString('es-ES', {
      minimumFractionDigits: this.decimals,
      maximumFractionDigits: this.decimals,
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.observer?.disconnect();
  }
}
