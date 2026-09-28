import { Injectable, NgZone, computed, inject, signal } from '@angular/core';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, UserRole } from '@manako/shared';
import { environment } from '../../../environments/environment';
import { ApiClient } from '../http/api-client.service';

export interface AuthResult {
  ok: boolean;
  error?: string;
}

interface DemoLoginResponse {
  accessToken: string;
  profile: Profile;
  created: boolean;
}

const DEMO_TOKEN_KEY = 'manako:demo-token';

/**
 * Autenticación delegada en Supabase Auth (spec §3.5).
 *
 * MODO DEMO (environment.demoMode): sin proyecto Supabase real — el login/
 * registro se resuelve contra la API (POST /auth/demo/login), que emite JWT
 * compatibles y crea usuarios sobre la marcha. El resto de la app (guards,
 * interceptores, RBAC) funciona igual porque el token tiene el mismo formato.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private supabase!: SupabaseClient;
  private readonly api = inject(ApiClient);
  private readonly zone = inject(NgZone);

  readonly demoMode = environment.demoMode;

  readonly session = signal<Session | null>(null);
  readonly profile = signal<Profile | null>(null);
  readonly initialized = signal(false);

  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly role = computed<UserRole | null>(() => this.profile()?.role ?? null);

  constructor() {
    if (!this.demoMode) {
      this.supabase = createClient(environment.supabaseUrl, environment.supabaseAnonKey, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
      });
    }
  }

  /** Restaurar sesión + perfil antes de la primera navegación (APP_INITIALIZER). */
  async init(): Promise<void> {
    if (this.demoMode) {
      const token = this.readDemoToken();
      if (token) {
        this.session.set(this.fakeSession(token));
        await this.loadProfile();
        if (!this.profile()) this.clearDemoToken(); // token inválido/expirado
      }
      this.initialized.set(true);
      return;
    }

    const { data } = await this.supabase.auth.getSession();
    this.session.set(data.session);
    if (data.session) await this.loadProfile();

    this.supabase.auth.onAuthStateChange((_event, session) => {
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
    if (this.demoMode) return this.readDemoToken();
    const { data } = await this.supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }

  get userId(): string | null {
    return this.session()?.user.id ?? null;
  }

  async signIn(email: string, _password: string): Promise<AuthResult> {
    if (this.demoMode) return this.demoLogin(email);
    const { error } = await this.supabase.auth.signInWithPassword({ email, password: _password });
    if (error) return { ok: false, error: this.humanize(error.message) };
    await this.loadProfile();
    return { ok: true };
  }

  async signUp(email: string, _password: string, fullName: string): Promise<AuthResult> {
    if (this.demoMode) return this.demoLogin(email, fullName);
    const { data, error } = await this.supabase.auth.signUp({
      email,
      password: _password,
      options: { data: { full_name: fullName } },
    });
    if (error) return { ok: false, error: this.humanize(error.message) };
    if (!data.session) {
      return { ok: true, error: 'confirm-email' };
    }
    await this.loadProfile();
    return { ok: true };
  }

  async signInWithGoogle(): Promise<AuthResult> {
    if (this.demoMode) {
      return { ok: false, error: 'OAuth no está disponible en modo demo. Usa una cuenta demo.' };
    }
    const { error } = await this.supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    return error ? { ok: false, error: this.humanize(error.message) } : { ok: true };
  }

  async signOut(): Promise<void> {
    if (this.demoMode) {
      this.clearDemoToken();
      this.session.set(null);
      this.profile.set(null);
      return;
    }
    await this.supabase.auth.signOut();
    this.session.set(null);
    this.profile.set(null);
  }

  async refreshProfile(): Promise<void> {
    await this.loadProfile();
  }

  /** Cuentas demo disponibles (panel del login). */
  demoUsers(): Promise<{ email: string; fullName: string | null; role: UserRole }[]> {
    return this.api.getAsync('/auth/demo/users');
  }

  // ── Modo demo ─────────────────────────────────────────────────────────────

  /** Login directo con una cuenta demo (un clic desde el panel). */
  async demoLogin(email: string, fullName?: string): Promise<AuthResult> {
    try {
      const res = await this.api.postAsync<DemoLoginResponse>('/auth/demo/login', {
        email,
        fullName,
      });
      this.writeDemoToken(res.accessToken);
      this.session.set(this.fakeSession(res.accessToken, res.profile));
      this.profile.set(res.profile);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: (err as Error).message || 'No se pudo iniciar la sesión demo' };
    }
  }

  private fakeSession(token: string, profile?: Profile): Session {
    return {
      access_token: token,
      refresh_token: 'demo',
      token_type: 'bearer',
      expires_in: 7 * 24 * 3600,
      expires_at: Math.floor(Date.now() / 1000) + 7 * 24 * 3600,
      user: {
        id: profile?.id ?? 'demo',
        email: profile?.email ?? 'demo@manako.local',
        app_metadata: {},
        user_metadata: { full_name: profile?.fullName },
        aud: 'authenticated',
        created_at: new Date().toISOString(),
      },
    } as Session;
  }

  private readDemoToken(): string | null {
    try {
      const raw = localStorage.getItem(DEMO_TOKEN_KEY);
      if (!raw) return null;
      const { token, exp } = JSON.parse(raw) as { token: string; exp: number };
      if (Date.now() / 1000 > exp) {
        localStorage.removeItem(DEMO_TOKEN_KEY);
        return null;
      }
      return token;
    } catch {
      return null;
    }
  }

  private writeDemoToken(token: string): void {
    try {
      // exp local = 7 días (coincide con el JWT demo)
      localStorage.setItem(
        DEMO_TOKEN_KEY,
        JSON.stringify({ token, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600 }),
      );
    } catch {
      /* almacenamiento no disponible */
    }
  }

  private clearDemoToken(): void {
    try {
      localStorage.removeItem(DEMO_TOKEN_KEY);
    } catch {
      /* noop */
    }
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
