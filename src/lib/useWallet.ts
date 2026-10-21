'use client';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { myWallet, mySafety, watchMySlips, type Safety } from './api';
import { useAuth } from '../components/auth';
import { summarizeTickets, type SportsTicket } from '../shared/lib/sportsTickets';
import type { RemoteSlip } from '../shared/types/remote';

/** Boletos del servidor con su estado, al día en tiempo real (worker, backoffice y la app). */
export function useWallet() {
  const { user } = useAuth();
  const [tickets, setTickets] = useState<SportsTicket[] | null>(null);
  const [remote, setRemote] = useState<Record<string, RemoteSlip>>({});
  const [safety, setSafety] = useState<Safety | null>(null);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try {
      const w = await myWallet();
      setTickets(w.tickets); setRemote(w.remote); setError('');
    } catch (e: any) { setError(e?.message ?? 'No se pudieron leer tus boletos.'); setTickets(t => t ?? []); }
    mySafety().then(setSafety).catch(() => setSafety(null));
  }, []);
  useEffect(() => {
    if (!user) return;
    void load();
    let t: ReturnType<typeof setTimeout> | undefined;
    const stop = watchMySlips(user.id, () => { clearTimeout(t); t = setTimeout(() => void load(), 600); });
    const poll = setInterval(() => void load(), 120_000);
    return () => { stop(); clearInterval(poll); clearTimeout(t); };
  }, [user, load]);
  const stats = useMemo(() => summarizeTickets(tickets ?? []), [tickets]);
  const paused = !!safety?.pause_until && Date.parse(safety.pause_until) > Date.now();
  return { tickets, remote, stats, safety, paused, error, reload: load };
}
