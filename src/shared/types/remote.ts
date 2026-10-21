// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Tipos de lo que devuelve el backend Winzo (bet_slips, bet_selections, fixtures). Sin dependencias:
// los usan src/lib, src/services/winzoApi.ts y la web (gol-wallet-web).

export type FixtureStatus = 'scheduled' | 'live' | 'halftime' | 'finished' | 'postponed' | 'cancelled' | 'suspended';

// half_won / half_lost (0016): hándicaps y totales asiáticos de cuarto de gol, liquidados en dos mitades
export type SelectionStatus = 'unmatched' | 'pending' | 'live_winning' | 'live_losing' | 'won' | 'lost' | 'void' | 'half_won' | 'half_lost' | 'review';
export type SlipStatus = 'open' | 'won' | 'lost' | 'void' | 'half_won' | 'half_lost' | 'review';

/** Lo justo del partido para mostrar cómo va cada selección en la lista. */
export type PartidoResumen = {
  status: FixtureStatus; minute: number | null; starts_at: string;
  home_score: number | null; away_score: number | null;
  /** Última vez que el worker o el backoffice tocaron el partido: sirve para estimar el minuto entre actualizaciones. */
  updated_at?: string | null;
  /** football, basketball, hockey… (0020/0021). El minuto solo se muestra en fútbol. */
  sport?: string | null;
  /** Equipos del partido emparejado: completan el boleto cuando el lector no leyó alguno. */
  home?: { name: string } | null; away?: { name: string } | null;
};
export type RemoteSelection = {
  id: string; raw_text: string | null; status: SelectionStatus; progress: unknown;
  market_key: string | null; params: Record<string, unknown> | null; fixture_id: string | null;
  partido: PartidoResumen | null;
};
export type RemoteSlip = {
  id: string; status: SlipStatus; selecciones: RemoteSelection[];
  /** Cash out guardado en el servidor; undefined = servidor sin la migración 0010. */
  cashout_amount?: number | null;
  /** Lo que devuelve el boleto ya liquidado (con nulas y mitades); undefined = servidor sin 0017. */
  payout?: number | null;
};

export type NewSelection = { fixtureId?: string; market?: string; params?: Record<string, unknown>; rawText?: string; odds?: number | null };
export type NewSlip = {
  casa?: string; importe?: number | null; cuota?: number | null; fecha?: string | null;
  entrada?: 'scan' | 'manual'; bruto?: unknown; selecciones: NewSelection[];
};
