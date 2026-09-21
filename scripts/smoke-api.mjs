// Smoke test E2E de la API Manakō (spec §12 paso 8).
// Requisitos: API corriendo en :3100 con las vars de /tmp/api-test.env (o equivalentes),
// BD local con migraciones + seed aplicados. Uso: node scripts/smoke-api.mjs
import { SignJWT } from 'jose';

const BASE = 'http://localhost:3100/api/v1';
const SECRET = new TextEncoder().encode('super-secret-dev-jwt-key-32chars!!');

const STUDENT = 'aaaaaaaa-0000-4000-8000-000000000002';
const INSTRUCTOR = 'aaaaaaaa-0000-4000-8000-000000000001';
const ADMIN = 'aaaaaaaa-0000-4000-8000-000000000003';
const NUEVA = 'aaaaaaaa-0000-4000-8000-000000000009';
const CURSO_GRATIS = 'bbbbbbbb-0000-4000-8000-000000000001';
const CURSO_PAGO = 'bbbbbbbb-0000-4000-8000-000000000002';
const L1 = 'dddddddd-0000-4000-8000-000000000002'; // 2ª lección (desbloqueada)
const L2 = 'dddddddd-0000-4000-8000-000000000003'; // 3ª (bloqueada hasta completar L1)

async function token(sub, email) {
  return new SignJWT({ email, role: 'authenticated' })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(sub)
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(SECRET);
}

let pass = 0, fail = 0;
function check(name, cond, extra = '') {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
}

async function req(method, path, { tok, body } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      ...(tok ? { Authorization: `Bearer ${tok}` } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* vacío */ }
  return { status: res.status, json };
}

const tStudent = await token(STUDENT, 'estudiante@manako.demo');
const tInstructor = await token(INSTRUCTOR, 'instructor@manako.demo');
const tAdmin = await token(ADMIN, 'admin@manako.demo');
const tNueva = await token(NUEVA, 'nueva@manako.demo');

console.log('— 1. Health y catálogo público —');
let r = await req('GET', '/health');
check('health 200 db up', r.status === 200 && r.json.db === 'up', JSON.stringify(r.json));

r = await req('GET', '/courses');
check('catálogo 200 con 2 publicados', r.status === 200 && r.json.data.length === 2);
const angular = r.json.data.find((c) => c.slug === 'angular-18-desde-cero');
check('curso angular: 4 lecciones, 3186s', angular?.lessonsCount === 4 && angular?.totalSeconds === 3186,
  `${angular?.lessonsCount}/${angular?.totalSeconds}`);

r = await req('GET', '/courses?search=nestjs&level=intermediate');
check('búsqueda+filtro nivel → 1 curso', r.status === 200 && r.json.data.length === 1 && r.json.data[0].slug === 'nestjs-profesional');

r = await req('GET', '/courses/categories');
check('categorías → 5', r.status === 200 && r.json.length === 5);

console.log('— 2. Auth /auth/me y RBAC —');
r = await req('GET', '/auth/me', { tok: tStudent });
check('me estudiante', r.status === 200 && r.json.role === 'student' && r.json.email === 'estudiante@manako.demo', JSON.stringify(r.json));

r = await req('GET', '/enrollments/me');
check('sin JWT → 401', r.status === 401);

r = await req('GET', '/enrollments/me', { tok: tStudent });
check('mis inscripciones (1 activa, 25%)', r.status === 200 && r.json.length === 1 && r.json[0].progress.percent === 25, JSON.stringify(r.json?.[0]?.progress));

r = await req('GET', '/instructor/courses', { tok: tStudent });
check('estudiante → /instructor 403', r.status === 403);

r = await req('GET', '/instructor/courses', { tok: tInstructor });
check('instructor → sus 3 cursos', r.status === 200 && r.json.length === 3, `${r.json?.length}`);

r = await req('GET', '/admin/metrics', { tok: tInstructor });
check('instructor → /admin 403', r.status === 403);

r = await req('GET', '/admin/metrics', { tok: tAdmin });
check('admin → métricas (usuarios>=4)', r.status === 200 && r.json.users.total >= 3, JSON.stringify(r.json?.users));

console.log('— 3. Detalle de curso + estado del viewer —');
r = await req('GET', '/courses/angular-18-desde-cero', { tok: tStudent });
const detail = r.json;
check('detalle 200 con módulos', r.status === 200 && detail.modules.length === 2);
check('viewer inscrito, 25%, next=L1', detail.viewer?.enrolled === true && detail.viewer?.progressPercent === 25 && detail.viewer?.nextLessonId === L1,
  JSON.stringify(detail.viewer));
const unlockedFlags = detail.modules.flatMap((m) => m.lessons.map((l) => [l.title.slice(0, 12), l.isPreview || l.unlocked]));
check('flags: preview✓ L1✓ L2✗ L3✗', JSON.stringify(unlockedFlags.map((x) => x[1])) === '[true,true,false,false]', JSON.stringify(unlockedFlags));
check('detalle NO filtra videoUrl a no-dueño', !JSON.stringify(detail).includes('BigBuckBunny'));

r = await req('GET', '/courses/nestjs-profesional', { tok: tStudent });
check('curso de pago: viewer no inscrito', r.json.viewer?.enrolled === false);

console.log('— 4. Playback: bloqueo secuencial validado en BACKEND —');
r = await req('GET', `/courses/${CURSO_GRATIS}/playback/${L1}`, { tok: tStudent });
check('L1 desbloqueada → 200 con url directa', r.status === 200 && r.json.url.includes('ElephantsDream') && r.json.watermark === 'estudiante@manako.demo', JSON.stringify(r.json).slice(0, 120));

r = await req('GET', `/courses/${CURSO_GRATIS}/playback/${L2}`, { tok: tStudent });
check('L2 bloqueada → 403', r.status === 403, `status=${r.status}`);

r = await req('GET', `/courses/${CURSO_PAGO}/playback/dddddddd-0000-4000-8000-000000000010`, { tok: tStudent });
check('preview de curso NO comprado → 200', r.status === 200 && r.json.url.includes('BigBuckBunny'));

r = await req('GET', `/courses/${CURSO_PAGO}/playback/dddddddd-0000-4000-8000-000000000011`, { tok: tStudent });
check('lección de curso NO comprado → 403', r.status === 403);

console.log('— 5. Progreso: umbral 90% + desbloqueo en cadena —');
r = await req('PUT', '/progress', { tok: tStudent, body: { items: [{ lessonId: L1, watchedSeconds: 860 }] } });
check('860/956s (<90%=860.4) → NO completada', r.status === 200 && r.json.lessons[0].completed === false, JSON.stringify(r.json.lessons?.[0]));

r = await req('PUT', '/progress', { tok: tStudent, body: { items: [{ lessonId: L1, watchedSeconds: 900 }] } });
check('900/956s (>=90%) → completada', r.json.lessons[0].completed === true);
check('curso ahora 50% + next=L2', r.json.course.percent === 50 && r.json.nextUnlockedLessonId === L2, JSON.stringify(r.json.course));

r = await req('GET', `/courses/${CURSO_GRATIS}/playback/${L2}`, { tok: tStudent });
check('L2 ahora desbloqueada → 200', r.status === 200 && r.json.url.includes('ForBiggerBlazes'));

r = await req('PUT', '/progress', { tok: tStudent, body: { items: [{ lessonId: L1, watchedSeconds: 100 }] } });
check('watched no decrece (900)', r.json.lessons[0].watchedSeconds === 900);

console.log('— 6. Checkout gratis + validaciones —');
r = await req('POST', '/payments/checkout', { tok: tNueva, body: { courseId: CURSO_PAGO } });
check('checkout curso de pago sin Stripe real → error 4xx/5xx controlado', r.status >= 400, `status=${r.status}`);

r = await req('GET', '/progress/course/' + CURSO_GRATIS, { tok: tStudent });
check('progreso por curso coherente', r.status === 200 && r.json.completedLessons === 2 && r.json.percent === 50, JSON.stringify({ c: r.json.completedLessons, p: r.json.percent }));

console.log('— 7. Instructor: CRUD + validación de publicación —');
r = await req('POST', '/instructor/courses', { tok: tInstructor, body: { title: 'Curso de prueba E2E', level: 'beginner' } });
const nuevoId = r.json?.id;
check('crear borrador 201', r.status === 201 && r.json.status === 'draft' && !!r.json.slug, JSON.stringify(r.json).slice(0, 100));

r = await req('POST', `/instructor/courses/${nuevoId}/publish`, { tok: tInstructor });
check('publicar sin lecciones → 400', r.status === 400, `status=${r.status}`);

r = await req('POST', `/instructor/courses/${nuevoId}/modules`, { tok: tInstructor, body: { title: 'Módulo 1' } });
const modId = r.json?.id;
check('crear módulo 201', r.status === 201);

r = await req('POST', `/instructor/modules/${modId}/lessons`, { tok: tInstructor, body: { title: 'Lección 1', durationSeconds: 100, videoUrl: 'https://example.com/v.mp4', isPreview: true } });
check('crear lección direct 201', r.status === 201 && r.json.videoProvider === 'direct');

r = await req('POST', `/instructor/courses/${nuevoId}/publish`, { tok: tInstructor });
check('publicar con video → 200 published', r.status === 200 && r.json.status === 'published');

r = await req('PATCH', `/instructor/courses/${nuevoId}`, { tok: tStudent, body: { title: 'hack' } });
check('otro usuario no edita el curso → 403', r.status === 403);

r = await req('GET', `/instructor/courses/${nuevoId}/analytics`, { tok: tInstructor });
check('analíticas 200', r.status === 200 && r.json.courseId === nuevoId);

console.log('— 8. Validación de DTOs (whitelist) —');
r = await req('POST', '/instructor/courses', { tok: tInstructor, body: { title: 'x', campoMaligno: 'boom' } });
check('campo no whitelisted → 400', r.status === 400);

r = await req('PUT', '/progress', { tok: tStudent, body: { items: [{ lessonId: 'no-uuid', watchedSeconds: -5 }] } });
check('payload inválido → 400', r.status === 400);

console.log(`\nRESULTADO: ${pass} pasan, ${fail} fallan`);
process.exit(fail > 0 ? 1 : 0);
