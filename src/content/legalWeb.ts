// Textos legales de la web: los mismos de la app (src/shared/lib/legal.json) con lo propio de la web
// (enlaces de afiliación, registro de clics, almacenamiento local). Revisar con asesoría antes de publicar.
import { LEGAL, fillLegal, type LegalSection } from '../shared/lib/legal';

const APP_NO_ADS = 'No incluye publicidad de operadores de juego ni enlaces para apostar.';
const WEB_ADS = 'La app no incluye publicidad de operadores de juego. La web pública puede mostrar enlaces de afiliación a operadores con licencia de la DGOJ (ver «Cómo nos financiamos»); nunca dentro de tu cartera.';

const fill = (sections: LegalSection[]) => sections.map(s => ({ title: fillLegal(s.title), paragraphs: s.paragraphs.map(fillLegal) }));

export const AFFILIATE_SECTIONS: LegalSection[] = [
  { title: 'Cómo nos financiamos', paragraphs: [
    'Gol-Wallet es gratuita. Para mantenerla, la web pública (no la app) puede incluir enlaces de afiliación a operadores de juego con licencia de la Dirección General de Ordenación del Juego. Si te registras en uno de ellos a través de nuestro enlace, el operador puede pagarnos una comisión. A ti no te cuesta nada ni cambia las condiciones.',
    'Solo enlazamos operadores con licencia vigente en España, que revisamos a mano. Las ofertas se muestran únicamente en páginas públicas, a quien confirma ser mayor de 18 años, y nunca en tu cartera, tu historial ni tus estadísticas.',
    'Si tienes una pausa activa, has pedido no ver ofertas o tu cuenta está suspendida, no te mostramos ninguna. Puedes ocultarlas siempre desde tu perfil.',
    'Las comunicaciones comerciales se ajustan al Real Decreto 958/2020, de comunicaciones comerciales de las actividades de juego.',
  ] },
];

export const WEB_PRIVACY_SECTIONS: LegalSection[] = [
  { title: 'Lo que guarda la web', paragraphs: [
    'La web usa la misma cuenta que la app: los boletos que añades aquí se guardan en el mismo servidor y aparecen en tu móvil.',
    'Cuando pulsas un enlace de afiliación registramos qué casa, desde qué página, la fecha, tu usuario si has iniciado sesión y un resumen cifrado e irreversible de tu dirección IP (no la IP). Sirve para cuadrar las comisiones con los operadores y para contar visitantes únicos. Se borra a los 13 meses. Base jurídica: interés legítimo en financiar el servicio. No compartimos estos datos con los operadores.',
    'Las fotos que subes para leer un boleto se envían a nuestro lector solo para extraer los datos y no se guardan.',
  ] },
];

export const COOKIE_SECTIONS: LegalSection[] = [
  { title: 'Cookies y almacenamiento local', paragraphs: [
    'La web no usa cookies de publicidad ni de analítica de terceros.',
    'Guarda en tu navegador (almacenamiento local) tu sesión, para que no tengas que entrar cada vez, y si has confirmado que eres mayor de 18 años para ver ofertas. Son necesarios para el servicio que pides y no requieren consentimiento. Puedes borrarlos desde tu navegador o cerrando sesión.',
    'Al pulsar un enlace de afiliación sales a la web del operador, que aplica su propia política de cookies.',
  ] },
];

export function webTerms(): LegalSection[] {
  return [...fill(LEGAL.terms.map(s => ({ ...s, paragraphs: s.paragraphs.map(p => p.replace(APP_NO_ADS, WEB_ADS)) }))), ...AFFILIATE_SECTIONS];
}
export const webPrivacy = (): LegalSection[] => [...fill(LEGAL.privacy), ...WEB_PRIVACY_SECTIONS, ...fill(LEGAL.deletion)];
export const legalUpdated = LEGAL.updated;
