// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Saldo por casa de apuestas: las casas las crea el usuario (la app no propone nombres).
// Saldo = depositado − retirado − apostado + lo que devuelven las apuestas (premios y cash out).
// Funciones puras (sin React Native) para poder testearlas.

export type Casa = { id: string; name: string; createdAt: string };

export type WalletMove = {
  id: string;
  casaId: string;
  kind: 'deposit' | 'withdraw';
  amount: number;
  /** AAAA-MM-DD */
  date: string;
};

export type Wallets = { version: 2; casas: Casa[]; moves: WalletMove[] };
export const EMPTY_WALLETS: Wallets = { version: 2, casas: [], moves: [] };

/** Apuesta deportiva tal como la ve la app (estado ya resuelto). */
export type WalletBet = { stake: number; status: string; maxWin: number; cashout?: number; _raw: Record<string, any> };

export type CasaSummary = {
  casa: Casa;
  deposited: number;
  withdrawn: number;
  /** Apostado en total en esta casa. */
  staked: number;
  /** Apostado en boletos aún sin decidir. */
  inPlay: number;
  /** Lo que han devuelto las apuestas: premios y cash out. */
  returned: number;
  /** Dinero que tienes ahora en la casa. */
  balance: number;
  /** Lo que has ganado o perdido de verdad con las apuestas: devuelto − apostado (las abiertas no cuentan). */
  result: number;
  bets: number;
  moves: WalletMove[];
};

const round2 = (n: number) => Math.round(n * 100) / 100;
export const newId = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;

/** Lo que ha devuelto una apuesta: premio (o lo cobrado de verdad), cash out, o nada. */
export function betReturn(b: WalletBet): number {
  if (b.status === 'cobrada') return b.cashout ?? 0;
  if (b.status === 'anulada') return b.stake;
  if (b.status === 'ganada') {
    const paid = b._raw?.collected?.amount;
    return typeof paid === 'number' ? paid : b.maxWin;
  }
  return 0;
}

export function casaSummary(casa: Casa, w: Wallets, bets: WalletBet[]): CasaSummary {
  const moves = w.moves.filter(m => m.casaId === casa.id).sort((a, b) => b.date.localeCompare(a.date));
  const mine = bets.filter(b => b._raw?.casaId === casa.id);
  const deposited = round2(moves.filter(m => m.kind === 'deposit').reduce((s, m) => s + m.amount, 0));
  const withdrawn = round2(moves.filter(m => m.kind === 'withdraw').reduce((s, m) => s + m.amount, 0));
  const staked = round2(mine.reduce((s, b) => s + b.stake, 0));
  const inPlay = round2(mine.filter(b => b.status === 'abierta').reduce((s, b) => s + b.stake, 0));
  const returned = round2(mine.reduce((s, b) => s + betReturn(b), 0));
  return {
    casa, deposited, withdrawn, staked, inPlay, returned, moves, bets: mine.length,
    balance: round2(deposited - withdrawn - staked + returned),
    result: round2(returned - (staked - inPlay)),
  };
}

export function walletSummary(w: Wallets, bets: WalletBet[]): CasaSummary[] {
  return w.casas.map(c => casaSummary(c, w, bets));
}

export function walletTotals(list: CasaSummary[]) {
  const sum = (k: 'deposited' | 'withdrawn' | 'balance' | 'result' | 'inPlay') => round2(list.reduce((s, x) => s + x[k], 0));
  return { deposited: sum('deposited'), withdrawn: sum('withdrawn'), balance: sum('balance'), result: sum('result'), inPlay: sum('inPlay') };
}

/** Cuánto falta depositar para poder registrar una apuesta de `stake` (0 si hay saldo). */
export function shortfall(balance: number, stake: number): number {
  return stake > balance ? round2(stake - Math.max(0, balance)) : 0;
}

/** Nombre válido y no repetido (sin distinguir mayúsculas ni acentos). */
export function casaNameError(name: string, casas: Casa[]): string | null {
  const n = name.trim();
  if (n.length < 2) return 'Escribe un nombre de al menos 2 letras.';
  if (n.length > 30) return 'Como mucho 30 caracteres.';
  const key = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  return casas.some(c => key(c.name) === key(n)) ? 'Ya tienes una casa con ese nombre.' : null;
}

/** Versión 1 (movimientos con el nombre de la casa) → versión 2 (casas creadas). */
export function migrateWallets(raw: any): Wallets {
  if (raw?.version === 2) return { ...EMPTY_WALLETS, ...raw };
  const casas: Casa[] = [];
  const byName = new Map<string, string>();
  const moves: WalletMove[] = [];
  for (const m of Array.isArray(raw?.moves) ? raw.moves : []) {
    const name = String(m.operator ?? '').trim();
    if (!name) continue;
    if (!byName.has(name)) { const id = newId('casa'); byName.set(name, id); casas.push({ id, name, createdAt: new Date().toISOString() }); }
    moves.push({ id: m.id ?? newId('m'), casaId: byName.get(name)!, kind: m.kind === 'withdraw' ? 'withdraw' : 'deposit', amount: Number(m.amount) || 0, date: String(m.date ?? '').slice(0, 10) });
  }
  return { version: 2, casas, moves };
}
