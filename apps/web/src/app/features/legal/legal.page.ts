import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';

interface LegalDoc {
  title: string;
  updated: string;
  sections: { heading: string; body: string }[];
}

/**
 * Páginas legales obligatorias (spec §10.1). CONTENIDO DE PLANTILLA:
 * debe ser revisado y adaptado por un abogado local antes de operar con
 * usuarios y pagos reales (GDPR/CCPA/leyes locales, spec §10.2).
 */
const DOCS: Record<string, LegalDoc> = {
  terminos: {
    title: 'Términos y Condiciones de uso',
    updated: '2026-09-01',
    sections: [
      {
        heading: '1. Objeto y aceptación',
        body: 'Estos Términos regulan el acceso y uso de la plataforma Manakō ("la Plataforma"), operada por [RAZÓN SOCIAL] con domicilio en [DOMICILIO] y documento de identificación fiscal [ID FISCAL]. Al crear una cuenta o comprar un curso, aceptas íntegramente estos Términos. Si no estás de acuerdo, no utilices la Plataforma.',
      },
      {
        heading: '2. Cuentas de usuario',
        body: 'Debes tener al menos 18 años (o la mayoría de edad legal en tu jurisdicción) para crear una cuenta. Eres responsable de la veracidad de tus datos, de la confidencialidad de tus credenciales y de toda la actividad realizada con tu cuenta. Los menores de edad solo pueden usar la Plataforma con consentimiento verificable de su tutor legal (ver COPPA/leyes locales, spec §10.6).',
      },
      {
        heading: '3. Cursos y licencias de contenido',
        body: 'La compra o inscripción de un curso otorga una licencia personal, no exclusiva, intransferible y revocable para acceder al contenido con fines de aprendizaje personal. Queda prohibido redistribuir, revender, descargar mediante técnicas de elusión, compartir credenciales o explotar comercialmente el contenido. El incumplimiento puede suponer la terminación de la cuenta sin reembolso y las acciones legales que correspondan.',
      },
      {
        heading: '4. Instructores',
        body: 'Los instructores publican contenido bajo el Acuerdo de Instructor (ver sección "Enseña en Manakō"), que regula la licencia de contenidos, el reparto de ingresos y las obligaciones de originalidad del material. La Plataforma puede retirar contenido que infrinja derechos de terceros (política DMCA/Takedown).',
      },
      {
        heading: '5. Pagos, precios e impuestos',
        body: 'Los precios se muestran en la moneda indicada e incluyen los impuestos aplicables cuando la ley lo exige. El cobro se procesa mediante Stripe. Según tu país de residencia pueden aplicarse impuestos sobre servicios digitales (p. ej. IVA de la UE según el país del consumidor). La Plataforma o el procesador de pagos pueden emitir facturas a solicitud.',
      },
      {
        heading: '6. Certificados',
        body: 'Los certificados emitidos por Manakō acreditan la finalización de un curso dentro de la Plataforma. NO son títulos oficiales ni acreditación gubernamental o universitaria, salvo que se indique expresamente un convenio con una institución reconocida.',
      },
      {
        heading: '7. Limitación de responsabilidad',
        body: 'La Plataforma se ofrece "tal cual". En la máxima medida permitida por la ley, [RAZÓN SOCIAL] no responde por daños indirectos ni por la idoneidad del contenido para un fin particular. La responsabilidad agregada máxima se limita al importe pagado por el curso en los 12 meses anteriores a la reclamación.',
      },
      {
        heading: '8. Modificaciones y ley aplicable',
        body: 'Podemos actualizar estos Términos; los cambios materiales se notificarán con al menos 15 días de antelación. Estos Términos se rigen por la legislación de [PAÍS/JURISDICCIÓN] y cualquier disputa se someterá a sus tribunales (o a arbitraje, si la ley local lo permite y el usuario lo acepta).',
      },
    ],
  },
  privacidad: {
    title: 'Política de Privacidad',
    updated: '2026-09-01',
    sections: [
      {
        heading: '1. Responsable del tratamiento',
        body: '[RAZÓN SOCIAL], [DOMICILIO], contacto: privacidad@[DOMINIO]. Si aplica por escala/legislación, se designará un Delegado de Protección de Datos (DPO).',
      },
      {
        heading: '2. Datos que recogemos y base legal',
        body: '• Datos de cuenta (email, nombre): ejecución del contrato.\n• Datos de progreso y consumo de video (lecciones vistas, segundos reproducidos): ejecución del contrato e interés legítimo (mejora del servicio).\n• Datos de pago: los procesa Stripe; Manakō almacena solo el identificador de transacción, importe y estado (nunca números de tarjeta).\n• Datos de uso y errores (logs, Sentry): interés legítimo en seguridad y calidad.\n• Cookies: solo técnicas necesarias (ver Política de Cookies).',
      },
      {
        heading: '3. Encargados de tratamiento',
        body: 'Utilizamos proveedores que actúan como encargados del tratamiento bajo sus respectivos DPAs: Supabase (base de datos y autenticación), Stripe (pagos), proveedor de streaming de video (Mux/Cloudflare Stream), proveedor de email transaccional (Resend/SendGrid) y monitoreo de errores (Sentry). Las transferencias internacionales se cubren con cláusulas contractuales tipo (SCC) cuando aplica.',
      },
      {
        heading: '4. Conservación',
        body: 'Conservamos tus datos mientras la cuenta esté activa. Al solicitar la eliminación, borramos o anonimizamos los datos personales en 30 días, salvo obligaciones legales de conservación (fiscales/contables, hasta el plazo legal aplicable).',
      },
      {
        heading: '5. Tus derechos',
        body: 'Puedes ejercer acceso, rectificación, supresión ("derecho al olvido"), portabilidad, limitación y oposición escribiendo a privacidad@[DOMINIO]. Respondemos en 30 días. También puedes reclamar ante tu autoridad de control local (p. ej. AEPD en España, INAI en México, SIC en Colombia). Usuarios de California: derechos CCPA/CPRA equivalentes.',
      },
      {
        heading: '6. Seguridad',
        body: 'Cifrado en tránsito (HTTPS/TLS) y en reposo, control de acceso por roles y políticas a nivel de fila en la base de datos (RLS), URLs de video firmadas con expiración corta y minimización de datos.',
      },
    ],
  },
  cookies: {
    title: 'Política de Cookies',
    updated: '2026-09-01',
    sections: [
      {
        heading: '1. Qué cookies usamos',
        body: 'Manakō usa únicamente cookies/almacenamiento técnico necesario: (a) cookies de sesión de autenticación gestionadas por Supabase Auth (sb-*-auth-token) para mantener tu sesión iniciada; (b) localStorage para recordar tu progreso no sincronizado y tu preferencia de cookies. No utilizamos cookies publicitarias ni de perfilado de terceros en el MVP.',
      },
      {
        heading: '2. Base legal y consentimiento',
        body: 'Las cookies estrictamente necesarias no requieren consentimiento (art. 22.2 LSSI-CE / ePrivacy). Si en el futuro añadimos analítica de producto (p. ej. PostHog), pediremos consentimiento previo mediante el banner y documentaremos aquí cada cookie, su finalidad y duración.',
      },
      {
        heading: '3. Cómo gestionarlas',
        body: 'Puedes borrar o bloquear cookies desde la configuración de tu navegador. Ten en cuenta que bloquear las cookies de sesión impedirá iniciar sesión y continuar tus cursos.',
      },
    ],
  },
  reembolsos: {
    title: 'Política de Reembolsos',
    updated: '2026-09-01',
    sections: [
      {
        heading: '1. Plazo de garantía',
        body: 'Ofrecemos reembolso completo dentro de los [7/14/30] días naturales desde la compra de un curso, sin necesidad de justificar el motivo, siempre que se haya consumido menos del [30]% del contenido (medido por lecciones completadas). Los cursos gratuitos no generan reembolso.',
      },
      {
        heading: '2. Cómo solicitarlo',
        body: 'Escríbenos a soporte@[DOMINIO] indicando tu email de compra y el curso. Procesamos la solicitud en un máximo de 5 días hábiles; el abono puede tardar 5-10 días adicionales según tu banco. El reembolso revoca automáticamente tu inscripción y el acceso al contenido.',
      },
      {
        heading: '3. Excepciones',
        body: 'No se reembolsan: (a) solicitudes fuera de plazo; (b) cuentas con abuso del sistema (comprar-completar-reembolsar de forma reiterada); (c) suscripciones tras el periodo de garantía, que pueden cancelarse para el siguiente ciclo. En la UE, el derecho de desistimiento de 14 días aplica salvo renuncia expresa al iniciar la ejecución del contenido digital.',
      },
      {
        heading: '4. Disputas y contracargos',
        body: 'Antes de abrir un contracargo (chargeback) con tu banco, contacta con nosotros: resolveremos la mayoría de los casos más rápido. Los contracargos fraudulentos pueden implicar la suspensión de la cuenta.',
      },
    ],
  },
  instructores: {
    title: 'Enseña en Manakō — Acuerdo de Instructor (resumen)',
    updated: '2026-09-01',
    sections: [
      {
        heading: 'Resumen del acuerdo',
        body: 'Esta página resume el Acuerdo de Instructor. El texto completo y detallado está en docs/contrato-instructor-marketplace.md y se formaliza al activar tu cuenta de instructor.\n\nPuntos clave:\n• Conservas la propiedad de tu contenido; otorgas a Manakō una licencia de hosting y distribución.\n• Reparto de ingresos: [70]% para ti en ventas orgánicas de la Plataforma; [97]% cuando la venta procede de tu propio enlace/cupón (modelo configurable).\n• Pagos mensuales vía Stripe Connect, con mínimo de [50 USD] y retenciones fiscales según tu formulario W-9/W-8BEN o equivalente local.\n• Garantizas que el contenido es original o cuenta con licencias suficientes; la Plataforma aplica política DMCA/Takedown.\n• Puedes solicitar la baja; tras ella, los alumnos inscritos conservan el acceso y se liquidan las regalías pendientes.',
      },
    ],
  },
};

@Component({
  selector: 'app-legal',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      @if (doc(); as d) {
        <p class="text-xs uppercase tracking-wide text-slate-400">Documentos legales</p>
        <h1 class="mt-1 text-3xl font-bold text-slate-900">{{ d.title }}</h1>
        <p class="mt-1 text-sm text-slate-500">Última actualización: {{ d.updated }}</p>

        <div class="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          ⚠️ Documento de plantilla generado desde la especificación técnica (§10). Debe ser revisado
          y adaptado por asesoría legal local antes de operar con usuarios y pagos reales.
        </div>

        <div class="mt-8 space-y-8">
          @for (section of d.sections; track section.heading) {
            <section>
              <h2 class="text-lg font-semibold text-slate-900">{{ section.heading }}</h2>
              <p class="mt-2 whitespace-pre-line leading-relaxed text-slate-600">{{ section.body }}</p>
            </section>
          }
        </div>
      } @else {
        <h1 class="text-2xl font-bold text-slate-900">Documento no encontrado</h1>
      }
    </div>
  `,
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  private readonly docKey = toSignal(
    this.route.paramMap.pipe(map((p) => p.get('doc') ?? '')),
    { initialValue: '' },
  );

  protected readonly doc = computed<LegalDoc | null>(() => DOCS[this.docKey()] ?? null);
}
