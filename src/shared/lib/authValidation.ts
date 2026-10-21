// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Validación y mensajes de las pantallas de cuenta (del diseño: gol-wallet-design/expo/src/screens/auth/validation.ts).
// Sin dependencias de React Native: testeable en Node.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function validateEmail(email: string): string | null {
  if (!email.trim()) return 'Escribe tu email';
  if (!EMAIL_RE.test(email.trim())) return 'Revisa el email, parece incompleto';
  return null;
}

export type PasswordRules = { length: boolean; letter: boolean; number: boolean };

export function passwordRules(pw: string): PasswordRules {
  return { length: pw.length >= 8, letter: /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(pw), number: /\d/.test(pw) };
}

export function validateNewPassword(pw: string): string | null {
  const r = passwordRules(pw);
  if (!r.length) return 'Usa al menos 8 caracteres';
  if (!r.letter) return 'Añade al menos una letra';
  if (!r.number) return 'Añade al menos un número';
  return null;
}

export type AuthErrorCode =
  | 'invalid-credentials' | 'email-in-use' | 'weak-password' | 'network'
  | 'too-many-requests' | 'email-not-confirmed' | 'link-expired' | 'cancelled' | 'unknown';

export class AuthError extends Error {
  constructor(public code: AuthErrorCode, message?: string) { super(message ?? code); }
}

export function authErrorMessage(code: AuthErrorCode): string {
  switch (code) {
    // No revelamos si el email existe (seguridad)
    case 'invalid-credentials': return 'El email o la contraseña no son correctos.';
    case 'email-in-use': return 'Ya hay una cuenta con este email.';
    case 'weak-password': return 'Esa contraseña es demasiado fácil. Prueba con otra.';
    case 'network': return 'Sin conexión. Revisa internet e inténtalo de nuevo.';
    case 'too-many-requests': return 'Demasiados intentos. Espera un momento y vuelve a probar.';
    case 'email-not-confirmed': return 'Confirma tu email desde el enlace que te enviamos y vuelve a entrar.';
    case 'link-expired': return 'El enlace ha caducado. Pide uno nuevo.';
    case 'cancelled': return '';
    default: return 'Algo ha fallado. Inténtalo de nuevo.';
  }
}

export const toAuthCode = (e: unknown): AuthErrorCode => (e instanceof AuthError ? e.code : 'unknown');

/** Error de Supabase Auth → código de la app. */
export function supabaseAuthCode(e: { code?: string; message?: string; name?: string; status?: number } | null | undefined): AuthErrorCode {
  if (!e) return 'unknown';
  const code = e.code ?? '';
  const msg = (e.message ?? '').toLowerCase();
  if (e.name === 'AuthRetryableFetchError' || /network|fetch|failed to fetch/.test(msg)) return 'network';
  if (code === 'invalid_credentials' || msg.includes('invalid login credentials')) return 'invalid-credentials';
  if (['email_exists', 'user_already_exists', 'email_address_not_authorized'].includes(code) || msg.includes('already been registered') || msg.includes('already registered')) return 'email-in-use';
  if (code === 'weak_password' || msg.includes('password should')) return 'weak-password';
  if (code.startsWith('over_') || e.status === 429) return 'too-many-requests';
  if (code === 'email_not_confirmed' || msg.includes('email not confirmed')) return 'email-not-confirmed';
  if (code === 'otp_expired' || msg.includes('expired')) return 'link-expired';
  return 'unknown';
}
