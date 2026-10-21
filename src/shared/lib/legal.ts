// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
// Textos legales de Gol-Wallet: una sola fuente (legal.json) para la app y la web pública.
// La web (privacidad.html, borrar-cuenta.html) se genera con: node scripts/build-legal-pages.cjs
import data from './legal.json';

export type LegalSection = { title: string; paragraphs: string[] };

export const LEGAL = data;

/** Sustituye {owner.name}, {owner.email}… por los datos del titular. */
export const fillLegal = (text: string) =>
  text.replace(/\{owner\.(\w+)\}/g, (_, k: keyof typeof data.owner) => data.owner[k] ?? '');

/** Los datos del titular aún tienen huecos ([NIF]…): no se puede publicar en las tiendas así. */
export const LEGAL_INCOMPLETE = Object.values(data.owner).some(v => /^\[.*\]$/.test(v));

/** Email de contacto, solo si ya está rellenado. */
export const CONTACT_EMAIL = /^\[.*\]$/.test(data.owner.email) ? '' : data.owner.email;
