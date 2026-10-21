'use client';
import { useState } from 'react';
import { AuthCard, AuthLinks, Field } from '../../../components/AuthForm';
import { sendReset } from '../../../lib/api';
import { validateEmail } from '../../../shared/lib/authValidation';

export default function Recuperar() {
  const [email, setEmail] = useState('');
  const [done, setDone] = useState<string | null>(null);
  return (
    <AuthCard head="Contraseña" title="Recupera tu contraseña" submit="Enviar enlace" done={done}
      onSubmit={async () => {
        const bad = validateEmail(email);
        if (bad) return bad;
        await sendReset(email);
        // No decimos si el email existe (igual que la app)
        setDone('Si hay una cuenta con ese email, te llegará un enlace para elegir otra contraseña.');
      }}
      footer={<AuthLinks login />}>
      <Field id="email" label="Email" type="email" autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} required />
    </AuthCard>
  );
}
