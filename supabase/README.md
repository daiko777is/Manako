# Migraciones y seed — Supabase

## Estructura

```
supabase/
├── migrations/
│   ├── 0001_initial_schema.sql   # Tablas, enums, índices, triggers
│   └── 0002_functions_rls.sql    # Funciones helper, RLS, vistas, grants
└── seed.sql                      # Datos demo (SOLO desarrollo)
```

## Opción A — Supabase CLI (recomendada)

```bash
npm i -g supabase          # o: brew install supabase/tap/supabase
supabase login
supabase link --project-ref TU-REF      # TU-REF está en la URL del dashboard
supabase db push                        # aplica migrations/*
supabase db reset                       # (dev) recrea todo + aplica seed.sql
```

> La CLI detecta automáticamente `supabase/migrations` y `supabase/seed.sql`
> en la raíz del repo. Si la CLI exige `supabase/config.toml`, ejecuta una vez
> `supabase init` y conserva esta carpeta.

## Opción B — SQL Editor del dashboard

Pega el contenido de `0001_initial_schema.sql` y luego `0002_functions_rls.sql`
(en ese orden) en el SQL Editor de tu proyecto Supabase y ejecuta.

## Opción C — Postgres local sin Supabase (docker compose)

Las migraciones incluyen shims (`auth.users`, `auth.uid()`, roles
`anon`/`authenticated`) para funcionar en Postgres plano:

```bash
docker compose up -d db
psql "postgresql://manako:manako_dev_password@localhost:5432/manako" \
  -f supabase/migrations/0001_initial_schema.sql
psql "postgresql://manako:manako_dev_password@localhost:5432/manako" \
  -f supabase/migrations/0002_functions_rls.sql
psql "postgresql://manako:manako_dev_password@localhost:5432/manako" \
  -f supabase/seed.sql
```

## Usuarios demo del seed (solo desarrollo)

| Rol        | Email                    | Contraseña   |
|------------|--------------------------|--------------|
| Instructor | `instructor@manako.demo` | `manako123!` |
| Estudiante | `estudiante@manako.demo` | `manako123!` |
| Admin      | `admin@manako.demo`      | `manako123!` |

> En Supabase real, los inserts directos en `auth.users` NO permiten login
> (GoTrue gestiona las contraseñas). Crea los usuarios demo desde
> **Dashboard → Authentication → Add user** (o con la Admin API usando la
> service key) y el trigger `handle_new_user` creará sus profiles.
> El seed SQL sí funciona tal cual en Postgres local (Opción C).

## Notas de diseño

- **RLS activado en todas las tablas sensibles** (spec §4/§6): las políticas
  cubren el acceso directo vía supabase-js desde el cliente; la API NestJS
  aplica además RBAC en código (defensa en profundidad).
- **Columnas de video protegidas**: `lessons.video_asset_id`,
  `video_playback_id` y `video_url` tienen el SELECT revocado para los roles
  `anon`/`authenticated`; solo se entregan vía API tras validar inscripción
  y desbloqueo secuencial (`lesson_is_unlocked()`).
- **Menor privilegio (producción)**: crea un rol dedicado para la API
  (`api_role`) con GRANTS limitados en lugar de usar `postgres`:

```sql
create role api_role login password '...';
grant usage on schema public to api_role;
grant select, insert, update, delete on all tables in schema public to api_role;
grant usage on all sequences in schema public to api_role;
revoke all on stripe_webhook_events from api_role; -- ejemplo de ajuste fino
```
