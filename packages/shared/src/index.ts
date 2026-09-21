/**
 * Manakō · Tipos compartidos (contratos entre frontend Angular y API NestJS).
 *
 * IMPORTANTE: este paquete contiene SOLO tipos/interfaces (compile-time).
 * Nada de valores en runtime: así TypeScript elimina los imports en el
 * bundle de la web y no hay problemas de resolución en el dist de la API.
 */

// ────────────────────────────────────────────────────────────────────────────
// Enums / union types (espejo de los enums de Postgres)
// ────────────────────────────────────────────────────────────────────────────
export type UserRole = 'student' | 'instructor' | 'admin';
export type CourseStatus = 'draft' | 'published' | 'archived';
export type CourseLevel = 'beginner' | 'intermediate' | 'advanced';
export type PaymentStatus = 'pending' | 'succeeded' | 'failed' | 'refunded';
export type EnrollmentStatus = 'active' | 'refunded';
export type VideoProviderKind = 'mux' | 'cloudflare' | 'direct';
export type CourseSort = 'popular' | 'rating' | 'newest' | 'price_asc' | 'price_desc';

// ────────────────────────────────────────────────────────────────────────────
// Usuarios y perfiles
// ────────────────────────────────────────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  avatarUrl: string | null;
  createdAt: string;
}

export interface InstructorProfile {
  userId: string;
  headline: string | null;
  bio: string | null;
  payoutsEnabled: boolean;
}

// ────────────────────────────────────────────────────────────────────────────
// Catálogo
// ────────────────────────────────────────────────────────────────────────────
export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface CourseSummary {
  id: string;
  title: string;
  slug: string;
  subtitle: string | null;
  priceCents: number;
  currency: string;
  level: CourseLevel;
  thumbnailUrl: string | null;
  status: CourseStatus;
  publishedAt: string | null;
  avgRating: number;
  reviewsCount: number;
  totalEnrollments: number;
  lessonsCount: number;
  totalSeconds: number;
  category: Pick<Category, 'id' | 'name' | 'slug'> | null;
  instructor: { id: string; fullName: string | null; avatarUrl: string | null } | null;
}

export interface LessonNode {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  durationSeconds: number;
  isPreview: boolean;
  /** Solo presente para dueño/admin o lecciones ya desbloqueadas. */
  unlocked?: boolean;
  /** Solo presente para el dueño del curso (panel de instructor). */
  videoProvider?: VideoProviderKind;
  videoReady?: boolean;
  hasVideo?: boolean;
}

export interface ModuleNode {
  id: string;
  title: string;
  description: string | null;
  orderIndex: number;
  lessons: LessonNode[];
}

export interface CourseDetail extends CourseSummary {
  description: string;
  modules: ModuleNode[];
  instructor: {
    id: string;
    fullName: string | null;
    avatarUrl: string | null;
    headline?: string | null;
    bio?: string | null;
  } | null;
  /** Estado del usuario autenticado respecto al curso. */
  viewer?: {
    enrolled: boolean;
    isOwner: boolean;
    isAdmin: boolean;
    progressPercent: number;
    completedLessons: number;
    /** id de la siguiente lección a continuar (o la primera desbloqueada). */
    nextLessonId: string | null;
  } | null;
}

export interface CourseQuery {
  search?: string;
  category?: string; // slug
  level?: CourseLevel;
  minPrice?: number; // en centavos
  maxPrice?: number; // en centavos; 0 = solo gratis
  sort?: CourseSort;
  cursor?: string; // id del último elemento de la página anterior
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  nextCursor: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Progreso
// ────────────────────────────────────────────────────────────────────────────
export interface ProgressItemInput {
  lessonId: string;
  watchedSeconds: number;
}

export interface LessonProgressState {
  lessonId: string;
  watchedSeconds: number;
  completed: boolean;
  lastWatchedAt: string;
}

export interface CourseProgress {
  courseId: string;
  totalLessons: number;
  completedLessons: number;
  percent: number;
  lessons: LessonProgressState[];
}

export interface ProgressUpdateResponse {
  lessons: LessonProgressState[];
  course?: {
    courseId: string;
    totalLessons: number;
    completedLessons: number;
    percent: number;
  };
  /** id de la siguiente lección desbloqueada tras la actualización, si la hay */
  nextUnlockedLessonId?: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Reproducción de video
// ────────────────────────────────────────────────────────────────────────────
export interface PlaybackResponse {
  lessonId: string;
  provider: VideoProviderKind;
  /** URL HLS firmada (mux/cloudflare) o URL directa (direct). Corta expiración. */
  url: string;
  expiresAt: string | null;
  /** Texto de marca de agua disuasoria (email del usuario). */
  watermark: string | null;
}

// ────────────────────────────────────────────────────────────────────────────
// Inscripciones y pagos
// ────────────────────────────────────────────────────────────────────────────
export interface EnrollmentSummary {
  id: string;
  courseId: string;
  enrolledAt: string;
  status: EnrollmentStatus;
  course: Pick<
    CourseSummary,
    | 'id' | 'title' | 'slug' | 'thumbnailUrl' | 'level' | 'priceCents' | 'currency'
    | 'instructor'
  >;
  progress: { totalLessons: number; completedLessons: number; percent: number } | null;
}

export interface CheckoutResponse {
  /** Cuando el curso es gratis: inscripción inmediata. */
  enrolled: boolean;
  /** URL de Stripe Checkout cuando hay pago pendiente. */
  url?: string;
}

export interface PaymentSummary {
  id: string;
  userId: string;
  courseId: string;
  amountCents: number;
  currency: string;
  status: PaymentStatus;
  createdAt: string;
  course?: { id: string; title: string; slug: string };
  user?: { id: string; email: string; fullName: string | null };
}

// ────────────────────────────────────────────────────────────────────────────
// Panel de instructor
// ────────────────────────────────────────────────────────────────────────────
export interface InstructorCourseRow extends CourseSummary {
  modulesCount: number;
  revenueCents: number;
}

export interface LessonRetentionRow {
  lessonId: string;
  title: string;
  orderIndex: number;
  moduleOrderIndex: number;
  startedCount: number;
  completedCount: number;
  avgWatchedSeconds: number;
  /** completedCount / inscripciones activas (0-100) */
  retentionPercent: number;
}

export interface InstructorAnalytics {
  courseId: string;
  enrollments: number;
  revenueCents: number;
  avgProgressPercent: number;
  totalWatchedMinutes: number;
  retention: LessonRetentionRow[];
}

export interface UploadInitResponse {
  lessonId: string;
  provider: VideoProviderKind;
  /**
   * mode='url'   → el navegador sube el archivo directo al proveedor
   *                (PUT a uploadUrl).
   * mode='relay' → el navegador sube el archivo a la API (multipart) y la
   *                API lo retransmite al proveedor (Cloudflare Stream).
   */
  mode: 'url' | 'relay';
  uploadUrl?: string;
  method?: 'PUT' | 'POST';
  relayEndpoint?: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Panel de administración
// ────────────────────────────────────────────────────────────────────────────
export interface AdminMetrics {
  users: { total: number; students: number; instructors: number; admins: number };
  courses: { total: number; published: number; drafts: number };
  enrollmentsActive: number;
  revenueCents: number;
  refundedCents: number;
  lessonsCompletedToday: number;
}

export interface AdminUserRow {
  id: string;
  email: string;
  fullName: string | null;
  role: UserRole;
  createdAt: string;
  enrollments: number;
  coursesCreated: number;
}

export interface AdminCourseRow extends CourseSummary {
  updatedAt: string;
}
