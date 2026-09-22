import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { debounceTime, switchMap } from 'rxjs';
import type { AdminCourseRow, AdminMetrics, AdminUserRow, PaymentSummary, UserRole } from '@manako/shared';
import { AdminService } from '../../core/admin/admin.service';
import { ToastService } from '../../core/toast/toast.service';
import { formatDate, formatMoney, statusLabel } from '../../shared/format';
import { IconComponent } from '../../shared/components/icon.component';

type Tab = 'metrics' | 'users' | 'courses' | 'payments';

/**
 * Panel de administración (spec §1 módulo 8): métricas globales, gestión
 * de usuarios/roles, moderación de cursos y pagos/reembolsos.
 */
@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-7xl px-4 py-10 sm:px-6">
      <header class="mb-8">
        <p class="eyebrow"><app-icon name="shield" [size]="13" /> Administración</p>
        <h1 class="mt-3 font-heading text-3xl font-bold text-slate-900">Centro de control</h1>
        <p class="mt-1.5 text-slate-500">Métricas globales, moderación y pagos.</p>
      </header>

      <!-- Tabs -->
      <nav class="mb-8 flex gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm" aria-label="Secciones de administración">
        @for (tab of tabs; track tab.id) {
          <button
            type="button"
            class="flex flex-1 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all duration-200"
            [class]="activeTab() === tab.id
              ? 'bg-slate-900 text-white'
              : 'text-slate-500 hover:bg-slate-50 hover:text-slate-800'"
            (click)="setTab(tab.id)"
          >
            <app-icon [name]="tab.icon" [size]="16" />
            <span class="hidden sm:inline">{{ tab.label }}</span>
          </button>
        }
      </nav>

      <!-- MÉTRICAS -->
      @if (activeTab() === 'metrics') {
        @if (metrics(); as m) {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div class="card p-5">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
                <app-icon name="users" [size]="18" />
              </span>
              <p class="mt-3 font-heading text-3xl font-bold text-slate-900 tnum">{{ m.users.total }}</p>
              <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Usuarios</p>
              <p class="mt-2 text-xs text-slate-500">
                {{ m.users.students }} estudiantes · {{ m.users.instructors }} instructores · {{ m.users.admins }} admins
              </p>
            </div>
            <div class="card p-5">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-sky-600">
                <app-icon name="academic-cap" [size]="18" />
              </span>
              <p class="mt-3 font-heading text-3xl font-bold text-slate-900 tnum">{{ m.courses.total }}</p>
              <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Cursos</p>
              <p class="mt-2 text-xs text-slate-500">{{ m.courses.published }} publicados · {{ m.courses.drafts }} borradores</p>
            </div>
            <div class="card p-5">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
                <app-icon name="book" [size]="18" />
              </span>
              <p class="mt-3 font-heading text-3xl font-bold text-slate-900 tnum">{{ m.enrollmentsActive }}</p>
              <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Inscripciones activas</p>
              <p class="mt-2 text-xs text-slate-500">{{ m.lessonsCompletedToday }} lecciones completadas hoy</p>
            </div>
            <div class="card p-5">
              <span class="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
                <app-icon name="dollar" [size]="18" />
              </span>
              <p class="mt-3 font-heading text-3xl font-bold text-slate-900 tnum">{{ formatMoney(m.revenueCents) }}</p>
              <p class="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Ingresos brutos</p>
              <p class="mt-2 text-xs text-slate-500">Reembolsado: {{ formatMoney(m.refundedCents) }}</p>
            </div>
          </div>
        } @else {
          <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            @for (i of [1, 2, 3, 4]; track i) {
              <div class="card p-5"><div class="skeleton h-32 w-full"></div></div>
            }
          </div>
        }
      }

      <!-- USUARIOS -->
      @if (activeTab() === 'users') {
        <div class="mb-4 max-w-sm">
          <label for="u-search" class="label">Buscar usuario</label>
          <input id="u-search" class="input" placeholder="email o nombre…" [formControl]="userSearch" />
        </div>
        <div class="card overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-4 py-3">Usuario</th>
                <th class="px-4 py-3">Rol</th>
                <th class="px-4 py-3">Alta</th>
                <th class="px-4 py-3 text-right">Inscripciones</th>
                <th class="px-4 py-3 text-right">Cursos creados</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (u of users(); track u.id) {
                <tr>
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-800">{{ u.fullName ?? '—' }}</p>
                    <p class="text-xs text-slate-400">{{ u.email }}</p>
                  </td>
                  <td class="px-4 py-3">
                    <select
                      class="input w-36 py-1 text-xs"
                      [value]="u.role"
                      (change)="setRole(u, $event)"
                    >
                      <option value="student">student</option>
                      <option value="instructor">instructor</option>
                      <option value="admin">admin</option>
                    </select>
                  </td>
                  <td class="px-4 py-3 text-slate-500">{{ formatDate(u.createdAt) }}</td>
                  <td class="px-4 py-3 text-right text-slate-600">{{ u.enrollments }}</td>
                  <td class="px-4 py-3 text-right text-slate-600">{{ u.coursesCreated }}</td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-10 text-center text-slate-400">Sin usuarios</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- CURSOS (moderación) -->
      @if (activeTab() === 'courses') {
        <div class="card overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-4 py-3">Curso</th>
                <th class="px-4 py-3">Instructor</th>
                <th class="px-4 py-3">Precio</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (c of coursesList(); track c.id) {
                <tr>
                  <td class="px-4 py-3">
                    <p class="font-medium text-slate-800">{{ c.title }}</p>
                    <p class="text-xs text-slate-400">/cursos/{{ c.slug }}</p>
                  </td>
                  <td class="px-4 py-3 text-slate-500">{{ c.instructor?.fullName ?? '—' }}</td>
                  <td class="px-4 py-3 text-slate-600">{{ formatMoney(c.priceCents, c.currency) }}</td>
                  <td class="px-4 py-3">
                    <span [class]="c.status === 'published' ? 'badge-green' : c.status === 'draft' ? 'badge-amber' : 'badge-slate'">
                      {{ statusLabel(c.status) }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    <div class="flex gap-1">
                      @if (c.status !== 'published') {
                        <button type="button" class="btn-ghost btn-sm text-emerald-700" (click)="setStatus(c, 'published')">
                          Publicar
                        </button>
                      }
                      @if (c.status !== 'archived') {
                        <button type="button" class="btn-ghost btn-sm text-rose-600" (click)="setStatus(c, 'archived')">
                          Archivar
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="5" class="px-4 py-10 text-center text-slate-400">Sin cursos</td></tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- PAGOS -->
      @if (activeTab() === 'payments') {
        <div class="card overflow-x-auto">
          <table class="w-full text-left text-sm">
            <thead class="bg-slate-50 text-xs uppercase tracking-wide text-slate-400">
              <tr>
                <th class="px-4 py-3">Fecha</th>
                <th class="px-4 py-3">Usuario</th>
                <th class="px-4 py-3">Curso</th>
                <th class="px-4 py-3">Importe</th>
                <th class="px-4 py-3">Estado</th>
                <th class="px-4 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-slate-100">
              @for (p of payments(); track p.id) {
                <tr>
                  <td class="px-4 py-3 text-slate-500">{{ formatDate(p.createdAt) }}</td>
                  <td class="px-4 py-3">
                    <p class="text-slate-700">{{ p.user?.fullName ?? '—' }}</p>
                    <p class="text-xs text-slate-400">{{ p.user?.email }}</p>
                  </td>
                  <td class="px-4 py-3 text-slate-600">{{ p.course?.title ?? p.courseId }}</td>
                  <td class="px-4 py-3 font-medium text-slate-800">{{ formatMoney(p.amountCents, p.currency) }}</td>
                  <td class="px-4 py-3">
                    <span
                      [class]="
                        p.status === 'succeeded' ? 'badge-green'
                        : p.status === 'refunded' ? 'badge-slate'
                        : p.status === 'failed' ? 'badge-amber' : 'badge-amber'
                      "
                    >
                      {{ p.status }}
                    </span>
                  </td>
                  <td class="px-4 py-3">
                    @if (p.status === 'succeeded') {
                      <button type="button" class="btn-ghost btn-sm text-rose-600" (click)="refund(p)">
                        Reembolsar
                      </button>
                    }
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6" class="px-4 py-10 text-center text-slate-400">Sin pagos registrados</td></tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `,
})
export class AdminDashboardPage {
  private readonly admin = inject(AdminService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'metrics', label: 'Métricas', icon: 'chart-bar' },
    { id: 'users', label: 'Usuarios', icon: 'users' },
    { id: 'courses', label: 'Cursos', icon: 'academic-cap' },
    { id: 'payments', label: 'Pagos', icon: 'credit-card' },
  ];
  protected readonly activeTab = signal<Tab>('metrics');

  protected readonly metrics = signal<AdminMetrics | null>(null);
  protected readonly users = signal<AdminUserRow[]>([]);
  protected readonly coursesList = signal<AdminCourseRow[]>([]);
  protected readonly payments = signal<PaymentSummary[]>([]);

  protected readonly userSearch = this.fb.nonNullable.control('');

  protected readonly formatMoney = formatMoney;
  protected readonly formatDate = formatDate;
  protected readonly statusLabel = statusLabel;

  constructor() {
    this.admin.metrics().pipe(takeUntilDestroyed()).subscribe((m) => this.metrics.set(m));
    this.admin.courses().pipe(takeUntilDestroyed()).subscribe((c) => this.coursesList.set(c));
    this.admin
      .payments({ limit: 50 })
      .pipe(takeUntilDestroyed())
      .subscribe((p) => this.payments.set(p.data));

    // Búsqueda de usuarios con debounce (RxJS) → señal
    this.userSearch.valueChanges
      .pipe(
        debounceTime(300),
        switchMap((search) => this.admin.users({ search: search || undefined, limit: 50 })),
        takeUntilDestroyed(),
      )
      .subscribe((page) => this.users.set(page.data));
    this.setTab('metrics');
  }

  protected setTab(tab: Tab): void {
    this.activeTab.set(tab);
    if (tab === 'users' && this.users().length === 0) {
      this.admin
        .users({ limit: 50 })
        .pipe(takeUntilDestroyed())
        .subscribe((page) => this.users.set(page.data));
    }
  }

  protected setRole(user: AdminUserRow, event: Event): void {
    const role = (event.target as HTMLSelectElement).value as UserRole;
    this.admin
      .setRole(user.id, role)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.success(`Rol de ${user.email} → ${role}`);
        this.users.update((list) => list.map((u) => (u.id === user.id ? { ...u, role } : u)));
      });
  }

  protected setStatus(course: AdminCourseRow, status: 'draft' | 'published' | 'archived'): void {
    this.admin
      .setCourseStatus(course.id, status)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.success(`Curso "${course.title}" → ${statusLabel(status)}`);
        this.coursesList.update((list) =>
          list.map((c) => (c.id === course.id ? { ...c, status } : c)),
        );
      });
  }

  protected refund(payment: PaymentSummary): void {
    if (!confirm(`¿Reembolsar ${formatMoney(payment.amountCents, payment.currency)}? Se revocará el acceso del alumno.`)) {
      return;
    }
    this.admin
      .refund(payment.id)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.success('Reembolso procesado en Stripe');
        this.payments.update((list) =>
          list.map((p) => (p.id === payment.id ? { ...p, status: 'refunded' } : p)),
        );
      });
  }
}
