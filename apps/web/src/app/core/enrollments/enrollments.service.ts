import { Injectable, inject } from '@angular/core';
import type { EnrollmentSummary } from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

@Injectable({ providedIn: 'root' })
export class EnrollmentsService {
  private readonly api = inject(ApiClient);

  mine() {
    return this.api.get<EnrollmentSummary[]>('/enrollments/me');
  }
}
