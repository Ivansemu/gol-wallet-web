'use client';
// Ofertas de casas con licencia (afiliación). Solo en páginas públicas: nunca en la cartera privada.
// Antes de enseñar nada: interruptor del servidor encendido, sin pausa ni «no ver ofertas», y el visitante
// confirma que es mayor de 18 años. Si algo falla, no se enseña nada (no hay ofertas de ejemplo).
import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { BadgeCheck, ExternalLink, Info, ShieldAlert } from 'lucide-react';
import { affiliateOffers, openOffer, type Offers as OffersData, type Slot } from '../lib/api';
import { Cut, Receipt, ReceiptHead } from './receipt';

const AGE_KEY = 'golwallet-mayor-18';
const readAge = (): 'yes' | 'no' | null => { try { return localStorage.getItem(AGE_KEY) as any; } catch { return null; } };
const saveAge = (v: 'yes' | 'no') => { try { localStorage.setItem(AGE_KEY, v); } catch { /* sin almacenamiento: se vuelve a preguntar */ } };

const VERTICAL: Record<string, string> = { sports: 'Deportes', lottery: 'Lotería', casino: 'Casino' };

export function Offers({ slot, title = 'Casas con licencia en España', intro }: { slot: Slot; title?: string; intro?: string }) {
  const path = usePathname() ?? '/';
  const [data, setData] = useState<OffersData | null>(null);
  const [age, setAge] = useState<'yes' | 'no' | null>(null);
  const [error, setError] = useState('');
  useEffect(() => { setAge(readAge()); void affiliateOffers(slot).then(setData); }, [slot]);

  if (!data?.enabled || !data.offers.length || age === 'no') return null;

  if (age !== 'yes') {
    return (
      <section className="section" aria-labelledby={`ofertas-${slot}`}>
        <Receipt flat>
          <ReceiptHead left="Solo mayores de edad" right="+18" />
          <h2 id={`ofertas-${slot}`} className="heading" style={{ fontSize: 20, margin: '10px 0' }}>{title}</h2>
          <p>Para ver las casas de apuestas con licencia tienes que ser mayor de 18 años.</p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => { saveAge('yes'); setAge('yes'); }}>Tengo 18 años o más</button>
            <button className="btn ghost" onClick={() => { saveAge('no'); setAge('no'); }}>Soy menor</button>
          </div>
        </Receipt>
      </section>
    );
  }

  return (
    <section className="section stack" aria-labelledby={`ofertas-${slot}`}>
      <div className="stack-sm">
        <h2 id={`ofertas-${slot}`}>{title}</h2>
        {intro ? <p className="muted">{intro}</p> : null}
        <p className="disclosure"><Info size={16} aria-hidden /> {data.disclosure ?? 'Enlaces de afiliación.'}</p>
      </div>
      <div className="grid-3">
        {data.offers.map(o => (
          <Receipt key={o.slug} className="offer">
            <ReceiptHead left={o.verticals.map(v => VERTICAL[v] ?? v).join(' · ')} right="+18" />
            <h3 className="heading" style={{ fontSize: 20 }}>{o.name}</h3>
            <p className="license"><BadgeCheck size={14} aria-hidden style={{ verticalAlign: -2 }} /> {o.license}</p>
            {o.summary ? <p style={{ fontSize: 14 }}>{o.summary}</p> : null}
            {o.terms ? <><Cut /><p style={{ fontSize: 12 }} className="mono">{o.terms}</p></> : null}
            <button className="btn block" onClick={() => openOffer(o.slug, slot, path).catch(e => setError(e.message))}>
              Ir a {o.name} <ExternalLink size={16} aria-hidden />
            </button>
          </Receipt>
        ))}
      </div>
      {error ? <p className="error" role="alert"><ShieldAlert size={16} aria-hidden /> {error}</p> : null}
      <p className="subtle">+18 · Juega con responsabilidad · <a href="https://www.jugarbien.es" rel="noopener" target="_blank">jugarbien.es</a>. Puedes ocultar estas ofertas desde tu perfil.</p>
    </section>
  );
}
