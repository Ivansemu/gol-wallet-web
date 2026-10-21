// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Peñas y boletos compartidos: quién ha puesto cuánto y cuánto le toca a cada uno si hay premio.
// Funciones puras (sin React Native) para poder testearlas.

export type PenyaMember = { name: string; amount: number; paid: boolean };
export type Penya = { members: PenyaMember[] };

const cents = (n: number) => Math.round(n * 100);

/**
 * Reparte el premio en proporción a lo que puso cada uno (a partes iguales si nadie puso importe).
 * Trabaja en céntimos: la suma de las partes es exactamente el premio.
 */
export function splitPrize(members: PenyaMember[], prize: number): { name: string; share: number }[] {
  if (!members.length) return [];
  const total = members.reduce((s, m) => s + Math.max(0, m.amount), 0);
  const weights = members.map(m => (total > 0 ? Math.max(0, m.amount) / total : 1 / members.length));
  const pot = cents(prize);
  const raw = weights.map(w => w * pot);
  const base = raw.map(Math.floor);
  let rest = pot - base.reduce((a, b) => a + b, 0);
  // Los céntimos que sobran van a quien tenía mayor parte decimal (y, a igualdad, por orden)
  const order = raw.map((r, i) => ({ i, frac: r - Math.floor(r) })).sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) { if (rest <= 0) break; base[i] += 1; rest -= 1; }
  return members.map((m, i) => ({ name: m.name, share: base[i] / 100 }));
}

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

/** Texto para mandar al grupo (WhatsApp…). */
export function penyaSummary(title: string, members: PenyaMember[], prize: number | null): string {
  const total = members.reduce((s, m) => s + m.amount, 0);
  const lines = [`🎟️ ${title} · peña de ${members.length}`, `Puesto entre todos: ${eur(total)}`];
  const pending = members.filter(m => !m.paid);
  if (prize != null && prize > 0) {
    lines.push(`🏆 Premio: ${eur(prize)}`, '', 'Reparto:');
    for (const p of splitPrize(members, prize)) lines.push(`· ${p.name}: ${eur(p.share)}`);
  } else {
    lines.push('', 'Participaciones:');
    for (const m of members) lines.push(`· ${m.name}: ${eur(m.amount)}${m.paid ? ' ✓' : ' (pendiente de pagar)'}`);
  }
  if (pending.length) lines.push('', `Falta por pagar: ${pending.map(m => m.name).join(', ')}`);
  lines.push('', 'Hecho con Gol-Wallet');
  return lines.join('\n');
}

/** Identificador estable de un boleto guardado (para la ruta /pena/[key]). */
export const betKey = (b: Record<string, any>) => String(b.remoteId ?? b.id ?? b.ticketId ?? b.scannedAt ?? '');
