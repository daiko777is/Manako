/**
 * Tipado mínimo de video.js (v8) para el reproductor de Manakō.
 * Cubre solo la superficie que usamos; evita depender de @types desactualizados.
 */
declare module 'video.js' {
  export interface VideoJsPlayer {
    on(event: string, handler: (...args: never[]) => void): void;
    off(event: string, handler?: (...args: never[]) => void): void;
    one(event: string, handler: (...args: never[]) => void): void;
    currentTime(): number;
    currentTime(seconds: number): void;
    duration(): number;
    ready(callback: () => void): void;
    play(): Promise<unknown> | void;
    pause(): void;
    src(source: { src: string; type: string } | Array<{ src: string; type: string }>): void;
    dispose(): void;
    el(): HTMLElement;
    error(): { code: number; message: string } | null;
  }

  export type VideoJsOptions = Record<string, unknown>;

  export default function videojs(
    element: HTMLElement | string,
    options?: VideoJsOptions,
    ready?: () => void,
  ): VideoJsPlayer;
}
