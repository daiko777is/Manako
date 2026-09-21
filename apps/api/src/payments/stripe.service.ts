import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/** Wrapper fino de Stripe: única fuente del cliente y su configuración. */
@Injectable()
export class StripeService {
  readonly stripe: Stripe;
  readonly webhookSecret: string;

  constructor(config: ConfigService) {
    this.stripe = new Stripe(config.get<string>('STRIPE_SECRET_KEY') ?? '', {
      apiVersion: '2024-06-20',
      appInfo: { name: 'Manako API', version: '0.1.0' },
    });
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';
  }
}
