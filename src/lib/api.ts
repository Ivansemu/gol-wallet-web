// Todo lo que la web pide al backend (el mismo Supabase que la app). RLS decide qué ve cada uno.
import { supabase, OCR_URL, SUPABASE_URL, SITE_URL } from './supabase';
import { slipForServer, walletFromServer, type ServerSlipRow } from './wallet';
import type { MyPremium } from '../shared/lib/plan';
import type { FixtureOption } from '../shared/lib/manualMarkets';
import type { DrawRow } from '../shared/lib/lotteryDraw';
import { parseOcrResponse } from '../shared/lib/ticketParser';
import { clockMinute } from '../shared/lib/selectionInsight';

const db = () => {
  const c = supabase();
  if (!c) throw new Error('La web no tiene configurado el servidor (NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY).');
  return c;
};

// ─── Cuenta ─────────────────────────────────────
export async function currentUser() {
  const c = supabase();
  if (!c) return null;
  const { data } = await c.auth.getSession();
  const u = data.session?.user;
  return u && !u.is_anonymous ? u : null;
}

export async function signIn(email: string, password: string) {
  const { error } = await db().auth.signInWithPassword({ email: email.trim(), password });
  if (error) throw error;
}

export async function signUp(email: string, password: string) {
  const { data, error } = await db().auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: `${SITE_URL}/cartera/` } });
  if (error) throw error;
  return { needsConfirmation: !data.session };
}

export async function sendReset(email: string) {
  const { error } = await db().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${SITE_URL}/cuenta/nueva-clave/` });
  if (error) throw error;
}

export async function setNewPassword(password: string) {
  const { error } = await db().auth.updateUser({ password });
  if (error) throw error;
}

export async function signOut() { await db().auth.signOut(); }

export async function myPlan(): Promise<MyPremium | null> {
  const { data, error } = await db().rpc('my_premium');
  return error ? null : data;
}

export type Safety = { pause_until: string | null; hide_offers: boolean };
export async function mySafety(): Promise<Safety> {
  const { data } = await db().from('user_safety').select('pause_until, hide_offers').maybeSingle();
  return { pause_until: data?.pause_until ?? null, hide_offers: !!data?.hide_offers };
}
export async function setSafety(pauseDays: number | null, hideOffers: boolean | null): Promise<Safety> {
  const { data, error } = await db().rpc('my_safety_set', { p_pause_days: pauseDays, p_hide_offers: hideOffers });
  if (error) throw error;
  return data as Safety;
}

export async function exportMyData(): Promise<unknown> {
  const { data, error } = await db().rpc('my_data_export');
  if (error) throw error;
  return data;
}

export async function deleteMyAccount() {
  const { error } = await db().rpc('delete_my_account');
  if (error) throw error;
  await db().auth.signOut();
}

// ─── Boletos ────────────────────────────────────
const SLIP_FIELDS = `id, status, cashout_amount, raw, bookmaker, stake, total_odds, placed_at, entry, created_at,
  selecciones:bet_selections(id, raw_text, status, progress, market_key, params, fixture_id,
    partido:fixtures(status, minute, starts_at, home_score, away_score, updated_at, sport,
      home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name)))`;

let noPayout = false; // servidor sin la columna payout (0017): como la app, se pide sin ella

export async function myWallet() {
  const query = (fields: string) => db().from('bet_slips').select(fields).order('placed_at', { ascending: false }).limit(1000);
  let { data, error } = await query(noPayout ? SLIP_FIELDS : `payout, ${SLIP_FIELDS}`);
  if (error?.code === '42703' && !noPayout) {  // 42703 = columna inexistente
    noPayout = true;
    ({ data, error } = await query(SLIP_FIELDS));
  }
  if (error) throw error;
  const rows = ((data ?? []) as unknown as ServerSlipRow[]).map(r => ({
    ...r, payout: r.payout == null ? null : Number(r.payout), cashout_amount: r.cashout_amount == null ? null : Number(r.cashout_amount),
  }));
  return walletFromServer(rows);
}

/** Mismo alta que la app (crearApuesta): boleto + selecciones; si fallan las selecciones no queda a medias. */
export async function createSlip(ticket: Record<string, any>): Promise<string> {
  const s = slipForServer(ticket);
  const c = db();
  const { data: slip, error } = await c.from('bet_slips')
    .insert({ bookmaker: s.casa ?? null, stake: s.importe ?? null, total_odds: s.cuota ?? null, entry: s.entrada ?? 'manual', raw: s.bruto, placed_at: s.fecha ?? new Date().toISOString() })
    .select('id').single();
  if (error) throw error;
  const rows = s.selecciones.map(x => {
    const matched = Boolean(x.fixtureId && x.market);
    return { slip_id: slip.id, fixture_id: matched ? x.fixtureId : null, market_key: x.market ?? null, params: x.params ?? {},
      raw_text: x.rawText ?? null, odds: x.odds ?? null, status: matched ? 'pending' : 'unmatched' };
  });
  if (rows.length) {
    const res = await c.from('bet_selections').insert(rows);
    if (res.error) { await c.from('bet_slips').delete().eq('id', slip.id); throw res.error; }
  }
  return slip.id as string;
}

export async function deleteSlip(id: string) {
  const { error } = await db().from('bet_slips').delete().eq('id', id);
  if (error) throw error;
}

/** Cash out cobrado en la casa (o null para quitarlo). El servidor no deja pasar de la ganancia máxima. */
export async function setCashout(id: string, amount: number | null) {
  const { error } = await db().rpc('winzo_set_cashout', { p_slip: id, p_amount: amount });
  if (error) throw error;
}

/** Avisa cuando el servidor cambia algo de tus boletos (worker, backoffice, la app). */
export function watchMySlips(userId: string, onChange: () => void): () => void {
  const c = db();
  const ch = c.channel(`web-apuestas-${userId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_slips', filter: `user_id=eq.${userId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'bet_selections', filter: `user_id=eq.${userId}` }, onChange);
  void c.realtime.setAuth().finally(() => ch.subscribe());
  return () => { void c.removeChannel(ch); };
}

export async function myServerStats(from?: string | null, to?: string | null) {
  const { data, error } = await db().rpc('my_slip_stats', { p_from: from ?? null, p_to: to ?? null });
  if (error) throw error;
  return data as Record<string, any> | null;
}

/** Partidos del backoffice para elegir al añadir a mano (como la app). */
export async function fixturesToPick(): Promise<FixtureOption[]> {
  const { data, error } = await db().from('fixtures')
    .select(`id, starts_at, status, minute, sport, home_score, away_score, competition:competitions(name, country),
      home:teams!fixtures_home_team_id_fkey(name), away:teams!fixtures_away_team_id_fkey(name)`)
    .gte('starts_at', new Date(Date.now() - 6 * 3600e3).toISOString()).order('starts_at').limit(2000);
  if (error) throw error;
  return ((data ?? []) as any[]).map(r => ({
    id: r.id, startsAt: r.starts_at, status: r.status, minute: clockMinute(r.sport, r.minute),
    homeScore: r.home_score ?? null, awayScore: r.away_score ?? null, home: r.home?.name ?? 'Local', away: r.away?.name ?? 'Visitante',
    competition: r.competition?.name ?? null, country: r.competition?.country ?? null,
  }));
}

// ─── Lectura de boletos (OCR) ───────────────────
export type OcrOutcome = { ok: true; ticket: Record<string, any> } | { ok: false; message: string; quota?: boolean };

/** Foto → boleto, con el mismo lector que la app (cupo y registro en el servidor). */
export async function readTicketPhoto(file: File): Promise<OcrOutcome> {
  const { data } = await db().auth.getSession();
  if (!data.session) return { ok: false, message: 'Entra en tu cuenta para leer boletos.' };
  const imageBase64 = await shrink(file);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 25_000);
  try {
    const res = await fetch(OCR_URL, {
      method: 'POST', signal: ctrl.signal,
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${data.session.access_token}` },
      body: JSON.stringify({ imageBase64 }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 402 || res.status === 403) return { ok: false, quota: true, message: String(body.error ?? 'Has agotado las lecturas de este mes.') };
      if (res.status === 429) return { ok: false, message: 'Has leído muchos boletos seguidos. Espera un minuto.' };
      return { ok: false, message: String(body.error ?? `El lector respondió con un error (${res.status}).`) };
    }
    const parsed = parseOcrResponse(body);
    if (!parsed || parsed.type !== 'sports_bet') {
      return { ok: false, message: parsed?.type === 'lottery' ? 'Es un boleto de lotería: compruébalo en «Comprobar lotería».' : 'No he podido leer un boleto deportivo en la foto.' };
    }
    return { ok: true, ticket: parsed as unknown as Record<string, any> };
  } catch (e: any) {
    return { ok: false, message: e?.name === 'AbortError' ? 'El lector tardó demasiado. Prueba otra vez.' : 'No se pudo conectar con el lector.' };
  } finally { clearTimeout(timer); }
}

/** Reduce la foto a 1600 px de lado y JPEG 0,85 (como el preprocesado de la app) y devuelve base64. */
async function shrink(file: File): Promise<string> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bmp.width * scale); canvas.height = Math.round(bmp.height * scale);
  canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
}

// ─── Lotería (pública) ──────────────────────────
export async function publicDraw(game: string, date?: string | null): Promise<DrawRow | null> {
  const { data, error } = await db().rpc('public_lottery_draw', { p_game: game, p_date: date || null });
  if (error) throw error;
  return data as DrawRow | null;
}
export async function latestDraws(): Promise<DrawRow[]> {
  const { data, error } = await db().rpc('public_latest_draws');
  if (error) throw error;
  return (data ?? []) as DrawRow[];
}

// ─── Afiliados (solo web) ───────────────────────
export type Offer = { slug: string; name: string; license: string; verticals: string[]; summary: string | null; terms: string | null };
export type Offers = { enabled: boolean; disclosure?: string; offers: Offer[] };
export type Slot = 'home' | 'compare' | 'partner_page' | 'lottery';

export async function affiliateOffers(slot: Slot): Promise<Offers> {
  const c = supabase();
  if (!c) return { enabled: false, offers: [] };
  const { data, error } = await c.rpc('affiliate_offers', { p_slot: slot });
  return error || !data ? { enabled: false, offers: [] } : data as Offers;
}

export const goUrl = (slug: string, slot: Slot, from: string) =>
  `${SUPABASE_URL}/functions/v1/affiliate-go/${encodeURIComponent(slug)}?slot=${slot}&from=${encodeURIComponent(from)}`;

/**
 * Abre la casa. Con sesión se pide el destino por POST con el token (el clic queda con el usuario y el
 * servidor comprueba su pausa); sin sesión, el enlace GET redirige directamente.
 */
export async function openOffer(slug: string, slot: Slot, from: string) {
  const c = supabase();
  const session = c ? (await c.auth.getSession()).data.session : null;
  if (!session || session.user.is_anonymous) { window.location.href = goUrl(slug, slot, from); return; }
  const res = await fetch(goUrl(slug, slot, from), { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
  const body = await res.json().catch(() => ({}));
  if (body.url) window.location.href = body.url;
  else throw new Error('Esta oferta no está disponible para tu cuenta (pausa, preferencia o cuenta suspendida).');
}
