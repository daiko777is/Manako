import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@manako/shared';
import { environment } from '../../../environments/environment';
import { ApiClient } from '../http/api-client.service';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

/**
 * Autenticación delegada en Supabase Auth (spec §3.5): email/password y
 * OAuth (Google). La API de negocio valida el mismo JWT (HS256/JWKS) y
 * resuelve el rol desde `profiles`. Las sesiones usan refresh token
 * rotativo gestionado por supabase-js.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly supabase: SupabaseClient;
  private readonly api = inject(ApiClient);
  private readonly zone = inject(NgZone);

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly initialized = signal(false);

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed<UserRole | null>(() => this.profile()?.role ?? null);

  constructor() {
    this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    });
  }

  /** Restaurar sesión + perfil antes de la primera navegación (APP_INITIALIZER). */
  async init(): Promise<void> {
    const { data } = await this.supabase.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.loadProfile();

    this.supabase.auth.onAuthStateChange((_event, session) => {
      // onAuthStateChange puede dispararse fuera de la zone de Angular
      this.zone.run(() => {
        this.session.set(session);
        if (session) {
          void this.loadProfile();
        } else {
          this.profile.set(null);
        }
      });
    });
    this.initialized.set(true);
  }

  private async loadProfile(): Promise<void> {
    try {
      this.profile.set(await this.api.getAsync<Profile>('/auth/me'));
    } catch {
      this.profile.set(null);
    }
  }

  /** Access token vigente (supabase-js refresca solo si está caducado). */
  async getAccessToken(): Promise<string | null> {
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  get userId(): string | null {
    return this.session()?.user.id ?? null;
  }

  async signIn(email: string, password: string): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: this.humanize(error.message) };
    await this.loadProfile();
    return { ok: true };
  }

  async signUp(email: string, password: string, fullName: string): Promise<AuthResult> {
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { ok: false, error: this.humanize(error.message) };
    // Si el proyecto exige confirmar email, no hay sesión todavía
    if (!data.session) {
      return { ok: true, error: 'confirm-email' };
    }
    await this.loadProfile();
    return { ok: true };
  }

  async signInWithGoogle(): Promise<AuthResult> {
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error ? { ok: false, error: this.humanize(error.message) } : { ok: true };
  }

  async signOut(): Promise<void> {
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  async refreshProfile(): Promise<void> {
    await this.loadProfile();
  }

  private humanize(message: string): string {
    const map: Record<string, string> = {
      'Invalid login credentials': 'Email o contraseña incorrectos',
      'Email not confirmed': 'Confirma tu email antes de iniciar sesión',
      'User already registered': 'Ya existe una cuenta con ese email',
      'Password should be at least 6 characters': 'La contraseña debe tener al menos 6 caracteres',
    };
    return map[message] ?? message;
  }
}
