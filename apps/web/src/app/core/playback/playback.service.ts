import { Injectable, inject } from '@angular/core';
import type { CourseProgress, PlaybackResponse, ProgressUpdateResponse } from '@manako/shared';
import { ApiClient } from '../http/api-client.service';

/** Endpoints de reproducción y progreso del estudiante. */
@Injectable({ providedIn: 'root' })
export class PlaybackService {
  private readonly api = inject(ApiClient);

  /**
   * Solicita la URL firmada del video. La API revalida inscripción y
   * desbloqueo secuencial antes de emitirla (spec §6.2/§6.4).
   */
  getPlayback(courseId: string, lessonId: string) {
    return this.api.get<PlaybackResponse>(`/courses/${courseId}/playback/${lessonId}`);
  }

  courseProgress(courseId: string) {
    return this.api.get<CourseProgress>(`/progress/course/${courseId}`);
  }

  markComplete(lessonId: string) {
    return this.api.post<{ lessonId: string; completed: boolean }>(
      `/progress/lessons/${lessonId}/complete`,
    );
  }

  /** Sincronización inmediata del buffer (fin de lección, navegación). */
  pushProgress(items: { lessonId: string; watchedSeconds: number }[]) {
    return this.api.put<ProgressUpdateResponse>('/progress', { items });
  }
}
