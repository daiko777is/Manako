# Manakō — Plataforma de cursos online

Implementación completa de la especificación técnica
[`plataforma-cursos-especificacion-tecnica.md`](uploads/plataforma-cursos-especificacion-tecnica.md):
un clon de Udemy/Platzi con **Angular 18 (standalone + Signals + RxJS)**,
**NestJS**, **Supabase (Postgres + Auth + RLS)** y **Stripe**, preparado para
video con **Mux / Cloudflare Stream**.

```
manako/
├── apps/
│   ├── api/            # Backend NestJS (monolito modular, capas Controller→Service→Repository)
│   └── web/            # Frontend Angular 18 (standalone, signals, RxJS, Tailwind)
├── packages/
│   └── shared/         # Tipos compartidos web↔api (solo compile-time)
├── supabase/
│   ├── migrations/     # DDL + funciones + RLS (fuente de verdad del esquema)
│   └── seed.sql        # Datos demo (desarrollo)
├── docs/
│   ├── SETUP.md                            # 🔑 Conexión a Supabase/Stripe/Mux reales
│   ├── esquema-base-de-datos.md            # ERD completo + reglas + matriz RLS
│   ├── contrato-instructor-marketplace.md  # Acuerdo de instructor desglosado
│   └── arquitectura.html                   # Diagramas visuales (abrir en navegador)
├── devops/github-actions-ci.yml            # Pipeline CI/CD (spec §12) — cópialo a
│                                           # .github/workflows/ci.yml para activarlo
└── docker-compose.yml                      # Postgres + Redis + API para local
```

---

## 🚀 Arranque rápido

```bash
npm install                                   # instala los 3 workspaces
# 1) Configura servicios reales (Supabase, Stripe, video):
cp apps/api/.env.example apps/api/.env        #   y sigue docs/SETUP.md
cp apps/web/.env.example apps/web/.env
# 2) Aplica el esquema en tu proyecto Supabase (supabase db push)
# 3) Levanta ambos apps:
npm run dev                                   # api :3000 + web :4200 (concurrently)
```

- Web: http://localhost:4200 · API: http://localhost:3000/api/v1 · Swagger: http://localhost:3000/api/docs
- **¿Sin claves todavía?** Prueba con Postgres local: `docker compose up -d db`, aplica las
  migraciones + seed (ver [`supabase/README.md`](supabase/README.md)) y usa `VIDEO_PROVIDER=direct`.
- Guía completa con claves reales: **[`docs/SETUP.md`](docs/SETUP.md)**.

```bash
npm test                # unitarios de la API (jest)
npm run lint            # eslint api + web
npm run build           # build de producción de ambos apps
```

---

## ✅ Especificación → implementación

| Spec | Requisito | Dónde está |
|---|---|---|
| §1 | Auth y perfiles (student/instructor/admin) | Supabase Auth + `auth/` (API) + `core/auth` (web); promoción a instructor `POST /instructors/apply` |
| §1 | Catálogo con búsqueda, filtros, categorías | `courses/` (API, pg_trgm + cursor) + `features/catalog` (signals + RxJS debounce) |
| §1 | Reproductor con tracking de progreso | `features/learn/video-player.component.ts` (video.js HLS) + `core/progress` (throttle 5 s + localStorage) |
| §1 | Bloqueo secuencial con Guards | `lessonUnlockGuard` (web) + `PlaybackService`/`lesson_is_unlocked()` (API/SQL) |
| §1 | Barra de progreso por curso | `course_progress_view` + `ProgressBarComponent` + sidebar del reproductor |
| §1 | Pagos/inscripción | Stripe Checkout + webhook idempotente (`payments/`) + `enrollments/` |
| §1 | Panel instructor (CRUD cursos) | `curriculum/` (API) + `features/instructor` (editor, uploads, analíticas) |
| §1 | Panel administración | `admin/` (API) + `features/admin` (métricas, usuarios/roles, moderación, reembolsos) |
| §2 | API intermedia NestJS + Supabase | Arquitectura implementada tal cual (ver `docs/arquitectura.html`) |
| §3.1 | Standalone + Signals + RxJS, Tailwind, Reactive Forms, video.js, lazy loading | Todo el frontend (`apps/web`) |
| §3.2 | DTOs class-validator, Prisma, Swagger, JWT Supabase validado en NestJS | `apps/api` (`config/env.ts` valida entorno al arrancar) |
| §3.3 | Postgres + RLS + índices | `supabase/migrations/*` + `docs/esquema-base-de-datos.md` |
| §3.4 | Mux / Cloudflare Stream / URLs firmadas / webhooks de video | `playback/providers/*` (factoría seleccionable por env y por lección) |
| §3.5 | JWT corta duración + RBAC + validación backend | `SupabaseJwtService` (HS256 o JWKS) + `JwtAuthGuard`/`RolesGuard` |
| §3.6 | Stripe Checkout + webhooks + reembolsos (+ Connect Fase 3) | `payments/` · refund admin · `PLATFORM_FEE_PERCENT` · campos Connect en BD |
| §3.7 | Docker, CI/CD, entornos | `apps/api/Dockerfile`, `docker-compose.yml`, `devops/github-actions-ci.yml` |
| §3.8 | Logs JSON estructurados + request-id | `JsonLoggingInterceptor` + `RequestIdInterceptor` (Sentry/PostHog: integrar claves) |
| §4 | Modelo de datos + umbral 90% + RLS de ejemplo | Migraciones SQL + `PROGRESS_COMPLETION_THRESHOLD` + tests |
| §5 | Monolito modular, Repository+Service+Controller, feature flags, caché | Módulos de dominio en `apps/api`; `feature_flags` (API con caché TTL); Redis opcional |
| §6.2 | Guard de lección + validación backend antes de URL firmada | `lesson-unlock.guard.ts` ↔ `PlaybackService.getPlayback()` (doble capa) |
| §6.3 | OWASP: Helmet, CORS whitelist, throttler, DTOs whitelist, secretos en env | `main.ts` + `ThrottlerModule` + `ValidationPipe` + `.env.example` |
| §6.4 | URLs firmadas TTL corto, watermark, anti clic-derecho | `PlaybackResponse.watermark` + overlay en el reproductor + TTL 600 s |
| §7.1 | Lazy loading, OnPush, signals, budgets | `app.routes.ts` (todo lazy), componentes OnPush, budgets en `angular.json` |
| §7.3 | Paginación cursor, índices, pool (PgBouncer) | `common/pagination.ts` + índices SQL + `DATABASE_URL` pooler |
| §7.4 | Throttle del progreso + buffer local + sincronización | `ProgressTrackerService` (flush 5 s/online/pagehide con `fetch keepalive`) |
| §8 | Capas, DTOs, errores `{statusCode,message,error}`, versionado `/api/v1`, idempotencia, migraciones | `common/all-exceptions.filter.ts`, `VersioningType.URI`, `stripe_webhook_events` |
| §9 | Interceptor JWT + errores, `takeUntilDestroyed`, strict TS, componentes dumb/smart | `core/http/*`, `tsconfig strict`, `course-card` (dumb) vs páginas (smart) |
| §10 | Términos/Privacidad/Cookies/Reembolsos + banner consentimiento + aviso de certificados | `features/legal/*` (plantillas revisables) + `CookieBannerComponent` + footer |
| §11 | Unit (jest), e2e (Playwright) | `*.spec.ts` (18 tests API) + `apps/web/e2e/smoke.spec.ts` |
| §12 | Pipeline lint→test→build→audit→staging→prod manual→smoke | `devops/github-actions-ci.yml` (mover a `.github/workflows/` para activar) |
| §13 | Fases 0-1 (fundación + MVP) | Este repo; fases 2-4 mapeadas en docs (campos BD ya preparados: Connect, certificados, reviews) |
| §16 | Checklist pre-lanzamiento | Cubierto en `docs/SETUP.md` §7 |

**Fases posteriores ya preparadas en el esquema** (sin endpoints aún): `reviews`,
`certificates`, suscripciones (Stripe Billing) y Stripe Connect (marketplace).

---

## 🧪 Tests

```bash
npm test                            # unitarios API (jest): desbloqueo, umbral 90%, idempotencia webhooks
npm run test -w @manako/web         # Web (karma): utilidades de formato
npm run test:e2e -w @manako/api     # Integración contra BD (requiere DATABASE_URL de prueba)
node scripts/smoke-api.mjs          # 37 checks E2E HTTP contra API+BD local con seed (ver cabecera)
cd apps/web && npx playwright test  # E2E del flujo crítico (requiere apps corriendo + seed)
```

---

## 🔐 Seguridad — resumen de capas

1. **Frontend**: Guards (`authGuard`, `rolesGuard`, `enrollmentGuard`, `lessonUnlockGuard`) → solo UX.
2. **API**: JWT Supabase verificado (HS256/JWKS) + RBAC por rol de BD + rate limiting + DTO whitelist + Helmet + CORS.
3. **Datos**: RLS en todas las tablas sensibles, columnas de video con SELECT revocado,
   `lesson_is_unlocked()` como segunda validación, triggers anti-escalada de rol.
4. **Contenido**: URLs HLS firmadas con TTL de minutos + watermark con el email del usuario.
5. **Pagos**: acceso concedido solo por webhook verificado y idempotente; reembolsos revocan inscripción.

---

## 📚 Documentación

- [`docs/SETUP.md`](docs/SETUP.md) — conectar Supabase, Stripe, Mux/Cloudflare y desplegar.
- [`docs/esquema-base-de-datos.md`](docs/esquema-base-de-datos.md) — ERD, decisiones, RLS, reglas de negocio.
- [`docs/arquitectura.html`](docs/arquitectura.html) — diagramas (arquitectura, compra, reproducción, CI/CD).
- [`docs/contrato-instructor-marketplace.md`](docs/contrato-instructor-marketplace.md) — acuerdo de instructor.
- [`supabase/README.md`](supabase/README.md) — aplicar migraciones y seed.

> Los textos legales de `apps/web/src/app/features/legal` y el contrato de instructor son
> **plantillas** derivadas de la spec §10: hazlas revisar por asesoría legal local antes de
> operar con pagos reales.
