// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Mercados del formulario «Añadir apuesta» conectados al evaluador del backend (winzo-backend/shared/markets.ts).
// Con partido del backoffice + mercado estructurado, la selección se crea ya emparejada («pending») y se
// resuelve sola. Los mercados libres (hándicap, resultado exacto…) entran sin emparejar y los revisa el backoffice.
// Sin dependencias de React Native: testeable en Node.

export type MarketKind =
  | 'match_result' | 'match_result_2gv' | 'btts' | 'total_goals' | 'corners' | 'yellow_cards' | 'shots_on_target'
  | 'double_chance' | 'handicap' | 'correct_score' | 'other';
export type Side = 'over' | 'under';
export type TeamScope = 'all' | 'home' | 'away';

export type MarketChoice = {
  kind: MarketKind;
  /** 1X2: home/draw/away · Ambos marcan: yes/no · Doble oportunidad: 1X/X2/12. */
  pick?: string;
  side?: Side;
  line?: number;
  team?: TeamScope;
  /** Pronóstico escrito a mano (mercados libres). */
  text?: string;
};

type Def = { label: string; structured: boolean; stat?: string; lines?: number[]; defaultLine?: number };
const range = (from: number, to: number) => Array.from({ length: Math.round(to - from) + 1 }, (_, i) => from + i);

export const MARKET_DEFS: Record<MarketKind, Def> = {
  match_result: { label: '1X2', structured: true },
  match_result_2gv: { label: '1X2 (2GV)', structured: true },
  btts: { label: 'Ambos marcan', structured: true },
  total_goals: { label: 'Más/Menos goles', structured: true, lines: range(0.5, 6.5), defaultLine: 2.5 },
  corners: { label: 'Córners', structured: true, stat: 'corners', lines: range(2.5, 14.5), defaultLine: 9.5 },
  yellow_cards: { label: 'Tarjetas amarillas', structured: true, stat: 'yellow_cards', lines: range(0.5, 8.5), defaultLine: 3.5 },
  shots_on_target: { label: 'Tiros a puerta', structured: true, stat: 'shots_on_target', lines: range(1.5, 15.5), defaultLine: 7.5 },
  double_chance: { label: 'Doble oportunidad', structured: false },
  handicap: { label: 'Hándicap', structured: false },
  correct_score: { label: 'Resultado exacto', structured: false },
  other: { label: 'Otro', structured: false },
};

/** Orden de la hoja de mercados. */
export const MARKET_ORDER: MarketKind[] = ['match_result', 'match_result_2gv', 'btts', 'total_goals', 'corners', 'yellow_cards',
  'shots_on_target', 'double_chance', 'handicap', 'correct_score', 'other'];

export const hasLine = (k: MarketKind) => !!MARKET_DEFS[k].lines;

/** Valores por defecto al cambiar de mercado. */
export function defaultChoice(kind: MarketKind): MarketChoice {
  const d = MARKET_DEFS[kind];
  return d.lines ? { kind, side: 'over', line: d.defaultLine, team: 'all' } : { kind };
}

const fmtLine = (n: number) => String(n);

export type BuiltSelection = {
  /** Texto del mercado y del pronóstico tal como se ven en la app y en el backoffice. */
  market: string; pick: string;
  /** Solo si se puede evaluar automáticamente. */
  marketKey?: string; params?: Record<string, unknown>;
};

/** Mercado + pronóstico legibles y, si es posible, el mercado del evaluador. null = falta elegir algo. */
export function buildSelection(c: MarketChoice, home: string, away: string): BuiltSelection | null {
  const d = MARKET_DEFS[c.kind];
  const teamName = (t?: string) => (t === 'home' ? home : t === 'away' ? away : '');
  switch (c.kind) {
    case 'match_result':
    case 'match_result_2gv': {
      if (c.pick !== 'home' && c.pick !== 'draw' && c.pick !== 'away') return null;
      const pick = c.pick === 'draw' ? 'X' : teamName(c.pick);
      return { market: d.label, pick, marketKey: 'match_result',
        params: c.kind === 'match_result_2gv' && c.pick !== 'draw' ? { pick: c.pick, lead_payout: 2 } : { pick: c.pick } };
    }
    case 'btts':
      if (c.pick !== 'yes' && c.pick !== 'no') return null;
      return { market: d.label, pick: c.pick === 'yes' ? 'Sí' : 'No', marketKey: 'btts', params: { pick: c.pick } };
    case 'total_goals':
    case 'corners':
    case 'yellow_cards':
    case 'shots_on_target': {
      if ((c.side !== 'over' && c.side !== 'under') || c.line == null || !Number.isFinite(c.line)) return null;
      const who = c.team === 'home' || c.team === 'away' ? teamName(c.team) : '';
      const pick = `${c.side === 'over' ? 'Más' : 'Menos'} de ${fmtLine(c.line)}`;
      const params: Record<string, unknown> = { line: c.line, side: c.side };
      if (who) params.team = c.team;
      if (d.stat) params.stat = d.stat;
      return { market: who ? `${d.label} · ${who}` : d.label, pick, marketKey: d.stat ? 'total_stat' : 'total_goals', params };
    }
    default: {
      const text = (c.kind === 'double_chance' ? c.pick : c.text)?.trim();
      return text ? { market: d.label, pick: text } : null;
    }
  }
}

// ─── Búsqueda de partidos ──────────────────────────────────────────────

export type FixtureOption = {
  id: string; startsAt: string; status: string; minute: number | null;
  homeScore: number | null; awayScore: number | null;
  home: string; away: string; competition: string | null; country: string | null;
};

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Partidos que encajan con lo escrito (equipos o competición, sin tildes; «betis sevilla» busca los dos).
 * Sin texto: los que están en juego y los próximos. En juego primero, luego por hora.
 */
export function searchFixtures(all: FixtureOption[], query: string, now = Date.now(), limit = 30): FixtureOption[] {
  const words = norm(query).split(' ').filter(w => w.length > 1);
  const live = (f: FixtureOption) => ['live', 'halftime'].includes(f.status);
  const usable = all.filter(f => live(f) || (f.status !== 'cancelled' && Date.parse(f.startsAt) > now - 3 * 3600e3));
  const hits = words.length
    ? usable.filter(f => {
      const hay = norm(`${f.home} ${f.away} ${f.competition ?? ''} ${f.country ?? ''}`);
      return words.every(w => hay.includes(w));
    })
    : usable.filter(f => live(f) || Date.parse(f.startsAt) < now + 36 * 3600e3);
  return hits.sort((a, b) => Number(live(b)) - Number(live(a)) || Date.parse(a.startsAt) - Date.parse(b.startsAt)).slice(0, limit);
}
