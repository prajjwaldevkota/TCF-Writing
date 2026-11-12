import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Session } from '@supabase/supabase-js';
import { ADMIN_EMAIL, recordUserEmail, isOwnerEmail } from '../services/adminService';


interface SignUpResult {
  error: Error | null;
  needsVerification?: boolean;
  alreadyExists?: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  isPasswordRecovery: boolean;
  isAdmin: boolean;
  signUp: (email: string, pass: string, name?: string) => Promise<SignUpResult>;
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: Error | null }>;
  clearPasswordRecovery: () => void;
  resendVerification: (email: string) => Promise<{ error: Error | null }>;
  demoLogin: (email: string) => void;
  userName: string;
  updateUserName: (name: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getUserDisplayName(u: User | null): string {
  if (!u) return 'Utilisateur';
  const email = u.email?.trim().toLowerCase();
  if (email) {
    const local = localStorage.getItem(`tcf_user_name_${email}`);
    if (local && local.trim().length > 0) return local.trim();
  }
  const metaName = (u.user_metadata as any)?.name || (u.user_metadata as any)?.full_name;
  if (metaName && typeof metaName === 'string' && metaName.trim().length > 0) {
    return metaName.trim();
  }
  return email ? email.split('@')[0] : 'Utilisateur';
}



export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(false);
  const [userName, setUserName] = useState<string>(() => getUserDisplayName(null));

  useEffect(() => {
    setUserName(getUserDisplayName(user));
  }, [user]);

  const updateUserName = async (newName: string): Promise<{ error: Error | null }> => {
    const trimmed = newName.trim();
    if (!trimmed) {
      return { error: new Error('Le nom ne peut pas être vide.') };
    }

    if (user?.email) {
      localStorage.setItem(`tcf_user_name_${user.email.trim().toLowerCase()}`, trimmed);
    }
    setUserName(trimmed);

    setUser((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        user_metadata: {
          ...(prev.user_metadata || {}),
          name: trimmed,
          full_name: trimmed
        }
      };
    });

    if (supabase && isSupabaseConfigured && user && user.id !== 'admin_Écriture_id') {
      try {
        await supabase.auth.updateUser({
          data: { name: trimmed, full_name: trimmed }
        });
      } catch (e) {
        console.warn('Could not update user metadata on Supabase:', e);
      }
    }

    return { error: null };
  };

  useEffect(() => {
    // Check if URL hash indicates a password recovery redirect
    if (
      window.location.hash &&
      (window.location.hash.includes('type=recovery') || window.location.hash.includes('access_token='))
    ) {
      if (window.location.hash.includes('type=recovery')) {
        setIsPasswordRecovery(true);
      }
    }

    if (!supabase || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }

    // Safety timeout: on slow or throttled mobile networks, never block the app indefinitely
    const sessionTimeout = setTimeout(() => {
      setLoading((current) => {
        if (current) {
          console.warn('Supabase getSession timed out after 4 seconds; unblocking UI.');
          return false;
        }
        return false;
      });
    }, 4000);

    // Initialize Supabase Auth session
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        clearTimeout(sessionTimeout);
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
      })
      .catch((err) => {
        clearTimeout(sessionTimeout);
        console.warn('Supabase getSession failed:', err);
        setLoading(false);
      });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, session) => {
      clearTimeout(sessionTimeout);
      setSession(session);
      setUser(session?.user ?? null);
      if (event === 'PASSWORD_RECOVERY') {
        setIsPasswordRecovery(true);
      }
      setLoading(false);
    });

    return () => {
      clearTimeout(sessionTimeout);
      subscription.unsubscribe();
    };
  }, []);

  const getAuthRedirectUrl = (): string => {
    if (typeof window !== 'undefined' && window.location) {
      return window.location.origin + window.location.pathname;
    }
    return '/';
  };

  const signUp = async (email: string, pass: string, name?: string): Promise<SignUpResult> => {
    const normalized = email.trim().toLowerCase();
    recordUserEmail(normalized);

    const trimmedName = name?.trim();
    if (trimmedName) {
      try {
        localStorage.setItem(`tcf_user_name_${normalized}`, trimmedName);
      } catch {}
      setUserName(trimmedName);
    }

    if (!supabase || !isSupabaseConfigured) {
      return { error: new Error("Service d'inscription indisponible.") };
    }

    const redirectUrl = getAuthRedirectUrl();
    const { data, error } = await supabase.auth.signUp({
      email: normalized,
      password: pass,
      options: {
        emailRedirectTo: redirectUrl,
        data: trimmedName ? { name: trimmedName, full_name: trimmedName } : undefined
      }
    });

    if (error) {
      const msg = error.message.toLowerCase();
      if (
        msg.includes('already registered') ||
        msg.includes('already exists') ||
        msg.includes('user already registered') ||
        msg.includes('unique constraint')
      ) {
        return {
          error: new Error('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.'),
          alreadyExists: true
        };
      }
      return { error: new Error(error.message), needsVerification: false };
    }

    // Supabase behavior: If email already exists, identities is returned as empty list []
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        error: new Error('Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter.'),
        alreadyExists: true
      };
    }

    const needsVerification = Boolean(data.user && (!data.session || !data.user.email_confirmed_at));
    return { error: null, needsVerification };
  };

  const signIn = async (email: string, pass: string) => {
    const normalized = email.trim().toLowerCase();
    const cleanPass = pass.trim();

    recordUserEmail(normalized);

    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error("Service d'authentification indisponible. Veuillez vérifier votre connexion.")
      };
    }

    const { data, error } = await supabase.auth.signInWithPassword({
      email: normalized,
      password: pass
    });

    if (error) {
      return { error: new Error(error.message) };
    }

    if (data.session) {
      setSession(data.session);
      setUser(data.user);
    }

    return { error: null };
  };

  const signOut = async () => {
    try {
      localStorage.removeItem('tcf_admin_logged_in');
      localStorage.removeItem('tcf_admin_user_email');
      localStorage.removeItem('tcf_local_user_email');
      localStorage.removeItem('tcf_demo_user');
    } catch {}

    if (supabase && isSupabaseConfigured) {
      try {
        await supabase.auth.signOut();
      } catch (e) {
        console.warn('Error during signOut:', e);
      }
    }

    setUser(null);
    setSession(null);
    setIsPasswordRecovery(false);
  };

  const resetPassword = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return {
        error: new Error(
          "Supabase n'est pas encore configuré sur cet environnement (clé API manquante dans .env)."
        )
      };
    }
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });
    return { error: error ? new Error(error.message) : null };
  };

  const updatePassword = async (newPassword: string) => {
    if (!supabase || !isSupabaseConfigured) {
      return { error: null };
    }
    const { error } = await supabase.auth.updateUser({
      password: newPassword
    });
    if (!error) {
      setIsPasswordRecovery(false);
      if (window.location.hash) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
    return { error: error ? new Error(error.message) : null };
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search);
    }
  };

  const resendVerification = async (email: string) => {
    if (!supabase || !isSupabaseConfigured) return { error: null };
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = getAuthRedirectUrl();
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: cleanEmail,
      options: {
        emailRedirectTo: redirectUrl
      }
    });
    return { error: error ? new Error(error.message) : null };
  };

  const demoLogin = (email: string) => {
    console.info('demoLogin called for', email);
  };

  // Check email verification status:
  // Admin is always verified; other users are verified if session exists or email is confirmed
  const isEmailVerified = Boolean(
    user && (
      isOwnerEmail(user.email) ||
      Boolean(user.email_confirmed_at || (user as any).confirmed_at) ||
      Boolean(session) ||
      !isSupabaseConfigured
    )
  );

  const isAdmin = Boolean(user && user.app_metadata?.role === 'admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        isConfigured: isSupabaseConfigured,
        isEmailVerified,
        isPasswordRecovery,
        isAdmin,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        clearPasswordRecovery,
        resendVerification,
        demoLogin,
        userName,
        updateUserName
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
