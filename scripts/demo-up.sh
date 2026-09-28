#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════════
# Manakō · Demo en un comando
#   npm run demo
# Levanta: Postgres (docker) + migraciones + seed + API + Web en modo demo.
# Requisitos: Docker corriendo, Node 20+, deps instaladas (npm install).
# Sin Docker: mira docs/DEMO.md (opción Postgres propio / Supabase CLI).
# ═══════════════════════════════════════════════════════════════════════════
set -euo pipefail
cd "$(dirname "$0")/.."

step() { printf '\n\033[1;34m▶ %s\033[0m\n' "$1"; }
ok()   { printf '  \033[0;32m✓\033[0m %s\n' "$1"; }
die()  { printf '  \033[0;31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

# ── 0. Dependencias ────────────────────────────────────────────────────────
step "Verificando dependencias"
if [ ! -d node_modules ] || [ ! -d apps/api/node_modules ] && [ ! -d node_modules/@nestjs ]; then
  npm install --no-audit --no-fund
  (cd apps/api && npx prisma generate)
fi
ok "node_modules listo"

command -v docker >/dev/null 2>&1 || die "Docker no encontrado. Instala Docker o sigue docs/DEMO.md (opción B)."
docker info >/dev/null 2>&1 || die "El daemon de Docker no está corriendo."

# ── 1. Entornos demo ───────────────────────────────────────────────────────
step "Configurando .env de demo"
[ -f apps/api/.env ] || cp apps/api/.env.demo apps/api/.env
[ -f apps/web/.env ] || cp apps/web/.env.demo apps/web/.env
grep -q "DEMO_MODE=true" apps/api/.env || cp apps/api/.env.demo apps/api/.env
grep -q "NG_APP_DEMO_MODE=true" apps/web/.env || cp apps/web/.env.demo apps/web/.env
ok "apps/api/.env y apps/web/.env en modo demo"

# ── 2. Base de datos ───────────────────────────────────────────────────────
step "Levantando Postgres (docker compose)"
docker compose up -d db
for i in $(seq 1 30); do
  if docker compose exec -T db pg_isready -U manako >/dev/null 2>&1; then break; fi
  sleep 1
  [ "$i" = "30" ] && die "Postgres no arrancó a tiempo"
done
ok "Postgres aceptando conexiones"

step "Aplicando esquema (solo la primera vez)"
HAS_SCHEMA=$(docker compose exec -T db psql -U manako -d manako -tAc "select to_regclass('public.courses') is not null")
if [ "$HAS_SCHEMA" != "t" ]; then
  docker compose exec -T db psql -U manako -d manako -v ON_ERROR_STOP=1 -q < supabase/migrations/0001_initial_schema.sql
  docker compose exec -T db psql -U manako -d manako -v ON_ERROR_STOP=1 -q < supabase/migrations/0002_functions_rls.sql
  ok "Migraciones aplicadas (RLS incluido)"
else
  ok "Esquema ya existe — se omite"
fi

step "Cargando datos demo (idempotente)"
docker compose exec -T db psql -U manako -d manako -v ON_ERROR_STOP=1 -q < supabase/seed.sql
ok "Seed listo: 3 cursos, 3 cuentas demo"

# ── 3. Arranque ────────────────────────────────────────────────────────────
step "Arrancando API (:3000) + Web (:4200)"
cat <<'EOF'

  ┌──────────────────────────────────────────────────────────┐
  │  🎓 Manakō demo                                          │
  │                                                          │
  │  Web:   http://localhost:4200                            │
  │  API:   http://localhost:3000/api/v1  (docs: /api/docs)  │
  │                                                          │
  │  Cuentas demo (login con un clic):                       │
  │    estudiante@manako.demo  · Estudiante                  │
  │    instructor@manako.demo  · Instructor                  │
  │    admin@manako.demo       · Admin                       │
  │                                                          │
  │  Pagos: simulados · Video: muestras Creative Commons     │
  │  Ctrl+C para parar todo                                  │
  └──────────────────────────────────────────────────────────┘

EOF
npm run dev
