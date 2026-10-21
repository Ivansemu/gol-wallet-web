// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Qué avisos locales programar: inicio de tus partidos y día del sorteo de tus boletos de lotería.
// Funciones puras (sin React Native) para poder testearlas.
import type { RemoteSlip } from '../types/remote';
import { matchSelections } from './betSync';

export type NotificationSettings = {
  matchStart: boolean;   // 5 min antes de que empiece un partido de tus apuestas abiertas
  results: boolean;      // cuando una apuesta se gana o se pierde (con la app abierta o en segundo plano)
  live: boolean;         // en directo (push): goles, córners, tarjetas… de tus partidos con apuestas abiertas
  lotteryDraw: boolean;  // a las 19:00 del día del sorteo de tus boletos sin comprobar
  prizes: boolean;       // 30, 7 y 1 día antes de que caduque un premio sin cobrar
};
export const DEFAULT_SETTINGS: NotificationSettings = { matchStart: true, results: true, live: true, lotteryDraw: true, prizes: true };

export type PlannedNotification = { id: string; date: Date; title: string; body: string };

type LocalBet = Record<string, any>;
const MAX = 50;                       // iOS admite 64 avisos programados por app
const HORIZON = 14 * 86_400_000;      // solo las próximas 2 semanas
const MATCH_LEAD = 5 * 60_000;        // 5 minutos antes del inicio
const GAMES: Record<string, string> = {
  euromillones: 'Euromillones', primitiva: 'La Primitiva', bonoloto: 'Bonoloto', gordo: 'El Gordo',
  once: 'ONCE', eurodreams: 'EuroDreams', loteria_nacional: 'Lotería Nacional', quiniela: 'La Quiniela', quinigol: 'El Quinigol',
};

/** "2026-10-01 20:45" / ISO → fecha (hora local del móvil si no lleva zona). null si no se entiende. */
export function parseStart(v?: string | null): Date | null {
  if (!v || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const local = v.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?$/);
  const d = local
    ? new Date(+local[1], +local[2] - 1, +local[3], local[4] != null ? +local[4] : 12, local[5] != null ? +local[5] : 0)
    : new Date(v);
  return Number.isFinite(d.getTime()) ? d : null;
}

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 60);

export function planNotifications(bets: LocalBet[], remote: Record<string, RemoteSlip>, settings: NotificationSettings, now = new Date(), extra: PlannedNotification[] = []): PlannedNotification[] {
  const out = new Map<string, PlannedNotification>();
  const within = (d: Date) => d.getTime() > now.getTime() && d.getTime() - now.getTime() < HORIZON;

  if (settings.matchStart) {
    // Las cobradas con cash out ya no se siguen
    for (const bet of bets.filter(b => (!b.type || b.type === 'sports_bet') && !b.cashout)) {
      const events: LocalBet[] = Array.isArray(bet.events) ? bet.events : [];
      const slip = bet.remoteId ? remote[bet.remoteId] : undefined;
      if (slip && ['won', 'lost', 'void', 'half_won', 'half_lost'].includes(slip.status)) continue;   // boleto ya cerrado
      const server = slip ? matchSelections(slip, events) : [];
      events.forEach((ev, i) => {
        const sel = server[i];
        if (sel && ['won', 'lost', 'void', 'half_won', 'half_lost'].includes(sel.status)) return;
        // Hora del backoffice si la selección está emparejada; si no, la del boleto
        const start = parseStart(sel?.partido?.starts_at) ?? parseStart(ev.startTime ?? ev.date ?? ev.kickoff);
        if (!start) return;
        const at = new Date(start.getTime() - MATCH_LEAD);
        if (!within(at)) return;
        const home = ev.homeTeam || ev.home || 'Local', away = ev.awayTeam || ev.away || 'Visitante';
        const id = `gw-match-${slug(`${home}-${away}`)}-${start.getTime()}`;
        if (out.has(id)) return;   // varias apuestas al mismo partido: un solo aviso
        const market = ev.market || ev.marketName, pick = ev.selection || ev.pick;
        out.set(id, { id, date: at, title: `⚽ ${home} – ${away} empieza en 5 min`,
          body: market || pick ? `Tu apuesta: ${[market, pick].filter(Boolean).join(' · ')}` : 'Sigue cómo va tu apuesta en Gol-Wallet.' });
      });
    }
  }

  if (settings.lotteryDraw) {
    const byDraw = new Map<string, number>();
    for (const t of bets.filter(b => b.type === 'lottery' && !b.checkResult && b.drawDate)) {
      const key = `${t.game}|${String(t.drawDate).slice(0, 10)}`;
      byDraw.set(key, (byDraw.get(key) ?? 0) + 1);
    }
    for (const [key, count] of byDraw) {
      const [game, day] = key.split('|');
      const date = parseStart(`${day} 19:00`);
      if (!date || !within(date)) continue;
      const id = `gw-draw-${game}-${day}`;
      out.set(id, { id, date, title: `🎟️ Hoy hay sorteo de ${GAMES[game] ?? 'lotería'}`,
        body: `Tienes ${count} ${count === 1 ? 'boleto' : 'boletos'} para el sorteo de hoy. Guarda el papel hasta comprobarlo.` });
    }
  }

  // Avisos que calcula quien llama (caducidad de premios…), con el mismo horizonte
  for (const n of extra) if (within(n.date) && !out.has(n.id)) out.set(n.id, n);

  return [...out.values()].sort((a, b) => a.date.getTime() - b.date.getTime()).slice(0, MAX);
}

type Sel = RemoteSlip['selecciones'][number];
/** Selecciones que acaban de resolverse (para avisar de ganada/perdida). */
export function resolvedChanges(prev: Map<string, string>, remote: Record<string, RemoteSlip>): { sel: Sel; status: 'won' | 'lost' | 'void' }[] {
  const out: { sel: Sel; status: 'won' | 'lost' | 'void' }[] = [];
  for (const slip of Object.values(remote)) for (const sel of slip.selecciones) {
    const before = prev.get(sel.id);
    const done = ['won', 'lost', 'void', 'half_won', 'half_lost'];
    if (before && before !== sel.status && done.includes(sel.status) && !done.includes(before)) {
      // Medias liquidaciones: el aviso las cuenta como acertada / fallada
      const status = sel.status === 'half_won' ? 'won' : sel.status === 'half_lost' ? 'lost' : sel.status;
      out.push({ sel, status: status as 'won' | 'lost' | 'void' });
    }
  }
  return out;
}

export function resultMessage(sel: Sel, status: 'won' | 'lost' | 'void'): { title: string; body: string } {
  const teams = (sel.raw_text ?? '').split(' · ')[0] || 'Tu partido';
  const early = (sel.progress as Record<string, unknown> | null)?.early_payout;
  if (status === 'won') return { title: '✅ ¡Selección acertada!', body: early ? `${teams} · pagada por goles de ventaja` : teams };
  if (status === 'lost') return { title: '❌ Selección fallada', body: teams };
  return { title: 'Selección nula', body: teams };
}
