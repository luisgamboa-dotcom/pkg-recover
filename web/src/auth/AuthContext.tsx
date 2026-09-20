import type { Session, User } from '@supabase/supabase-js';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { isSupabaseConfigured, requireSupabase } from '../lib/supabase';

const VALID_ROLES = ['customer', 'reseller', 'company', 'admin'] as const;

/** Falla cerrado: cualquier rol desconocido se trata como cliente. */
function safeRole(code: string): (typeof VALID_ROLES)[number] {
  return (VALID_ROLES as readonly string[]).includes(code)
    ? (code as (typeof VALID_ROLES)[number])
    : 'customer';
}

export type AccountType = 'customer' | 'reseller' | 'company';

export interface Profile {
  id: string;
  roleCode: string;
  roleName: string;
  firstName: string | null;
  lastName: string | null;
}

interface AuthState {
  configured: boolean;
  loading: boolean;
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  signUp: (input: SignUpInput) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

export interface SignUpInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  accountType: AccountType;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const sb = requireSupabase();
  const { data, error } = await sb
    .from('profiles')
    .select('id, first_name, last_name, roles!inner(code, name)')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  const role = data.roles as unknown as { code: string; name: string };
  const safe = safeRole(role.code);
  return {
    id: data.id as string,
    roleCode: safe,
    roleName: safe === role.code ? role.name : 'Cliente particular',
    firstName: (data.first_name as string | null) ?? null,
    lastName: (data.last_name as string | null) ?? null,
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      return;
    }
    // El trigger handle_new_user crea el perfil; reintenta 1 vez si hay lag.
    let p = await fetchProfile(userId);
    if (!p) {
      await new Promise((r) => setTimeout(r, 1200));
      p = await fetchProfile(userId);
    }
    setProfile(p);
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    const sb = requireSupabase();
    sb.auth.getSession().then(({ data }) => {
      setSession(data.session);
      void loadProfile(data.session?.user.id).finally(() => setLoading(false));
    });
    const { data: sub } = sb.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      void loadProfile(next?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signUp = useCallback(
    async (input: SignUpInput): Promise<{ needsConfirmation: boolean }> => {
      const sb = requireSupabase();
      const { data, error } = await sb.auth.signUp({
        email: input.email,
        password: input.password,
        options: {
          data: {
            first_name: input.firstName,
            last_name: input.lastName,
            phone: input.phone,
            // El trigger solo acepta customer/reseller; company queda como
            // customer y un admin la verifica y eleva el rol.
            requested_role:
              input.accountType === 'reseller' ? 'reseller' : 'customer',
            requested_account_type: input.accountType,
          },
        },
      });
      if (error) throw error;

      // Completa nombre/teléfono en el perfil creado por el trigger.
      // Solo con sesión: sin ella (confirmación pendiente) RLS lo rechazaría
      // y mostraría un error falso, pues la cuenta sí se creó.
      if (data.user && data.session) {
        await sb
          .from('profiles')
          .update({
            first_name: input.firstName,
            last_name: input.lastName,
            phone: input.phone,
          })
          .eq('id', data.user.id);
        setSession(data.session);
        await loadProfile(data.user.id);
      }
      return { needsConfirmation: !data.session };
    },
    [loadProfile],
  );

  const signIn = useCallback(async (email: string, password: string) => {
    const sb = requireSupabase();
    const { error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    // Fija la sesión en el contexto ANTES de volver: así la redirección del
    // login ya encuentra user/profile y no muestra la vista sin sesión.
    const { data } = await sb.auth.getSession();
    setSession(data.session);
    await loadProfile(data.session?.user.id);
  }, [loadProfile]);

  const signOut = useCallback(async () => {
    const sb = requireSupabase();
    const { error } = await sb.auth.signOut();
    if (error) throw error;
    setSession(null);
    setProfile(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string) => {
    const sb = requireSupabase();
    const { error } = await sb.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    if (error) throw error;
  }, []);

  const refreshProfile = useCallback(async () => {
    await loadProfile(session?.user.id);
  }, [loadProfile, session]);

  const value = useMemo<AuthState>(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      refreshProfile,
    }),
    [
      loading,
      session,
      profile,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      refreshProfile,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
