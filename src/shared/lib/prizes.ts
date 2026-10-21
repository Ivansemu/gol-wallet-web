// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Premios sin cobrar: boletos ganados que aún no has cobrado y cuándo caducan.
// Funciones puras (sin React Native) para poder testearlas.
//
// Plazos:
// · Lotería (SELAE): 3 meses a contar desde el día siguiente al sorteo.
// · Apuestas deportivas en tienda: depende de cada casa; usamos 90 días como aviso orientativo
//   (la app lo dice así y remite al reverso del boleto).
import { parseStart } from './notificationPlan';

export const SPORTS_CLAIM_DAYS = 90;
export const LOTTERY_CLAIM_MONTHS = 3;
const DAY = 86_400_000;

/** Marca de «ya cobrado» que se guarda en el boleto del móvil. */
export type Collected = { at: string; amount: number | null; online?: boolean };

export type UnclaimedPrize = {
  key: string;
  kind: 'sports' | 'lottery';
  title: string;
  operator: string;
  amount: number;
  deadline: Date | null;
  /** Días que quedan (negativo = caducado). null si no se sabe la fecha. */
  daysLeft: number | null;
  /** Boleto tal y como está guardado en el móvil (para marcarlo como cobrado). */
  raw: Record<string, any>;
  /** Id del boleto deportivo en la app (para abrir su detalle). */
  ticketId?: string;
};

type SportsLike = {
  id: string; status: string; maxWin: number; operator: string; placedAt?: string;
  events: { home?: string; away?: string; startTime?: string }[]; _raw: Record<string, any>;
};
type LotteryLike = Record<string, any>;

const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

/** Último partido del boleto (o la fecha del boleto) + 90 días. */
export function sportsDeadline(t: SportsLike): Date | null {
  const starts = t.events.map(e => parseStart(e.startTime)).filter((d): d is Date => !!d);
  const base = starts.length ? new Date(Math.max(...starts.map(d => d.getTime()))) : parseStart(t.placedAt);
  return base ? endOfDay(new Date(base.getTime() + SPORTS_CLAIM_DAYS * DAY)) : null;
}

/** Día siguiente al sorteo + 3 meses. */
export function lotteryDeadline(drawDate?: string | null): Date | null {
  const d = parseStart(drawDate ? `${String(drawDate).slice(0, 10)} 12:00` : null);
  if (!d) return null;
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
  return endOfDay(new Date(next.getFullYear(), next.getMonth() + LOTTERY_CLAIM_MONTHS, next.getDate()));
}

const daysBetween = (from: Date, to: Date) => Math.ceil((to.getTime() - from.getTime()) / DAY);

export const isCollected = (raw: Record<string, any>) => !!raw?.collected;

export function sportsTitle(t: SportsLike): string {
  if (t.events.length > 1) return `Combinada de ${t.events.length}`;
  const e = t.events[0];
  return e?.home && e?.away ? `${e.home} – ${e.away}` : 'Apuesta sencilla';
}

/** Premios ganados sin marcar como cobrados, del que caduca antes al que caduca después. */
export function unclaimedPrizes(sports: SportsLike[], lottery: LotteryLike[], now = new Date(), gameName: (g?: string) => string = g => g ?? 'Lotería'): UnclaimedPrize[] {
  const out: UnclaimedPrize[] = [];
  for (const t of sports) {
    // Las cobradas con cash out ya están cobradas por definición
    if (t.status !== 'ganada' || isCollected(t._raw) || !(t.maxWin > 0)) continue;
    const deadline = sportsDeadline(t);
    out.push({ key: `s:${t.id}`, kind: 'sports', title: sportsTitle(t), operator: t.operator, amount: t.maxWin,
      deadline, daysLeft: deadline ? daysBetween(now, deadline) : null, raw: t._raw, ticketId: t.id });
  }
  for (const b of lottery) {
    const prize = Number(b.checkResult?.totalPrize ?? 0);
    if (!(prize > 0) || isCollected(b)) continue;
    const deadline = lotteryDeadline(b.drawDate ?? b.checkResult?.drawDate);
    out.push({ key: `l:${b.id ?? b.ticketId ?? b.scannedAt}`, kind: 'lottery', title: gameName(b.game), operator: 'Loterías y Apuestas del Estado',
      amount: prize, deadline, daysLeft: deadline ? daysBetween(now, deadline) : null, raw: b });
  }
  return out.sort((a, b) => (a.deadline?.getTime() ?? Infinity) - (b.deadline?.getTime() ?? Infinity));
}

/** Avisos a 30, 7 y 1 día de que caduque cada premio (a las 11:00). */
export function prizeReminders(prizes: UnclaimedPrize[], now = new Date()): { id: string; date: Date; title: string; body: string }[] {
  const out: { id: string; date: Date; title: string; body: string }[] = [];
  for (const p of prizes) {
    if (!p.deadline) continue;
    for (const days of [30, 7, 1]) {
      const d = new Date(p.deadline.getFullYear(), p.deadline.getMonth(), p.deadline.getDate() - days, 11, 0);
      if (d.getTime() <= now.getTime()) continue;
      const euros = p.amount.toFixed(2).replace('.', ',');
      out.push({
        id: `gw-prize-${p.key.replace(/[^a-z0-9]/gi, '').slice(-40)}-${days}`, date: d,
        title: days === 1 ? `⏰ Mañana caduca tu premio de ${euros} €` : `💰 Tienes ${euros} € sin cobrar`,
        body: `${p.title} · ${p.operator}. ${days === 1 ? 'Cóbralo hoy.' : `Caduca en ${days} días.`}`,
      });
    }
  }
  return out;
}
