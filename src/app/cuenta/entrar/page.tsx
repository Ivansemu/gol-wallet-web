'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { AuthCard, AuthLinks, Field } from '../../../components/AuthForm';
import { signIn } from '../../../lib/api';
import { safeNext, useQuery } from '../../../lib/useQuery';
import { validateEmail } from '../../../shared/lib/authValidation';

export default function Entrar() {
  const router = useRouter();
  const next = useQuery('next');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  return (
    <AuthCard head="Entrar" title="Entra en tu cartera" submit="Entrar"
      onSubmit={async () => {
        const bad = validateEmail(email) ?? (password ? null : 'Escribe tu contraseña');
        if (bad) return bad;
        await signIn(email, password);
        router.replace(safeNext(next));
      }}
      footer={<AuthLinks register reset />}>
      <Field id="email" label="Email" type="email" autoComplete="email" placeholder="tu@email.com" value={email} onChange={e => setEmail(e.target.value)} required />
      <Field id="password" label="Contraseña" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} required />
    </AuthCard>
  );
}
