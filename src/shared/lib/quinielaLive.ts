// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Quiniela en directo: con los 15 partidos de la jornada y sus marcadores, el signo de cada partido
// y cuántos aciertos lleva tu boleto. Funciones puras (sin React Native) para poder testearlas.

export type JornadaMatch = { position: number; home: string; away: string; fixture_id: string | null };
export type LiveFixture = { id: string; status: string; minute: number | null; home_score: number | null; away_score: number | null };
export type MatchState = 'pending' | 'live' | 'finished' | 'void';

export type QuinielaRow = {
  position: number; home: string; away: string;
  pick: string; sign: string | null; score: string | null; minute: number | null;
  state: MatchState;
  /** null mientras no ha empezado. */
  hit: boolean | null;
};

const STARTED = new Set(['live', 'halftime', 'finished', 'suspended']);

/** 1 · X · 2 según el marcador (null si no ha empezado). */
export function currentSign(f?: LiveFixture | null): '1' | 'X' | '2' | null {
  if (!f || !STARTED.has(f.status) || f.home_score == null || f.away_score == null) return null;
  return f.home_score > f.away_score ? '1' : f.home_score < f.away_score ? '2' : 'X';
}

/** Pleno al 15: goles de cada equipo con 0, 1, 2 o M (3 o más) → «2-M». */
export function plenoSign(f?: LiveFixture | null): string | null {
  if (!f || !STARTED.has(f.status) || f.home_score == null || f.away_score == null) return null;
  const g = (n: number) => (n >= 3 ? 'M' : String(n));
  return `${g(f.home_score)}-${g(f.away_score)}`;
}

const stateOf = (f?: LiveFixture | null): MatchState =>
  !f ? 'pending' : ['postponed', 'cancelled', 'abandoned'].includes(f.status) ? 'void'
    : f.status === 'finished' ? 'finished' : STARTED.has(f.status) ? 'live' : 'pending';

/** ¿El signo jugado (1, X, 2, dobles «1X», triples, o pleno «2-M») incluye el resultado? */
function matches(pick: string, sign: string | null, isPleno: boolean): boolean | null {
  if (sign == null) return null;
  const p = pick.trim().toUpperCase();
  if (isPleno && p.includes('-')) return p.replace(/\s/g, '') === sign;
  if (isPleno) return null;   // pleno apuntado como 1/X/2: no se puede comprobar con goles
  return p.split('').includes(sign);
}

export const CATEGORIES: Record<number, string> = { 14: '1.ª categoría', 13: '2.ª categoría', 12: '3.ª categoría', 11: '4.ª categoría', 10: '5.ª categoría' };

export function quinielaLive(picks: string[], matchesList: JornadaMatch[], fixtures: Record<string, LiveFixture>) {
  const rows: QuinielaRow[] = [...matchesList].sort((a, b) => a.position - b.position).slice(0, 15).map(m => {
    const f = m.fixture_id ? fixtures[m.fixture_id] : undefined;
    const isPleno = m.position === 15;
    const sign = isPleno ? plenoSign(f) : currentSign(f);
    const pick = picks[m.position - 1] ?? '';
    return {
      position: m.position, home: m.home, away: m.away, pick, sign,
      score: f && f.home_score != null && f.away_score != null && STARTED.has(f.status) ? `${f.home_score}-${f.away_score}` : null,
      minute: f?.minute ?? null, state: stateOf(f), hit: pick ? matches(pick, sign, isPleno) : null,
    };
  });
  const main = rows.filter(r => r.position <= 14);
  const hits = main.filter(r => r.hit === true).length;
  const misses = main.filter(r => r.hit === false).length;
  const pleno = rows.find(r => r.position === 15);
  const finished = rows.length > 0 && rows.every(r => r.state === 'finished' || r.state === 'void');
  const category = hits === 14 && pleno?.hit === true ? 'Pleno al 15 (especial)' : CATEGORIES[hits] ?? null;
  return {
    rows, hits, misses, finished, category,
    /** Lo máximo que aún puedes acertar en los 14 primeros. */
    possible: 14 - misses,
    live: rows.some(r => r.state === 'live'),
  };
}
