-- ============================================================================
-- Manakō · Migración 0001 — Esquema inicial
-- PostgreSQL 15+ (Supabase). Compatible con Postgres "plano" vía shims.
-- Ejecutar con: supabase db push   (o pegar en el SQL Editor de Supabase)
-- ============================================================================

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists pg_trgm;    -- búsqueda por similitud de texto

-- ----------------------------------------------------------------------------
-- Shims para desarrollo local SIN Supabase (docker-compose / Postgres plano).
-- En un proyecto Supabase real, auth.users, auth.uid() y los roles ya existen
-- y estos bloques no hacen nada.
-- ----------------------------------------------------------------------------
do $do$
begin
  if to_regclass('auth.users') is null then
    create schema if not exists auth;
    create table auth.users (
      id uuid primary key default gen_random_uuid(),
      email text unique,
      encrypted_password text,
      raw_user_meta_data jsonb default '{}'::jsonb,
      raw_app_meta_data jsonb default '{}'::jsonb,
      created_at timestamptz default now()
    );
  end if;

  if to_regprocedure('auth.uid()') is null then
    create function auth.uid() returns uuid
    language sql stable as $fn$
      select nullif(
        coalesce(
          current_setting('request.jwt.claim.sub', true),
          (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
        ), '')::uuid
    $fn$;
  end if;

  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin;
  end if;
end $do$;

-- ----------------------------------------------------------------------------
-- ENUMs
-- ----------------------------------------------------------------------------
create type user_role        as enum ('student', 'instructor', 'admin');
create type course_status    as enum ('draft', 'published', 'archived');
create type course_level     as enum ('beginner', 'intermediate', 'advanced');
create type payment_status   as enum ('pending', 'succeeded', 'failed', 'refunded');
create type enrollment_status as enum ('active', 'refunded');
create type video_provider   as enum ('mux', 'cloudflare', 'direct');

-- ----------------------------------------------------------------------------
-- Tabla: profiles (1:1 con auth.users — se crea sola vía trigger, ver 0002)
-- ----------------------------------------------------------------------------
create table profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  role       user_role not null default 'student',
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index profiles_role_idx on profiles(role);

-- ----------------------------------------------------------------------------
-- Tabla: instructors (perfil extendido de instructores; 1:1 con profiles)
-- ----------------------------------------------------------------------------
create table instructors (
  user_id           uuid primary key references profiles(id) on delete cascade,
  headline          text,
  bio               text,
  stripe_account_id text unique,          -- Stripe Connect (pagos marketplace, Fase 3+)
  payouts_enabled   boolean not null default false,
  created_at        timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tabla: categories
-- ----------------------------------------------------------------------------
create table categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  description text
);

-- ----------------------------------------------------------------------------
-- Tabla: courses
-- ----------------------------------------------------------------------------
create table courses (
  id                uuid primary key default gen_random_uuid(),
  instructor_id     uuid not null references instructors(user_id) on delete restrict,
  category_id       uuid references categories(id) on delete set null,
  title             text not null,
  slug              text not null unique,
  subtitle          text,
  description       text not null default '',
  price_cents       integer not null default 0 check (price_cents >= 0),
  currency          char(3) not null default 'USD',
  level             course_level not null default 'beginner',
  thumbnail_url     text,
  status            course_status not null default 'draft',
  published_at      timestamptz,
  -- Campos desnormalizados (mantenidos por triggers, ver abajo)
  avg_rating        numeric(3,2) not null default 0,
  reviews_count     integer not null default 0,
  total_enrollments integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index courses_status_published_idx on courses(status, published_at desc);
create index courses_category_idx         on courses(category_id);
create index courses_instructor_idx       on courses(instructor_id);
create index courses_price_idx            on courses(price_cents);
create index courses_title_trgm_idx       on courses using gin (title gin_trgm_ops);

-- ----------------------------------------------------------------------------
-- Tabla: modules (módulos/secciones de un curso, ordenados)
-- ----------------------------------------------------------------------------
create table modules (
  id          uuid primary key default gen_random_uuid(),
  course_id   uuid not null references courses(id) on delete cascade,
  title       text not null,
  description text,
  order_index integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (course_id, order_index)
);
create index modules_course_idx on modules(course_id);

-- ----------------------------------------------------------------------------
-- Tabla: lessons (lecciones de un módulo, ordenadas)
-- video_asset_id / video_playback_id / video_url son SENSIBLES: el acceso
-- directo vía cliente Supabase está restringido por column grants (ver 0002).
-- ----------------------------------------------------------------------------
create table lessons (
  id                uuid primary key default gen_random_uuid(),
  module_id         uuid not null references modules(id) on delete cascade,
  title             text not null,
  description       text,
  order_index       integer not null default 0,
  duration_seconds  integer not null default 0 check (duration_seconds >= 0),
  video_provider    video_provider not null default 'direct',
  video_asset_id    text,            -- id del asset en el proveedor (Mux asset / CF Stream uid)
  video_playback_id text,            -- id de reproducción (Mux playback id)
  video_url         text,            -- solo para provider='direct' (desarrollo)
  is_preview        boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (module_id, order_index)
);
create index lessons_module_idx on lessons(module_id);

-- ----------------------------------------------------------------------------
-- Tabla: payments (antes de enrollments por la FK circular)
-- Idempotencia: stripe_checkout_session_id y stripe_payment_intent_id UNIQUE.
-- ----------------------------------------------------------------------------
create table payments (
  id                         uuid primary key default gen_random_uuid(),
  user_id                    uuid not null references profiles(id) on delete cascade,
  course_id                  uuid not null references courses(id) on delete cascade,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id   text unique,
  amount_cents               integer not null check (amount_cents >= 0),
  currency                   char(3) not null default 'USD',
  status                     payment_status not null default 'pending',
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);
create index payments_user_idx   on payments(user_id);
create index payments_course_idx on payments(course_id);
create index payments_status_idx on payments(status);

-- ----------------------------------------------------------------------------
-- Tabla: stripe_webhook_events (idempotencia estricta de webhooks)
-- ----------------------------------------------------------------------------
create table stripe_webhook_events (
  id           text primary key,   -- evt_...
  type         text not null,
  processed_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- Tabla: enrollments (inscripciones)
-- ----------------------------------------------------------------------------
create table enrollments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references profiles(id) on delete cascade,
  course_id   uuid not null references courses(id) on delete cascade,
  status      enrollment_status not null default 'active',
  payment_id  uuid references payments(id) on delete set null,
  enrolled_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index enrollments_user_idx   on enrollments(user_id);
create index enrollments_course_idx on enrollments(course_id);

-- ----------------------------------------------------------------------------
-- Tabla: lesson_progress (estado de progreso por usuario/lección)
-- Regla de negocio: completed = watched_seconds >= duration_seconds * umbral
-- (umbral configurable en la API, default 0.9). Ver también 0002 (RLS).
-- ----------------------------------------------------------------------------
create table lesson_progress (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id) on delete cascade,
  lesson_id       uuid not null references lessons(id) on delete cascade,
  watched_seconds integer not null default 0 check (watched_seconds >= 0),
  completed       boolean not null default false,
  last_watched_at timestamptz not null default now(),
  unique (user_id, lesson_id)
);
create index lesson_progress_user_idx   on lesson_progress(user_id);
create index lesson_progress_lesson_idx on lesson_progress(lesson_id);
create index lesson_progress_incomplete_idx on lesson_progress(user_id, completed);

-- ----------------------------------------------------------------------------
-- Tabla: reviews (Fase 3 en la API; esquema + RLS listos desde ya)
-- ----------------------------------------------------------------------------
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references profiles(id) on delete cascade,
  course_id  uuid not null references courses(id) on delete cascade,
  rating     integer not null check (rating between 1 and 5),
  comment    text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, course_id)
);
create index reviews_course_idx on reviews(course_id);

-- ----------------------------------------------------------------------------
-- Tabla: certificates (Fase 3; esquema listo)
-- ----------------------------------------------------------------------------
create table certificates (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references profiles(id) on delete cascade,
  course_id          uuid not null references courses(id) on delete cascade,
  certificate_number text not null unique,
  certificate_url    text,
  issued_at          timestamptz not null default now(),
  unique (user_id, course_id)
);

-- ----------------------------------------------------------------------------
-- Tabla: feature_flags (lanzamiento gradual de funcionalidades)
-- ----------------------------------------------------------------------------
create table feature_flags (
  key         text primary key,
  enabled     boolean not null default false,
  description text,
  updated_at  timestamptz not null default now()
);

insert into feature_flags (key, enabled, description) values
  ('sequential_lock', true,  'Bloqueo secuencial de lecciones (N+1 hasta completar N)'),
  ('reviews_enabled', false, 'Sistema de reviews visible en el catálogo (Fase 3)'),
  ('certificates_enabled', false, 'Emisión de certificados PDF (Fase 3)')
on conflict (key) do nothing;

-- ----------------------------------------------------------------------------
-- Trigger genérico: updated_at
-- ----------------------------------------------------------------------------
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger trg_profiles_updated      before update on profiles      for each row execute function set_updated_at();
create trigger trg_courses_updated       before update on courses       for each row execute function set_updated_at();
create trigger trg_lessons_updated       before update on lessons       for each row execute function set_updated_at();
create trigger trg_payments_updated      before update on payments      for each row execute function set_updated_at();
create trigger trg_reviews_updated       before update on reviews       for each row execute function set_updated_at();
create trigger trg_feature_flags_updated before update on feature_flags for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Trigger: crear profile automáticamente al registrarse en auth.users
-- ----------------------------------------------------------------------------
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', split_part(coalesce(new.email, ''), '@', 1)),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_app_meta_data ->> 'role')::user_role, 'student')
  )
  on conflict (id) do update set email = excluded.email;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ----------------------------------------------------------------------------
-- Trigger: contadores desnormalizados de courses (enrollments y reviews)
-- ----------------------------------------------------------------------------
create or replace function maintain_course_counters() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_course uuid;
begin
  v_course := coalesce(new.course_id, old.course_id);

  if tg_table_name = 'enrollments' then
    update courses c
    set total_enrollments = (
      select count(*) from enrollments e
      where e.course_id = v_course and e.status = 'active'
    )
    where c.id = v_course;
  else
    update courses c
    set reviews_count = (select count(*) from reviews r where r.course_id = v_course),
        avg_rating = coalesce(
          (select round(avg(r.rating)::numeric, 2) from reviews r where r.course_id = v_course),
          0)
    where c.id = v_course;
  end if;

  return null;
end $$;

create trigger trg_enrollments_counters
  after insert or update of status or delete on enrollments
  for each row execute function maintain_course_counters();

create trigger trg_reviews_counters
  after insert or update or delete on reviews
  for each row execute function maintain_course_counters();

-- ----------------------------------------------------------------------------
-- Trigger: evitar escalada de privilegios editando el propio role
-- (la API usa rol de servicio y auth.uid() es null → permitido;
--  un usuario autenticado solo puede cambiar su role si es admin)
-- ----------------------------------------------------------------------------
create or replace function prevent_role_escalation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.role is distinct from old.role
     and auth.uid() is not null
     and not exists (select 1 from profiles p where p.id = auth.uid() and p.role = 'admin')
  then
    raise exception 'No puedes cambiar tu propio rol';
  end if;
  return new;
end $$;

create trigger trg_profiles_role before update on profiles
  for each row execute function prevent_role_escalation();
