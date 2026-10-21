'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { latestDraws } from '../lib/api';
import { backendConfigured } from '../lib/supabase';
import type { DrawRow } from '../shared/lib/lotteryDraw';
import { gameName } from '../shared/lib/lotteryGames';
import { DrawBalls } from '../components/DrawBalls';
import { Receipt, ReceiptHead } from '../components/receipt';

/** Últimos sorteos cargados en el servidor (los mismos que usa la app). Sin datos no se enseña nada. */
export function LatestDraws() {
  const [rows, setRows] = useState<DrawRow[] | null>(null);
  useEffect(() => { if (backendConfigured()) latestDraws().then(setRows).catch(() => setRows([])); }, []);
  if (!rows?.length) return null;
  return (
    <section className="section stack" data-section="lottery" aria-labelledby="sorteos">
      <div className="between"><h2 id="sorteos">Últimos sorteos</h2><Link href="/loteria/" className="btn ghost sm">Comprobar mi boleto</Link></div>
      <div className="grid-3">
        {rows.slice(0, 6).map(r => (
          <Receipt key={r.game}>
            <ReceiptHead left={gameName(r.game)} right={new Date(r.draw_date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
            <div style={{ marginTop: 12 }}><DrawBalls row={r} /></div>
          </Receipt>
        ))}
      </div>
    </section>
  );
}
