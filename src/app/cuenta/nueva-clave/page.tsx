'use client';
import { useState } from 'react';
import { AuthCard, Field } from '../../../components/AuthForm';
import { setNewPassword } from '../../../lib/api';
import { validateNewPassword } from '../../../shared/lib/authValidation';
import Link from 'next/link';

export default function NuevaClave() {
  const [password, setPassword] = useState('');
  const [done, setDone] = useState<string | null>(null);
  return (
    <AuthCard head="Contraseña" title="Elige otra contraseña" submit="Guardar" done={done}
      onSubmit={async () => {
        const bad = validateNewPassword(password);
        if (bad) return bad;
        await setNewPassword(password);
        setDone('Contraseña cambiada. Ya puedes usarla en la web y en la app.');
      }}
      footer={done ? <Link href="/cartera/" className="btn">Ir a mi cartera</Link> : null}>
      <Field id="password" label="Contraseña nueva" type="password" autoComplete="new-password" hint="Al menos 8 caracteres, con una letra y un número." value={password} onChange={e => setPassword(e.target.value)} required />
    </AuthCard>
  );
}
