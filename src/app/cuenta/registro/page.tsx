'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthCard, AuthLinks, Field } from '../../../components/AuthForm';
import { signUp } from '../../../lib/api';
import { validateEmail, validateNewPassword } from '../../../shared/lib/authValidation';

export default function Registro() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [adult, setAdult] = useState(false);
  const [terms, setTerms] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  return (
    <AuthCard head="Cuenta nueva" title="Crea tu cuenta gratis" submit="Crear cuenta" done={done}
      onSubmit={async () => {
        const bad = validateEmail(email) ?? validateNewPassword(password)
          ?? (!adult ? 'Gol-Wallet es solo para mayores de 18 años.' : !terms ? 'Acepta las condiciones y la política de privacidad.' : null);
        if (bad) return bad;
        const r = await signUp(email, password);
        if (r.needsConfirmation) setDone('Te hemos enviado un email para confirmar la cuenta. Ábrelo desde este dispositivo.');
        else router.replace('/cartera/');
      }}
      footer={<AuthLinks login />}>
      <Field id="email" label="Email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
      <Field id="password" label="Contraseña" type="password" autoComplete="new-password" hint="Al menos 8 caracteres, con una letra y un número." value={password} onChange={e => setPassword(e.target.value)} required />
      <label className="row" style={{ alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
        <input type="checkbox" checked={adult} onChange={e => setAdult(e.target.checked)} style={{ width: 22, height: 22 }} /> Tengo 18 años o más.
      </label>
      <label className="row" style={{ alignItems: 'flex-start', gap: 10, fontSize: 14 }}>
        <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ width: 22, height: 22 }} />
        <span>Acepto las <Link href="/legal/aviso-legal/">condiciones</Link> y la <Link href="/legal/privacidad/">política de privacidad</Link>.</span>
      </label>
    </AuthCard>
  );
}
