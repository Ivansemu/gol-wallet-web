'use client';
import { useState, type FormEvent, type ReactNode } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { Receipt, ReceiptHead } from './receipt';
import { authErrorMessage, supabaseAuthCode } from '../shared/lib/authValidation';

/** Formulario de cuenta en un tique: muestra el error de Supabase con el mismo texto que la app. */
export function AuthCard({ head, title, children, onSubmit, submit, done, footer }: {
  head: string; title: string; children: ReactNode; submit: string; done?: string | null; footer?: ReactNode;
  onSubmit: () => Promise<void | string>;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const handle = async (e: FormEvent) => {
    e.preventDefault();
    setError(''); setBusy(true);
    try {
      const msg = await onSubmit();
      if (typeof msg === 'string' && msg) setError(msg);
    } catch (err: any) {
      setError(err?.status || err?.code ? authErrorMessage(supabaseAuthCode(err)) : err?.message ?? 'Algo ha fallado. Prueba otra vez.');
    } finally { setBusy(false); }
  };
  return (
    <div className="narrow" style={{ maxWidth: 480, paddingTop: 36 }}>
      <Receipt>
        <ReceiptHead left={head} right="Gol-Wallet" />
        <h1 style={{ fontSize: 28, margin: '14px 0 18px' }}>{title}</h1>
        {done ? <p className="ok" role="status"><CheckCircle2 size={18} aria-hidden /> {done}</p> : (
          <form onSubmit={handle} className="stack" noValidate>
            {children}
            {error ? <p className="error" role="alert"><AlertCircle size={16} aria-hidden /> {error}</p> : null}
            <button className="btn block" disabled={busy}>{busy ? 'Un momento…' : submit}</button>
          </form>
        )}
        {footer ? <div className="stack-sm" style={{ marginTop: 18, fontSize: 14 }}>{footer}</div> : null}
      </Receipt>
    </div>
  );
}

export function Field({ id, label, hint, ...input }: { id: string; label: string; hint?: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} className="input" {...input} />
      {hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export const AuthLinks = ({ register, login, reset }: { register?: boolean; login?: boolean; reset?: boolean }) => (
  <>
    {login && <p>¿Ya tienes cuenta? <Link href="/cuenta/entrar/">Entra</Link></p>}
    {register && <p>¿No tienes cuenta? <Link href="/cuenta/registro/">Créala gratis</Link></p>}
    {reset && <p><Link href="/cuenta/recuperar/">He olvidado la contraseña</Link></p>}
  </>
);
