import type { DrawRow } from '../shared/lib/lotteryDraw';
import { drawFromRow } from '../shared/lib/lotteryDraw';

/** Combinación ganadora de un sorteo: bolas, estrellas y extras (complementario, reintegro, clave). */
export function DrawBalls({ row, hits }: { row: DrawRow; hits?: { numbers?: number[]; stars?: number[] } }) {
  const d = drawFromRow(row);
  const isHit = (n: number, list?: number[]) => (list ? (list.includes(n) ? ' hit' : ' miss') : '');
  return (
    <div className="stack-sm">
      {d.results?.length ? (
        <div className="balls" aria-label={`Resultados: ${d.results.join(', ')}`}>
          {d.results.map((r, i) => <span key={i} className="ball static">{r}</span>)}
        </div>
      ) : (
        <div className="balls" aria-label={`Números: ${d.winningNumbers.join(', ')}`}>
          {d.winningNumbers.map(n => <span key={n} className={`ball static${hits ? isHit(n, hits.numbers) : ''}`}>{n}</span>)}
          {d.winningStars?.map(n => <span key={`s${n}`} className={`ball static star${hits ? isHit(n, hits.stars) : ''}`}>{n}</span>)}
        </div>
      )}
      <div className="row subtle">
        {d.complementario != null && <span>Complementario <b className="mono">{d.complementario}</b></span>}
        {d.reintegro != null && <span>Reintegro <b className="mono">{d.reintegro}</b></span>}
        {d.elKey != null && <span>Clave <b className="mono">{d.elKey}</b></span>}
      </div>
    </div>
  );
}
