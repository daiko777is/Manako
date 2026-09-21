import type { VideoProviderKind } from '@manako/shared';

/** Información mínima de la lección que necesita un proveedor de video. */
export interface LessonVideoRef {
  lessonId: string;
  videoAssetId: string | null;
  videoPlaybackId: string | null;
  videoUrl: string | null;
}

export interface SignedPlayback {
  url: string;
  expiresAt: string | null;
}

export type UploadInit =
  | { mode: 'url'; uploadUrl: string; method: 'PUT' | 'POST'; assetId?: string }
  | { mode: 'relay'; relayEndpoint: string };

export interface WebhookResult {
  /** id del asset tal como lo conoce el proveedor (= lessons.video_asset_id). */
  assetId: string;
  playbackId?: string;
  status: 'ready' | 'processing' | 'failed';
}

/**
 * Contrato único para proveedores de streaming (spec §3.4).
 * La lección nunca expone su URL real: la API genera URLs firmadas de
 * corta expiración tras validar inscripción + desbloqueo (spec §6.4).
 */
export interface VideoProvider {
  readonly kind: VideoProviderKind;

  /** URL de reproducción firmada (HLS) con TTL corto. */
  playbackUrl(lesson: LessonVideoRef, ttlSeconds: number): Promise<SignedPlayback>;

  /** Inicio de subida: URL directa al proveedor (Mux) o relay vía API (CF). */
  createUpload?(filename: string, contentType: string): Promise<UploadInit>;

  /** Subida retransmitida por la API (solo proveedores que lo requieren). */
  uploadFile?(file: Buffer, filename: string, contentType: string): Promise<{ assetId: string }>;

  /** Procesa el webhook del proveedor (verifica firma/secret internamente). */
  handleWebhook?(
    headers: Record<string, string | string[] | undefined>,
    rawBody: Buffer,
  ): Promise<WebhookResult | null>;
}
