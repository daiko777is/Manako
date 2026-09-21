export interface RequestUser {
  /** id del usuario (sub del JWT de Supabase = profiles.id). */
  id: string;
  email: string;
  role: import('@manako/shared').UserRole;
  fullName: string | null;
}

export const REQUEST_USER_KEY = 'manako:requestUser';
