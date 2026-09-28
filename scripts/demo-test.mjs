// Test en vivo del MODO DEMO (se ejecuta con la API en :3100 + BD seed)
const BASE = 'http://localhost:3100/api/v1';
let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  if (cond) { pass++; console.log(`  ✅ ${name}`); }
  else { fail++; console.log(`  ❌ ${name} ${extra}`); }
};
const req = async (method, path, { tok, body } = {}) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { ...(tok ? { Authorization: `Bearer ${tok}` } : {}), ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch {}
  return { status: res.status, json };
};

const CURSO_PAGO = 'bbbbbbbb-0000-4000-8000-000000000002';
const LECCION_PAGO_1 = 'dddddddd-0000-4000-8000-000000000011';

console.log('— 1. Endpoint demo: listado de cuentas —');
let r = await req('GET', '/auth/demo/users');
check('GET /auth/demo/users → 200 con las 3 cuentas seed', r.status === 200 && r.json.length >= 3 &&
  ['estudiante@manako.demo','instructor@manako.demo','admin@manako.demo'].every(e => r.json.some(u => u.email === e)),
  JSON.stringify(r.json?.slice?.(0,4)).slice(0,160));
check('incluye los 3 roles', ['student','instructor','admin'].every(role => r.json.some(u => u.role === role)));

console.log('— 2. Login demo con un clic (estudiante) —');
r = await req('POST', '/auth/demo/login', { body: { email: 'estudiante@manako.demo' } });
const tokStudent = r.json?.accessToken;
check('login → 200 + accessToken', r.status === 200 && !!tokStudent);
check('profile del login correcto', r.json?.profile?.role === 'student' && r.json?.profile?.email === 'estudiante@manako.demo');

r = await req('GET', '/auth/me', { tok: tokStudent });
check('JWT demo valida en /auth/me (mismo formato Supabase)', r.status === 200 && r.json.email === 'estudiante@manako.demo', `status=${r.status}`);

console.log('— 3. Registro demo: usuario nuevo al instante —');
const nuevo = `demo.${Date.now()}@manako.demo`;
r = await req('POST', '/auth/demo/login', { body: { email: nuevo, fullName: 'Usuario Demo Nuevo' } });
const tokNuevo = r.json?.accessToken;
check('usuario nuevo creado (created=true, role student)', r.status === 200 && r.json.created === true && r.json.profile.role === 'student', JSON.stringify(r.json).slice(0,140));
r = await req('GET', '/auth/me', { tok: tokNuevo });
check('el nuevo usuario puede llamarse /auth/me', r.status === 200 && r.json.fullName === 'Usuario Demo Nuevo');

console.log('— 4. Compra DEMO de curso de pago (sin Stripe) —');
r = await req('POST', '/payments/checkout', { tok: tokNuevo, body: { courseId: CURSO_PAGO } });
check('checkout → enrolled:true demo:true', r.status === 200 && r.json.enrolled === true && r.json.demo === true, JSON.stringify(r.json));
r = await req('GET', '/enrollments/me', { tok: tokNuevo });
check('inscripción visible en /enrollments/me', r.status === 200 && r.json.length === 1 && r.json[0].courseId === CURSO_PAGO);
r = await req('GET', `/courses/${CURSO_PAGO}/playback/${LECCION_PAGO_1}`, { tok: tokNuevo });
check('playback de lección pagada → 200 (url directa del seed)', r.status === 200 && r.json.url.includes('ElephantsDream'), `status=${r.status}`);

console.log('— 5. Progreso + bloqueo secuencial siguen funcionando en demo —');
r = await req('GET', `/courses/${CURSO_PAGO}/playback/dddddddd-0000-4000-8000-000000000010`, { tok: tokNuevo });
check('preview accesible', r.status === 200);
r = await req('PUT', '/progress', { tok: tokNuevo, body: { items: [{ lessonId: LECCION_PAGO_1, watchedSeconds: 900 }] } });
check('progreso 900/956 → completada (umbral 90%)', r.status === 200 && r.json.lessons[0]?.completed === true, JSON.stringify(r.json.lessons?.[0]));

console.log('— 6. Roles demo: instructor y admin —');
r = await req('POST', '/auth/demo/login', { body: { email: 'instructor@manako.demo' } });
const tokInstr = r.json?.accessToken;
r = await req('GET', '/instructor/courses', { tok: tokInstr });
check('instructor → sus 3 cursos', r.status === 200 && r.json.length === 3, `${r.status}`);
r = await req('GET', '/admin/metrics', { tok: tokInstr });
check('instructor → /admin 403 (RBAC intacto en demo)', r.status === 403);

r = await req('POST', '/auth/demo/login', { body: { email: 'admin@manako.demo' } });
const tokAdmin = r.json?.accessToken;
r = await req('GET', '/admin/metrics', { tok: tokAdmin });
check('admin → métricas 200 (revenue incluye pago demo)', r.status === 200 && r.json.revenueCents >= 4999, JSON.stringify(r.json.revenueCents));
r = await req('GET', '/admin/payments', { tok: tokAdmin });
check('admin ve el pago demo (succeeded)', r.status === 200 && r.json.data.some(p => p.status === 'succeeded' && p.amountCents === 4999));
const payId = r.json.data.find(p => p.status === 'succeeded')?.id;
r = await req('POST', `/admin/payments/${payId}/refund`, { tok: tokAdmin });
check('reembolso demo → 200 refunded (sin Stripe)', (r.status === 200 || r.status === 201) && r.json.status === "refunded", `status=${r.status}`);
r = await req('GET', `/courses/${CURSO_PAGO}/playback/${LECCION_PAGO_1}`, { tok: tokNuevo });
check('tras reembolso → playback 403 (acceso revocado)', r.status === 403, `status=${r.status}`);

console.log(`\nRESULTADO DEMO: ${pass} pasan, ${fail} fallan`);
process.exit(fail > 0 ? 1 : 0);
