import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { firstValueFrom, Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';

export type QueryParams = Record<string, string | number | boolean | undefined | null>;

function buildParams(params?: QueryParams): HttpParams {
  let p = new HttpParams();
  if (!params) return p;
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      p = p.set(key, String(value));
    }
  }
  return p;
}

function translateError(err: HttpErrorResponse): string {
  const data = err.error as { message?: string | string[] } | null;
  const raw = Array.isArray(data?.message) ? data?.message?.join(', ') : data?.message;
  const fallback: Record<number, string> = {
    400: 'Solicitud inválida',
    401: 'Sesión expirada, vuelve a iniciar sesión',
    403: 'No tienes permiso para esta acción',
    404: 'No encontrado',
    409: 'Conflicto: la operación no se pudo completar',
    429: 'Demasiadas peticiones, inténtalo en unos segundos',
    500: 'Error del servidor, inténtalo más tarde',
  };
  return raw ?? fallback[err.status] ?? 'Error de conexión con la API';
}

/**
 * Cliente HTTP tipado contra la API NestJS. El JWT lo adjunta el
 * authInterceptor; aquí solo normalizamos params y errores.
 */
@Injectable({ providedIn: 'root' })
export class ApiClient {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiUrl.replace(/\/$/, '');

  get<T>(path: string, params?: QueryParams): Observable<T> {
    return this.http.get<T>(`${this.base}${path}`, { params: buildParams(params) }).pipe(
      catchError((err) => throwError(() => new Error(translateError(err)))),
    );
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${this.base}${path}`, body ?? {}).pipe(
      catchError((err) => throwError(() => new Error(translateError(err)))),
    );
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(`${this.base}${path}`, body ?? {}).pipe(
      catchError((err) => throwError(() => new Error(translateError(err)))),
    );
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${this.base}${path}`, body ?? {}).pipe(
      catchError((err) => throwError(() => new Error(translateError(err)))),
    );
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${this.base}${path}`).pipe(
      catchError((err) => throwError(() => new Error(translateError(err)))),
    );
  }

  /** Variantes Promise para código async/await (guards, servicios). */
  getAsync<T>(path: string, params?: QueryParams): Promise<T> {
    return firstValueFrom(this.get<T>(path, params));
  }

  postAsync<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.post<T>(path, body));
  }

  putAsync<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.put<T>(path, body));
  }

  patchAsync<T>(path: string, body?: unknown): Promise<T> {
    return firstValueFrom(this.patch<T>(path, body));
  }

  deleteAsync<T>(path: string): Promise<T> {
    return firstValueFrom(this.delete<T>(path));
  }

  /** Subida multipart con progreso (XHR) — usada por el relay de video. */
  uploadWithProgress(
    path: string,
    file: File,
    onProgress: (percent: number) => void,
  ): Observable<unknown> {
    return new Observable((observer) => {
      const xhr = new XMLHttpRequest();
      const form = new FormData();
      form.append('file', file);
      xhr.open('POST', `${this.base}${path}`);

      const tokenSub = this.attachAuth(xhr);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        tokenSub();
        if (xhr.status >= 200 && xhr.status < 300) {
          observer.next(xhr.responseText ? JSON.parse(xhr.responseText) : null);
          observer.complete();
        } else {
          observer.error(new Error(`Error ${xhr.status} al subir el archivo`));
        }
      };
      xhr.onerror = () => {
        tokenSub();
        observer.error(new Error('Fallo de red durante la subida'));
      };
      xhr.send(form);
      return () => xhr.abort();
    });
  }

  /** Adjunta el Authorization header de forma síncrona si hay token cacheado. */
  private attachAuth(xhr: XMLHttpRequest): () => void {
    // El token se obtiene de la sesión persistida por supabase-js en localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key?.startsWith('sb-') && key.endsWith('auth-token')) {
          const raw = localStorage.getItem(key);
          if (!raw) continue;
          const parsed = JSON.parse(raw) as { access_token?: string };
          if (parsed.access_token) {
            xhr.setRequestHeader('Authorization', `Bearer ${parsed.access_token}`);
          }
          break;
        }
      }
    } catch {
      /* sin token: la API responderá 401 */
    }
    return () => undefined;
  }
}
