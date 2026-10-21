// Cartera de la web: misma lógica que la app sobre los boletos del servidor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { walletFromServer, manualTicket, manualErrors, slipForServer } from '../src/lib/wallet.ts';

const sel = (status, index = 0, extra = {}) => ({ id: `s${index}`, raw_text: null, status, progress: null, market_key: null, params: { index }, fixture_id: null, partido: null, ...extra });

test('boletos del servidor con el estado del servidor', () => {
  const rows = [
    { id: 'r1', status: 'won', payout: 18, cashout_amount: null, placed_at: '2026-10-01T10:00:00Z',
      raw: { app: 'bolettus', localId: 'm1', operator: 'Casa', stake: 10, finalOdds: 2, maxWin: 20, issuedAt: '2026-10-01T10:00:00Z', events: [{ homeTeam: 'A', awayTeam: 'B' }] },
      selecciones: [sel('won')] },
    { id: 'r2', status: 'open', payout: null, cashout_amount: null, raw: null, bookmaker: 'Otra', stake: '5', total_odds: '3', placed_at: '2026-10-05T10:00:00Z',
      selecciones: [sel('unmatched')] },
  ];
  const { tickets } = walletFromServer(rows);
  assert.equal(tickets.length, 2);
  assert.equal(tickets[0].operator, 'Otra', 'más reciente primero');
  assert.equal(tickets[0].maxWin, 15);
  assert.equal(tickets[0].status, 'abierta');
  assert.equal(tickets[1].status, 'ganada');
  assert.equal(tickets[1].maxWin, 18, 'cobro real del servidor');
});

test('boleto manual en el formato de la app', () => {
  const input = { operator: 'Casa', stake: 10, legs: [
    { home: 'Betis', away: 'Sevilla', market: '1X2', pick: 'Betis', odds: 2, fixtureId: 'fx1', marketKey: 'match_result', marketParams: { pick: 'home' } },
    { home: 'A', away: 'B', market: 'Otro', pick: 'Algo', odds: 1.5 },
  ] };
  assert.deepEqual(manualErrors(input), []);
  const t = manualTicket(input, new Date('2026-10-21T10:00:00Z'));
  assert.equal(t.finalOdds, 3);
  assert.equal(t.maxWin, 30);
  assert.equal(t.betType, 'combinada');
  assert.match(t.id, /^web-/);
  const slip = slipForServer(t);
  assert.equal(slip.bruto.app, 'gol-wallet-web');
  assert.equal(slip.selecciones[0].fixtureId, 'fx1', 'emparejada: el servidor la resuelve');
  assert.equal(slip.selecciones[1].fixtureId, undefined);
  assert.equal(slip.importe, 10);
  assert.ok(manualErrors({ operator: '', stake: 0, legs: [{ home: '', away: 'x', market: '', pick: '', odds: 0.5 }] }).length >= 3);
});

test('boleto leído de una foto: se revisa y se guarda como «scan»', async () => {
  const { reviewFromScan } = await import('../src/lib/wallet.ts');
  const r = reviewFromScan({ type: 'sports_bet', operator: 'Casa', stake: 5, finalOdds: 4.2, maxWin: 21, ticketId: 'X1', issuedAt: '2026-10-20T18:00:00Z',
    events: [{ home: 'A', away: 'B', market: '1X2', pick: '1', odds: 2.1 }, { home: 'C', away: 'D', market: '1X2', pick: 'X', odds: 2 }] });
  assert.equal(r.legs.length, 2);
  const t = manualTicket(r);
  assert.equal(t.entry, 'scan');
  assert.equal(t.ticketId, 'X1');
  assert.equal(t.maxWin, 21, 'el premio leído del boleto manda');
  assert.equal(t.finalOdds, 4.2);
});

test('textos legales de la web: la frase «sin publicidad» de la app se adapta a la web', async () => {
  const { webTerms, webPrivacy } = await import('../src/content/legalWeb.ts');
  const terms = JSON.stringify(webTerms());
  assert.ok(!terms.includes('No incluye publicidad de operadores de juego ni enlaces para apostar.'), 'si cambia el texto de la app, hay que revisar la web');
  assert.ok(terms.includes('enlaces de afiliación'));
  assert.ok(!terms.includes('{owner.'), 'datos del titular rellenados');
  assert.ok(JSON.stringify(webPrivacy()).includes('13 meses'));
});
