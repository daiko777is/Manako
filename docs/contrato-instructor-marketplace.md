# Manakō — Acuerdo de Instructor / Marketplace (desglose)

> Profundización del §10.1 y §10.3 de la especificación técnica. Este documento
> desglosa el contrato que regula la relación entre Manakō (la "Plataforma") y
> los instructores que publican cursos. **Es una plantilla técnica-comercial:
> debe ser revisada y adaptada por asesoría legal en la jurisdicción de
> operación antes de su uso real.** Los campos entre `[CORCHETES]` son
> parámetros de negocio configurables.

---

## 1. Estructura del acuerdo

| # | Sección | Contenido clave | Dónde se implementa en el sistema |
|---|---|---|---|
| 1 | Partes y objeto | Identificación del instructor, aceptación electrónica | `POST /api/v1/instructors/apply` + registro de consentimiento |
| 2 | Licencia de contenido | El instructor **conserva la propiedad**; licencia no exclusiva de hosting/distribución | RLS de `courses`/`lessons`; columnas de video protegidas |
| 3 | Económico | Reparto de ingresos, comisiones, moneda, ajustes | `payments`, `PLATFORM_FEE_PERCENT`, Stripe Connect (Fase 3) |
| 4 | Pagos al instructor | Cadencia, mínimos, KYC, formularios fiscales | `instructors.stripe_account_id`, `payouts_enabled` |
| 5 | Obligaciones del instructor | Originalidad, calidad, conducta, soporte | Moderación admin (`PATCH /admin/courses/:id/status`) |
| 6 | Propiedad intelectual y DMCA | Takedown, contranotificación, reincidentes | Panel admin + flujo de retirada |
| 7 | Datos personales | Instructor como parte del tratamiento; GDPR | Política de Privacidad + DPA anexo |
| 8 | Duración y terminación | Baja, efectos post-terminación | `courses.status='archived'`, `enrollments` |
| 9 | Responsabilidad e indemnidad | Garantías, límites, indemnización | — |
| 10 | Misceláneo | Ley aplicable, cesión, notificaciones | — |

---

## 2. Cláusulas — detalle

### 2.1 Licencia de contenido (modelo recomendado: licencia, no cesión)

El instructor **otorga a la Plataforma** una licencia mundial, no exclusiva,
transferible solo a cesionarios del negocio, sublicenciable únicamente para la
distribución a estudiantes, durante la vigencia del acuerdo, para:

1. **Reproducir y transcodificar** el contenido (streaming adaptativo HLS,
   thumbnails, previews) — implementado vía Mux/Cloudflare Stream.
2. **Distribuirlo y comunicarlo públicamente** a través de la Plataforma a
   usuarios inscritos, con las medidas de protección del §6.4 de la spec
   (URLs firmadas, watermark, bloqueo secuencial).
3. **Usar fragmentos con fines promocionales** (trailers/previews de hasta
   `[2]` minutos, título, nombre e imagen del instructor en catálogo, emails
   y redes de la Plataforma).

El instructor **retiene**: la titularidad del copyright, el derecho a publicar
el mismo contenido en otras plataformas (salvo exclusividad opcional, §2.2) y
los materiales subyacentes (código, diapositivas).

> **Decisión de diseño (spec §10.3):** licencia ≠ cesión. Es el modelo de
> Udemy/Skillshare: más atractivo para instructores y suficiente para operar.
> Si se prefiriera cesión de derechos, debe ser expresa, escrita y remunerada
> según la ley local de propiedad intelectual.

### 2.2 Exclusividad (opcional, por curso)

- **Por defecto: NO exclusiva.**
- La Plataforma puede ofrecer un programa opcional "Manakō Originals" con
  exclusividad por `[12]` meses a cambio de un reparto mejorado
  (`[85]/15` en lugar del estándar) o anticipo recuperable.

### 2.3 Reparto de ingresos (modelo híbrido tipo Udemy)

| Origen de la venta | Instructor recibe | Plataforma | Justificación |
|---|---|---|---|
| **Orgánica** (catálogo, búsqueda, recomendaciones, ads de la Plataforma) | `[50]%` | `[50]%` | La Plataforma pone el tráfico y asume el coste de adquisición |
| **Promoción del instructor** (enlace/cupón propio) | `[97]%` | `[3]%` (coste de procesamiento) | El instructor trae al cliente |
| **Suscripción global** (modelo Platzi, Fase 3) | Pool prorrateado por **minutos consumidos** | `[—]` | Reparto objetivo por consumo, auditado mensualmente |

Reglas adicionales:
- Base de cálculo: **importe neto** = precio cobrado − impuestos repercutidos
  (IVA/impuestos digitales) − comisiones del procesador de pago (Stripe ≈
  `[2.9]% + 0.30`).
- Reembolsos y chargebacks **se descuentan** del periodo en que ocurran,
  incluso si generan saldo negativo (compensable en periodos siguientes).
- La moneda de liquidación es `[USD]`; conversiones al tipo de cambio del
  procesador en la fecha de liquidación.
- El parámetro vive en la API como `PLATFORM_FEE_PERCENT` (por defecto 30%
  de comisión sobre bruto en ventas orgánicas para el MVP de **pago único**;
  el split por origen de venta se activa con Stripe Connect en Fase 3).

### 2.4 Pagos al instructor (Stripe Connect)

- **Cadencia:** mensual, a `[30]` días del cierre de mes.
- **Mínimo:** `[50 USD]`; si no se alcanza, se acumula al siguiente periodo.
- **KYC/Onboarding:** el instructor completa el formulario de Stripe Connect
  (Express o Custom) → `instructors.stripe_account_id`.
- **Fiscal:** formulario `W-9` (EE.UU.) / `W-8BEN` (no EE.UU.) o equivalente
  local antes del primer pago. La Plataforma puede retener lo que la ley
  exija (p. ej. backup withholding).
- **Facturación:** el instructor emite factura/self-billing según jurisdicción;
  en países con facturación electrónica obligatoria (CFDI México, DIAN
  Colombia, SII Chile…) se integrará el emisor correspondiente.
- Mientras `payouts_enabled = false`, las ventas se acumulan pero no se
  liquidan (falta KYC o aceptación del acuerdo).

### 2.5 Obligaciones del instructor

1. **Originalidad y licencias:** garantiza ser titular o contar con licencias
   de TODO el contenido (video, audio, imágenes, fuentes, código, marcas de
   terceros captadas en pantalla). Materiales de stock: solo con licencia que
   permita redistribución en cursos de pago.
2. **Contenido prohibido:** discurso de odio, contenido sexual explícito,
   material que promueva actividades ilegales, malware, desinformación
   médica/financiera grave, contenido que infrinja sanciones internacionales.
3. **Calidad técnica:** audio inteligible, video ≥ `[720p]`, sin marcas de
   agua de terceros, durations coherentes con el currículo declarado.
4. **No captación:** no usar la Plataforma para redirigir estudiantes a
   sistemas de pago externos o recoger sus datos personales fuera de ella
   (protección de datos + protección del negocio).
5. **Soporte:** responder preguntas de estudiantes en el foro del curso en
   `[5]` días hábiles (cuando el foro esté activo, Fase 3).
6. **Actualización:** mantener el contenido razonablemente actualizado cuando
   se venda como "actualizado a [año/versión]".

### 2.6 Propiedad intelectual de terceros y DMCA/Takedown

- **Agente designado:** la Plataforma publicará un agente DMCA (o equivalente
  local) y un formulario de aviso de infracción.
- **Procedimiento:** aviso válido → retirada preventiva del contenido en
  `[48] h → notificación al instructor → contranotificación en `[10]` días →
  reposición o escalada judicial.
- **Reincidentes:** `[3]` avisos válidos en `[12]` meses ⇒ terminación y
  retención de saldos conforme a ley.
- **Indemnidad:** el instructor indemniza a la Plataforma por reclamaciones
  de IP derivadas de su contenido (con el límite y exclusiones del §2.8).

### 2.7 Protección de datos (anexo DPA)

- Rol de las partes: la Plataforma es **responsable** del tratamiento de datos
  de estudiantes; el instructor actúa como **encargado** respecto de datos de
  estudiantes a los que acceda (p. ej. preguntas del foro, analíticas
  agregadas/anonimizadas del panel).
- El panel de instructor **no expone emails completos** de estudiantes salvo
  consentimiento expreso (minimización, GDPR art. 5).
- Transferencias internacionales cubiertas por SCCs/decisiones de adecuación.
- Obligación de notificar brechas de seguridad en `[48]` horas.

### 2.8 Responsabilidad, garantías e indemnidad

- El instructor garantiza: titularidad/licencias del contenido, capacidad
  para contratar, exactitud de datos fiscales, y que el contenido no daña
  sistemas de la Plataforma.
- La Plataforma **no garantiza ingresos mínimos** ni posicionamiento en el
  catálogo (los algoritmos de recomendación pueden cambiar).
- Límite de responsabilidad de la Plataforma frente al instructor: los
  importes liquidados al instructor en los `[12]` meses previos al hecho
  causante.
- Ninguna parte responde por daños indirectos/lucro cesante, salvo dolo.

### 2.9 Duración, terminación y efectos

- **Vigencia:** indefinida desde la aceptación electrónica; cualquiera puede
  terminar con `[30]` días de preaviso, o de inmediato por incumplimiento
  material no subsanado en `[14]` días.
- **Efectos de la baja del instructor:**
  - Los cursos pasan a `archived` (fuera del catálogo, sin ventas nuevas).
  - **Los estudiantes ya inscritos conservan el acceso** durante
    `[mínimo 12 meses / tiempo razonable]] — la licencia del §2.1 sobrevive
    a la terminación exclusivamente para servir a inscritos previos.
  - Se liquidan las regalías devengadas pendientes (netas de reembolsos).
- **Por decisión de la Plataforma** (violación de políticas): retirada
  inmediata; los inscritos conservan acceso o reciben reembolso a discreción
  documentada; saldos del instructor pueden retenerse para cubrir
  reembolsos/indemnidades.

### 2.10 Misceláneo

- **Cesión:** el instructor no puede ceder el acuerdo sin consentimiento; la
  Plataforma sí (reorganización/venta del negocio).
- **Ley y foro:** `[PAÍS]`, tribunales de `[CIUDAD]` (o arbitraje
  `[CORTE]` si se prefiere).
- **Notificaciones:** al email de la cuenta del instructor; se tienen por
  recibidas `[24] h después del envío.
- **Acuerdo completo / severabilidad / idioma:** cláusulas estándar; versión
  prevaleciente: `[español/inglés]`.
- **Aceptación electrónica:** clickwrap versionado — se almacena
  `accepted_terms_version` + timestamp + hash del texto aceptado (evidencia).

---

## 3. Checklist de implementación por fases

| Fase | Elemento | Estado en este repo |
|---|---|---|
| MVP | Aceptación clickwrap al hacer `POST /instructors/apply` | Pendiente de añadir campo `accepted_terms_version` en `instructors` |
| MVP | Comisión de Plataforma configurable | ✅ `PLATFORM_FEE_PERCENT` (env de la API) |
| MVP | Moderación/retirada de cursos por admin | ✅ `PATCH /api/v1/admin/courses/:id/status` |
| Fase 3 | Stripe Connect (onboarding KYC + split automático) | Campos BD listos (`stripe_account_id`, `payouts_enabled`) |
| Fase 3 | Panel de liquidaciones + descarga de reportes fiscales | Pendiente |
| Fase 3 | Formulario DMCA público + flujo de contranotificación | Pendiente (plantilla en este doc, §2.6) |
| Fase 3 | Foro por lección con datos minimizados | Pendiente |

---

## 4. Parámetros de negocio a fijar antes de lanzar

```text
INSTRUCTOR_SHARE_ORGANIC      = [50]%
INSTRUCTOR_SHARE_SELF_PROMO   = [97]%
PLATFORM_FEE_PERCENT (MVP)    = 30%   ← ya en el código (env)
PAYOUT_CYCLE                  = mensual, net-30
PAYOUT_MINIMUM                = 50 USD
SETTLEMENT_CURRENCY           = USD
EXCLUSIVITY_PROGRAM           = opcional, 12 meses, 85/15
TAKEDOWN_SLA                  = 48 h
POST_TERMINATION_ACCESS       = ≥ 12 meses para inscritos previos
```
