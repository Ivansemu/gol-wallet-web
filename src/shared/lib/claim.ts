// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Reclamación a la casa de apuestas cuando no paga (o paga menos) un boleto que según los datos está ganado.
// Funciones puras (sin React Native) para poder testearlas.

export type ClaimSelection = { match: string; bet: string; score: string | null; result: string };
export type ClaimData = {
  operator: string; ticketRef: string | null; placedAt: string | null;
  stake: number; odds: number | null; expected: number; paid: number;
  selections: ClaimSelection[]; owner?: string | null;
};

const eur = (n: number) => `${n.toFixed(2).replace('.', ',')} €`;

export const claimDifference = (d: Pick<ClaimData, 'expected' | 'paid'>) => Math.round((d.expected - d.paid) * 100) / 100;

/** Texto de la reclamación, listo para copiar en la hoja de reclamaciones o en un email a la casa. */
export function claimText(d: ClaimData, now = new Date()): string {
  const diff = claimDifference(d);
  const lines = [
    `Asunto: Reclamación por el pago de un boleto${d.ticketRef ? ` (ref. ${d.ticketRef})` : ''}`,
    '',
    `A la atención de ${d.operator}:`,
    '',
    `Les escribo para reclamar el pago del boleto${d.ticketRef ? ` con referencia ${d.ticketRef}` : ''}${d.placedAt ? `, jugado el ${new Date(d.placedAt).toLocaleDateString('es-ES')}` : ''}, por importe de ${eur(d.stake)}${d.odds ? ` a cuota ${d.odds.toFixed(2).replace('.', ',')}` : ''}.`,
    '',
    'Según los resultados oficiales, todas las selecciones se cumplieron:',
    ...d.selections.map(s => `· ${s.match} — ${s.bet}${s.score ? ` · resultado final ${s.score}` : ''} · ${s.result}`),
    '',
    `El premio que corresponde es de ${eur(d.expected)} y ${d.paid > 0 ? `se me han abonado ${eur(d.paid)}` : 'no se me ha abonado ninguna cantidad'}. La diferencia reclamada es de ${eur(diff)}.`,
    '',
    'Les ruego que revisen la liquidación y me abonen la diferencia, o que me indiquen por escrito el motivo concreto (regla del mercado aplicada) si consideran que no corresponde.',
    '',
    `Conservo el boleto original.${d.owner ? `\n\n${d.owner}` : ''}`,
    `Fecha: ${now.toLocaleDateString('es-ES')}`,
  ];
  return lines.join('\n');
}

/** Dónde reclamar según sea en tienda o por internet. */
export const CLAIM_STEPS = {
  tienda: [
    'Habla primero con el encargado del local con el boleto en la mano: muchos errores se corrigen ahí.',
    'Si no lo arreglan, pide la hoja de reclamaciones oficial (están obligados a dártela) y copia este texto.',
    'Quédate con tu copia sellada. Si en un mes no responden, llévala al servicio de consumo o de juego de tu comunidad autónoma.',
  ],
  online: [
    'Escribe al servicio de atención al cliente de la casa con este texto y guarda el número de incidencia.',
    'Si en un mes no responden o no estás de acuerdo, puedes reclamar ante la Dirección General de Ordenación del Juego (ordenacionjuego.es → Atención al jugador).',
  ],
} as const;
