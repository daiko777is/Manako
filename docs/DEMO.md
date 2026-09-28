# Manakō — Modo Demo (app funcional sin servicios externos)

El modo demo permite probar **toda la aplicación** (login, inscripción, compra,
reproductor con progreso y bloqueo secuencial, panel de instructor y de admin)
usando solo Postgres local. Sin Supabase cloud, sin Stripe, sin Mux.

## Opción A — Un comando (recomendada, requiere Docker)

```bash
npm install     # solo la primera vez
npm run demo
```

El script `scripts/demo-up.sh`:
1. Copia `.env.demo` → `.env` en `apps/api` y `apps/web` (modo demo activado).
2. Levanta Postgres con `docker compose up -d db`.
3. Aplica migraciones + RLS (solo la primera vez) y el seed (idempotente).
4. Arranca API (`:3000`) y Web (`:4200`) con `npm run dev`.

Abre **http://localhost:4200** → en `/login` verás el panel **"Modo demo activo"**
con las cuentas de un clic:

| Cuenta | Rol | Qué probar |
|---|---|---|
| `estudiante@manako.demo` | Estudiante | Ya inscrito al curso gratis con progreso: reproductor, bloqueo secuencial, marcar completada |
| `instructor@manako.demo` | Instructor | Panel de instructor: crear curso, módulos, lecciones, publicar, analíticas |
| `admin@manako.demo` | Admin | Métricas, usuarios/roles, moderación, reembolsos |

El registro también funciona: crea cuentas nuevas al instante (sin email de
confirmación). O escribe cualquier email nuevo en el login y se crea solo.

### Flujo de compra demo
En un curso de pago (p. ej. *NestJS profesional*, $49.99), pulsa **Comprar**:
la API **simula el pago de Stripe** (payment `succeeded` + inscripción inmediata,
marcado en logs como `[DEMO] Pago simulado`). Verás el curso en *Mi aprendizaje*,
el pago en el panel admin y podrás reembolsarlo desde ahí (también simulado).

## Opción B — Sin Docker (Postgres propio)

1. Crea la BD y aplica esquema + seed:
   ```bash
   createdb manako
   psql -d manako -f supabase/migrations/0001_initial_schema.sql
   psql -d manako -f supabase/migrations/0002_functions_rls.sql
   psql -d manako -f supabase/seed.sql
   ```
2. `cp apps/api/.env.demo apps/api/.env` y ajusta `DATABASE_URL` a tu Postgres.
3. `cp apps/web/.env.demo apps/web/.env`.
4. `npm run dev`.

## Opción C — Demo con Supabase local real (auth de verdad)

Si quieres OAuth/emails reales en local: `supabase start` (Docker), aplica las
migraciones con `supabase db push`, y usa las URLs/keys locales que imprime la
CLI (`http://127.0.0.1:54321`) en los `.env` **sin** `DEMO_MODE`. Los usuarios
seed hay que crearlos desde el dashboard local (`http://127.0.0.1:54323`).

## Qué es real y qué está simulado en el modo demo

| Pieza | Estado en demo |
|---|---|
| Postgres, RLS, triggers, vistas | ✅ Reales (mismo esquema que producción) |
| JWT + RBAC + guards + rate limiting | ✅ Reales (la API firma JWT con el mismo formato que Supabase) |
| Progreso, umbral 90%, bloqueo secuencial | ✅ Reales (misma lógica que producción) |
| Login/registro | ⚠️ Simulado: sin verificación de contraseña ni email (endpoint `/auth/demo/*`, solo activo con `DEMO_MODE=true`) |
| Pagos | ⚠️ Simulados: sin llamadas a Stripe; reembolsos marcan estado directamente |
| Video | ⚠️ Muestras Creative Commons vía provider `direct` (sin HLS firmado; en producción: Mux/CF Stream) |
| Emails transaccionales | ❌ No hay (fase 2) |

## Seguridad

- Los endpoints demo viven en `POST /api/v1/auth/demo/login` y
  `GET /api/v1/auth/demo/users`; devuelven **404 si `DEMO_MODE` no es `true`**
  y tienen rate limiting reforzado.
- `DEMO_MODE=true` imprime un warning al arrancar. **Nunca** actives
  `DEMO_MODE` en un despliegue público con datos reales.
- El JWT demo expira a los 7 días y se guarda en `localStorage`
  (`manako:demo-token`).

## Resetear la demo

```bash
docker compose exec db psql -U manako -d manako -c "drop schema public cascade; create schema public;"
docker compose exec db psql -U manako -d manako -v ON_ERROR_STOP=1 < supabase/migrations/0001_initial_schema.sql
docker compose exec db psql -U manako -d manako -v ON_ERROR_STOP=1 < supabase/migrations/0002_functions_rls.sql
docker compose exec db psql -U manako -d manako -v ON_ERROR_STOP=1 < supabase/seed.sql
```
