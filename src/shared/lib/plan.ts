// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Texto de «Tu plan» a partir de my_premium() del servidor (migración 0027). El servidor decide el acceso:
// la app solo lo muestra. Sin respuesta del servidor no se afirma nada.
export type MyPremium = {
  premium: boolean; source?: 'subscription' | 'grant' | null; until?: string | null; reason?: string | null;
  enforced: boolean; status?: string | null; will_renew?: boolean;
  scans_used: number; scans_limit: number; account_status?: 'active' | 'suspended' | null;
};

const day = (iso: string) => new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

export function planText(p: MyPremium | null): string {
  if (!p) return '—';
  if (p.premium) {
    const until = p.until ? ` hasta el ${day(p.until)}` : '';
    if (p.source === 'grant') return `Premium (concedido)${until}`;
    if (p.status === 'cancelled') return `Premium${until} · no se renovará`;
    if (p.status === 'billing_issue') return `Premium${until} · revisa el pago en tu tienda`;
    if (p.status === 'trial') return `Prueba de Premium${until}`;
    return `Premium${until}`;
  }
  return p.enforced ? `Gratis · ${p.scans_used} de ${p.scans_limit} lecturas con IA este mes` : 'Gratis';
}
