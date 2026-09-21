/**
 * Validación tipada de variables de entorno (fail-fast al arrancar).
 * Si falta algo crítico, la API no sube y explica exactamente qué falta.
 */

export interface ApiEnv {
  PORT: number;
  NODE_ENV: string;
  CORS_ORIGINS: string;
  FRONTEND_URL: string;
  DATABASE_URL: string;
  DIRECT_URL?: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SUPABASE_JWT_SECRET?: string;
  SUPABASE_JWKS_URL?: string;
  SUPABASE_JWT_ISSUER?: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  PLATFORM_FEE_PERCENT: number;
  VIDEO_PROVIDER: 'mux' | 'cloudflare' | 'direct';
  PLAYBACK_URL_TTL_SECONDS: number;
  PROGRESS_COMPLETION_THRESHOLD: number;
  MUX_TOKEN_ID?: string;
  MUX_TOKEN_SECRET?: string;
  MUX_SIGNING_KEY_ID?: string;
  MUX_SIGNING_KEY_PRIVATE_KEY?: string;
  MUX_WEBHOOK_SECRET?: string;
  CF_STREAM_ACCOUNT_ID?: string;
  CF_STREAM_API_TOKEN?: string;
  CF_STREAM_CUSTOMER_KEY?: string;
  CF_STREAM_PRIVATE_KEY_PEM?: string;
  CF_STREAM_WEBHOOK_SECRET?: string;
  REDIS_URL?: string;
  THROTTLE_TTL_SECONDS: number;
  THROTTLE_LIMIT: number;
  LOG_FORMAT: string;
}

function num(raw: Record<string, unknown>, key: string, fallback?: number): number {
  const v = raw[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[env] Falta la variable numérica ${key}`);
  }
  const n = Number(v);
  if (Number.isNaN(n)) throw new Error(`[env] ${key} debe ser un número (recibido: "${String(v)}")`);
  return n;
}

function str(raw: Record<string, unknown>, key: string, fallback?: string): string {
  const v = raw[key];
  if (v === undefined || v === '') {
    if (fallback !== undefined) return fallback;
    throw new Error(`[env] Falta la variable obligatoria ${key} (ver apps/api/.env.example)`);
  }
  return String(v);
}

function opt(raw: Record<string, unknown>, key: string): string | undefined {
  const v = raw[key];
  if (v === undefined || v === '') return undefined;
  return String(v);
}

export function validateEnv(raw: Record<string, unknown>): ApiEnv {
  const env: ApiEnv = {
    PORT: num(raw, 'PORT', 3000),
    NODE_ENV: str(raw, 'NODE_ENV', 'development'),
    CORS_ORIGINS: str(raw, 'CORS_ORIGINS', 'http://localhost:4200'),
    FRONTEND_URL: str(raw, 'FRONTEND_URL', 'http://localhost:4200'),
    DATABASE_URL: str(raw, 'DATABASE_URL'),
    DIRECT_URL: opt(raw, 'DIRECT_URL'),
    SUPABASE_URL: str(raw, 'SUPABASE_URL'),
    SUPABASE_SERVICE_ROLE_KEY: str(raw, 'SUPABASE_SERVICE_ROLE_KEY'),
    SUPABASE_JWT_SECRET: opt(raw, 'SUPABASE_JWT_SECRET'),
    SUPABASE_JWKS_URL: opt(raw, 'SUPABASE_JWKS_URL'),
    SUPABASE_JWT_ISSUER: opt(raw, 'SUPABASE_JWT_ISSUER'),
    STRIPE_SECRET_KEY: str(raw, 'STRIPE_SECRET_KEY'),
    STRIPE_WEBHOOK_SECRET: str(raw, 'STRIPE_WEBHOOK_SECRET'),
    PLATFORM_FEE_PERCENT: num(raw, 'PLATFORM_FEE_PERCENT', 30),
    VIDEO_PROVIDER: (opt(raw, 'VIDEO_PROVIDER') ?? 'direct') as ApiEnv['VIDEO_PROVIDER'],
    PLAYBACK_URL_TTL_SECONDS: num(raw, 'PLAYBACK_URL_TTL_SECONDS', 600),
    PROGRESS_COMPLETION_THRESHOLD: num(raw, 'PROGRESS_COMPLETION_THRESHOLD', 0.9),
    MUX_TOKEN_ID: opt(raw, 'MUX_TOKEN_ID'),
    MUX_TOKEN_SECRET: opt(raw, 'MUX_TOKEN_SECRET'),
    MUX_SIGNING_KEY_ID: opt(raw, 'MUX_SIGNING_KEY_ID'),
    MUX_SIGNING_KEY_PRIVATE_KEY: opt(raw, 'MUX_SIGNING_KEY_PRIVATE_KEY'),
    MUX_WEBHOOK_SECRET: opt(raw, 'MUX_WEBHOOK_SECRET'),
    CF_STREAM_ACCOUNT_ID: opt(raw, 'CF_STREAM_ACCOUNT_ID'),
    CF_STREAM_API_TOKEN: opt(raw, 'CF_STREAM_API_TOKEN'),
    CF_STREAM_CUSTOMER_KEY: opt(raw, 'CF_STREAM_CUSTOMER_KEY'),
    CF_STREAM_PRIVATE_KEY_PEM: opt(raw, 'CF_STREAM_PRIVATE_KEY_PEM'),
    CF_STREAM_WEBHOOK_SECRET: opt(raw, 'CF_STREAM_WEBHOOK_SECRET'),
    REDIS_URL: opt(raw, 'REDIS_URL'),
    THROTTLE_TTL_SECONDS: num(raw, 'THROTTLE_TTL_SECONDS', 60),
    THROTTLE_LIMIT: num(raw, 'THROTTLE_LIMIT', 100),
    LOG_FORMAT: str(raw, 'LOG_FORMAT', 'json'),
  };

  if (!env.SUPABASE_JWT_SECRET && !env.SUPABASE_JWKS_URL) {
    throw new Error('[env] Debes definir SUPABASE_JWT_SECRET o SUPABASE_JWKS_URL para validar los JWT');
  }
  if (!['mux', 'cloudflare', 'direct'].includes(env.VIDEO_PROVIDER)) {
    throw new Error('[env] VIDEO_PROVIDER debe ser mux | cloudflare | direct');
  }
  if (env.VIDEO_PROVIDER === 'mux') {
    for (const k of ['MUX_SIGNING_KEY_ID', 'MUX_SIGNING_KEY_PRIVATE_KEY'] as const) {
      if (!env[k]) throw new Error(`[env] VIDEO_PROVIDER=mux requiere ${k}`);
    }
  }
  if (env.VIDEO_PROVIDER === 'cloudflare') {
    for (const k of ['CF_STREAM_CUSTOMER_KEY', 'CF_STREAM_PRIVATE_KEY_PEM'] as const) {
      if (!env[k]) throw new Error(`[env] VIDEO_PROVIDER=cloudflare requiere ${k}`);
    }
  }
  if (env.PROGRESS_COMPLETION_THRESHOLD <= 0 || env.PROGRESS_COMPLETION_THRESHOLD > 1) {
    throw new Error('[env] PROGRESS_COMPLETION_THRESHOLD debe estar en (0, 1]');
  }

  return env;
}
