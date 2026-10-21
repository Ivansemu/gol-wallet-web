// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Cómo va cada selección, en una frase: «Falta 1 gol del Betis», «Se está cumpliendo»…
// Solo usa lo que llega del backend (estado, progreso y marcador del partido): sin dependencias
// de React Native para poder testearlo.
import type { PartidoResumen, RemoteSelection, SelectionStatus } from '../types/remote';

export type Tone = 'good' | 'bad' | 'neutral' | 'muted';
export type Insight = {
  phase: 'unmatched' | 'scheduled' | 'live' | 'halftime' | 'finished' | 'stopped';
  tone: Tone;
  title: string;
  detail?: string;
  score?: string;
  minute?: number | null;
};
type Leg = { market: string; params?: Record<string, any> };
type Names = { home: string; away: string };

const STATS: Record<string, [string, string]> = {   // [singular, plural]
  corners: ['córner', 'córners'], shots: ['tiro', 'tiros'], shots_on_target: ['tiro a puerta', 'tiros a puerta'],
  fouls: ['falta', 'faltas'], offsides: ['fuera de juego', 'fueras de juego'],
  yellow_cards: ['amarilla', 'amarillas'], red_cards: ['roja', 'rojas'], goals: ['gol', 'goles'],
};
const n = (count: number, [one, many]: [string, string]) => `${count} ${count === 1 ? one : many}`;
const falta = (count: number, what: [string, string]) => `${count === 1 ? 'Falta' : 'Faltan'} ${n(count, what)}`;
export const fmtLine = (line: number) => String(line).replace('.', ',');
const GOALS: [string, string] = ['gol', 'goles'];

const PERIOD: Record<string, string> = {
  h1: '1ª parte', h2: '2ª parte', et: 'prórroga', ft_et: 'con prórroga', ft_et_pens: 'con prórroga y penaltis',
};
/** El minuto solo tiene sentido en fútbol (y en partidos sin deporte, que son de fútbol). */
export const hasMatchClock = (sport?: string | null) => !sport || sport === 'football';
/** Minuto para mostrar: null fuera del fútbol (baloncesto, voleibol…: se enseña solo «En juego» y el marcador). */
export const clockMinute = (sport: string | null | undefined, minute: number | null | undefined) =>
  hasMatchClock(sport) ? minute ?? null : null;

const signed = (x: number) => (x > 0 ? `+${fmtLine(x)}` : fmtLine(x));

/** Texto corto de un mercado con sus parámetros (formato de shared/markets.ts). */
export function legLabel(leg: Leg, names: Names): string {
  const text = legLabelBase(leg, names);
  const period = PERIOD[leg.params?.period];
  return period ? `${text} · ${period}` : text;
}

function legLabelBase(leg: Leg, names: Names): string {
  const p = leg.params ?? {};
  const side = p.side === 'under' ? 'Menos de' : 'Más de';
  const who = p.team === 'home' ? ` de ${names.home}` : p.team === 'away' ? ` de ${names.away}` : '';
  const pick3 = (k: string) => (k === 'home' ? names.home : k === 'away' ? names.away : 'Empate');
  const team = p.team === 'away' ? names.away : names.home;
  switch (leg.market) {
    case 'double_chance':
      return p.pick === 'home_draw' ? `${names.home} o empate` : p.pick === 'draw_away' ? `Empate o ${names.away}` : `Gana ${names.home} o ${names.away}`;
    case 'draw_no_bet': return `Gana ${pick3(p.pick)} (empate: nula)`;
    case 'exact_score': return `Resultado exacto ${p.home}-${p.away}`;
    case 'ht_ft': return `Descanso/final: ${pick3(p.ht)} / ${pick3(p.ft)}`;
    case 'asian_handicap': return `Hándicap asiático ${team} ${signed(Number(p.line))}`;
    case 'european_handicap': return `Hándicap ${team} ${signed(Number(p.line))}: ${pick3(p.pick)}`;
    case 'exact_goals': return `${p.n}${p.or_more ? ' o más' : ''} goles${who}`;
    case 'goals_odd_even': return `Goles${who}: ${p.pick === 'odd' ? 'impar' : 'par'}`;
    case 'winning_margin': return p.pick === 'draw' ? 'Empate' : `Gana ${p.pick === 'any' ? 'cualquiera' : pick3(p.pick)} por ${p.margin}${p.or_more ? ' o más' : ''}`;
    case 'match_result': return p.pick === 'draw' ? 'Empate'
      : `Gana ${p.pick === 'home' ? names.home : names.away}${p.lead_payout ? ` (${p.lead_payout} goles de ventaja)` : ''}`;
    case 'total_goals': return `${side} ${fmtLine(p.line)} goles${who}`;
    case 'btts': return p.pick === 'no' ? 'Ambos marcan: no' : 'Ambos marcan: sí';
    case 'total_stat': return `${side} ${fmtLine(p.line)} ${STATS[p.stat]?.[1] ?? p.stat}${who}`;
    case 'player_stat': return `Jugador: ${side.toLowerCase()} ${fmtLine(p.line)} ${STATS[p.stat]?.[1] ?? p.stat}`;
    case 'player_scores': return `${p.player_name ?? 'El jugador'} marca`;
    default: return p.pick_text ? String(p.pick_text) : leg.market;
  }
}

// Mercados que la app sabe seguir con el marcador del partido entero
const SCORE_MARKETS = new Set(['match_result', 'total_goals', 'btts', 'total_stat', 'player_stat', 'player_scores']);
/** ¿Hay que fiarse del estado del servidor en vez del marcador? (partes, asiáticos, hándicaps…) */
const serverOnly = (leg: Leg) => !SCORE_MARKETS.has(leg.market) || (leg.params?.period != null && leg.params.period !== 'ft');

/**
 * Cómo va un mercado con el marcador/progreso actual. ok = se está cumpliendo (null = no se sabe).
 * `finished` cambia el tiempo verbal («Falta 1 gol» en directo, «Faltó 1 gol» al terminar no aporta: se usa el marcador).
 */
export function describeLeg(leg: Leg, h: number, a: number, progress: Record<string, any> | null, names: Names): { ok: boolean | null; text: string } {
  const p = leg.params ?? {};
  switch (leg.market) {
    case 'match_result': {
      const lead = h - a;
      if (p.pick === 'draw') {
        if (lead === 0) return { ok: true, text: `Empate ${h}-${a}` };
        const trailing = lead > 0 ? names.away : names.home;
        return { ok: false, text: `${falta(Math.abs(lead), GOALS)} de ${trailing}` };
      }
      const mine = p.pick === 'home' ? lead : -lead;
      const team = p.pick === 'home' ? names.home : names.away;
      // Pago anticipado: con N goles de ventaja se paga aunque luego remonten
      const payout = Number(p.lead_payout) > 0 && mine > 0 && mine < Number(p.lead_payout)
        ? ` · ${n(Number(p.lead_payout) - mine, ['gol más', 'goles más'])} y se paga` : '';
      if (mine > 0) return { ok: true, text: `${team} gana ${h}-${a}${payout}` };
      return { ok: false, text: `${falta(1 - mine, GOALS)} de ${team}` };
    }
    case 'total_goals': {
      const cur = p.team === 'home' ? h : p.team === 'away' ? a : h + a;
      return overUnder(cur, Number(p.line), p.side, GOALS, p.team ? ` de ${p.team === 'home' ? names.home : names.away}` : '');
    }
    case 'btts': {
      const scored = { home: h > 0, away: a > 0 };
      if (p.pick === 'no') {
        if (scored.home && scored.away) return { ok: false, text: 'Ya han marcado los dos' };
        if (!scored.home && !scored.away) return { ok: true, text: 'Ninguno ha marcado todavía' };
        return { ok: true, text: `Se cumple si ${scored.home ? names.away : names.home} no marca` };
      }
      if (scored.home && scored.away) return { ok: true, text: 'Han marcado los dos' };
      if (!scored.home && !scored.away) return { ok: false, text: 'Faltan goles de los dos equipos' };
      return { ok: false, text: `Falta que marque ${scored.home ? names.away : names.home}` };
    }
    case 'total_stat':
    case 'player_stat': {
      if (progress?.current == null) return { ok: null, text: 'Sin estadísticas todavía' };
      const what = STATS[p.stat] ?? [String(p.stat), String(p.stat)];
      return overUnder(Number(progress.current), Number(p.line), p.side, what, '');
    }
    case 'player_scores':
      if (p.scored === true) return { ok: true, text: `${p.player_name ?? 'El jugador'} ha marcado` };
      if (p.scored === false) return { ok: false, text: `${p.player_name ?? 'El jugador'} no marcó` };
      return { ok: null, text: `Pendiente de que marque ${p.player_name ?? 'el jugador'}` };
    default:
      return { ok: null, text: 'El backoffice revisará esta selección' };
  }
}

function overUnder(cur: number, line: number, side: string, what: [string, string], who: string): { ok: boolean; text: string } {
  if (side === 'under') {
    if (cur >= line) return { ok: false, text: `${n(cur, what)}${who}: ya supera ${fmtLine(line)}` };
    const room = Math.ceil(line) - 1 - cur;   // cuántos más caben sin pasar la línea
    return { ok: true, text: room === 0 ? `${n(cur, what)}${who}: no puede haber ni uno más` : `Puede haber ${n(room, what)} más como máximo${who}` };
  }
  if (cur > line) return { ok: true, text: `${n(cur, what)}${who}: ya supera ${fmtLine(line)}` };
  return { ok: false, text: `${falta(Math.floor(line) + 1 - cur, what)}${who}` };
}

const FINAL: Partial<Record<SelectionStatus, [Tone, string]>> = {
  won: ['good', 'Cumplida'], lost: ['bad', 'No cumplida'], void: ['muted', 'Nula'], review: ['neutral', 'En revisión'],
  half_won: ['good', 'Medio ganada'], half_lost: ['bad', 'Medio perdida'],
};

export function selectionInsight(sel: Pick<RemoteSelection, 'status' | 'market_key' | 'params' | 'progress' | 'partido'> | undefined,
                                 names: Names, now = new Date()): Insight {
  if (!sel || !sel.partido) {
    return { phase: 'unmatched', tone: 'muted', title: 'Pendiente de emparejar', detail: 'El backoffice aún no la ha asociado a un partido' };
  }
  const f: PartidoResumen = sel.partido;
  const minute = clockMinute(f.sport, f.minute);
  const h = f.home_score ?? 0, a = f.away_score ?? 0;
  const score = `${h}-${a}`;
  const leg: Leg = { market: sel.market_key ?? '', params: (sel.params ?? {}) as Record<string, any> };
  const progress = (sel.progress ?? null) as Record<string, any> | null;

  if (f.status === 'scheduled') {
    const start = new Date(f.starts_at);
    const sameDay = start.toDateString() === now.toDateString();
    const time = start.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    return { phase: 'scheduled', tone: 'muted', title: 'Sin empezar',
      detail: sameDay ? `Empieza hoy a las ${time}` : `Empieza el ${start.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })}, ${time}` };
  }
  if (['postponed', 'cancelled', 'suspended'].includes(f.status)) {
    const label = { postponed: 'Partido aplazado', cancelled: 'Partido cancelado', suspended: 'Partido suspendido' }[f.status as 'postponed'];
    return { phase: 'stopped', tone: 'neutral', title: label, detail: 'El backoffice revisará la apuesta', score };
  }

  // Crear apuesta: cuántas condiciones van bien y cuál falta
  let described: { ok: boolean | null; text: string };
  if (leg.market === 'bet_builder') {
    const legs = (leg.params?.legs ?? []) as Leg[];
    const results = legs.map(l => (serverOnly(l) ? { ok: null, text: legLabel(l, names) } : describeLeg(l, h, a, null, names)));
    // Estadísticas/jugador: el servidor sabe más (progress.legs); se respeta su estado
    const serverLegs = (progress?.legs ?? []) as { status?: string }[];
    const okFlags = results.map((r, i) => {
      const st = serverLegs[i]?.status;
      if (st === 'won' || st === 'live_winning') return true;
      if (st === 'lost' || st === 'live_losing') return false;
      return r.ok;
    });
    const good = okFlags.filter(Boolean).length;
    const missing = legs.map((l, i) => okFlags[i] === true ? null : legLabel(l, names)).filter(Boolean);
    described = {
      ok: okFlags.every(o => o === true) ? true : okFlags.some(o => o === false) ? false : null,
      text: missing.length ? `${good} de ${legs.length} condiciones · Falta: ${missing.join(', ')}` : `Las ${legs.length} condiciones se cumplen`,
    };
  } else if (sel.status === 'unmatched' || !leg.market) {
    // Partido conocido y mercado aún sin entender: se sigue el marcador; el backoffice decide el mercado
    described = { ok: null, text: 'Mercado por revisar en el backoffice' };
  } else if (serverOnly(leg)) {
    // Partes, asiáticos, hándicaps…: el marcador total no basta, manda el estado del servidor
    const ok = sel.status === 'live_winning' ? true : sel.status === 'live_losing' ? false : null;
    const parts = progress?.parts as { line: number; status: string }[] | undefined;
    const half = parts?.length === 2 ? ' · línea partida en dos mitades' : '';
    described = { ok, text: `${legLabel(leg, names)}${half}` };
  } else {
    described = describeLeg(leg, h, a, progress, names);
  }

  const final = FINAL[sel.status];
  // Pagada por goles de ventaja (también si el partido sigue en juego)
  const early = sel.status === 'won' && (progress?.early_payout ||
    (progress?.legs as { early_payout?: boolean }[] | undefined)?.some(l => l?.early_payout));
  if (early) {
    const lp = progress?.lead_payout ?? (progress?.legs as any[] | undefined)?.find(l => l?.early_payout)?.lead_payout ?? 2;
    return { phase: f.status === 'finished' ? 'finished' : 'live', tone: 'good', title: 'Cumplida',
      detail: `Pagada por ${lp} goles de ventaja${f.status === 'finished' ? ` · Final ${score}` : ''}`, score, minute };
  }
  if (f.status === 'finished' || final) {
    return { phase: 'finished', tone: final?.[0] ?? 'neutral', title: final?.[1] ?? 'Terminado', detail: `Final ${score}`, score };
  }
  const tone: Tone = described.ok === true ? 'good' : described.ok === false ? 'bad' : 'neutral';
  const title = described.ok === true ? 'Se está cumpliendo' : described.ok === false ? 'Aún no se cumple' : 'En juego';
  return { phase: f.status === 'halftime' ? 'halftime' : 'live', tone, title, detail: described.text, score, minute };
}
