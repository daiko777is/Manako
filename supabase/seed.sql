-- ============================================================================
-- Manakō · Seed de desarrollo (datos demo)
-- Aplicar con: supabase db reset  (ejecuta migraciones + este seed)
-- ⚠️ SOLO DESARROLLO: crea usuarios demo con contraseña conocida.
-- ============================================================================

-- Categorías ----------------------------------------------------------------
insert into categories (id, name, slug, description) values
  ('11111111-1111-4111-8111-111111111111', 'Desarrollo Web',    'desarrollo-web',    'Frontend, backend y fullstack'),
  ('22222222-2222-4222-8222-222222222222', 'Mobile',            'mobile',            'iOS, Android e híbrido'),
  ('33333333-3333-4333-8333-333333333333', 'Datos e IA',        'datos-e-ia',        'Data science, ML e IA aplicada'),
  ('44444444-4444-4444-8444-444444444444', 'Diseño',            'diseno',            'UX/UI y diseño de producto'),
  ('55555555-5555-4555-8555-555555555555', 'Negocios',          'negocios',          'Emprendimiento y habilidades blandas')
on conflict (slug) do nothing;

-- Usuarios demo ---------------------------------------------------------------
-- password para los tres: manako123!  (hash bcrypt de ejemplo)
-- En Supabase real, créalos desde el dashboard (Auth → Add user) o con el
-- Admin API; estos inserts sirven para desarrollo local con Postgres plano.
insert into auth.users (id, email, encrypted_password, raw_user_meta_data, raw_app_meta_data)
values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'instructor@manako.demo',
    crypt('manako123!', gen_salt('bf')),
    '{"full_name":"Valentina Ríos"}'::jsonb, '{"role":"instructor"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'estudiante@manako.demo',
    crypt('manako123!', gen_salt('bf')),
    '{"full_name":"Marco Pérez"}'::jsonb, '{"role":"student"}'::jsonb),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin@manako.demo',
    crypt('manako123!', gen_salt('bf')),
    '{"full_name":"Admin Manakō"}'::jsonb, '{"role":"admin"}'::jsonb)
on conflict (id) do nothing;

-- Profiles (si el trigger handle_new_user no corrió, p.ej. inserts directos)
insert into profiles (id, email, full_name, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'instructor@manako.demo', 'Valentina Ríos', 'instructor'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'estudiante@manako.demo', 'Marco Pérez',    'student'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'admin@manako.demo',      'Admin Manakō',   'admin')
on conflict (id) do update set role = excluded.role;

insert into instructors (user_id, headline, bio) values
  ('aaaaaaaa-0000-4000-8000-000000000001',
   'Fullstack engineer · 10 años construyendo productos web',
   'Ingeniera fullstack apasionada por Angular y la arquitectura escalable. Ha liderado equipos en startups y consultoría.')
on conflict (user_id) do nothing;

-- Curso 1: publicado, gratis ---------------------------------------------------
insert into courses (id, instructor_id, category_id, title, slug, subtitle, description, price_cents, currency, level, status, published_at, thumbnail_url)
values
  ('bbbbbbbb-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '11111111-1111-4111-8111-111111111111',
   'Angular 18 desde cero: Signals, RxJS y Standalone Components',
   'angular-18-desde-cero',
   'Construye aplicaciones modernas con la última generación de Angular',
   'Curso práctico donde construirás una SPA completa con standalone components, signals para estado reactivo y RxJS para streams complejos. Incluye proyecto final: un tablero de cursos.',
   0, 'USD', 'beginner', 'published', now(), null)
on conflict (slug) do nothing;

insert into modules (id, course_id, title, order_index) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Fundamentos', 0),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Reactividad avanzada', 1)
on conflict (course_id, order_index) do nothing;

-- Videos de muestra públicos (Big Buck Bunny / Sintel — Creative Commons)
insert into lessons (id, module_id, title, order_index, duration_seconds, video_provider, video_url, is_preview) values
  ('dddddddd-0000-4000-8000-000000000001', 'cccccccc-0000-4000-8000-000000000001',
   'Bienvenida al curso', 0, 596, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', true),
  ('dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001',
   'Standalone components en la práctica', 1, 956, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', false),
  ('dddddddd-0000-4000-8000-000000000003', 'cccccccc-0000-4000-8000-000000000002',
   'Signals vs RxJS: cuándo usar cada uno', 2, 734, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4', false),
  ('dddddddd-0000-4000-8000-000000000004', 'cccccccc-0000-4000-8000-000000000002',
   'Proyecto final: tablero de cursos', 3, 900, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4', false)
on conflict (module_id, order_index) do nothing;

-- Curso 2: publicado, de pago ---------------------------------------------------
insert into courses (id, instructor_id, category_id, title, slug, subtitle, description, price_cents, currency, level, status, published_at)
values
  ('bbbbbbbb-0000-4000-8000-000000000002',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '33333333-3333-4333-8333-333333333333',
   'NestJS profesional: APIs escalables con Prisma y Docker',
   'nestjs-profesional',
   'Arquitectura por capas, RBAC, webhooks de pago y despliegue',
   'Aprende a estructurar un backend NestJS listo para producción: módulos de dominio, DTOs validados, Prisma, Stripe, colas y observabilidad.',
   4999, 'USD', 'intermediate', 'published', now())
on conflict (slug) do nothing;

insert into modules (id, course_id, title, order_index) values
  ('cccccccc-0000-4000-8000-000000000010', 'bbbbbbbb-0000-4000-8000-000000000002', 'Arquitectura NestJS', 0)
on conflict (course_id, order_index) do nothing;

insert into lessons (id, module_id, title, order_index, duration_seconds, video_provider, video_url, is_preview) values
  ('dddddddd-0000-4000-8000-000000000010', 'cccccccc-0000-4000-8000-000000000010',
   'Muestra gratis: monolito modular', 0, 596, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', true),
  ('dddddddd-0000-4000-8000-000000000011', 'cccccccc-0000-4000-8000-000000000010',
   'Controller → Service → Repository', 1, 956, 'direct',
   'https://storage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', false)
on conflict (module_id, order_index) do nothing;

-- Curso 3: borrador (para probar el panel de instructor) ------------------------
insert into courses (id, instructor_id, category_id, title, slug, subtitle, description, price_cents, level, status)
values
  ('bbbbbbbb-0000-4000-8000-000000000003',
   'aaaaaaaa-0000-4000-8000-000000000001',
   '22222222-2222-4222-8222-222222222222',
   'PWA con Angular: modo offline real',
   'pwa-con-angular',
   'Service workers, cache strategies y UX offline',
   'Borrador en construcción.',
   2999, 'advanced', 'draft')
on conflict (slug) do nothing;

-- Inscripción demo del estudiante al curso gratis ------------------------------
insert into enrollments (id, user_id, course_id, status) values
  ('eeeeeeee-0000-4000-8000-000000000001',
   'aaaaaaaa-0000-4000-8000-000000000002',
   'bbbbbbbb-0000-4000-8000-000000000001', 'active')
on conflict (user_id, course_id) do nothing;

-- Progreso demo (primera lección completada) ------------------------------------
insert into lesson_progress (user_id, lesson_id, watched_seconds, completed) values
  ('aaaaaaaa-0000-4000-8000-000000000002', 'dddddddd-0000-4000-8000-000000000001', 596, true)
on conflict (user_id, lesson_id) do update set completed = excluded.completed;
