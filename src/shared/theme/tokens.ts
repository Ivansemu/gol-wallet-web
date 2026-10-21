// COPIA de winzo-app (scripts/sync-shared.mjs). No editar aquí: cambia la app y vuelve a sincronizar.
const Platform = { select: <T,>(o: { web?: T; default?: T; ios?: T; android?: T }): T | undefined => o.web ?? o.default ?? o.ios };

// Gol-Wallet · tokens de la dirección «Recibo» (lienzo «Gol-Wallet · Rediseño», Dirección 4).
// Verde noche de fondo, boletos como tiques de papel, cifras en monoespaciada y rotulador lima / oro.
// Única fuente de color: ninguna pantalla usa hex sueltos. Claro y oscuro por sección.

export type ThemeName = 'sport' | 'lottery';
export const DEFAULT_SCHEME = 'light' as const;
export const stadium = { ink: '#06120B', night: '#0A1A11', top: '#0A1A11', lotteryTop: '#0A1A11', dock: '#13261A' } as const;

/** Papel de los tiques (Recibo): fondo, tinta, tinta suave, puntos de guía y corte. */
export const paper = { bg: '#F2EEE3', ink: '#1A1A17', muted: '#5C5A52', rule: '#B9B4A6', ruleSoft: '#CFCAB9', segment: '#E6E1D3' } as const;

export type Scheme = 'light' | 'dark';

type Tone = { fg: string; bg: string; dot: string };
export type StatusColors = { open: Tone; won: Tone; lost: Tone; void: Tone; live: Tone; warn: Tone; cashout: Tone };

const statusLight: StatusColors = {
  open: { fg: '#1D5FD1', bg: '#E7EFFD', dot: '#1D5FD1' },
  won: { fg: '#137A3F', bg: '#E2F4E8', dot: '#137A3F' },
  lost: { fg: '#C2362B', bg: '#FCE9E7', dot: '#C2362B' },
  void: { fg: '#59626E', bg: '#EDEFF2', dot: '#59626E' },
  live: { fg: '#C2410C', bg: '#FFEDE3', dot: '#C2410C' },
  warn: { fg: '#8A5A00', bg: '#FFF4D6', dot: '#8A5A00' },
  // Cash out: no está en el diseño; turquesa para no chocar con «abierta» (azul)
  cashout: { fg: '#0B6F64', bg: '#DFF3EF', dot: '#0B6F64' },
};
const statusDark: StatusColors = {
  open: { fg: '#7FA8FF', bg: '#18264A', dot: '#7FA8FF' },
  won: { fg: '#5DD394', bg: '#12301F', dot: '#5DD394' },
  lost: { fg: '#FF8A7E', bg: '#3A1714', dot: '#FF8A7E' },
  void: { fg: '#A3ABB6', bg: '#23272D', dot: '#A3ABB6' },
  live: { fg: '#FF9452', bg: '#3A1E0E', dot: '#FF9452' },
  warn: { fg: '#F2C14E', bg: '#33270A', dot: '#F2C14E' },
  cashout: { fg: '#4FD1C0', bg: '#0F2E2A', dot: '#4FD1C0' },
};

const onHero = {
  text: '#FFFFFF',
  muted: 'rgba(255,255,255,0.72)',
  label: 'rgba(255,255,255,0.78)',
  glass: 'rgba(255,255,255,0.14)',
  glassSoft: 'rgba(255,255,255,0.08)',
  divider: 'rgba(255,255,255,0.18)',
};

export type Palette = {
  surface: string; white: string; status: StatusColors; onHero: typeof onHero;
  primary: string; onPrimary: string; primaryDeep: string; tint: string; tintInk: string;
  /** Cifra destacada sobre el hero oscuro (lima / oro). */
  heroAccent: string;
  /** Fondo del hero «marcador» de la sección. */
  hero: string;
  bg: string; segmentBg: string; ink: string; inkMuted: string; inkSubtle: string;
  line: string; lineStrong: string;
  /** Icono del botón central de escanear. */
  scanIcon: string;
  /** Texto de enlaces y foco de campos. */
  link: string;
  /** «Rotulador» que subraya el dato clave del tique (lima en Deportes, oro en Lotería). */
  marker: string;
};

export const palettesByScheme: Record<ThemeName, Record<Scheme, Palette>> = {
  sport: {
    light: {
      surface: '#FFFFFF', white: '#FFFFFF', status: statusLight, onHero,
      primary: '#0E2B1F', onPrimary: '#FFFFFF', primaryDeep: '#0A1F16', tint: '#E8F5CC', tintInk: '#33500A',
      heroAccent: '#C4F03A', hero: '#0A1F16',
      bg: '#F2F4F1', segmentBg: '#E3E8E2', ink: '#0F1A14', inkMuted: '#46544B', inkSubtle: '#68766D',
      line: '#E0E5DF', lineStrong: '#C6CEC5', scanIcon: '#0A1F16', link: '#0E2B1F', marker: '#C4F03A',
    },
    dark: {
      surface: '#13261A', white: '#FFFFFF', status: statusDark, onHero,
      primary: '#C4F03A', onPrimary: '#0A1F16', primaryDeep: '#132A1E', tint: '#1F2C10', tintInk: '#D5F27A',
      heroAccent: '#C4F03A', hero: '#13261A',
      bg: '#0A1A11', segmentBg: '#1C3324', ink: '#EEF3EF', inkMuted: '#AAB6AE', inkSubtle: '#8C9990',
      line: '#22392A', lineStrong: '#2A4031', scanIcon: '#0A1F16', link: '#C4F03A', marker: '#C4F03A',
    },
  },
  lottery: {
    light: {
      surface: '#FFFFFF', white: '#FFFFFF', status: statusLight, onHero,
      primary: '#0E2B1F', onPrimary: '#FFFFFF', primaryDeep: '#0A1F16', tint: '#FFF3D1', tintInk: '#6B4A00',
      heroAccent: '#FFC83D', hero: '#0A1F16',
      bg: '#F4F3EE', segmentBg: '#E8E6DC', ink: '#0F1A14', inkMuted: '#46544B', inkSubtle: '#68766D',
      line: '#E3E1D8', lineStrong: '#CBC8BB', scanIcon: '#1A1400', link: '#0E2B1F', marker: '#FFC83D',
    },
    dark: {
      surface: '#13261A', white: '#FFFFFF', status: statusDark, onHero,
      primary: '#FFC83D', onPrimary: '#1A1400', primaryDeep: '#132A1E', tint: '#2E2610', tintInk: '#FFD877',
      heroAccent: '#FFC83D', hero: '#13261A',
      bg: '#0A1A11', segmentBg: '#1C3324', ink: '#EEF3EF', inkMuted: '#AAB6AE', inkSubtle: '#8C9990',
      line: '#22392A', lineStrong: '#2A4031', scanIcon: '#1A1400', link: '#FFC83D', marker: '#FFC83D',
    },
  },
};

// Sobre el papel, los estados se imprimen en tinta de color (≥ 4,5:1 sobre el papel).
const statusPaper: StatusColors = { ...statusLight, live: { fg: '#B03A09', bg: '#FFEDE3', dot: '#B03A09' } };
const onPaper = {
  text: paper.ink, muted: paper.muted, label: paper.muted,
  glass: 'rgba(26,26,23,0.08)', glassSoft: 'rgba(26,26,23,0.05)', divider: paper.rule,
};

/**
 * Paleta dentro de un tique de papel: tinta oscura sobre papel, sea cual sea el modo.
 * La usa `PaperScope`, así cualquier componente dentro de un tique se lee sin tocarlo.
 */
export const paperPalettes: Record<ThemeName, Palette> = {
  sport: {
    surface: paper.bg, white: '#FFFFFF', status: statusPaper, onHero: onPaper,
    primary: '#0E2B1F', onPrimary: '#FFFFFF', primaryDeep: '#0A1F16', tint: '#E8F5CC', tintInk: '#33500A',
    heroAccent: '#0E2B1F', hero: paper.bg,
    bg: paper.bg, segmentBg: paper.segment, ink: paper.ink, inkMuted: paper.muted, inkSubtle: '#6B685F',
    line: paper.ruleSoft, lineStrong: paper.rule, scanIcon: '#0A1F16', link: '#0E2B1F', marker: '#C4F03A',
  },
  lottery: {
    surface: paper.bg, white: '#FFFFFF', status: statusPaper, onHero: onPaper,
    primary: '#0E2B1F', onPrimary: '#FFFFFF', primaryDeep: '#0A1F16', tint: '#FFF3D1', tintInk: '#6B4A00',
    heroAccent: '#6B4A00', hero: paper.bg,
    bg: paper.bg, segmentBg: paper.segment, ink: paper.ink, inkMuted: paper.muted, inkSubtle: '#6B685F',
    line: paper.ruleSoft, lineStrong: paper.rule, scanIcon: '#1A1400', link: '#0E2B1F', marker: '#FFC83D',
  },
};

/**
 * Color pensado para el fondo oscuro → su tinta equivalente sobre el papel (estados, acento, texto del panel).
 * Para las cifras que una pantalla colorea por fuera y se pintan dentro de un tique.
 */
export function toPaperInk(color: string): string {
  for (const sec of Object.values(palettesByScheme)) {
    for (const pal of Object.values(sec)) {
      for (const k of Object.keys(pal.status) as (keyof StatusColors)[]) if (pal.status[k].fg === color) return statusPaper[k].fg;
      if (color === pal.heroAccent || color === pal.marker || color === pal.onHero.text || color === pal.ink) return paper.ink;
      if (color === pal.onHero.muted || color === pal.onHero.label || color === pal.inkMuted || color === pal.inkSubtle) return paper.muted;
    }
  }
  return color;
}

/** Paletas claras (las pantallas que aún no usan useTheme leen estas). */
export const palettes = { sport: palettesByScheme.sport.light, lottery: palettesByScheme.lottery.light };

/** Colores por juego de lotería (texto blanco encima ≥ 4,5:1) y estrellas. */
export const lotteryGameColors: Record<string, string> = {
  euromillones: '#1F4FD1', primitiva: '#0E7A45', bonoloto: '#B5600B', gordo: '#B42318', once: '#0B6F64',
  eurodreams: '#6D35C9', loteria_nacional: '#7A5A0E', quiniela: '#A0275F', quinigol: '#2B3A55', unknown_lottery: '#59626E',
};
export const lotteryStar = { bg: '#FFC83D', fg: '#3A2A00', border: '#E3A916' } as const;

/** Series de gráficas aptas para daltonismo. Orden fijo, nunca rotar. */
export const chartSeries: Record<Scheme, readonly string[]> = {
  light: ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#56B4E9', '#CC79A7'],
  dark: ['#3D8FD6', '#BF8200', '#14A07A', '#DB6428', '#479CD2', '#BF73A3'],
};

export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24 } as const;
export const radius = { xs: 6, sm: 8, md: 14, button: 16, card: 16, lg: 20, sheet: 28, pill: 999 } as const;
export const hitSlop = 44; // objetivo táctil mínimo
export const TAB_BAR_HEIGHT = 62; // alto de la barra inferior flotante (píldora y botón de escanear)
export const layout = { maxContentWidth: 720, statsTwoColumnsFrom: 780 } as const;
export const motion = { fast: 150, base: 240, sheet: 280, emphasis: 600 } as const;

export const fonts = {
  /** Títulos (Recibo): Sora 800 en minúsculas. */
  heading: 'Sora_800ExtraBold',
  /** Cifras de tique: JetBrains Mono, como una impresora térmica. */
  mono: 'JetBrainsMono_500Medium',
  monoBold: 'JetBrainsMono_700Bold',
  figure: 'JetBrainsMono_800ExtraBold',
  display: 'Sora_700Bold',
  displayExtra: 'Sora_800ExtraBold',
  displaySemi: 'Sora_600SemiBold',
  body: 'Manrope_500Medium',
  bodySemi: 'Manrope_600SemiBold',
  bodyBold: 'Manrope_700Bold',
  bodyExtra: 'Manrope_800ExtraBold',
} as const;

const tnum = { fontVariant: ['tabular-nums' as const] };

export const type = {
  display: { fontFamily: fonts.heading, fontSize: 36, lineHeight: 42, letterSpacing: -1 },
  title: { fontFamily: fonts.heading, fontSize: 24, lineHeight: 30, letterSpacing: -0.5 },
  heading: { fontFamily: fonts.heading, fontSize: 18, lineHeight: 22, letterSpacing: -0.2 },
  value: { fontFamily: fonts.figure, fontSize: 17, lineHeight: 22, ...tnum },
  valueLg: { fontFamily: fonts.figure, fontSize: 22, lineHeight: 28, ...tnum },
  /** Cifra grande del tique (premio, balance), en mono. */
  hero: { fontFamily: fonts.figure, fontSize: 40, lineHeight: 48, letterSpacing: -0.8, ...tnum },
  body: { fontFamily: fonts.bodySemi, fontSize: 15, lineHeight: 22 },
  bodySm: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bodyBold, fontSize: 14, lineHeight: 20 },
  /** Rótulo de tique en mono y mayúsculas (PREMIO POSIBLE, RESUMEN · DEPORTES…). */
  overline: { fontFamily: fonts.figure, fontSize: 11, lineHeight: 14, letterSpacing: 1.1, textTransform: 'uppercase' as const },
  caption: { fontFamily: fonts.bodySemi, fontSize: 12, lineHeight: 16 },
  tab: { fontFamily: fonts.bodyBold, fontSize: 11, lineHeight: 14 },
  button: { fontFamily: fonts.bodyExtra, fontSize: 16, lineHeight: 20 },
  /** Línea de tique «Etiqueta ······ valor». */
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 22 },
} as const;

export const shadow = {
  card: { shadowColor: '#0F1A14', shadowOpacity: 0.06, shadowRadius: 2, shadowOffset: { width: 0, height: 1 }, elevation: 1 },
  md: { shadowColor: '#0F1A14', shadowOpacity: 0.1, shadowRadius: 9, shadowOffset: { width: 0, height: 6 }, elevation: 4 },
  float: { shadowColor: '#0F1A14', shadowOpacity: 0.18, shadowRadius: 15, shadowOffset: { width: 0, height: 10 }, elevation: 8 },
} as const;

/** Color de la paleta con transparencia: alpha('#0D7F6F', 0.1) → 'rgba(13,127,111,0.1)'. */
export function alpha(hex: string, a: number) {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h.slice(0, 6), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

/** Colores fijos que no dependen del tema (medallas, juegos, info, directo, cámara). */
export const accents = {
  white: '#FFFFFF',
  black: '#000000',
  /** Velo oscuro sobre la cámara y en ilustraciones. */
  night: '#0F172A',
  nightSoft: '#1E293B',
  info: '#2563EB',
  live: '#EA580C',
  /** Series categóricas de las gráficas, en orden fijo (validado para daltonismo: no reordenar). */
  chart: ['#2A78D6', '#EB6834', '#1BAF7A', '#EDA100', '#E87BA4', '#4A3AA7'],
  /** Punto medio neutro de escalas divergentes (mapa de calor). */
  chartNeutral: '#F0EFEC',
  lightPrimary: { sport: '#14A08C', lottery: '#8B63E6' },
  medal: { gold: '#F5B301', silver: '#94A3B8', bronze: '#C2733A' },
  /** Colores de acento para patrocinios (sin uso: no hay publicidad de casas de apuestas). */
  sponsor: { green: '#15803D', gold: '#CA8A04', red: '#E4002B', blue: '#4781C1', purple: '#7E22CE', violet: '#9333EA' },
  game: {
    euromillones: '#2563EB',
    primitiva: '#059669',
    bonoloto: '#0891B2',
    gordo: '#EA580C',
    once: '#DB2777',
    eurodreams: '#7C3AED',
    loteria_nacional: '#B45309',
    quiniela: '#15803D',
    quinigol: '#0D9488',
    unknown_lottery: '#64748B',
  } as Record<string, string>,
} as const;

/** Tipografías completas (kit + pesos extra usados por pantallas antiguas). */
export const fontWeights = {
  regular: 'Manrope_400Regular',
  medium: fonts.body,
  semi: fonts.bodySemi,
  bold: fonts.bodyBold,
  display: fonts.display,
} as const;

// ─── RAW PALETTE ──────────────────────────────────────────────────────────────
// Derivada de `palettes` (kit): cambiar un color allí lo cambia en toda la app.
const S = palettes.sport;
const L = palettes.lottery;
const RAW = {
  void:    S.bg,
  ink:     S.segmentBg,
  abyss:   S.bg,
  card:    S.surface,
  deep:    S.surface,
  surface: S.surface,
  raised:  S.bg,
  panel:   S.segmentBg,

  gold:      S.primary,
  goldLight: accents.lightPrimary.sport,
  goldMid:   S.primary,
  goldDark:  S.primaryDeep,
  goldInk:   S.white,

  green:     S.status.won.dot,
  greenDeep: S.status.won.fg,
  red:       S.status.lost.dot,
  redDeep:   S.status.lost.fg,
  liveRed:   S.status.lost.dot,
  liveOrange: accents.live,
  orange:    accents.live,
  amber:     S.status.open.dot,
  blue:      accents.info,

  teal:      S.primary,
  tealDark:  S.primaryDeep,
  tealLight: accents.lightPrimary.sport,
  tealInk:   S.white,

  violet:      L.primary,
  violetDark:  L.primaryDeep,
  violetLight: accents.lightPrimary.lottery,
  violetInk:   L.white,
} as const;

// ─── TYPOGRAPHY PRESETS ───────────────────────────────────────────────────────
// Complete text style objects — use spread: { ...TYPE.heading, color: C.text }
export const TYPE = {
  display: {
    fontFamily: fonts.display,
    fontSize: 48,
    lineHeight: 54,
    letterSpacing: -1.5,
  },
  hero: {
    fontFamily: fonts.display,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: -1.0,
  },
  title: {
    fontFamily: fonts.bodyBold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.8,
  },
  heading: {
    fontFamily: fonts.bodyBold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.5,
  },
  subheading: {
    fontFamily: fonts.bodySemi,
    fontSize: 18,
    lineHeight: 24,
    letterSpacing: -0.3,
  },
  body: {
    fontFamily: fonts.body,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: -0.2,
  },
  bodySmall: {
    fontFamily: fonts.body,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  caption: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0.1,
  },
  label: {
    fontFamily: fonts.bodySemi,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.7,
    textTransform: 'uppercase' as const,
  },
  micro: {
    fontFamily: fonts.bodySemi,
    fontSize: 10,
    lineHeight: 13,
    letterSpacing: 1.0,
    textTransform: 'uppercase' as const,
  },
  numHero: {
    fontFamily: fonts.display,
    fontSize: 40,
    lineHeight: 44,
    letterSpacing: -1.2,
  },
  numLg: {
    fontFamily: fonts.display,
    fontSize: 24,
    lineHeight: 28,
    letterSpacing: -0.6,
  },
  numSm: {
    fontFamily: fonts.bodyBold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: -0.3,
  },
} as const;

// ─── DESIGN SYSTEM TOKENS ─────────────────────────────────────────────────────
export const DSN = {

  // ── Colors ──────────────────────────────────────────────────────────────────
  color: {
    // Backgrounds — 7-step elevation scale
    bg:          RAW.void,       // root screen background
    bgDeep:      RAW.ink,        // deepest inset
    bgAlt:       RAW.abyss,      // subtle variant
    cardBg:      RAW.card,       // primary card surface
    surface:     RAW.surface,    // elevated card
    surfaceAlt:  RAW.raised,     // modal / sheet
    panel:       RAW.panel,      // highest elevation
    overlay:     alpha(S.ink, 0.45),

    // Brand
    brand:       RAW.gold,
    brandLight:  RAW.goldLight,
    brandMid:    RAW.goldMid,
    brandDark:   RAW.goldDark,
    brandSoft:   alpha(S.primary, 0.10),
    brandGlow:   alpha(S.primary, 0.08),
    brandInk:    RAW.goldInk,

    // Status — semáforo: verde ganado, rojo perdido, ámbar pendiente
    won:         RAW.green,
    wonSoft:     alpha(RAW.green, 0.10),
    wonGlow:     alpha(RAW.green, 0.16),
    lost:        RAW.red,
    lostSoft:    alpha(RAW.red, 0.09),
    lostGlow:    alpha(RAW.red, 0.16),
    live:        RAW.liveOrange,
    liveSoft:    alpha(RAW.orange, 0.10),
    liveGlow:    alpha(RAW.orange, 0.18),
    pending:     RAW.amber,
    pendingSoft: alpha(RAW.amber, 0.11),
    pendingGlow: alpha(RAW.amber, 0.18),
    info:        RAW.blue,
    infoSoft:    alpha(RAW.blue, 0.09),
    infoGlow:    alpha(RAW.blue, 0.16),

    // Text — slate sobre fondo claro
    text:         S.ink,
    textSub:      S.inkMuted,
    textMuted:    S.inkMuted,
    textDisabled: S.inkSubtle,

    // Borders
    border:       S.line,
    borderMid:    S.line,
    borderStrong: S.lineStrong,
    borderBrand:  alpha(S.primary, 0.28),
    borderLive:   alpha(RAW.orange, 0.28),

    // Glass — rellenos sutiles sobre blanco
    glass:        S.bg,
    glassMid:     S.bg,
    glassHigh:    S.segmentBg,
  },

  // ── Section accent shortcuts (full palettes in sectionThemes.ts) ─────────────
  section: {
    sports: {
      brand:      RAW.teal,
      brandLight: RAW.tealLight,
      brandDark:  RAW.tealDark,
      brandInk:   RAW.tealInk,
      soft:       alpha(S.primary, 0.10),
      glow:       alpha(S.primary, 0.08),
      border:     alpha(S.primary, 0.28),
    },
    lottery: {
      brand:      RAW.violet,
      brandLight: RAW.violetLight,
      brandDark:  RAW.violetDark,
      brandInk:   RAW.violetInk,
      soft:       alpha(L.primary, 0.09),
      glow:       alpha(L.primary, 0.07),
      border:     alpha(L.primary, 0.26),
    },
  },

  // ── Typography ───────────────────────────────────────────────────────────────
  font: {
    r:  fontWeights.regular,
    m:  fonts.body,
    sb: fonts.bodySemi,
    b:  fonts.bodyBold,
    xb: fonts.heading,
  },

  // ── Font sizes (raw) ─────────────────────────────────────────────────────────
  size: {
    xs:  10,
    sm:  12,
    md:  14,
    lg:  16,
    xl:  18,
    xl2: 22,
    xl3: 28,
    xl4: 36,
    xl5: 48,
  },

  // ── Spacing (4px base grid) ──────────────────────────────────────────────────
  space: {
    1:  4,
    2:  8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    7:  28,
    8:  32,
    10: 40,
    12: 48,
    16: 64,
  },

  // ── Border radius ────────────────────────────────────────────────────────────
  radius: {
    xs:   4,
    sm:   8,
    md:   12,
    lg:   16,
    xl:   20,
    xl2:  26,
    xl3:  32,
    pill: 999,
  },

  // ── Icon sizes ───────────────────────────────────────────────────────────────
  icon: {
    xs:  14,
    sm:  18,
    md:  22,
    lg:  28,
    xl:  36,
    xl2: 48,
  },

  // ── Z-index ──────────────────────────────────────────────────────────────────
  z: {
    base:    0,
    raised:  10,
    floating: 20,
    overlay: 30,
    modal:   40,
    toast:   50,
    scanner: 60,
  },

  // ── Shadows ──────────────────────────────────────────────────────────────────
  shadow: {
    brand: Platform.select({
      ios:     { shadowColor: RAW.gold,   shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      default: {},
    }),
    card: Platform.select({
      ios:     { shadowColor: S.ink,  shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
      android: { elevation: 2 },
      default: {},
    }),
    won: Platform.select({
      ios:     { shadowColor: RAW.green,  shadowOpacity: 0.20, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 3 },
      default: {},
    }),
    soft: Platform.select({
      ios:     { shadowColor: S.ink,  shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } },
      android: { elevation: 1 },
      default: {},
    }),
    sports: Platform.select({
      ios:     { shadowColor: RAW.teal,   shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      default: {},
    }),
    lottery: Platform.select({
      ios:     { shadowColor: RAW.violet, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      default: {},
    }),
    live: Platform.select({
      ios:     { shadowColor: RAW.liveOrange, shadowOpacity: 0.22, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 4 },
      default: {},
    }),
  },

} as const;

// ─── LEGACY ALIAS — backward-compat with older screens ────────────────────────
export const T = {
  colors: {
    bg:          DSN.color.bg,
    bgSoft:      DSN.color.bgAlt,
    brand:       DSN.color.brand,
    brandSoft:   DSN.color.brandSoft,
    brandInk:    DSN.color.brandInk,
    success:     DSN.color.won,
    successSoft: DSN.color.wonSoft,
    danger:      DSN.color.lost,
    dangerSoft:  DSN.color.lostSoft,
    warning:     DSN.color.pending,
    warningSoft: DSN.color.pendingSoft,
    card:        DSN.color.glass,
    border:      DSN.color.border,
    hair:        DSN.color.border,
    ink:         S.ink,
    inkSoft:     S.inkMuted,
    muted:       DSN.color.textMuted,
  },
  font:   DSN.font,
  radius: { xl: 20, lg: 16, md: 12, sm: 8, xs: 6, pill: 999 },
  space:  DSN.space,
  shadow: DSN.shadow,
};

