// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
import type { ScannedTicket } from '../types/tickets';

export type TicketDraft = {
  stake: string;
  operator: string;
  maxWin: string;
  finalOdds: string;
  date: string;
  rows: Record<string, string>[];
};

export function createTicketDraft(ticket: ScannedTicket): TicketDraft {
  const fields = ticket.type === 'sports_bet' ? ticket.events : ticket.lines;
  return {
    stake: String(ticket.stake ?? ''),
    operator: ticket.type === 'sports_bet' ? ticket.operator : '',
    maxWin: ticket.type === 'sports_bet' ? String(ticket.maxWin ?? '') : '',
    finalOdds: ticket.type === 'sports_bet' ? String(ticket.finalOdds ?? '') : '',
    date: ticket.type === 'lottery' ? ticket.drawDate ?? '' : '',
    rows: fields.map((row, index) => ({ ...Object.fromEntries(Object.entries(row).map(([key, value]) =>
      [key, Array.isArray(value) ? value.join(' ') : String(value ?? '')])), _sourceIndex: String(index) })),
  };
}

function number(value: string, label: string, minimum: number): number {
  const clean = value.trim().replace(',', '.');
  if (!/^\d+(?:\.\d+)?$/.test(clean) || !Number.isFinite(Number(clean)) || Number(clean) < minimum) {
    throw new Error(`${label}: introduce un número válido, como mínimo ${minimum}.`);
  }
  return Number(clean);
}

/** Valida solo fechas escritas por el usuario: si el valor no se tocó, se conserva el del OCR tal cual. */
function date(value: string, original?: string): string | undefined {
  if (!value.trim()) return undefined;
  if (original && value.trim() === original.trim()) return original;
  const clean = value.trim();
  const day = clean.slice(0, 10);
  const parsed = new Date(day);
  if (!/^\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})?)?$/.test(clean) ||
    !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== day || !Number.isFinite(Date.parse(clean))) {
    throw new Error('Fecha inválida. Usa AAAA-MM-DD o AAAA-MM-DDTHH:mm.');
  }
  return clean;
}

function numbers(value: string, label: string): number[] {
  if (!value.trim()) return [];
  return value.trim().split(/[\s,]+/).map(v => {
    if (!/^\d+$/.test(v)) throw new Error(`${label}: utiliza números enteros separados por espacios.`);
    return number(v, label, 0);
  });
}

export function applyTicketDraft(ticket: ScannedTicket, draft: TicketDraft): ScannedTicket {
  const stake = number(draft.stake, 'Importe', 0.01);
  if (!draft.rows.length) throw new Error('Añade al menos una selección o combinación.');
  if (ticket.type === 'sports_bet') {
    if (!draft.operator.trim()) throw new Error('Indica el operador del boleto.');
    return { ...ticket, stake, operator: draft.operator.trim(),
      maxWin: number(draft.maxWin, 'Premio potencial', 0),
      finalOdds: draft.finalOdds.trim() ? number(draft.finalOdds, 'Cuota total', 1) : undefined,
      events: draft.rows.map((row, i) => {
        for (const key of ['home', 'away', 'market', 'pick']) {
          if (!row[key]?.trim()) throw new Error(`Selección ${i + 1}: completa equipos, mercado y selección.`);
        }
        return { ...(row._sourceIndex == null ? {} : ticket.events[Number(row._sourceIndex)]), home: row.home.trim(), away: row.away.trim(),
          market: row.market.trim(), pick: row.pick.trim(),
          sport: row.sport?.trim() || undefined,
          league: row.league?.trim() || row.competition?.trim() || undefined,
          odds: row.odds?.trim() ? number(row.odds, 'Cuota', 1) : undefined,
          startTime: date(row.startTime ?? '', row._sourceIndex == null ? undefined : ticket.events[Number(row._sourceIndex)]?.startTime),
        };
      }),
    };
  }
  return { ...ticket, stake, drawDate: date(draft.date, ticket.drawDate), lines: draft.rows.map((row, i) => {
    const main = numbers(row.numbers ?? '', 'Números');
    const stars = numbers(row.stars ?? '', 'Extras');
    const picks = (row.picks ?? '').trim().split(/\s+/).filter(Boolean);
    if (!main.length && !picks.length) throw new Error(`Combinación ${i + 1}: introduce números o pronósticos.`);
    if (main.length > 1 && new Set(main).size !== main.length) throw new Error(`Combinación ${i + 1}: hay números repetidos.`);
    if (new Set(stars).size !== stars.length) throw new Error('Hay extras repetidos.');
    const result = { ...(row._sourceIndex == null ? {} : ticket.lines[Number(row._sourceIndex)]), numbers: main, stars, picks };
    for (const key of ['reintegro', 'elKey', 'series', 'fraction'] as const) {
      result[key] = row[key]?.trim() ? number(row[key], key, 0) : undefined;
      if (result[key] != null && !Number.isSafeInteger(result[key])) throw new Error(`${key}: introduce un número entero.`);
    }
    return result;
  }) };
}
