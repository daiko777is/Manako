import { BadRequestException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { StripeService } from './stripe.service';

/**
 * Webhook de Stripe (spec §3.6/§8): verificación de firma + idempotencia
 * estricta (los webhooks se reintentan; nunca debe haber doble inscripción
 * ni doble registro de pago).
 */
describe('PaymentsService — webhooks', () => {
  let service: PaymentsService;

  const txMock = {
    payment: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'pay-1', status: 'succeeded' }),
      update: jest.fn(),
    },
    enrollment: {
      upsert: jest.fn().mockResolvedValue({ id: 'enr-1' }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };

  const prismaMock = {
    stripeWebhookEvent: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
    },
    payment: { findFirst: jest.fn().mockResolvedValue(null), update: jest.fn() },
    enrollment: { updateMany: jest.fn() },
    course: { findUnique: jest.fn() },
    $transaction: jest.fn((cb: (tx: typeof txMock) => Promise<unknown>) => cb(txMock)),
  };

  const stripeMock = {
    stripe: {
      webhooks: { constructEvent: jest.fn() },
      refunds: { create: jest.fn() },
      checkout: { sessions: { create: jest.fn() } },
    },
    webhookSecret: 'whsec_test',
  };

  const checkoutEvent = {
    id: 'evt_123',
    type: 'checkout.session.completed',
    data: {
      object: {
        id: 'cs_test_1',
        payment_status: 'paid',
        client_reference_id: 'user-1',
        metadata: { courseId: 'course-1', userId: 'user-1' },
        payment_intent: 'pi_1',
        amount_total: 4999,
        currency: 'usd',
      },
    },
  } as unknown as Stripe.Event;

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue(null);
    txMock.payment.findUnique.mockResolvedValue(null);

    const moduleRef = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: StripeService, useValue: stripeMock },
        { provide: ConfigService, useValue: { get: () => 'http://localhost:4200' } },
      ],
    }).compile();
    service = moduleRef.get(PaymentsService);
  });

  it('rechaza webhooks con firma inválida', () => {
    stripeMock.stripe.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Signature mismatch');
    });
    expect(() => service.constructEvent(Buffer.from('{}'), 'v1=mala')).toThrow(
      BadRequestException,
    );
  });

  it('evento ya procesado → no-op (idempotencia por evt_id)', async () => {
    prismaMock.stripeWebhookEvent.findUnique.mockResolvedValue({ id: 'evt_123' });
    await service.handleEvent(checkoutEvent);
    expect(txMock.payment.create).not.toHaveBeenCalled();
    expect(txMock.enrollment.upsert).not.toHaveBeenCalled();
  });

  it('checkout.session.completed pagado → payment succeeded + enrollment activa', async () => {
    await service.handleEvent(checkoutEvent);

    expect(txMock.payment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          courseId: 'course-1',
          status: 'succeeded',
          amountCents: 4999,
          currency: 'USD',
        }),
      }),
    );
    expect(txMock.enrollment.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_courseId: { userId: 'user-1', courseId: 'course-1' } },
        create: expect.objectContaining({ status: 'active', paymentId: 'pay-1' }),
      }),
    );
    // El evento queda registrado para no reprocesarse
    expect(prismaMock.stripeWebhookEvent.create).toHaveBeenCalledWith({
      data: { id: 'evt_123', type: 'checkout.session.completed' },
    });
  });

  it('sesión completada SIN pagar no concede acceso', async () => {
    const unpaid = {
      ...checkoutEvent,
      id: 'evt_unpaid',
      data: { object: { ...(checkoutEvent.data.object as object), payment_status: 'unpaid' } },
    } as unknown as Stripe.Event;
    await service.handleEvent(unpaid);
    expect(txMock.payment.create).not.toHaveBeenCalled();
    expect(txMock.enrollment.upsert).not.toHaveBeenCalled();
  });
});
