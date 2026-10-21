'use client';
import { useEffect, useState } from 'react';

/** Parámetro de la URL (?id=…) leído en el navegador: la web es estática, sin servidor que lo resuelva. */
export function useQuery(name: string): string | null | undefined {
  const [v, setV] = useState<string | null | undefined>(undefined);
  useEffect(() => { setV(new URLSearchParams(window.location.search).get(name)); }, [name]);
  return v;
}

/** Solo rutas internas para ?next= (evita redirecciones abiertas). */
export const safeNext = (n: string | null | undefined, fallback = '/cartera/') => (n && /^\/[a-z0-9\-/]*$/i.test(n) ? n : fallback);
