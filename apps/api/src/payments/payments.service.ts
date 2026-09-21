import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import type { CheckoutResponse, PaymentSummary } from '@manako/shared';
import type { RequestUser } from '../auth/auth.types';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from './stripe.service';

/**
 * Pagos (spec §3.6):
 *  - Checkout Sessions de Stripe (modo payment — pago único por curso).
 *  - El acceso se concede SOLO cuando el webhook confirmado llega
 *    ("nunca confiar en el frontend para desbloquear un curso").
 *  - Idempotencia estricta: tabla stripe_webhook_events + transiciones de
 *    estado comprobadas (los webhooks de Stripe se reintentan).
 *  - Fase 3: suscripciones y Stripe Connect (split marketplace) — ver
 *    docs/contrato-instructor-marketplace.md.
 */
@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly frontendUrl: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripeService: StripeService,
    config: ConfigService,
  ) {
    this.frontendUrl = config.get<string>('FRONTEND_URL') ?? 'http://localhost:4200';
  }

  // ── Checkout ─────────────────────────────────────────────────────────────

  /** Crea (o reutiliza) la sesión de checkout de un curso de pago. */
  async createCheckout(user: RequestUser, courseId: string): Promise<CheckoutResponse> {
    const course = await this.prisma.course.findUnique({ where: { id: courseId } });
    if (!course || course.status !== 'published') {
      throw new NotFoundException('Curso no disponible');
    }

    const existing = await this.prisma.enrollment.findUnique({
      where: { userId_courseId: { userId: user.id, courseId } },
    });
    if (existing && existing.status === 'active') {
      return { enrolled: true };
    }

    // Curso gratis → inscripción inmediata
    if (course.priceCents === 0) {
      await this.prisma.enrollment.upsert({
        where: { userId_courseId: { userId: user.id, courseId } },
        create: { userId: user.id, courseId, status: 'active' },
        update: { status: 'active' },
      });
      return { enrolled: true };
    }

    // Reutilizar sesión pendiente si existe (evita sesiones huérfanas)
    const pending = await this.prisma.payment.findFirst({
      where: { userId: user.id, courseId, status: 'pending', stripeCheckoutSessionId: { not: null } },
      orderBy: { createdAt: 'desc' },
    });

    const session = await this.stripeService.stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: user.id,
      customer_email: user.email,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: course.currency.trim().toLowerCase(),
            unit_amount: course.priceCents,
            product_data: {
              name: course.title,
              description: course.subtitle ?? undefined,
            },
          },
        },
      ],
      metadata: { courseId, userId: user.id },
      // Facturación (spec §10.4): permitir al comprador pedir invoice
      invoice_creation: { enabled: true },
      success_url: `${this.frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${this.frontendUrl}/checkout/cancel?course=${course.slug}`,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
    });

    await this.prisma.payment.upsert({
      where: pending?.id ? { id: pending.id } : { stripeCheckoutSessionId: session.id },
      create: {
        userId: user.id,
        courseId,
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : null,
        amountCents: course.priceCents,
        currency: course.currency.trim(),
        status: 'pending',
      },
      update: { stripeCheckoutSessionId: session.id },
    });

    if (!session.url) throw new BadRequestException('Stripe no devolvió URL de checkout');
    return { enrolled: false, url: session.url };
  }

  // ── Webhook (idempotente) ────────────────────────────────────────────────

  /** Verifica la firma del webhook. Lanza si es inválido (spec §16). */
  constructEvent(rawBody: Buffer, signature: string): Stripe.Event {
    try {
      return this.stripeService.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        this.stripeService.webhookSecret,
      );
    } catch (err) {
      this.logger.warn(`Firma de webhook Stripe inválida: ${(err as Error).message}`);
      throw new BadRequestException('Firma de webhook inválida');
    }
  }

  /**
   * Procesa un evento ya verificado. Idempotencia en 2 capas:
   *  1. stripe_webhook_events: si el evt_id ya se procesó → no-op.
   *  2. Transiciones de estado comprobadas (succeeded→succeeded = no-op).
   */
  async handleEvent(event: Stripe.Event): Promise<void> {
    const already = await this.prisma.stripeWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (already) {
      this.logger.log(`Webhook ${event.id} ya procesado (idempotencia)`);
      return;
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'payment_intent.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.PaymentIntent);
        break;
      case 'charge.refunded':
        await this.onChargeRefunded(event.data.object as Stripe.Charge);
        break;
      default:
        this.logger.log(`Webhook ignorado: ${event.type}`);
    }

    await this.prisma.stripeWebhookEvent.create({
      data: { id: event.id, type: event.type },
    });
  }

  /** Pago confirmado → payment succeeded + enrollment activa (atómico). */
  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    if (session.payment_status !== 'paid') {
      this.logger.warn(`checkout.session.completed sin pagar (${session.id}) — se ignora`);
      return;
    }
    const courseId = session.metadata?.['courseId'];
    const userId = session.client_reference_id ?? session.metadata?.['userId'];
    if (!courseId || !userId) {
      this.logger.error(`Webhook sin metadata courseId/userId: ${session.id}`);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.findUnique({
        where: { stripeCheckoutSessionId: session.id },
      });
      const paymentIntentId = typeof session.payment_intent === 'string' ? session.payment_intent : null;

      const upsertedPayment = payment
        ? await tx.payment.update({
            where: { id: payment.id },
            data: {
              status: payment.status === 'succeeded' ? payment.status : 'succeeded',
              stripePaymentIntentId: payment.stripePaymentIntentId ?? paymentIntentId,
            },
          })
        : await tx.payment.create({
            data: {
              userId,
              courseId,
              stripeCheckoutSessionId: session.id,
              stripePaymentIntentId: paymentIntentId,
              amountCents: Number(session.amount_total ?? 0),
              currency: (session.currency ?? 'usd').toUpperCase(),
              status: 'succeeded',
            },
          });

      if (upsertedPayment.status !== 'succeeded') return;

      await tx.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        create: { userId, courseId, status: 'active', paymentId: upsertedPayment.id },
        update: { status: 'active', paymentId: upsertedPayment.id },
      });
    });
    this.logger.log(`Inscripción confirmada: user=${userId} course=${courseId}`);
  }

  private async onPaymentFailed(intent: Stripe.PaymentIntent): Promise<void> {
    const payment = await this.prisma.payment.findFirst({
      where: {
        OR: [
          { stripePaymentIntentId: intent.id },
          { stripeCheckoutSessionId: typeof intent.metadata?.['checkout_session'] === 'string' ? intent.metadata['checkout_session'] : '__none__' },
        ],
      },
    });
    if (payment && payment.status === 'pending') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'failed' } });
    }
  }

  /** Reembolso desde Stripe (dashboard o API admin) → revoca el acceso. */
  private async onChargeRefunded(charge: Stripe.Charge): Promise<void> {
    const intentId = typeof charge.payment_intent === 'string' ? charge.payment_intent : null;
    if (!intentId) return;
    const payment = await this.prisma.payment.findFirst({
      where: { stripePaymentIntentId: intentId },
    });
    if (!payment || payment.status === 'refunded') return;

    await this.prisma.$transaction([
      this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'refunded' } }),
      this.prisma.enrollment.updateMany({
        where: { userId: payment.userId, courseId: payment.courseId },
        data: { status: 'refunded' },
      }),
    ]);
    this.logger.log(`Reembolso aplicado: payment=${payment.id}`);
  }

  // ── Reembolso iniciado por admin (spec §3.6: reembolsos/disputas) ────────

  async refund(adminUserId: string, paymentId: string): Promise<PaymentSummary> {
    const payment = await this.prisma.payment.findUnique({ where: { id: paymentId } });
    if (!payment) throw new NotFoundException('Pago no encontrado');
    if (payment.status === 'refunded') {
      throw new ConflictException('El pago ya está reembolsado');
    }
    if (!payment.stripePaymentIntentId) {
      throw new BadRequestException('El pago no tiene payment intent asociado');
    }

    await this.stripeService.stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
    });
    // El estado final lo fija el webhook charge.refunded (fuente de verdad),
    // pero adelantamos el estado local para reflejar la operación de inmediato.
    const updated = await this.prisma.payment.update({
      where: { id: payment.id },
      data: { status: 'refunded' },
    });
    await this.prisma.enrollment.updateMany({
      where: { userId: payment.userId, courseId: payment.courseId },
      data: { status: 'refunded' },
    });
    this.logger.log(`Admin ${adminUserId} reembolsó payment=${payment.id}`);
    return this.toSummary(updated);
  }

  async listMine(userId: string): Promise<PaymentSummary[]> {
    const rows = await this.prisma.payment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { course: { select: { id: true, title: true, slug: true } } },
    });
    return rows.map((r) => this.toSummary(r, r.course));
  }

  private toSummary(
    p: {
      id: string;
      userId: string;
      courseId: string;
      amountCents: number;
      currency: string;
      status: 'pending' | 'succeeded' | 'failed' | 'refunded';
      createdAt: Date;
    },
    course?: { id: string; title: string; slug: string } | null,
  ): PaymentSummary {
    return {
      id: p.id,
      userId: p.userId,
      courseId: p.courseId,
      amountCents: p.amountCents,
      currency: p.currency.trim(),
      status: p.status,
      createdAt: p.createdAt.toISOString(),
      ...(course ? { course } : {}),
    };
  }
}
