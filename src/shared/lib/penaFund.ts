// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Peñas compartidas (migración 0025): el bote común con participaciones y los boletos a medias.
// Funciones puras (sin React Native) para poder testearlas. La app solo apunta: el dinero se mueve fuera
// (Bizum, efectivo…).
//
// Bote con participaciones (como un fondo): el bote vale lo que hay en caja más lo apostado que sigue en juego
// (a su coste). Quien aporta compra participaciones al valor del momento, así quien entra tarde no se lleva parte
// de lo que el bote ganó antes, ni paga lo que perdió. Premios y pérdidas cambian el valor de la participación
// para todos a la vez, en proporción a lo que tiene cada uno.
import { splitPrize } from './penya';

export type PenaEntryKind = 'contribution' | 'withdrawal' | 'stake' | 'payout' | 'adjust';
export type PenaEntry = {
  id: string; kind: PenaEntryKind; created_at: string;
  amount: number;              // siempre ≥ 0, salvo en los ajustes
  member_id?: string | null;   // aportación / retirada: de quién
  ticket_id?: string | null;   // apuesta / premio: de qué boleto
};
export type PenaMemberRef = { id: string; display_name: string };

export type MemberBalance = {
  id: string; name: string;
  units: number;
  value: number;          // lo que vale su parte del bote ahora
  contributed: number; withdrawn: number;
  result: number;         // value + withdrawn − contributed
  share: number;          // fracción del bote (0..1)
};
export type FundState = {
  cash: number;           // dinero del bote que no está apostado
  inPlay: number;         // apostado en boletos del bote aún sin resolver (a su coste)
  total: number;          // cash + inPlay
  unitValue: number;      // valor de una participación (empieza en 1 €)
  units: number;
  members: MemberBalance[];
  openTickets: string[];  // boletos del bote con apuesta y sin premio apuntado
  errors: string[];       // movimientos que no se han podido aplicar (p. ej. retirar más de lo que se tiene)
};

const EPS = 1e-9;
const round2 = (n: number) => Math.round(n * 100) / 100;
const order = (a: PenaEntry, b: PenaEntry) => a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);

/** Repasa el libro en orden y calcula el estado del bote y de cada miembro. */
export function fundState(entries: PenaEntry[], members: PenaMemberRef[]): FundState {
  let cash = 0, units = 0;
  const open = new Map<string, number>();                      // ticket → apostado
  const m = new Map(members.map(x => [x.id, { units: 0, contributed: 0, withdrawn: 0 }]));
  const errors: string[] = [];
  const nav = () => (units > EPS ? (cash + [...open.values()].reduce((s, v) => s + v, 0)) / units : 1);
  const who = (id?: string | null) => (id ? m.get(id) : undefined);

  for (const e of [...entries].sort(order)) {
    const amount = Math.max(0, Number(e.amount) || 0);
    if (e.kind === 'contribution') {
      const acc = who(e.member_id);
      if (!acc) { errors.push(`Aportación sin miembro (${e.id})`); continue; }
      const u = amount / nav();
      acc.units += u; acc.contributed += amount; units += u; cash += amount;
    } else if (e.kind === 'withdrawal') {
      const acc = who(e.member_id);
      if (!acc) { errors.push(`Retirada sin miembro (${e.id})`); continue; }
      const price = nav();
      const u = amount / price;
      if (u > acc.units + EPS || amount > cash + 0.005) { errors.push(`Retirada mayor que su parte o que la caja (${e.id})`); continue; }
      acc.units = Math.max(0, acc.units - u); acc.withdrawn += amount; units = Math.max(0, units - u); cash -= amount;
    } else if (e.kind === 'stake') {
      if (!e.ticket_id) { errors.push(`Apuesta sin boleto (${e.id})`); continue; }
      if (amount > cash + 0.005) { errors.push(`Apuesta mayor que la caja (${e.id})`); continue; }
      cash -= amount; open.set(e.ticket_id, (open.get(e.ticket_id) ?? 0) + amount);
    } else if (e.kind === 'payout') {
      // Premio (0 si se perdió): vuelve a la caja y el boleto deja de estar en juego
      if (e.ticket_id) open.delete(e.ticket_id);
      cash += amount;
    } else if (e.kind === 'adjust') {
      // Corrección del administrador (comisión, redondeo…): puede ser negativa
      cash += Number(e.amount) || 0;
    }
  }

  const unitValue = nav();
  const inPlay = [...open.values()].reduce((s, v) => s + v, 0);
  const total = cash + inPlay;
  return {
    cash: round2(cash), inPlay: round2(inPlay), total: round2(total),
    unitValue, units,
    openTickets: [...open.keys()],
    errors,
    members: members.map(x => {
      const a = m.get(x.id)!;
      const value = a.units * unitValue;
      return {
        id: x.id, name: x.display_name, units: a.units,
        value: round2(value), contributed: round2(a.contributed), withdrawn: round2(a.withdrawn),
        result: round2(value + a.withdrawn - a.contributed),
        share: units > EPS ? a.units / units : 0,
      };
    }),
  };
}

/** Lo máximo que un miembro puede retirar ahora: su parte, sin pasar de lo que hay en caja. */
export function maxWithdrawal(state: FundState, memberId: string): number {
  const me = state.members.find(x => x.id === memberId);
  return me ? round2(Math.min(me.value, state.cash)) : 0;
}

/** Apostado desde el bote en el mes de `now` (hora de Madrid aproximada con el mes UTC). */
export function stakedThisMonth(entries: PenaEntry[], now = new Date()): number {
  const ym = now.toISOString().slice(0, 7);
  return round2(entries.filter(e => e.kind === 'stake' && e.created_at.slice(0, 7) === ym).reduce((s, e) => s + (Number(e.amount) || 0), 0));
}

/** ¿Cabe esta apuesta en el presupuesto mensual del bote? (sin presupuesto, siempre) */
export function budgetCheck(entries: PenaEntry[], monthlyBudget: number | null | undefined, stake: number, now = new Date()) {
  const used = stakedThisMonth(entries, now);
  if (!monthlyBudget || monthlyBudget <= 0) return { ok: true, used, left: null as number | null };
  const left = round2(monthlyBudget - used);
  return { ok: stake <= left + 0.005, used, left };
}

export type TicketShare = { member_id: string; amount: number; paid: boolean };

/** Boleto a medias (fuera del bote): cuánto le toca a cada uno del premio, en proporción a lo que puso. */
export function splitTicket(shares: TicketShare[], members: PenaMemberRef[], prize: number) {
  const name = (id: string) => members.find(x => x.id === id)?.display_name ?? 'Miembro';
  const parts = splitPrize(shares.map(s => ({ name: s.member_id, amount: s.amount, paid: s.paid })), prize);
  return parts.map(p => ({ member_id: p.name, name: name(p.name), share: p.share }));
}

/** Código de invitación legible (sin 0/O ni 1/I/L para dictarlo sin errores). */
export function inviteCode(random: () => number = Math.random, length = 8): string {
  const abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  return Array.from({ length }, () => abc[Math.floor(random() * abc.length)]).join('');
}

/** Normaliza lo que escribe el usuario («abcd-1234», con espacios…) al formato del código. */
export const normalizeCode = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');
