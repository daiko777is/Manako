import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import type {
  InstructorAnalytics,
  InstructorCourseRow,
  LessonNode,
  ModuleNode,
  UploadInitResponse,
} from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

export interface EditorCourse {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  description: string;
  priceCents: number;
  currency: string;
  level: string;
  thumbnailUrl: string | null;
  status: string;
  publishedAt: string | null;
  category: { id: string; name: string; slug: string } | null;
  modules: (ModuleNode & {
    lessons: (LessonNode & { durationSeconds: number; videoUrl?: string | null })[];
  })[];
}

/** API del panel de instructor (rutas /instructor/*). */
@Injectable({ providedIn: 'root' })
export class InstructorService {
  private readonly api = inject(ApiClient);

  listCourses(): Observable<InstructorCourseRow[]> {
    return this.api.get<InstructorCourseRow[]>('/instructor/courses');
  }

  getCourse(id: string): Observable<EditorCourse> {
    return this.api.get<EditorCourse>(`/instructor/courses/${id}`);
  }

  createCourse(body: Record<string, unknown>): Observable<EditorCourse> {
    return this.api.post<EditorCourse>('/instructor/courses', body);
  }

  updateCourse(id: string, body: Record<string, unknown>): Observable<EditorCourse> {
    return this.api.patch<EditorCourse>(`/instructor/courses/${id}`, body);
  }

  publishCourse(id: string): Observable<EditorCourse> {
    return this.api.post<EditorCourse>(`/instructor/courses/${id}/publish`);
  }

  archiveCourse(id: string): Observable<EditorCourse> {
    return this.api.delete<EditorCourse>(`/instructor/courses/${id}`);
  }

  analytics(id: string): Observable<InstructorAnalytics> {
    return this.api.get<InstructorAnalytics>(`/instructor/courses/${id}/analytics`);
  }

  // ── Módulos y lecciones ────────────────────────────────────────────────────

  createModule(courseId: string, body: { title: string; description?: string }): Observable<ModuleNode> {
    return this.api.post<ModuleNode>(`/instructor/courses/${courseId}/modules`, body);
  }

  updateModule(moduleId: string, body: Record<string, unknown>): Observable<ModuleNode> {
    return this.api.patch<ModuleNode>(`/instructor/modules/${moduleId}`, body);
  }

  deleteModule(moduleId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/instructor/modules/${moduleId}`);
  }

  createLesson(moduleId: string, body: Record<string, unknown>): Observable<LessonNode> {
    return this.api.post<LessonNode>(`/instructor/modules/${moduleId}/lessons`, body);
  }

  updateLesson(lessonId: string, body: Record<string, unknown>): Observable<LessonNode> {
    return this.api.patch<LessonNode>(`/instructor/lessons/${lessonId}`, body);
  }

  deleteLesson(lessonId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/instructor/lessons/${lessonId}`);
  }

  // ── Video ─────────────────────────────────────────────────────────────────

  initUpload(lessonId: string): Observable<UploadInitResponse> {
    return this.api.post<UploadInitResponse>(`/instructor/lessons/${lessonId}/upload`);
  }

  /** Subida directa al proveedor (Mux): PUT con progreso vía XHR. */
  directUpload(uploadUrl: string, file: File, onProgress: (pct: number) => void): Observable<void> {
    return new Observable((observer) => {
      const xhr = new XMLHttpRequest();
      xhr.open('PUT', uploadUrl);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next();
          observer.complete();
        } else {
          observer.error(new Error(`El proveedor rechazó la subida (HTTP ${xhr.status})`));
        }
      };
      xhr.onerror = () => observer.error(new Error('Fallo de red durante la subida'));
      xhr.send(file);
      return () => xhr.abort();
    });
  }

  /** Subida relay vía API (Cloudflare Stream). */
  relayUpload(relayEndpoint: string, file: File, onProgress: (pct: number) => void): Observable<unknown> {
    // relayEndpoint viene como /api/v1/... → extraemos la parte tras /api/v1
    const path = relayEndpoint.replace(/^\/api\/v\d+/, '');
    return this.api.uploadWithProgress(path, file, onProgress);
  }
}
