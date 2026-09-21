-- ============================================================================
-- Manakō · Migración 0002 — Funciones helper, RLS y vistas
-- Defensa en profundidad: la API (NestJS) valida RBAC en código, y estas
-- políticas protegen además cualquier acceso directo vía cliente Supabase.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Funciones helper (SECURITY DEFINER para evitar recursión en políticas RLS)
-- ----------------------------------------------------------------------------
create or replace function is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and role = 'admin')
$$;

create or replace function is_instructor(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = p_user and role in ('instructor', 'admin'))
$$;

create or replace function is_enrolled(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from enrollments
    where user_id = p_user and course_id = p_course and status = 'active'
  )
$$;

create or replace function owns_course(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from courses where id = p_course and instructor_id = p_user)
$$;

-- ¿El usuario puede ver el curso? (publicado, dueño o admin)
create or replace function course_is_visible(p_user uuid, p_course uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from courses c
    where c.id = p_course
      and (c.status = 'published' or c.instructor_id = p_user or is_admin(p_user))
  )
$$;

-- ----------------------------------------------------------------------------
-- Regla de negocio central: desbloqueo secuencial de lecciones.
-- Una lección está desbloqueada si:
--   1. es preview, o
--   2. el usuario es el instructor dueño / admin, o
--   3. el usuario está inscrito Y todas las lecciones ANTERIORES no-preview
--      (orden global del curso: módulo.order_index, lección.order_index)
--      están completadas.
-- La API replica esta lógica en TypeScript ANTES de emitir la URL firmada
-- del video (ver apps/api/src/playback). Nunca confiar solo en el Guard.
-- ----------------------------------------------------------------------------
create or replace function lesson_is_unlocked(p_user uuid, p_lesson uuid) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare
  v_lesson lessons%rowtype;
  v_module modules%rowtype;
  v_course courses%rowtype;
begin
  select * into v_lesson from lessons where id = p_lesson;
  if not found then return false; end if;

  -- previews siempre visibles (curso publicado)
  if v_lesson.is_preview then
    return true;
  end if;

  select * into v_module from modules where id = v_lesson.module_id;
  select * into v_course from courses where id = v_module.course_id;

  if v_course.instructor_id = p_user or is_admin(p_user) then
    return true;
  end if;

  if not is_enrolled(p_user, v_course.id) then
    return false;
  end if;

  -- ¿existe alguna lección anterior NO completada?
  return not exists (
    select 1
    from lessons l2
    join modules m2 on m2.id = l2.module_id
    where m2.course_id = v_course.id
      and l2.is_preview = false
      and (m2.order_index, l2.order_index) < (v_module.order_index, v_lesson.order_index)
      and not exists (
        select 1 from lesson_progress lp
        where lp.lesson_id = l2.id and lp.user_id = p_user and lp.completed
      )
  );
end $$;

-- ----------------------------------------------------------------------------
-- Habilitar RLS en TODAS las tablas sensibles
-- ----------------------------------------------------------------------------
alter table profiles          enable row level security;
alter table instructors       enable row level security;
alter table categories        enable row level security;
alter table courses           enable row level security;
alter table modules           enable row level security;
alter table lessons           enable row level security;
alter table payments          enable row level security;
alter table stripe_webhook_events enable row level security;
alter table enrollments       enable row level security;
alter table lesson_progress   enable row level security;
alter table reviews           enable row level security;
alter table certificates      enable row level security;
alter table feature_flags     enable row level security;

-- ============================================================================
-- profiles
-- ============================================================================
-- Cada usuario ve/edita SOLO su perfil; admin ve todos.
create policy profiles_select on profiles for select to authenticated
  using (id = auth.uid() or is_admin(auth.uid()));

create policy profiles_update_own on profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Vista pública de instructores (sin email ni datos sensibles).
-- Sin security_invoker: se ejecuta como dueña y expone solo lo publicado.
create or replace view profiles_public_view as
  select id, full_name, avatar_url, role
  from profiles
  where role in ('instructor', 'admin');

grant select on profiles_public_view to anon, authenticated;

-- ============================================================================
-- instructors
-- ============================================================================
create policy instructors_select on instructors for select to anon, authenticated
  using (true);   -- bios públicas

create policy instructors_update_own on instructors for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Un usuario puede crear su fila de instructor si su perfil ya es instructor
-- (el cambio de rol lo hace la API con rol de servicio, no el cliente).
create policy instructors_insert_own on instructors for insert to authenticated
  with check (user_id = auth.uid() and is_instructor(auth.uid()));

-- ============================================================================
-- categories / feature_flags (lectura pública; escritura solo admin)
-- ============================================================================
create policy categories_select on categories for select to anon, authenticated
  using (true);
create policy categories_write on categories for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

create policy feature_flags_select on feature_flags for select to anon, authenticated
  using (true);
create policy feature_flags_write on feature_flags for all to authenticated
  using (is_admin(auth.uid())) with check (is_admin(auth.uid()));

-- ============================================================================
-- courses
-- ============================================================================
create policy courses_select on courses for select to anon, authenticated
  using (status = 'published' or instructor_id = auth.uid() or is_admin(auth.uid()));

create policy courses_insert on courses for insert to authenticated
  with check (
    instructor_id = auth.uid() and is_instructor(auth.uid())
  );

create policy courses_update on courses for update to authenticated
  using (instructor_id = auth.uid() or is_admin(auth.uid()))
  with check (instructor_id = auth.uid() or is_admin(auth.uid()));

create policy courses_delete on courses for delete to authenticated
  using (instructor_id = auth.uid() or is_admin(auth.uid()));

-- ============================================================================
-- modules (visibilidad heredada del curso)
-- ============================================================================
create policy modules_select on modules for select to anon, authenticated
  using (course_is_visible(auth.uid(), course_id));

create policy modules_insert on modules for insert to authenticated
  with check (owns_course(auth.uid(), course_id) or is_admin(auth.uid()));

create policy modules_update on modules for update to authenticated
  using (owns_course(auth.uid(), course_id) or is_admin(auth.uid()))
  with check (owns_course(auth.uid(), course_id) or is_admin(auth.uid()));

create policy modules_delete on modules for delete to authenticated
  using (owns_course(auth.uid(), course_id) or is_admin(auth.uid()));

-- ============================================================================
-- lessons
-- ============================================================================
-- Los METADATOS (título, duración, is_preview) del currículo son públicos para
-- cursos publicados — igual que Udemy. Las columnas de video NO: la protección
-- por column grants se aplica al FINAL de este archivo (después de los grants
-- masivos, que de otro modo la sobrescribirían). La URL de reproducción se
-- entrega únicamente por la API tras validar inscripción + desbloqueo.

create policy lessons_select on lessons for select to anon, authenticated
  using (
    exists (
      select 1 from modules m
      where m.id = lessons.module_id
        and course_is_visible(auth.uid(), m.course_id)
    )
  );

create policy lessons_insert on lessons for insert to authenticated
  with check (
    exists (
      select 1 from modules m
      where m.id = lessons.module_id
        and (owns_course(auth.uid(), m.course_id) or is_admin(auth.uid()))
    )
  );

create policy lessons_update on lessons for update to authenticated
  using (
    exists (
      select 1 from modules m
      where m.id = lessons.module_id
        and (owns_course(auth.uid(), m.course_id) or is_admin(auth.uid()))
    )
  )
  with check (
    exists (
      select 1 from modules m
      where m.id = lessons.module_id
        and (owns_course(auth.uid(), m.course_id) or is_admin(auth.uid()))
    )
  );

create policy lessons_delete on lessons for delete to authenticated
  using (
    exists (
      select 1 from modules m
      where m.id = lessons.module_id
        and (owns_course(auth.uid(), m.course_id) or is_admin(auth.uid()))
    )
  );

-- ============================================================================
-- enrollments
-- ============================================================================
create policy enrollments_select_own on enrollments for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- Auto-inscripción SOLO en cursos gratis publicados.
-- Las inscripciones de cursos pagos las crea la API (rol de servicio)
-- exclusivamente tras confirmar el webhook de Stripe.
create policy enrollments_insert_free on enrollments for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from courses c
      where c.id = enrollments.course_id
        and c.status = 'published'
        and c.price_cents = 0
    )
  );

create policy enrollments_delete_own on enrollments for delete to authenticated
  using (user_id = auth.uid());
-- update: sin política → solo rol de servicio (la API gestiona reembolsos).

-- ============================================================================
-- lesson_progress (spec §4: un estudiante solo lee/escribe SU progreso)
-- ============================================================================
create policy select_own_progress on lesson_progress for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

create policy insert_own_progress on lesson_progress for insert to authenticated
  with check (user_id = auth.uid());

create policy update_own_progress on lesson_progress for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy delete_own_progress on lesson_progress for delete to authenticated
  using (user_id = auth.uid());

-- ============================================================================
-- payments (solo lectura propia; escrituras únicamente vía API/servicio)
-- ============================================================================
create policy payments_select_own on payments for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));
-- insert/update/delete: sin políticas para anon/authenticated.

create policy stripe_events_service_only on stripe_webhook_events for select to authenticated
  using (is_admin(auth.uid()));

-- ============================================================================
-- reviews
-- ============================================================================
create policy reviews_select on reviews for select to anon, authenticated
  using (exists (select 1 from courses c where c.id = reviews.course_id and c.status = 'published'));

create policy reviews_insert_own on reviews for insert to authenticated
  with check (
    user_id = auth.uid()
    and is_enrolled(auth.uid(), course_id)
    and exists (select 1 from courses c where c.id = reviews.course_id and c.status = 'published')
  );

create policy reviews_update_own on reviews for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy reviews_delete on reviews for delete to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));

-- ============================================================================
-- certificates
-- ============================================================================
create policy certificates_select_own on certificates for select to authenticated
  using (user_id = auth.uid() or is_admin(auth.uid()));
-- La emisión es exclusivamente vía API (rol de servicio), Fase 3.

-- ============================================================================
-- Vista: progreso por curso (spec §4 — course_progress_view)
-- security_invoker: respeta la RLS del que consulta (cada usuario ve lo suyo).
-- ============================================================================
create or replace view course_progress_view
with (security_invoker = on) as
select
  e.user_id,
  e.course_id,
  count(l.id)::int as total_lessons,
  count(lp.id) filter (where lp.completed)::int as completed_lessons,
  case
    when count(l.id) = 0 then 0
    else round(100.0 * count(lp.id) filter (where lp.completed) / count(l.id))::int
  end as percent
from enrollments e
join modules m on m.course_id = e.course_id
join lessons l on l.module_id = m.id
left join lesson_progress lp on lp.lesson_id = l.id and lp.user_id = e.user_id
where e.status = 'active'
group by e.user_id, e.course_id;

grant select on course_progress_view to authenticated;

-- ============================================================================
-- Grants base para roles de Supabase (RLS sigue aplicando por encima)
-- ORDEN CRÍTICO: los grants masivos van primero y la protección por columnas
-- de `lessons` DESPUÉS (revoke + grant por columnas), o el grant masivo de
-- SELECT re-expondría video_asset_id / video_playback_id / video_url.
-- ============================================================================
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant select on categories, feature_flags to anon;

-- Protección de columnas sensibles de video (aplicada tras los grants masivos)
revoke select on lessons from anon, authenticated;
grant select (
  id, module_id, title, description, order_index,
  duration_seconds, is_preview, created_at, updated_at
) on lessons to anon, authenticated;

-- Los clientes solo pueden actualizar columnas seguras de su profile
-- (revoke de tabla + grant por columnas: el rol NUNCA es editable por cliente;
--  tercera capa: trigger prevent_role_escalation)
revoke update on profiles from authenticated;
grant update (full_name, avatar_url) on profiles to authenticated;

-- Nota: la API (NestJS) se conecta con DATABASE_URL de rol con privilegios
-- completos (postgres / service). Principio de menor privilegio: ver
-- docs/SETUP.md para crear un rol dedicado "api_role" en producción.
