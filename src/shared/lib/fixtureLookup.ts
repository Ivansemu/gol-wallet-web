// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Completar el partido cuando el boleto solo deja leer un equipo («Real Betis - ?»): se busca ese equipo entre los
// partidos del backoffice a esa hora. Solo si no hay dudas (un candidato claro); si no, se deja como estaba y el
// servidor o el backoffice lo resolverán. Sin React Native: se prueba en tests/regressions.cjs.
import type { FixtureOption } from './manualMarkets';

type Ev = { home?: string; away?: string; startTime?: string; [k: string]: unknown };

const STOP = new Set(['fc', 'cf', 'cd', 'sd', 'ud', 'rc', 'rcd', 'ca', 'club', 'de', 'la', 'el', 'afc', 'sc', 'ac', 'as', 'ssc', 'bk', 'fk', 'sk', 'if']);
const words = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ')
  .split(/\s+/).filter(w => w.length > 1 && !STOP.has(w));
const isWomen = (s: string) => /\b(fem|femenino|women|woman|ladies|w)\b/i.test(s);
const isYouth = (s: string) => /\b(u\d{2}|sub ?\d{2}|juvenil|b|ii|reserves?)\b/i.test(s);

/** Parecido entre el nombre leído y el del partido (0–1). Todas las palabras del leído dentro del otro = 1. */
export function teamScore(read: string, name: string): number {
  if (isWomen(read) !== isWomen(name) || isYouth(read) !== isYouth(name)) return 0;
  const r = words(read), n = words(name);
  if (!r.length || !n.length) return 0;
  const hit = r.filter(w => n.some(x => x === w || (w.length >= 5 && (x.startsWith(w) || w.startsWith(x))))).length;
  return hit / r.length * (hit / Math.max(r.length, n.length) * 0.2 + 0.8);
}

/** Hora del boleto («2026-10-21 21:00», hora de España) → milisegundos. null si no trae hora. */
function kickoff(s?: string): number | null {
  if (!s || !/\d{1,2}:\d{2}/.test(s)) return null;
  const t = Date.parse(s.trim().replace(' ', 'T'));
  return Number.isFinite(t) ? t : null;
}

/**
 * Selecciones con un solo equipo → partido del backoffice a ±45 min con ese equipo, si el mejor es claro
 * (parecido ≥ 0,75 y 0,2 por encima del siguiente). Devuelve los eventos con los dos equipos en el orden real.
 */
export function completeMissingTeams<T extends Ev>(events: T[], fixtures: FixtureOption[]): T[] {
  return events.map(e => {
    const known = e.home && !e.away ? e.home : !e.home && e.away ? e.away : null;
    const at = kickoff(e.startTime);
    if (!known || at == null) return e;
    const near = fixtures.filter(f => Math.abs(Date.parse(f.startsAt) - at) <= 45 * 60e3 && f.status !== 'cancelled');
    const scored = near.map(f => {
      const h = teamScore(known, f.home), a = teamScore(known, f.away);
      return { f, score: Math.max(h, a) };
    }).sort((x, y) => y.score - x.score);
    const [best, second] = scored;
    if (!best || best.score < 0.75 || (second && best.score - second.score < 0.2)) return e;
    return { ...e, home: best.f.home, away: best.f.away };
  });
}
