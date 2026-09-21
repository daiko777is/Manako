# Manakō — Esquema completo de base de datos

> Profundización del §4 de la especificación técnica. Fuente de verdad ejecutable:
> [`supabase/migrations/0001_initial_schema.sql`](../supabase/migrations/0001_initial_schema.sql) y
> [`0002_functions_rls.sql`](../supabase/migrations/0002_functions_rls.sql) ·
> espejo ORM: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma).

---

## 1. Diagrama entidad-relación

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1 (trigger handle_new_user)"
    profiles ||--o| instructors : "1:0..1 (rol instructor)"
    profiles ||--o{ enrollments : ""
    profiles ||--o{ lesson_progress : ""
    profiles ||--o{ payments : ""
    profiles ||--o{ reviews : ""
    profiles ||--o{ certificates : ""

    instructors ||--o{ courses : "posee"
    categories ||--o{ courses : "clasifica"

    courses ||--o{ modules : "contiene"
    modules ||--o{ lessons : "contiene"
    lessons ||--o{ lesson_progress : "estado por usuario"

    courses ||--o{ enrollments : ""
    courses ||--o{ payments : ""
    payments |o--o{ enrollments : "payment_id (FK diferida)"
    courses ||--o{ reviews : ""
    courses ||--o{ certificates : ""

    profiles {
        uuid id PK "= auth.users.id"
        text email
        text full_name
        user_role role "student|instructor|admin"
        text avatar_url
        timestamptz created_at
        timestamptz updated_at
    }
    instructors {
        uuid user_id PK_FK
        text headline
        text bio
        text stripe_account_id UK "Stripe Connect (Fase 3)"
        bool payouts_enabled
    }
    categories {
        uuid id PK
        text name
        text slug UK
        text description
    }
    courses {
        uuid id PK
        uuid instructor_id FK
        uuid category_id FK
        text title
        text slug UK
        text subtitle
        text description
        int price_cents "0 = gratis"
        char3 currency
        course_level level
        text thumbnail_url
        course_status status "draft|published|archived"
        timestamptz published_at
        numeric avg_rating "desnormalizado (trigger)"
        int reviews_count "desnormalizado (trigger)"
        int total_enrollments "desnormalizado (trigger)"
    }
    modules {
        uuid id PK
        uuid course_id FK
        text title
        int order_index "UNIQUE(course_id, order_index)"
    }
    lessons {
        uuid id PK
        uuid module_id FK
        text title
        int order_index "UNIQUE(module_id, order_index)"
        int duration_seconds
        video_provider video_provider "mux|cloudflare|direct"
        text video_asset_id "SENSIBLE"
        text video_playback_id "SENSIBLE"
        text video_url "SENSIBLE (solo direct)"
        bool is_preview
    }
    enrollments {
        uuid id PK
        uuid user_id FK "UNIQUE(user_id, course_id)"
        uuid course_id FK
        enrollment_status status "active|refunded"
        uuid payment_id FK "nullable (cursos gratis)"
        timestamptz enrolled_at
    }
    lesson_progress {
        uuid id PK
        uuid user_id FK "UNIQUE(user_id, lesson_id)"
        uuid lesson_id FK
        int watched_seconds
        bool completed
        timestamptz last_watched_at
    }
    payments {
        uuid id PK
        uuid user_id FK
        uuid course_id FK
        text stripe_checkout_session_id UK
        text stripe_payment_intent_id UK
        int amount_cents
        char3 currency
        payment_status status "pending|succeeded|failed|refunded"
    }
    stripe_webhook_events {
        text id PK "evt_... (idempotencia)"
        text type
        timestamptz processed_at
    }
    reviews {
        uuid id PK
        uuid user_id FK "UNIQUE(user_id, course_id)"
        uuid course_id FK
        int rating "CHECK 1..5"
        text comment
    }
    certificates {
        uuid id PK
        uuid user_id FK "UNIQUE(user_id, course_id)"
        uuid course_id FK
        text certificate_number UK
        text certificate_url
        timestamptz issued_at
    }
    feature_flags {
        text key PK
        bool enabled
        text description
    }
```

---

## 2. Decisiones de diseño

| Decisión | Motivo |
|---|---|
| `profiles.id = auth.users.id` (sin id propio) | Supabase Auth es la fuente de identidad; el trigger `handle_new_user` crea el profile al registrarse. Cero drift entre auth y negocio. |
| `price_cents INTEGER` (no float/decimal) | Dinero en centavos: aritmética exacta, coincide con `unit_amount` de Stripe. |
| Contadores desnormalizados en `courses` (`total_enrollments`, `avg_rating`, `reviews_count`) | El catálogo se ordena/filtra por ellos constantemente; mantenerlos por trigger evita JOINs+GROUP BY en cada página. |
| `UNIQUE(course_id, order_index)` en módulos y `UNIQUE(module_id, order_index)` en lecciones | Orden determinista y reordenamientos sin duplicados; el bloqueo secuencial depende de este orden. |
| `stripe_checkout_session_id` y `stripe_payment_intent_id` UNIQUE | Idempotencia de webhooks a nivel de restricción de BD (última línea de defensa además de `stripe_webhook_events`). |
| FK `enrollments.payment_id` creada con `ALTER TABLE` posterior | Rompe la dependencia circular payments↔enrollments. |
| Enums de Postgres (no strings) | Validación a nivel de BD + autocompletado en clientes SQL. |
| `lesson_progress` como tabla de **estado** (no de eventos) | El MVP necesita el estado actual; si se requiere analítica fina de reproducción, añadir `progress_events` particionada por mes (spec §3.3) sin tocar este diseño. |
| UUID v4 (`gen_random_uuid()`) | Ids no enumerables (seguridad) y generación segura en cliente/servidor. |

### Índices

| Tabla | Índice | Para qué |
|---|---|---|
| courses | `(status, published_at DESC)` | Página principal del catálogo |
| courses | `GIN (title gin_trgm_ops)` | Búsqueda por similitud (pg_trgm) |
| courses | `category_id`, `instructor_id`, `price_cents` | Filtros del catálogo |
| courses | `slug UNIQUE` | URLs públicas `/cursos/:slug` |
| enrollments | `user_id`, `course_id`, UNIQUE `(user_id, course_id)` | "Mis cursos" + upsert idempotente |
| lesson_progress | `user_id`, `lesson_id`, UNIQUE `(user_id, lesson_id)`, `(user_id, completed)` | Upsert de progreso y cálculo de desbloqueo |
| payments | `user_id`, `status`, session/intent UNIQUE | Historial y webhooks |
| lessons / modules | FK indexes + UNIQUE de orden | Carga de currículo |

---

## 3. Reglas de negocio implementadas en SQL

### 3.1 Completado de lección (spec §4)

`completed = watched_seconds >= duration_seconds * 0.9` — el umbral vive en la API
(`PROGRESS_COMPLETION_THRESHOLD`), que es quien escribe `completed`. La BD
garantiza el resto: `watched_seconds` monótono creciente y `completed`
irreversible se aplican en `ProgressService` (test unitario incluido).

### 3.2 Desbloqueo secuencial — `lesson_is_unlocked(p_user, p_lesson)`

Función `SECURITY DEFINER` que replica el Guard de Angular (spec §6.2):

1. Lección **preview** → siempre desbloqueada.
2. **Dueño del curso o admin** → siempre desbloqueada.
3. Sin **enrollment activo** → bloqueada.
4. Inscrito → desbloqueada **solo si todas las lecciones anteriores
   no-preview** (orden global `(modules.order_index, lessons.order_index)`)
   tienen `lesson_progress.completed = true`.

Se usa en RLS y su réplica TypeScript (`apps/api/src/common/unlock.ts`) se
ejecuta **antes de emitir la URL firmada del video** — con tests unitarios de
ambas implementaciones.

### 3.3 Progreso de curso — vista `course_progress_view`

```sql
create view course_progress_view with (security_invoker = on) as
select e.user_id, e.course_id,
       count(l.id)::int                                        as total_lessons,
       count(lp.id) filter (where lp.completed)::int           as completed_lessons,
       round(100.0 * count(lp.id) filter (where lp.completed)
             / nullif(count(l.id),0))::int                     as percent
from enrollments e
join modules m  on m.course_id = e.course_id
join lessons l  on l.module_id = m.id
left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
where e.status = 'active'
group by e.user_id, e.course_id;
```

`security_invoker = on` ⇒ cada usuario solo ve sus filas (respeta RLS).

### 3.4 Contadores automáticos — `maintain_course_counters()`

Triggers AFTER INSERT/UPDATE/DELETE sobre `enrollments` y `reviews` que
recalculan `total_enrollments`, `avg_rating` y `reviews_count` del curso.

### 3.5 Anti-escalada de privilegios — `prevent_role_escalation()`

Trigger BEFORE UPDATE en `profiles`: un usuario autenticado no puede cambiar
su propio `role` (solo admin, o la API con rol de servicio donde
`auth.uid()` es NULL).

---

## 4. Matriz RLS (quién puede qué)

| Tabla | anon | authenticated (dueño) | authenticated (otros) | instructor dueño | admin | service (API) |
|---|---|---|---|---|---|---|
| profiles | ✗ | SELECT/UPDATE propio | ✗ | — | SELECT todos | total |
| profiles_public_view | SELECT | SELECT | SELECT | SELECT | SELECT | — |
| instructors | SELECT | SELECT/UPDATE propio | SELECT | SELECT/UPDATE | total | total |
| categories | SELECT | SELECT | SELECT | SELECT | CRUD | total |
| courses | SELECT publicados | — | — | CRUD propios | CRUD | total |
| modules | SELECT si curso visible | — | — | CRUD si dueño | CRUD | total |
| lessons (metadata) | SELECT si curso publicado | — | — | CRUD si dueño | CRUD | total |
| lessons (columnas video) | ✗ (SELECT revocado) | ✗ | ✗ | vía API | vía API | total |
| enrollments | ✗ | SELECT propio; INSERT solo gratis | ✗ | — | SELECT todos | total (pagos) |
| lesson_progress | ✗ | SELECT/INSERT/UPDATE/DELETE propio | ✗ | — | SELECT | total |
| payments | ✗ | SELECT propios | ✗ | — | SELECT | total (webhook) |
| stripe_webhook_events | ✗ | ✗ | ✗ | ✗ | SELECT | total |
| reviews | SELECT publicados | CRUD propio (si inscrito) | SELECT | — | DELETE | total |
| certificates | ✗ | SELECT propios | ✗ | — | SELECT | total (emisión Fase 3) |
| feature_flags | SELECT | SELECT | SELECT | SELECT | CRUD | total |

**Claves del diseño:**
- El acceso de pago se materializa **solo** vía API con rol de servicio tras
  webhook confirmado de Stripe → la política `enrollments_insert_free` impide
  auto-inscribirse en cursos de pago desde el cliente.
- Las columnas sensibles de video se protegen con **column-level grants**
  (revocar SELECT de tabla y conceder solo columnas seguras), además de RLS.
- Funciones helper `SECURITY DEFINER` (`is_admin`, `is_enrolled`,
  `owns_course`, `course_is_visible`, `lesson_is_unlocked`) evitan recursión
  de políticas y centralizan las reglas.

---

## 5. Escalado futuro (spec §3.3 / §5)

- **Particionamiento**: si `lesson_progress`/eventos crecen, particionar
  `progress_events` por rango mensual (`PARTITION BY RANGE (created_at)`).
- **Caché**: catálogo cacheado en Redis con invalidación al editar cursos
  (la API ya está preparada: `REDIS_URL` opcional).
- **Full-text search**: el índice GIN trigram cubre el MVP; para búsqueda
  avanzada migrar a `tsvector` o Algolia (spec §14).
- **Marketplace**: `instructors.stripe_account_id` y `payouts_enabled` ya
  preparan el reparto de pagos con Stripe Connect (Fase 3).
