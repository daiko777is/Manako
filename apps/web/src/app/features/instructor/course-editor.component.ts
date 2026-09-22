import { ChangeDetectionStrategy, Component, Input, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ToastService } from '../../core/toast/toast.service';
import { InstructorService } from '../../core/instructor/instructor.service';
import { IconComponent } from '../../shared/components/icon.component';
import { formatClock } from '../../shared/format';

interface EditorLesson {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  durationSeconds: number;
  videoProvider: 'mux' | 'cloudflare' | 'direct';
  videoAssetId: string | null;
  videoPlaybackId: string | null;
  videoUrl: string | null;
  isPreview: boolean;
}

interface EditorModule {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  lessons: EditorLesson[];
}

interface EditorCourse {
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
  modules: EditorModule[];
}

/**
 * Editor completo del curso (spec §1 módulo 7 — panel de instructor):
 * metadatos, CRUD de módulos/lecciones, subida de video al proveedor
 * (Mux Direct Upload / Cloudflare relay / URL directa) y publicación
 * con validaciones.
 */
@Component({
  selector: 'app-course-editor',
  standalone: true,
  imports: [RouterLink, ReactiveFormsModule, IconComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (course(); as c) {
      <div class="mx-auto max-w-5xl px-4 py-10 sm:px-6">
        <nav class="mb-4 text-sm text-slate-400">
          <a routerLink="/instructor" class="hover:text-brand-700">← Panel de instructor</a>
        </nav>

        <header class="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 class="text-2xl font-bold text-slate-900">{{ c.title }}</h1>
            <p class="mt-1 text-sm text-slate-500">
              <span
                [class]="c.status === 'published' ? 'badge-green' : c.status === 'draft' ? 'badge-amber' : 'badge-slate'"
              >
                {{ c.status === 'published' ? 'Publicado' : c.status === 'draft' ? 'Borrador' : 'Archivado' }}
              </span>
              <a [routerLink]="['/cursos', c.slug]" target="_blank" class="ml-3 text-brand-700 hover:underline">
                Ver página pública ↗
              </a>
            </p>
          </div>
          <div class="flex gap-2">
            @if (c.status !== 'published') {
              <button type="button" class="btn-primary" (click)="publish()" [disabled]="busy()">
                Publicar curso
              </button>
            }
          </div>
        </header>

        <!-- Metadatos -->
        <form [formGroup]="metaForm" (ngSubmit)="saveMeta()" class="card mb-8 space-y-4 p-6">
          <h2 class="font-bold text-slate-900">Detalles del curso</h2>
          <div>
            <label for="m-title" class="label">Título</label>
            <input id="m-title" class="input" formControlName="title" />
          </div>
          <div>
            <label for="m-subtitle" class="label">Subtítulo</label>
            <input id="m-subtitle" class="input" formControlName="subtitle" />
          </div>
          <div>
            <label for="m-desc" class="label">Descripción</label>
            <textarea id="m-desc" class="input min-h-28" formControlName="description"></textarea>
          </div>
          <div class="grid gap-4 sm:grid-cols-3">
            <div>
              <label for="m-price" class="label">Precio ({{ c.currency }})</label>
              <input id="m-price" type="number" min="0" step="0.01" class="input" formControlName="price" />
            </div>
            <div>
              <label for="m-level" class="label">Nivel</label>
              <select id="m-level" class="input" formControlName="level">
                <option value="beginner">Principiante</option>
                <option value="intermediate">Intermedio</option>
                <option value="advanced">Avanzado</option>
              </select>
            </div>
            <div>
              <label for="m-thumb" class="label">URL de portada</label>
              <input id="m-thumb" class="input" formControlName="thumbnailUrl" placeholder="https://…" />
            </div>
          </div>
          <div class="flex justify-end">
            <button type="submit" class="btn-secondary" [disabled]="metaForm.invalid || busy()">Guardar cambios</button>
          </div>
        </form>

        <!-- Currículo -->
        <section class="space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="font-bold text-slate-900">Currículo</h2>
            <span class="text-xs text-slate-400">
              El desbloqueo es secuencial: los alumnos avanzan en orden (los previews son libres).
            </span>
          </div>

          @for (mod of c.modules; track mod.id) {
            <article class="card overflow-hidden">
              <header class="flex items-center justify-between gap-3 bg-slate-50 px-4 py-3">
                <h3 class="font-semibold text-slate-800">{{ mod.title }}</h3>
                <div class="flex gap-2">
                  <button type="button" class="btn-ghost btn-sm" (click)="toggleLessonForm(mod.id, 'new')">
                    + Lección
                  </button>
                  <button type="button" class="btn-ghost btn-sm text-rose-600" (click)="deleteModule(mod)">
                    Eliminar
                  </button>
                </div>
              </header>

              <ul class="divide-y divide-slate-100">
                @for (lesson of mod.lessons; track lesson.id) {
                  <li class="px-4 py-3">
                    <div class="flex flex-wrap items-center gap-3">
                      <span class="flex-1 text-sm font-medium text-slate-800">
                        {{ lesson.title }}
                        @if (lesson.isPreview) {
                          <span class="badge-green ml-2">muestra</span>
                        }
                      </span>
                      <span class="text-xs text-slate-400">{{ clock(lesson.durationSeconds) }}</span>
                      <span [class]="videoBadgeClass(lesson)" class="badge">
                        {{ videoBadgeText(lesson) }}
                      </span>
                      <label class="btn-secondary btn-sm cursor-pointer">
                        @if (uploadProgress()[lesson.id] !== undefined) {
                          <span class="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent"></span>
                          Subiendo {{ uploadProgress()[lesson.id] }}%
                        } @else {
                          <app-icon name="upload" [size]="14" /> Subir video
                        }
                        <input
                          type="file"
                          accept="video/*"
                          class="hidden"
                          [disabled]="uploadProgress()[lesson.id] !== undefined"
                          (change)="onUploadFile($event, lesson)"
                        />
                      </label>
                      <button type="button" class="btn-ghost btn-sm" (click)="toggleLessonForm(mod.id, lesson.id)" aria-label="Editar lección">
                        <app-icon name="pencil" [size]="14" />
                      </button>
                      <button type="button" class="btn-ghost btn-sm text-rose-600 hover:bg-rose-50" (click)="deleteLesson(lesson)" aria-label="Eliminar lección">
                        <app-icon name="trash" [size]="14" />
                      </button>
                    </div>

                    @if (uploadProgress()[lesson.id] !== undefined) {
                      <div class="mt-2 h-1.5 rounded-full bg-slate-100">
                        <div class="h-1.5 rounded-full bg-brand-500 transition-all" [style.width.%]="uploadProgress()[lesson.id]"></div>
                      </div>
                    }

                    <!-- Formulario de lección (crear/editar) -->
                    @if (editing().moduleId === mod.id && editing().lessonId === lesson.id) {
                      <form
                        [formGroup]="lessonForm"
                        (ngSubmit)="lesson.id ? updateLesson(lesson) : createLesson(mod)"
                        class="mt-3 space-y-3 rounded-lg bg-slate-50 p-4"
                      >
                        <div class="grid gap-3 sm:grid-cols-2">
                          <div>
                            <label class="label" [for]="'lt-' + lesson.id">Título *</label>
                            <input [id]="'lt-' + lesson.id" class="input" formControlName="title" />
                          </div>
                          <div>
                            <label class="label" [for]="'ld-' + lesson.id">Duración (segundos)</label>
                            <input [id]="'ld-' + lesson.id" type="number" min="0" class="input" formControlName="durationSeconds" />
                          </div>
                        </div>
                        @if (lesson.videoProvider === 'direct' || !lesson.id) {
                          <div>
                            <label class="label" [for]="'lu-' + lesson.id">URL del video (provider "direct")</label>
                            <input [id]="'lu-' + lesson.id" class="input" formControlName="videoUrl" placeholder="https://…/video.mp4" />
                          </div>
                        }
                        <label class="flex items-center gap-2 text-sm text-slate-600">
                          <input type="checkbox" class="accent-brand-600" formControlName="isPreview" />
                          Lección de muestra (visible sin inscripción)
                        </label>
                        <div class="flex justify-end gap-2">
                          <button type="button" class="btn-ghost btn-sm" (click)="editing.set({ moduleId: null, lessonId: null })">Cancelar</button>
                          <button type="submit" class="btn-primary btn-sm" [disabled]="lessonForm.invalid || busy()">
                            {{ lesson.id ? 'Guardar lección' : 'Añadir lección' }}
                          </button>
                        </div>
                      </form>
                    }
                  </li>
                } @empty {
                  <li class="px-4 py-6 text-center text-sm text-slate-400">
                    Módulo vacío — añade tu primera lección.
                  </li>
                }
              </ul>
            </article>
          }

          <!-- Añadir módulo -->
          <form [formGroup]="moduleForm" (ngSubmit)="createModule()" class="card flex flex-wrap items-end gap-3 p-4">
            <div class="min-w-52 flex-1">
              <label for="mod-title" class="label">Nuevo módulo</label>
              <input id="mod-title" class="input" formControlName="title" placeholder="Ej.: Fundamentos" />
            </div>
            <button type="submit" class="btn-secondary" [disabled]="moduleForm.invalid || busy()">+ Añadir módulo</button>
          </form>
        </section>
      </div>
    } @else {
      <div class="mx-auto max-w-5xl px-4 py-24 text-center text-slate-400">Cargando editor…</div>
    }
  `,
})
export class CourseEditorPage {
  @Input({ required: true }) courseId = '';

  private readonly service = inject(InstructorService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);

  protected readonly course = signal<EditorCourse | null>(null);
  protected readonly busy = signal(false);
  protected readonly uploadProgress = signal<Record<string, number>>({});
  protected readonly editing = signal<{ moduleId: string | null; lessonId: string | null }>({
    moduleId: null,
    lessonId: null,
  });

  protected readonly clock = formatClock;

  protected readonly metaForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    subtitle: [''],
    description: [''],
    price: [0],
    level: ['beginner'],
    thumbnailUrl: [''],
  });

  protected readonly moduleForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
  });

  protected readonly lessonForm = this.fb.nonNullable.group({
    title: ['', Validators.required],
    durationSeconds: [0],
    videoUrl: [''],
    isPreview: [false],
  });

  constructor() {
    this.load();
  }

  private load(): void {
    this.service
      .getCourse(this.courseId)
      .pipe(takeUntilDestroyed())
      .subscribe((course) => {
        const c = course as unknown as EditorCourse;
        this.course.set(c);
        this.metaForm.patchValue({
          title: c.title,
          subtitle: c.subtitle ?? '',
          description: c.description ?? '',
          price: c.priceCents / 100,
          level: c.level,
          thumbnailUrl: c.thumbnailUrl ?? '',
        });
      });
  }

  // ── Metadatos y publicación ──────────────────────────────────────────────

  protected saveMeta(): void {
    if (this.metaForm.invalid) return;
    this.busy.set(true);
    const raw = this.metaForm.getRawValue();
    this.service
      .updateCourse(this.courseId, {
        title: raw.title,
        subtitle: raw.subtitle || undefined,
        description: raw.description,
        priceCents: Math.round(raw.price * 100),
        level: raw.level,
        thumbnailUrl: raw.thumbnailUrl || undefined,
      })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success('Cambios guardados');
          this.load();
        },
        error: () => this.busy.set(false),
      });
  }

  protected publish(): void {
    this.busy.set(true);
    this.service
      .publishCourse(this.courseId)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.toast.success('¡Curso publicado! 🎉');
          this.load();
        },
        error: (err: { error?: { message?: string } }) => {
          this.busy.set(false);
          this.toast.error(err?.error?.message ?? 'No se pudo publicar el curso');
        },
      });
  }

  // ── Módulos ──────────────────────────────────────────────────────────────

  protected createModule(): void {
    if (this.moduleForm.invalid) return;
    const { title } = this.moduleForm.getRawValue();
    this.service
      .createModule(this.courseId, { title })
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.moduleForm.reset({ title: '' });
        this.load();
      });
  }

  protected deleteModule(mod: EditorModule): void {
    if (!confirm(`¿Eliminar el módulo "${mod.title}" y todas sus lecciones?`)) return;
    this.service
      .deleteModule(mod.id)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.info('Módulo eliminado');
        this.load();
      });
  }

  // ── Lecciones ────────────────────────────────────────────────────────────

  protected toggleLessonForm(moduleId: string, lessonId: string): void {
    const current = this.editing();
    if (current.moduleId === moduleId && current.lessonId === lessonId) {
      this.editing.set({ moduleId: null, lessonId: null });
      return;
    }
    this.editing.set({ moduleId, lessonId });
    if (lessonId !== 'new') {
      const lesson = this.findLesson(lessonId);
      this.lessonForm.patchValue({
        title: lesson?.title ?? '',
        durationSeconds: lesson?.durationSeconds ?? 0,
        videoUrl: lesson?.videoUrl ?? '',
        isPreview: lesson?.isPreview ?? false,
      });
    } else {
      this.lessonForm.reset({ title: '', durationSeconds: 0, videoUrl: '', isPreview: false });
    }
  }

  private findLesson(lessonId: string): EditorLesson | undefined {
    return this.course()?.modules.flatMap((m) => m.lessons).find((l) => l.id === lessonId);
  }

  protected createLesson(mod: EditorModule): void {
    if (this.lessonForm.invalid) return;
    const raw = this.lessonForm.getRawValue();
    this.service
      .createLesson(mod.id, {
        title: raw.title,
        durationSeconds: raw.durationSeconds,
        videoUrl: raw.videoUrl || undefined,
        isPreview: raw.isPreview,
      })
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.editing.set({ moduleId: null, lessonId: null });
        this.load();
      });
  }

  protected updateLesson(lesson: EditorLesson): void {
    if (this.lessonForm.invalid) return;
    const raw = this.lessonForm.getRawValue();
    this.service
      .updateLesson(lesson.id, {
        title: raw.title,
        durationSeconds: raw.durationSeconds,
        videoUrl: raw.videoUrl || undefined,
        isPreview: raw.isPreview,
      })
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.editing.set({ moduleId: null, lessonId: null });
        this.toast.success('Lección actualizada');
        this.load();
      });
  }

  protected deleteLesson(lesson: EditorLesson): void {
    if (!confirm(`¿Eliminar la lección "${lesson.title}"?`)) return;
    this.service
      .deleteLesson(lesson.id)
      .pipe(takeUntilDestroyed())
      .subscribe(() => {
        this.toast.info('Lección eliminada');
        this.load();
      });
  }

  // ── Subida de video (Mux direct / CF relay) ──────────────────────────────

  protected onUploadFile(event: Event, lesson: EditorLesson): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    input.value = ''; // permite re-seleccionar el mismo archivo

    this.uploadProgress.update((p) => ({ ...p, [lesson.id]: 0 }));

    this.service
      .initUpload(lesson.id)
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (init) => {
          const onProgress = (pct: number) =>
            this.uploadProgress.update((p) => ({ ...p, [lesson.id]: pct }));

          const upload$ =
            init.mode === 'url' && init.uploadUrl
              ? this.service.directUpload(init.uploadUrl, file, onProgress)
              : init.relayEndpoint
                ? this.service.relayUpload(init.relayEndpoint, file, onProgress)
                : null;

          if (!upload$) {
            this.uploadProgress.update((p) => {
              const next = { ...p };
              delete next[lesson.id];
              return next;
            });
            this.toast.error('El proveedor no soporta subida de video');
            return;
          }

          upload$.pipe(takeUntilDestroyed()).subscribe({
            next: () => {
              this.uploadProgress.update((p) => {
                const next = { ...p };
                delete next[lesson.id];
                return next;
              });
              this.toast.success(
                'Video subido ✓ Se está procesando en el proveedor; estará disponible en unos minutos (webhook).',
              );
              this.load();
            },
            error: (err: Error) => {
              this.uploadProgress.update((p) => {
                const next = { ...p };
                delete next[lesson.id];
                return next;
              });
              this.toast.error(err.message);
            },
          });
        },
        error: () => {
          this.uploadProgress.update((p) => {
            const next = { ...p };
            delete next[lesson.id];
            return next;
          });
        },
      });
  }

  protected videoBadgeText(lesson: EditorLesson): string {
    if (lesson.videoProvider === 'mux') {
      return lesson.videoPlaybackId ? 'Video listo' : lesson.videoAssetId ? 'Procesando…' : 'Sin video';
    }
    if (lesson.videoProvider === 'cloudflare') {
      return lesson.videoAssetId ? 'Video listo' : 'Sin video';
    }
    return lesson.videoUrl ? 'Video listo' : 'Sin video';
  }

  protected videoBadgeClass(lesson: EditorLesson): string {
    const text = this.videoBadgeText(lesson);
    if (text.includes('listo')) return 'badge-green';
    if (text.includes('Procesando')) return 'badge-amber';
    return 'badge-slate';
  }
}
