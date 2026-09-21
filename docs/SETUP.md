# Manakō — Puesta en marcha con servicios reales

Guía paso a paso para conectar el proyecto a **Supabase**, **Stripe** y un
**proveedor de video** reales. Tiempo estimado: 45–60 min.

> Requisitos: Node ≥ 20, una cuenta de [Supabase](https://supabase.com),
> [Stripe](https://stripe.com) y (recomendado) [Mux](https://mux.com) o
> [Cloudflare Stream](https://developers.cloudflare.com/stream/).

---

## 0. Instalar el monorepo

```bash
npm install            # instala los 3 workspaces (apps/api, apps/web, packages/shared)
```

---

## 1. Supabase (BD + Auth)

### 1.1 Crear el proyecto
1. [dashboard.supabase.com](https://dashboard.supabase.com) → **New project**
   (anota el `project-ref` y la contraseña de BD).

### 1.2 Aplicar esquema + RLS
Con la CLI (recomendado):
```bash
npm i -g supabase
supabase login
cd manako
supabase link --project-ref TU-REF
supabase db push          # aplica supabase/migrations/*.sql
```
O pega `0001_initial_schema.sql` y `0002_functions_rls.sql` (en ese orden) en
el **SQL Editor** del dashboard. Detalles y opción Postgres local:
[`supabase/README.md`](../supabase/README.md).

> ⚠️ Las migraciones crean el esquema relacional y las políticas RLS.
> Prisma se usa como ORM (cliente tipado); el DDL fuente de verdad es SQL.
> Si prefieres migraciones Prisma puras: `npx prisma migrate diff --from-empty
> --to-schema-datamodel prisma/schema.prisma --script` (no incluye RLS).

### 1.3 Auth
1. **Authentication → Providers**: activa *Email* (desactiva "Confirm email"
   para desarrollo si quieres login inmediato) y *Google* (opcional: requiere
   OAuth credentials de Google Cloud con redirect
   `https://TU-REF.supabase.co/auth/v1/callback`).
2. **Authentication → URL Configuration**: añade `http://localhost:4200` a
   *Redirect URLs*.
3. **API Keys**: copia la `anon public key` (para la web) y la
   `service_role key` (SOLO para la API).
4. **JWT Settings**: copia el *JWT Secret* (HS256) o activa *JWT signing keys*
   asimétricas y usa la URL JWKS (`SUPABASE_JWKS_URL`).

### 1.4 Datos demo (opcional)
Crea usuarios desde **Authentication → Add user** (el trigger
`handle_new_user` crea su profile automáticamente). Para cursos de ejemplo,
ejecuta las secciones de cursos/módulos/lecciones de `supabase/seed.sql`
(omite los inserts en `auth.users` en Supabase real).

---

## 2. API (NestJS)

```bash
cd apps/api
cp .env.example .env
```

Rellena en `.env` (todo lo marcado en `.env.example`):

| Variable | De dónde sale |
|---|---|
| `DATABASE_URL` | Supabase → Project Settings → Database → *Connection pooling* (PgBouncer, puerto 6543) |
| `DIRECT_URL` | Misma pantalla, conexión directa (puerto 5432) — la usa Prisma Migrate |
| `SUPABASE_URL` | `https://TU-REF.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` (secreta) |
| `SUPABASE_JWT_SECRET` **o** `SUPABASE_JWKS_URL` | Authentication → JWT Settings |
| `SUPABASE_JWT_ISSUER` | `https://TU-REF.supabase.co/auth/v1` |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | ver §3 |
| `VIDEO_PROVIDER` + claves del proveedor | ver §4 |
| `FRONTEND_URL` | `http://localhost:4200` en dev |

Arranque:
```bash
npm run start:dev      # http://localhost:3000/api/v1 · docs en /api/docs
```

Verifica: `curl http://localhost:3000/api/v1/health` → `{"status":"ok","db":"up"}`.

---

## 3. Stripe (pagos)

1. [dashboard.stripe.com](https://dashboard.stripe.com) (usa modo **test**
   primero) → Developers → **API keys** → copia la *Secret key*
   (`sk_test_...`) a `STRIPE_SECRET_KEY`.
2. **Webhook** (producción): Developers → Webhooks → *Add endpoint*:
   - URL: `https://TU-API/api/v1/payments/webhook`
   - Eventos: `checkout.session.completed`, `payment_intent.payment_failed`,
     `charge.refunded`
   - Copia el *Signing secret* (`whsec_...`) a `STRIPE_WEBHOOK_SECRET`.
3. **Webhook en local** (Stripe CLI reenvía eventos a tu máquina):
   ```bash
   stripe listen --forward-to localhost:3000/api/v1/payments/webhook
   # imprime whsec_... → pégalo en STRIPE_WEBHOOK_SECRET
   # en otra terminal, dispara eventos de prueba:
   stripe trigger checkout.session.completed
   ```
4. Prueba el flujo con la tarjeta `4242 4242 4242 4242`, cualquier fecha
   futura y CVC.

> **Marketplace (Fase 3):** activa Stripe Connect para el split
> plataforma/instructor (`PLATFORM_FEE_PERCENT` ya está cableado; falta el
> onboarding Connect — ver `docs/contrato-instructor-marketplace.md`).

---

## 4. Video (elige un proveedor)

### Opción A — Mux (recomendada, spec §3.4)
1. Mux → Settings → **API Access Tokens** → crea un token → `MUX_TOKEN_ID`,
   `MUX_TOKEN_SECRET`.
2. Settings → **Signing Keys** → crea una → `MUX_SIGNING_KEY_ID` y la clave
   privada (PEM, una sola vez) → `MUX_SIGNING_KEY_PRIVATE_KEY` (escapa saltos
   de línea como `\n` en el `.env`).
3. Settings → **Webhooks** → añade
   `https://TU-API/api/v1/media/webhooks/mux`, activa `video.asset.ready` y
   `video.asset.errored`, copia el *Signing secret* → `MUX_WEBHOOK_SECRET`.
4. `VIDEO_PROVIDER=mux`.
   Flujo: el instructor sube el archivo **directo a Mux** (PUT a la URL de
   Direct Upload que devuelve la API); cuando Mux termina de procesar, el
   webhook guarda el `playback_id` y la lección queda "lista".

### Opción B — Cloudflare Stream
1. CF Dashboard → Stream → **API Tokens** → token con permisos de upload →
   `CF_STREAM_API_TOKEN` + `CF_STREAM_ACCOUNT_ID`.
2. Stream → **Keys** → crea *Customer Key* → `CF_STREAM_CUSTOMER_KEY` y
   descarga la clave privada (PEM) → `CF_STREAM_PRIVATE_KEY_PEM` (escapa `\n`).
3. Webhooks de Stream apuntando a
   `https://TU-API/api/v1/media/webhooks/cloudflare` con el secret →
   `CF_STREAM_WEBHOOK_SECRET`.
4. `VIDEO_PROVIDER=cloudflare`.
   La subida va **vía relay por la API** (multipart, límite 2 GB configurado).

### Opción C — direct (solo desarrollo)
`VIDEO_PROVIDER=direct`: el instructor pega una URL mp4 pública por lección
(así funciona el `seed.sql`, con videos Creative Commons de Google).
**No lo uses para contenido de pago**: sin HLS firmado ni protección (§3.4).

---

## 5. Web (Angular)

```bash
cd apps/web
cp .env.example .env
```

Rellena:
```
NG_APP_API_URL=http://localhost:3000/api/v1
NG_APP_SUPABASE_URL=https://TU-REF.supabase.co
NG_APP_SUPABASE_ANON_KEY=tu-anon-public-key
```

El script `scripts/env-to-environment.mjs` genera
`src/environments/environment*.ts` automáticamente en cada
`npm start` / `npm run build`.

```bash
npm start              # http://localhost:4200
```

---

## 6. Probar el flujo completo (checklist)

1. **Registro** en `/registro` → sesión iniciada (Supabase Auth).
2. **Catálogo** `/cursos` → búsqueda/filtros funcionan.
3. **Curso gratis** → *Inscribirme gratis* → reproductor.
4. **Curso de pago** → *Comprar* → Stripe Checkout (tarjeta 4242…) → vuelta a
   `/checkout/success` → acceso concedido por el webhook.
5. **Reproductor**: avanza unos segundos, recarga la página → continúa donde
   lo dejaste; al superar el 90% la lección se marca completada y se
   desbloquea la siguiente (verifica el candado 🔒 en la N+2).
6. **Panel instructor** (`instructor@…`): crear curso → módulo → lección →
   subir video → publicar; revisar *Analíticas*.
7. **Panel admin**: métricas, cambiar roles, moderar cursos, reembolsar un
   pago (revoca la inscripción).

Usuarios demo del seed local: `estudiante@manako.demo` / `instructor@manako.demo` /
`admin@manako.demo` — contraseña `manako123!` (solo Postgres local; en
Supabase créalos desde el dashboard).

---

## 7. Producción

| Paso | Cómo |
|---|---|
| **Frontend** | Vercel/Netlify/Cloudflare Pages: build `npm run build -w @manako/web`, output `apps/web/dist/web/browser`. Variables: las 3 `NG_APP_*`. |
| **Backend** | Railway/Render/Fly con `apps/api/Dockerfile` (o Node 20 + `npm run build -w @manako/api`). Variables: las de `apps/api/.env.example`. |
| **Migraciones** | `supabase db push` contra el proyecto de producción (paso explícito del pipeline, spec §12). |
| **Webhooks** | Actualiza en Stripe/Mux/CF las URLs de producción (`https://TU-API/api/v1/...`). |
| **CORS** | `CORS_ORIGINS=https://tu-dominio.com` (whitelist estricta). |
| **BD** | Rol dedicado de menor privilegio para la API (ver `supabase/README.md`). Backups automáticos activos (Supabase los incluye). |
| **Secretos** | Gestor de secretos (Doppler/Vault) en lugar de `.env` plano. |
| **Checklist final** | Recorre el §16 de la especificación (RLS probado, firmas de webhook, rate limits, HSTS, e2e en CI…). |

### Smoke tests post-deploy
```bash
curl -fsS https://TU-API/api/v1/health
node scripts/smoke-api.mjs   # batería de 37 checks E2E (catálogo, RBAC, desbloqueo,
                             # progreso 90%, checkout gratis, CRUD instructor, DTOs)
                             # contra una BD local con seed — ver cabecera del script
npx playwright test          # desde apps/web, contra E2E_BASE_URL de staging
```
