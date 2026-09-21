import { Body, Controller, Get, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import type { CheckoutResponse, PaymentSummary } from '@manako/shared';
import { CurrentUser } from '../common/current-user.decorator';
import { Public } from '../common/public.decorator';
import type { RequestUser } from '../auth/auth.types';
import { PaymentsService } from './payments.service';
import { CreateCheckoutDto } from './dto/create-checkout.dto';

@ApiTags('payments')
@Controller({ path: 'payments', version: '1' })
export class PaymentsController {
  constructor(private readonly service: PaymentsService) {}

  /**
   * Inicia la compra: curso gratis → inscripción inmediata; curso de pago →
   * URL de Stripe Checkout. Rate limit reforzado (spec §6.3).
   */
  @Post('checkout')
  @ApiBearerAuth()
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 10 } })
  @ApiOperation({ summary: 'Crear sesión de checkout (o inscripción si es gratis)' })
  checkout(
    @CurrentUser() user: RequestUser,
    @Body() dto: CreateCheckoutDto,
  ): Promise<CheckoutResponse> {
    return this.service.createCheckout(user, dto.courseId);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mi historial de pagos' })
  mine(@CurrentUser() user: RequestUser): Promise<PaymentSummary[]> {
    return this.service.listMine(user.id);
  }

  /**
   * Webhook de Stripe (spec §6.3/§16): autenticado por firma HMAC-SHA256
   * con STRIPE_WEBHOOK_SECRET sobre el cuerpo crudo. Público (sin JWT).
   */
  @Public()
  @Post('webhook')
  @HttpCode(200)
  @Throttle({ default: { ttl: 60_000, limit: 120 } })
  @ApiOperation({ summary: 'Webhook de Stripe (verificado por firma)' })
  async webhook(
    @Req() req: Request,
    @Headers('stripe-signature') signature: string,
  ): Promise<{ received: boolean }> {
    const rawBody = (req as Request & { rawBody?: Buffer }).rawBody ?? Buffer.from('');
    const event = this.service.constructEvent(rawBody, signature);
    await this.service.handleEvent(event);
    return { received: true };
  }
}
