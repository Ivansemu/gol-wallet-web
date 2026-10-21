// Supabase simulado para las pruebas en navegador y las capturas (NO es el servidor real: la lógica SQL
// se prueba en winzo-backend/tests/db con las migraciones de verdad). Guarda lo que la web envía.
const USER = { id: '00000000-0000-4000-8000-000000000001', aud: 'authenticated', role: 'authenticated', email: 'lucia@ejemplo.es', is_anonymous: false,
  app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-01-01T00:00:00Z' };

const iso = (d) => new Date(Date.now() + d * 864e5).toISOString();
const sel = (id, status, i, partido = null, extra = {}) => ({ id, raw_text: null, status, progress: null, market_key: 'match_result', params: { index: i }, fixture_id: partido ? 'fx' + id : null, partido, ...extra });
const live = { status: 'live', minute: 67, starts_at: iso(-0.05), home_score: 2, away_score: 1, updated_at: new Date().toISOString(), sport: 'football' };

export function seed() {
  return {
    slips: [
      { id: 'r-live', status: 'open', payout: null, cashout_amount: null, placed_at: iso(-0.2), entry: 'scan', bookmaker: 'Casa Norte', stake: 10, total_odds: 5.04,
        raw: { app: 'bolettus', localId: 'm1', operator: 'Casa Norte', stake: 10, finalOdds: 5.04, maxWin: 50.4, issuedAt: iso(-0.2), betType: 'combinada',
          events: [{ homeTeam: 'Real Betis', awayTeam: 'Sevilla FC', market: '1X2', selection: 'Real Betis', odds: 2.1 },
                   { homeTeam: 'Valencia CF', awayTeam: 'Villarreal', market: 'Ambos marcan', selection: 'Sí', odds: 2.4 }] },
        selecciones: [sel('a', 'live_winning', 0, live), sel('b', 'pending', 1, { ...live, status: 'scheduled', minute: null, home_score: null, away_score: null, starts_at: iso(0.2) })] },
      { id: 'r-won', status: 'won', payout: 18.6, cashout_amount: null, placed_at: iso(-3), entry: 'manual', bookmaker: 'Apuestas Sur', stake: 10, total_odds: 1.86,
        raw: { app: 'gol-wallet-web', localId: 'w1', operator: 'Apuestas Sur', stake: 10, finalOdds: 1.86, maxWin: 18.6, issuedAt: iso(-3), events: [{ homeTeam: 'Málaga CF', awayTeam: 'Córdoba CF', market: '1X2', selection: 'Málaga CF', odds: 1.86 }] },
        selecciones: [sel('c', 'won', 0, { ...live, status: 'finished', minute: 90 })] },
      { id: 'r-lost', status: 'lost', payout: 0, cashout_amount: null, placed_at: iso(-12), entry: 'scan', bookmaker: 'Casa Norte', stake: 5, total_odds: 3.2,
        raw: { app: 'bolettus', localId: 'm2', operator: 'Casa Norte', stake: 5, finalOdds: 3.2, maxWin: 16, issuedAt: iso(-12), events: [{ homeTeam: 'Athletic Club', awayTeam: 'Real Sociedad', market: 'Más/Menos goles', selection: 'Más de 2,5', odds: 3.2 }] },
        selecciones: [sel('d', 'lost', 0, { ...live, status: 'finished', minute: 90 })] },
      { id: 'r-cash', status: 'open', payout: null, cashout_amount: 12, placed_at: iso(-40), entry: 'scan', bookmaker: 'Apuestas Sur', stake: 8, total_odds: 2.5,
        raw: { app: 'bolettus', localId: 'm3', operator: 'Apuestas Sur', stake: 8, finalOdds: 2.5, maxWin: 20, issuedAt: iso(-40), events: [{ homeTeam: 'Girona FC', awayTeam: 'Getafe CF', market: '1X2', selection: 'X', odds: 2.5 }] },
        selecciones: [sel('e', 'pending', 0)] },
    ],
    fixtures: [
      { id: 'fx-1', starts_at: iso(0.3), status: 'scheduled', minute: null, sport: 'football', home_score: null, away_score: null, competition: { name: 'LaLiga', country: 'España' }, home: { name: 'Real Betis' }, away: { name: 'Sevilla FC' } },
      { id: 'fx-2', starts_at: iso(1.1), status: 'scheduled', minute: null, sport: 'football', home_score: null, away_score: null, competition: { name: 'LaLiga', country: 'España' }, home: { name: 'Atlético de Madrid' }, away: { name: 'Real Madrid' } },
    ],
    draws: [
      { game: 'primitiva', draw_date: iso(-1).slice(0, 10), numbers: [4, 11, 19, 23, 37, 45], extras: { complementario: 8, reintegro: 3 }, prizes: { categories: { '4': 72.15, '3': 8, 'R': 1 }, source: 'SELAE · acta (datos de ejemplo)' } },
      { game: 'euromillones', draw_date: iso(-2).slice(0, 10), numbers: [7, 15, 22, 34, 48], extras: { estrellas: [3, 9] }, prizes: null },
      { game: 'bonoloto', draw_date: iso(-1).slice(0, 10), numbers: [2, 9, 17, 28, 31, 44], extras: { complementario: 40, reintegro: 6 }, prizes: null },
    ],
    offers: { enabled: true, disclosure: 'Enlace de afiliado: Gol-Wallet puede recibir una comisión si te registras. No cambia nada para ti.',
      offers: [
        { slug: 'casa-norte', name: 'Casa Norte (ejemplo)', license: 'Licencia general GA/0000/000 (ejemplo)', verticals: ['sports'], summary: 'Operador de ejemplo para las pruebas de la web.', terms: 'Condiciones de ejemplo: +18. Consulta las condiciones reales en la web del operador.' },
        { slug: 'apuestas-sur', name: 'Apuestas Sur (ejemplo)', license: 'Licencia general GA/0000/001 (ejemplo)', verticals: ['sports', 'casino'], summary: 'Segundo operador de ejemplo.', terms: null },
      ] },
    safety: null, premium: { premium: false, enforced: false, scans_used: 2, scans_limit: 10, account_status: 'active' },
    sent: { slips: [], selections: [], rpc: [], go: [] },
  };
}

export async function install(ctx, db, { signedIn = false } = {}) {
  const session = () => ({ access_token: 'demo-token', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, refresh_token: 'demo-refresh', user: USER });
  if (signedIn) await ctx.addInitScript((s) => { localStorage.setItem('golwallet-web-auth', JSON.stringify(s)); }, session());
  const json = (route, body, status = 200) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  await ctx.route('https://demo.supabase.co/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
    if (p === '/auth/v1/token') return json(route, session());
    if (p === '/auth/v1/user') return json(route, USER);
    if (p === '/auth/v1/logout') return route.fulfill({ status: 204 });
    if (p.startsWith('/rest/v1/rpc/')) {
      const fn = p.split('/').pop();
      const body = req.postDataJSON() ?? {};
      db.sent.rpc.push({ fn, body });
      if (fn === 'affiliate_offers') return json(route, db.safety?.hide_offers || (db.safety?.pause_until && Date.parse(db.safety.pause_until) > Date.now()) ? { enabled: false, offers: [] } : db.offers);
      if (fn === 'public_latest_draws') return json(route, db.draws);
      if (fn === 'public_lottery_draw') return json(route, db.draws.find(d => d.game === body.p_game) ?? null);
      if (fn === 'my_premium') return json(route, db.premium);
      if (fn === 'my_safety_set') {
        const cur = db.safety ?? { pause_until: null, hide_offers: false };
        db.safety = { pause_until: body.p_pause_days ? iso(body.p_pause_days) : cur.pause_until, hide_offers: body.p_hide_offers ?? cur.hide_offers };
        return json(route, db.safety);
      }
      if (fn === 'my_data_export') return json(route, { profile: { email: USER.email }, slips: db.slips.length });
      if (fn === 'winzo_set_cashout') { const s = db.slips.find(x => x.id === body.p_slip); if (s) s.cashout_amount = body.p_amount; return json(route, null); }
      return json(route, null);
    }
    if (p === '/rest/v1/bet_slips') {
      if (req.method() === 'GET') {
        // Como producción sin 0017: la columna payout no existe
        if (db.noPayout && /payout/.test(url.searchParams.get('select') ?? '')) return json(route, { code: '42703', message: 'column bet_slips.payout does not exist' }, 400);
        return json(route, db.noPayout ? db.slips.map(({ payout, ...s }) => s) : db.slips);
      }
      if (req.method() === 'POST') {
        const row = req.postDataJSON();
        const id = `r-new-${db.sent.slips.length + 1}`;
        db.sent.slips.push(row);
        db.slips.unshift({ id, status: 'open', payout: null, cashout_amount: null, ...row, selecciones: [] });
        return json(route, { id }, 201);
      }
      if (req.method() === 'DELETE') { const id = url.searchParams.get('id')?.replace('eq.', ''); db.slips = db.slips.filter(s => s.id !== id); return route.fulfill({ status: 204 }); }
    }
    if (p === '/rest/v1/bet_selections' && req.method() === 'POST') {
      const rows = req.postDataJSON();
      db.sent.selections.push(...rows);
      const slip = db.slips.find(s => s.id === rows[0]?.slip_id);
      if (slip) slip.selecciones = rows.map((r, i) => ({ id: `n${i}`, raw_text: r.raw_text, status: r.status, progress: null, market_key: r.market_key, params: r.params, fixture_id: r.fixture_id, partido: null }));
      return route.fulfill({ status: 201 });
    }
    if (p === '/rest/v1/user_safety') {
      const accept = req.headers()['accept'] ?? '';
      if (accept.includes('vnd.pgrst.object')) return db.safety ? json(route, db.safety) : json(route, { code: 'PGRST116', message: 'no rows' }, 406);
      return json(route, db.safety ? [db.safety] : []);
    }
    if (p === '/rest/v1/fixtures') return json(route, db.fixtures);
    if (p.startsWith('/functions/v1/affiliate-go/')) {
      db.sent.go.push({ method: req.method(), url: req.url(), auth: req.headers()['authorization'] ?? null });
      if (req.method() === 'POST') return json(route, { url: 'https://operador.example/alta' });
      // El servidor real responde 302 al operador; aquí basta con ver que la web navega al enlace de seguimiento
      return route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Redirección al operador (simulada)</h1>' });
    }
    return json(route, { message: `sin simular: ${req.method()} ${p}` }, 404);
  });
  await ctx.route('https://operador.example/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Web del operador (simulada)</h1>' }));
  await ctx.route('https://ocr.demo/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify({ type: 'sports_bet', operator: 'Casa Norte', stake: 5, finalOdds: 4.2, maxWin: 21, ticketId: 'CN-7781',
      events: [{ home: 'Atlético de Madrid', away: 'Real Madrid', market: '1X2', pick: 'X', odds: 3.5 }, { home: 'Real Betis', away: 'Sevilla FC', market: 'Ambos marcan', pick: 'Sí', odds: 1.2 }] }) }));
}
