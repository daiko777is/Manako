import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import type { CheckoutResponse, CourseDetail } from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

export interface AccessCheck {
  enrolled: boolean;
  isOwner: boolean;
  isAdmin: boolean;
  slug: string | null;
}

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly api = inject(ApiClient);

  getDetailBySlug(slug: string): Observable<CourseDetail> {
    return this.api.get<CourseDetail>(`/courses/${slug}`);
  }

  getDetailById(id: string): Observable<CourseDetail> {
    return this.api.get<CourseDetail>(`/courses/id/${id}`);
  }

  checkAccess(courseId: string): Observable<AccessCheck> {
    return this.api.get<AccessCheck>(`/enrollments/check/${courseId}`);
  }

  /** ¿Está desbloqueada la lección para el usuario actual? (spec §6.2) */
  isLessonUnlocked(courseId: string, lessonId: string): Observable<boolean> {
    return this.getDetailById(courseId).pipe(
      map((detail) =>
        detail.modules
          .flatMap((m) => m.lessons)
          .some((l) => l.id === lessonId && (l.isPreview || l.unlocked === true)),
      ),
    );
  }

  /** Checkout: gratis → inscripción inmediata; pago → URL de Stripe. */
  checkout(courseId: string): Observable<CheckoutResponse> {
    return this.api.post<CheckoutResponse>('/payments/checkout', { courseId });
  }

  enrollFree(courseId: string) {
    return this.api.post('/enrollments/free/' + courseId);
  }
}
