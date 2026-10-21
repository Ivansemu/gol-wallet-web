'use client';
// Sesión de la web (misma cuenta que la app). Las páginas de la cartera usan <RequireAuth>.
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import type { User } from '@supabase/supabase-js';
import { backendConfigured, supabase } from '../lib/supabase';

type Auth = { user: User | null; loading: boolean };
const Ctx = createContext<Auth>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<Auth>({ user: null, loading: true });
  useEffect(() => {
    const c = supabase();
    if (!c) { setState({ user: null, loading: false }); return; }
    const pick = (u: User | null | undefined) => (u && !u.is_anonymous ? u : null);
    c.auth.getSession().then(({ data }) => setState({ user: pick(data.session?.user), loading: false }));
    const { data } = c.auth.onAuthStateChange((_e, session) => setState({ user: pick(session?.user), loading: false }));
    return () => data.subscription.unsubscribe();
  }, []);
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const path = usePathname();
  useEffect(() => {
    if (!loading && !user && backendConfigured()) router.replace(`/cuenta/entrar/?next=${encodeURIComponent(path)}`);
  }, [loading, user, router, path]);
  if (!backendConfigured()) return <NotConfigured />;
  if (loading || !user) return <div className="narrow page-head"><p className="muted" role="status">Cargando tu cartera…</p></div>;
  return <>{children}</>;
}

export function NotConfigured() {
  return (
    <div className="narrow page-head">
      <div className="notice" role="alert">Esta copia de la web se ha compilado sin servidor (faltan NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY). No se muestran datos de ejemplo.</div>
    </div>
  );
}
