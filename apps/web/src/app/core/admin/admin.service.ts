import { Injectable, inject } from '@angular/core';
import type {
  AdminCourseRow,
  AdminMetrics,
  AdminUserRow,
  Paginated,
  PaymentSummary,
  UserRole,
} from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

/** API del panel de administración (rutas /admin/*, solo rol admin). */
@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiClient);

  metrics() {
    return this.api.get<AdminMetrics>('/admin/metrics');
  }

  users(query: { search?: string; cursor?: string; limit?: number }) {
    return this.api.get<Paginated<AdminUserRow>>('/admin/users', query);
  }

  setRole(userId: string, role: UserRole) {
    return this.api.patch<{ id: string; role: UserRole }>(`/admin/users/${userId}/role`, { role });
  }

  courses(status?: string) {
    return this.api.get<AdminCourseRow[]>('/admin/courses', { status });
  }

  setCourseStatus(courseId: string, status: 'draft' | 'published' | 'archived') {
    return this.api.patch(`/admin/courses/${courseId}/status`, { status });
  }

  payments(query: { status?: string; cursor?: string; limit?: number }) {
    return this.api.get<Paginated<PaymentSummary>>('/admin/payments', query);
  }

  refund(paymentId: string) {
    return this.api.post<PaymentSummary>(`/admin/payments/${paymentId}/refund`);
  }
}
