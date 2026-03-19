'use client';
// ════════════════════════════════════════════════════════════════════════════
// FILE: skins/sundial/sundial.component.tsx
// ════════════════════════════════════════════════════════════════════════════
/**
 * Roman/classical instrument. Stone and marble visual language.
 * Full-scale parabolic arc drawn as a CARVED GROOVE (double parallel strokes).
 * Roman numeral hour markers along the arc baseline.
 * Gnomon shadow drops from orb to baseline — shortens at zenith.
 * Latin phase labels in Palatino italic.
 *
 * MOBILE EXPAND FIX (v5):
 *   Outer motion.div layout = W*expandScale × H*expandScale (true visual footprint).
 *   Inner scale wrapper (position:absolute, transformOrigin:'top left') renders
 *   the full W×H card content scaled down. Outer glow stays outside the wrapper.
 *
 * FLAG BADGE UPDATE:
 *   Replaced custom PillFlag (country-flag-icons/react/3x2 React component)
 *   with PillFlagBadge from shared/flag-badge using skin="sundial".
 *
 *   Skin choice: "sundial"
 *     Applies a warm ochre-amber soft-light wash (day phases) or cool slate
 *     wash (night phases) so the flag reads as carved into — or resting on —
 *     the stone face. The 2px rect with directional inset shadow mimics a
 *     shallow carved relief slot, matching the widget's own material grammar.
 *
 *   Why not meridian:
 *     Meridian desaturates + screen-washes → "architectural blueprint" quality.
 *     Sundial needs "stone artifact" quality. Soft-light embeds the flag in
 *     the material rather than printing it on top.
 *
 *   Expanded card: country name kept as Palatino italic text only.
 *     A flag image would be visually anachronistic on a carved stone tablet.
 *     Classical serif text fits the established grammar of the skin exactly.
 *     (Same convention Aurora uses for its expanded state.)
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { useSolarTheme } from '../../provider/solar-theme-provider';
import { CONTENT_FADE } from '../../shared/content-fade';
import { PillFlagBadge } from '../../shared/flag-badge';
import { PillWeatherGlyph } from '../../shared/pill-weather-glyphs';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { ExpandDirection, WeatherCategory } from '../../widgets/solar-widget.shell';
import type { WidgetSkinProps } from '../types/widget-skin.types';

// ─── Palette ──────────────────────────────────────────────────────────────────

export interface SundialWidgetPalette {
  bg: [string, string, string];
  luster: string;
  arcColor: string;
  arcGroove: string;
  shadowColor: string;
  orbFill: string;
  orbGlow: string;
  tickColor: string;
  textPrimary: string;
  textSecondary: string;
  outerGlow: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  mode: 'light' | 'dark' | 'dim';
  starOpacity: number;
}

export const SUNDIAL_WIDGET_PALETTES: Record<SolarPhase, SundialWidgetPalette> = {
  midnight: {
    bg: ['#0E1018', '#141620', '#1A1C28'],
    luster: 'rgba(100,110,150,0.10)',
    arcColor: '#505878',
    arcGroove: 'rgba(100,110,150,0.30)',
    shadowColor: 'rgba(40,45,65,0.50)',
    orbFill: '#6878A8',
    orbGlow: 'rgba(72,88,168,0.60)',
    tickColor: 'rgba(80,90,130,0.40)',
    textPrimary: '#A8B0C8',
    textSecondary: 'rgba(96,112,160,0.55)',
    outerGlow: 'rgba(30,34,60,0.35)',
    pillBg: 'rgba(14,16,24,0.94)',
    pillBorder: 'rgba(80,90,130,0.30)',
    pillText: 'rgba(168,176,200,0.85)',
    label: 'NOX',
    sublabel: 'vigilia prima',
    mode: 'dark',
    starOpacity: 0.55,
  },
  night: {
    bg: ['#10141C', '#161C26', '#1E2430'],
    luster: 'rgba(90,110,160,0.12)',
    arcColor: '#485070',
    arcGroove: 'rgba(90,108,160,0.28)',
    shadowColor: 'rgba(38,44,62,0.48)',
    orbFill: '#5868A0',
    orbGlow: 'rgba(64,80,160,0.58)',
    tickColor: 'rgba(70,82,120,0.38)',
    textPrimary: '#98A8C0',
    textSecondary: 'rgba(88,104,150,0.52)',
    outerGlow: 'rgba(26,30,54,0.32)',
    pillBg: 'rgba(16,20,28,0.94)',
    pillBorder: 'rgba(72,84,122,0.28)',
    pillText: 'rgba(152,168,192,0.85)',
    label: 'NOCTIS',
    sublabel: 'hora noctis',
    mode: 'dark',
    starOpacity: 0.48,
  },
  dawn: {
    bg: ['#D8C0A0', '#E8D0B0', '#F0DCC0'],
    luster: 'rgba(220,180,120,0.16)',
    arcColor: '#A87830',
    arcGroove: 'rgba(210,160,80,0.35)',
    shadowColor: 'rgba(100,68,30,0.42)',
    orbFill: '#D09040',
    orbGlow: 'rgba(200,140,50,0.65)',
    tickColor: 'rgba(140,100,40,0.38)',
    textPrimary: '#604020',
    textSecondary: 'rgba(100,72,36,0.55)',
    outerGlow: 'rgba(140,90,30,0.28)',
    pillBg: 'rgba(215,192,160,0.92)',
    pillBorder: 'rgba(160,115,45,0.38)',
    pillText: 'rgba(96,64,32,0.90)',
    label: 'AURORA',
    sublabel: 'hora prima',
    mode: 'dim',
    starOpacity: 0.08,
  },
  sunrise: {
    bg: ['#E0C890', '#EED8A8', '#F8E8C0'],
    luster: 'rgba(240,200,100,0.18)',
    arcColor: '#B06010',
    arcGroove: 'rgba(220,130,40,0.38)',
    shadowColor: 'rgba(90,50,10,0.40)',
    orbFill: '#E09030',
    orbGlow: 'rgba(210,130,20,0.68)',
    tickColor: 'rgba(130,88,22,0.40)',
    textPrimary: '#503010',
    textSecondary: 'rgba(90,65,22,0.55)',
    outerGlow: 'rgba(160,100,20,0.30)',
    pillBg: 'rgba(220,200,140,0.92)',
    pillBorder: 'rgba(160,100,22,0.40)',
    pillText: 'rgba(80,48,16,0.90)',
    label: 'ORTUS',
    sublabel: 'aurora civilis',
    mode: 'dim',
    starOpacity: 0,
  },
  morning: {
    bg: ['#F0E8D0', '#F8F0E0', '#FFFDF4'],
    luster: 'rgba(240,220,160,0.14)',
    arcColor: '#A06818',
    arcGroove: 'rgba(200,140,40,0.32)',
    shadowColor: 'rgba(80,46,8,0.38)',
    orbFill: '#D89028',
    orbGlow: 'rgba(195,125,15,0.62)',
    tickColor: 'rgba(120,82,18,0.35)',
    textPrimary: '#402808',
    textSecondary: 'rgba(76,54,18,0.52)',
    outerGlow: 'rgba(140,90,15,0.22)',
    pillBg: 'rgba(238,228,200,0.92)',
    pillBorder: 'rgba(148,95,20,0.35)',
    pillText: 'rgba(64,40,8,0.90)',
    label: 'MANE',
    sublabel: 'hora tertia',
    mode: 'light',
    starOpacity: 0,
  },
  'solar-noon': {
    bg: ['#F8F4E8', '#FEFAEE', '#FFFEF8'],
    luster: 'rgba(240,230,180,0.12)',
    arcColor: '#906010',
    arcGroove: 'rgba(180,125,30,0.28)',
    shadowColor: 'rgba(70,42,6,0.35)',
    orbFill: '#C88820',
    orbGlow: 'rgba(175,115,10,0.58)',
    tickColor: 'rgba(110,76,16,0.32)',
    textPrimary: '#302008',
    textSecondary: 'rgba(68,48,14,0.50)',
    outerGlow: 'rgba(120,78,10,0.18)',
    pillBg: 'rgba(248,244,228,0.94)',
    pillBorder: 'rgba(132,88,15,0.30)',
    pillText: 'rgba(48,32,8,0.90)',
    label: 'MERIDIES',
    sublabel: 'hora sexta',
    mode: 'light',
    starOpacity: 0,
  },
  afternoon: {
    bg: ['#EEE0C8', '#F8ECDA', '#FEF5E8'],
    luster: 'rgba(230,190,120,0.16)',
    arcColor: '#A86020',
    arcGroove: 'rgba(195,120,35,0.32)',
    shadowColor: 'rgba(82,48,14,0.38)',
    orbFill: '#D88030',
    orbGlow: 'rgba(192,112,18,0.60)',
    tickColor: 'rgba(122,76,22,0.35)',
    textPrimary: '#482810',
    textSecondary: 'rgba(82,56,18,0.52)',
    outerGlow: 'rgba(138,82,14,0.22)',
    pillBg: 'rgba(234,220,196,0.92)',
    pillBorder: 'rgba(152,90,22,0.35)',
    pillText: 'rgba(72,40,12,0.90)',
    label: 'POSTMERIDIEM',
    sublabel: 'hora nona',
    mode: 'light',
    starOpacity: 0,
  },
  sunset: {
    bg: ['#C89070', '#D8A888', '#E8C0A0'],
    luster: 'rgba(210,150,90,0.18)',
    arcColor: '#985028',
    arcGroove: 'rgba(180,100,48,0.32)',
    shadowColor: 'rgba(80,40,18,0.40)',
    orbFill: '#C87040',
    orbGlow: 'rgba(182,95,30,0.65)',
    tickColor: 'rgba(112,65,28,0.38)',
    textPrimary: '#503020',
    textSecondary: 'rgba(88,55,28,0.55)',
    outerGlow: 'rgba(140,72,24,0.30)',
    pillBg: 'rgba(200,142,108,0.92)',
    pillBorder: 'rgba(148,76,38,0.38)',
    pillText: 'rgba(80,48,26,0.90)',
    label: 'OCCASUS',
    sublabel: 'hora undecima',
    mode: 'dim',
    starOpacity: 0,
  },
  dusk: {
    bg: ['#201828', '#2A2038', '#343050'],
    luster: 'rgba(100,80,140,0.12)',
    arcColor: '#585888',
    arcGroove: 'rgba(110,105,170,0.28)',
    shadowColor: 'rgba(44,40,70,0.45)',
    orbFill: '#6858A0',
    orbGlow: 'rgba(88,72,160,0.58)',
    tickColor: 'rgba(82,76,126,0.38)',
    textPrimary: '#988CB8',
    textSecondary: 'rgba(88,80,118,0.52)',
    outerGlow: 'rgba(42,32,80,0.30)',
    pillBg: 'rgba(32,24,40,0.94)',
    pillBorder: 'rgba(84,76,128,0.30)',
    pillText: 'rgba(152,140,184,0.85)',
    label: 'VESPER',
    sublabel: 'prima vigilia',
    mode: 'dark',
    starOpacity: 0.3,
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

export function lerpSundialWidgetPalette(
  a: SundialWidgetPalette,
  b: SundialWidgetPalette,
  t: number,
): SundialWidgetPalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = lerpColor;
  return {
    bg: [c(a.bg[0], b.bg[0], t), c(a.bg[1], b.bg[1], t), c(a.bg[2], b.bg[2], t)] as [
      string,
      string,
      string,
    ],
    luster: t < 0.5 ? a.luster : b.luster,
    arcColor: c(a.arcColor, b.arcColor, t),
    arcGroove: c(a.arcGroove, b.arcGroove, t),
    shadowColor: c(a.shadowColor, b.shadowColor, t),
    orbFill: c(a.orbFill, b.orbFill, t),
    orbGlow: c(a.orbGlow, b.orbGlow, t),
    tickColor: c(a.tickColor, b.tickColor, t),
    textPrimary: c(a.textPrimary, b.textPrimary, t),
    textSecondary: c(a.textSecondary, b.textSecondary, t),
    outerGlow: c(a.outerGlow, b.outerGlow, t),
    pillBg: c(a.pillBg, b.pillBg, t),
    pillBorder: c(a.pillBorder, b.pillBorder, t),
    pillText: c(a.pillText, b.pillText, t),
    label: t < 0.5 ? a.label : b.label,
    sublabel: t < 0.5 ? a.sublabel : b.sublabel,
    mode: t < 0.5 ? a.mode : b.mode,
    starOpacity: a.starOpacity + (b.starOpacity - a.starOpacity) * t,
  };
}

// ─── Arc constants ────────────────────────────────────────────────────────────

const W = 360;
const H = 180;
const ARC_BASE_Y = 162;
const ARC_ZENITH_Y = 32;
const ARC_HEIGHT = ARC_BASE_Y - ARC_ZENITH_Y;

const ROMAN_TICKS: Array<{ frac: number; label: string }> = [
  { frac: 0.0, label: 'VI' },
  { frac: 0.25, label: 'IX' },
  { frac: 0.5, label: 'XII' },
  { frac: 0.75, label: 'III' },
  { frac: 1.0, label: 'VI' },
];

function arcOrbPos(progress: number) {
  const t = Math.max(0.01, Math.min(0.99, progress));
  return { x: t * W, y: ARC_BASE_Y - ARC_HEIGHT * 4 * t * (1 - t) };
}

function buildArcPath(pts = 120): string {
  return Array.from({ length: pts }, (_, i) => {
    const t = i / (pts - 1);
    return `${i === 0 ? 'M' : 'L'}${(t * W).toFixed(1)},${(
      ARC_BASE_Y - ARC_HEIGHT * 4 * t * (1 - t)
    ).toFixed(1)}`;
  }).join(' ');
}

function buildArcGroovePath(offset: number, pts = 120): string {
  return Array.from({ length: pts }, (_, i) => {
    const t = i / (pts - 1);
    return `${i === 0 ? 'M' : 'L'}${(t * W).toFixed(1)},${(
      ARC_BASE_Y - ARC_HEIGHT * 4 * t * (1 - t) + offset
    ).toFixed(1)}`;
  }).join(' ');
}

// ─── Orb RAF ──────────────────────────────────────────────────────────────────

interface SundialOrbRefs {
  orbGroup: React.RefObject<SVGGElement>;
  gnomon: React.RefObject<SVGLineElement>;
}

function useSundialOrbRaf(refs: SundialOrbRefs) {
  const curP = useRef(-1);
  const tgtP = useRef(0);
  const rafId = useRef<number | null>(null);
  const first = useRef(true);
  const fading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (prog: number) => {
    const t = Math.max(0.01, Math.min(0.99, prog));
    const x = t * W;
    const y = ARC_BASE_Y - ARC_HEIGHT * 4 * t * (1 - t);
    refs.orbGroup.current?.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    if (refs.gnomon.current) {
      refs.gnomon.current.setAttribute('x1', String(x.toFixed(2)));
      refs.gnomon.current.setAttribute('y1', String(y.toFixed(2)));
      refs.gnomon.current.setAttribute('x2', String(x.toFixed(2)));
    }
  };
  const setOpacity = (o: number) => {
    if (refs.orbGroup.current) {
      refs.orbGroup.current.style.opacity = String(o);
    }
  };
  const anim = () => {
    const d = tgtP.current - curP.current;
    if (Math.abs(d) > 0.0004) {
      curP.current += d * 0.12;
      setPos(curP.current);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curP.current = tgtP.current;
      setPos(curP.current);
      rafId.current = null;
    }
  };
  const setTarget = (prog: number) => {
    tgtP.current = Math.max(0.01, Math.min(0.99, prog));
    if (first.current) {
      first.current = false;
      curP.current = tgtP.current;
      setPos(curP.current);
      setOpacity(1);
      return;
    }
    const rawDelta = prog - curP.current;
    let circDelta = rawDelta;
    if (circDelta > 0.5) circDelta -= 1;
    if (circDelta < -0.5) circDelta += 1;
    if (Math.abs(circDelta) < 0.03 && !fading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      curP.current = tgtP.current;
      setPos(curP.current);
      return;
    }
    const needsSnap = Math.abs(rawDelta) > 0.5 || Math.abs(circDelta) > 0.15;
    if (needsSnap && !fading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fading.current = true;
      setOpacity(0);
      fadeTimer.current = setTimeout(() => {
        curP.current = tgtP.current;
        setPos(curP.current);
        setOpacity(1);
        fading.current = false;
        fadeTimer.current = null;
        if (!rafId.current) rafId.current = requestAnimationFrame(anim);
      }, 160);
    } else if (!fading.current) {
      if (!rafId.current) rafId.current = requestAnimationFrame(anim);
    }
  };
  const resetFirst = () => {
    first.current = true;
  };
  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );
  return { setTarget, resetFirst };
}

// ─── Seeded random ────────────────────────────────────────────────────────────

function sr(s: number) {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Pill icon ────────────────────────────────────────────────────────────────

function SundialIcon({ color, size = 16 }: { color: string; size?: number }) {
  const cx = size * 0.5;
  const cy = size * 0.66;
  const r = size * 0.3;
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox={`0 0 ${size} ${size}`} fill="none">
      <line
        x1={size * 0.1}
        y1={cy}
        x2={size * 0.9}
        y2={cy}
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        opacity={0.8}
      />
      <path
        d={`M${cx - r} ${cy} A${r} ${r} 0 0 1 ${cx + r} ${cy}`}
        stroke={color}
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
        opacity={0.8}
      />
      <line
        x1={cx}
        y1={cy - r - size * 0.1}
        x2={cx}
        y2={cy}
        stroke={color}
        strokeWidth={1.0}
        strokeLinecap="round"
        opacity={0.9}
      />
      <circle cx={cx} cy={cy - r - size * 0.1} r={size * 0.05} fill={color} opacity={0.9} />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRANSFORM_ORIGINS: Record<ExpandDirection, string> = {
  'top-right': 'top right',
  'top-left': 'top left',
  'top-center': 'top center',
  'center-left': 'center left',
  center: 'center center',
  'center-right': 'center right',
  'bottom-right': 'bottom right',
  'bottom-left': 'bottom left',
  'bottom-center': 'bottom center',
};
const SIZE_SCALE: Record<string, number> = {
  xs: 0.55,
  sm: 0.7,
  md: 0.82,
  lg: 0.92,
  xl: 1.05,
};
const PHASE_TEMP: Record<SolarPhase, number> = {
  midnight: 12,
  night: 13,
  dawn: 14,
  sunrise: 16,
  morning: 19,
  'solar-noon': 25,
  afternoon: 27,
  sunset: 23,
  dusk: 18,
};
const PHASE_IS_DAYTIME: Record<SolarPhase, boolean> = {
  midnight: false,
  night: false,
  dawn: false,
  sunrise: false,
  morning: true,
  'solar-noon': true,
  afternoon: true,
  sunset: false,
  dusk: false,
};
function toF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}
function getYNudge(d: ExpandDirection) {
  return d.startsWith('bottom') ? 12 : d.startsWith('center') ? 0 : -12;
}
function collapseButtonSide(d: ExpandDirection): 'right' | 'left' {
  return d === 'top-left' || d === 'bottom-left' || d === 'center-left' ? 'left' : 'right';
}
function collapseArrowPath(d: ExpandDirection) {
  switch (d) {
    case 'top-right':
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
    case 'top-left':
      return 'M7 7 L1 1 M4 1 L1 1 L1 4';
    case 'top-center':
      return 'M4 7 L4 1 M1 3 L4 1 L7 3';
    case 'bottom-right':
      return 'M1 1 L7 7 M4 7 L7 7 L7 4';
    case 'bottom-left':
      return 'M7 1 L1 7 M4 7 L1 7 L1 4';
    case 'bottom-center':
      return 'M4 1 L4 7 M1 5 L4 7 L7 5';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}
function pillArrowPath(d: ExpandDirection) {
  switch (d) {
    case 'top-right':
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
    case 'top-left':
      return 'M7 7 L1 1 M4 1 L1 1 L1 4';
    case 'top-center':
      return 'M4 1 L4 7 M1 5 L4 7 L7 5';
    case 'bottom-right':
      return 'M1 1 L7 7 M4 7 L7 7 L7 4';
    case 'bottom-left':
      return 'M7 1 L1 7 M4 7 L1 7 L1 4';
    case 'bottom-center':
      return 'M4 7 L4 1 M1 3 L4 1 L7 3';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}

// ─── Live weather ─────────────────────────────────────────────────────────────

const WMO_MAP: Record<number, { description: string; category: WeatherCategory }> = {
  0: { description: 'Clear', category: 'clear' },
  1: { description: 'Mainly clear', category: 'clear' },
  2: { description: 'Partly cloudy', category: 'partly-cloudy' },
  3: { description: 'Overcast', category: 'overcast' },
  45: { description: 'Fog', category: 'fog' },
  48: { description: 'Fog', category: 'fog' },
  51: { description: 'Drizzle', category: 'drizzle' },
  53: { description: 'Drizzle', category: 'drizzle' },
  55: { description: 'Drizzle', category: 'drizzle' },
  61: { description: 'Rain', category: 'rain' },
  63: { description: 'Rain', category: 'rain' },
  65: { description: 'Heavy rain', category: 'heavy-rain' },
  71: { description: 'Snow', category: 'snow' },
  73: { description: 'Snow', category: 'snow' },
  75: { description: 'Heavy snow', category: 'heavy-snow' },
  80: { description: 'Rain showers', category: 'rain' },
  81: { description: 'Rain showers', category: 'rain' },
  82: { description: 'Heavy rain', category: 'heavy-rain' },
  85: { description: 'Snow showers', category: 'snow' },
  86: { description: 'Heavy snow', category: 'heavy-snow' },
  95: { description: 'Thunderstorm', category: 'thunder' },
  96: { description: 'Thunderstorm', category: 'thunder' },
  99: { description: 'Thunderstorm', category: 'thunder' },
};
interface LiveWeather {
  temperatureC: number;
  category: WeatherCategory;
  description: string;
}
async function fetchWeather(lat: number, lon: number): Promise<LiveWeather> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(lat));
  u.searchParams.set('longitude', String(lon));
  u.searchParams.set('current', 'temperature_2m,weather_code');
  u.searchParams.set('forecast_days', '1');
  const d = (await fetch(u.toString()).then((r) => r.json())) as {
    current: { temperature_2m: number; weather_code: number };
  };
  const info = WMO_MAP[d.current.weather_code] ?? {
    description: 'Clear',
    category: 'clear' as WeatherCategory,
  };
  return { temperatureC: Math.round(d.current.temperature_2m), ...info };
}
function useWeatherData(lat: number | null, lon: number | null): LiveWeather | null {
  const [w, setW] = useState<LiveWeather | null>(null);
  useEffect(() => {
    if (!lat || !lon) return;
    let dead = false;
    fetchWeather(lat, lon)
      .then((x) => {
        if (!dead) setW(x);
      })
      .catch(() => {});
    const id = setInterval(
      () =>
        fetchWeather(lat as number, lon as number)
          .then((x) => {
            if (!dead) setW(x);
          })
          .catch(() => {}),
      30 * 60 * 1000,
    );
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [lat, lon]);
  return w;
}

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.8,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 550, damping: 42 };

// ─── SundialExtras ────────────────────────────────────────────────────────────

export interface SundialExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── SundialWidget ────────────────────────────────────────────────────────────

export function SundialWidget({
  phase,
  blend,
  expandDirection = 'top-right',
  size = 'lg',
  showFlag = false,
  showWeather = false,
  hoverEffect = true,
  weather: weatherOverride = null,
  latitude,
  longitude,
  timezone,
  simulatedDate,
  temperatureOverride,
  temperatureUnit = 'C',
  forceExpanded,
  className = '',
  liveWeatherCategory,
  liveTemperatureC,
  palette: passedPalette,
}: WidgetSkinProps & SundialExtras) {
  const { coordsReady } = useSolarTheme();
  const [stored, setStored] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('sundial-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStored(next);
    try {
      localStorage.setItem('sundial-widget-expanded', JSON.stringify(next));
    } catch {}
  }, []);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : stored;
  const setIsExpanded = forceExpanded !== undefined ? () => {} : updateExpanded;
  const origin = TRANSFORM_ORIGINS[expandDirection];
  const yNudge = getYNudge(expandDirection);

  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;
  const internalPalette = lerpSundialWidgetPalette(
    SUNDIAL_WIDGET_PALETTES[blend.phase],
    SUNDIAL_WIDGET_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'sundial');

  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);
  const hasTempData =
    temperatureOverride != null || liveTemperatureC != null || liveWeather != null;
  const tempC =
    temperatureOverride ?? liveTemperatureC ?? liveWeather?.temperatureC ?? PHASE_TEMP[phase];
  const dispTempStr = hasTempData
    ? temperatureUnit === 'F'
      ? `${toF(tempC)}°F`
      : `${tempC}°C`
    : '';

  const effectiveCat: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weatherOverride ?? liveWeather?.category ?? null)
        : null;
  const weatherDesc = effectiveCat ? (liveWeather?.description ?? effectiveCat) : null;
  const expandedSublabel =
    showWeather && effectiveCat
      ? `${weatherDesc} · ${temperatureUnit === 'F' ? `${toF(tempC)}°F` : `${tempC}°C`}`
      : palette.sublabel;

  const showGnomon = !effectiveCat || effectiveCat === 'clear' || effectiveCat === 'partly-cloudy';
  const orbDimOpacity = effectiveCat ? WEATHER_ORB_DIM[effectiveCat] : 1;
  const pillShowWeather = showWeather && effectiveCat !== null && effectiveCat !== 'clear';
  const pillMinWidth = useMemo(() => {
    let w = 82;
    if (showWeather) w += 36;
    if (showFlag) w += 28;
    return w;
  }, [showWeather, showFlag]);
  const pillPhaseIcon: 'sun' | 'moon' | 'dawn' | 'dusk' =
    phase === 'midnight' || phase === 'night'
      ? 'moon'
      : phase === 'dawn' || phase === 'sunrise'
        ? 'dawn'
        : phase === 'sunset' || phase === 'dusk'
          ? 'dusk'
          : 'sun';

  const orbGroupRef = useRef<SVGGElement>(null);
  const gnomonRef = useRef<SVGLineElement>(null);
  const { setTarget, resetFirst } = useSundialOrbRaf({
    orbGroup: orbGroupRef,
    gnomon: gnomonRef,
  });
  const prevCoords = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoords.current) {
      prevCoords.current = true;
      resetFirst();
    }
  }, [coordsReady, resetFirst]);
  useEffect(() => {
    setTarget(progress);
  });

  const [expandScale, setExpandScale] = useState(SIZE_SCALE[size] ?? 0.92);
  useEffect(() => {
    if (size) {
      setExpandScale(SIZE_SCALE[size] ?? 0.92);
      return;
    }
    const upd = () => {
      const vw = window.innerWidth;
      setExpandScale(vw < 640 ? Math.min((vw - 24) / W, 1) : 0.9);
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [size]);

  // ── Country info ─────────────────────────────────────────────────────────
  // FC (React flag component) intentionally not fetched.
  // Expanded card: country name as Palatino italic text (period-appropriate).
  // Pill: PillFlagBadge with skin="sundial" for the stone material treatment.
  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const initPos = arcOrbPos(progress);
  const arcPath = useMemo(() => buildArcPath(), []);
  const arcPath2 = useMemo(() => buildArcGroovePath(1.0), []);

  const fmtMin = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(
      2,
      '0',
    )}`;
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const SERIF = "'Palatino Linotype','Palatino','Book Antiqua','Georgia',serif";
  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          // ── EXPANDED ────────────────────────────────────────────────────
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.86, y: yNudge }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: yNudge * 0.8 }}
            transition={SPRING_EXPAND}
            style={{
              width: W * expandScale,
              height: H * expandScale,
              transformOrigin: origin,
              position: 'relative',
            }}
            className="select-none"
          >
            {/* Outer glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: '1.6rem' }}
              animate={{
                boxShadow: `0 0 60px 18px ${palette.outerGlow}`,
              }}
              transition={{ duration: 1.8 }}
            />

            {/* Scale wrapper — W×H card content scaled to fit W*expandScale box */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: W,
                height: H,
                transform: `scale(${expandScale})`,
                transformOrigin: 'top left',
              }}
            >
              <motion.div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: '1.6rem',
                  border: `1px solid ${palette.arcColor}40`,
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.10)',
                }}
              >
                {/* z=0 Stone gradient */}
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(145deg,${palette.bg[0]} 0%,${palette.bg[1]} 55%,${
                      palette.bg[2]
                    } 100%)`,
                  }}
                  transition={{
                    duration: 1.8,
                    ease: 'easeInOut',
                  }}
                />

                {/* z=1 Stone luster */}
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 1 }}
                  animate={{
                    background: `radial-gradient(ellipse 55% 50% at 30% 28%, ${palette.luster} 0%, transparent 70%)`,
                  }}
                  transition={{
                    duration: 1.8,
                    ease: 'easeInOut',
                  }}
                />

                {/* z=2 Fixed stars */}
                {palette.starOpacity > 0 && (
                  <div
                    className="absolute inset-0"
                    style={{
                      zIndex: 2,
                      pointerEvents: 'none',
                    }}
                  >
                    {Array.from({ length: 10 }, (_, i) => (
                      <div
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative array, order is stable
                        key={i}
                        className="absolute rounded-full"
                        style={{
                          width: sr(i * 7) * 1.5 + 0.8,
                          height: sr(i * 7) * 1.5 + 0.8,
                          left: `${sr(i * 11 + 3) * 90}%`,
                          top: `${sr(i * 13 + 5) * 40}%`,
                          background: palette.textSecondary,
                          opacity: palette.starOpacity * (0.5 + sr(i * 3) * 0.5),
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* z=3 Weather backdrop */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveCat ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveCat && (
                    <WeatherBackdrop
                      category={effectiveCat}
                      skin="sundial"
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

                {/* z=4 Arc SVG */}
                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 4,
                    overflow: 'hidden',
                    opacity: coordsReady ? 1 : 0,
                    transition: 'opacity 0.9s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    <filter id="sundial-orb-glow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                    <filter id="sundial-orb-core" x="-30%" y="-30%" width="160%" height="160%">
                      <feGaussianBlur stdDeviation="1.8" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <line
                    x1={0}
                    y1={ARC_BASE_Y}
                    x2={W}
                    y2={ARC_BASE_Y}
                    stroke={palette.arcColor}
                    strokeWidth={0.8}
                    opacity={0.5}
                  />
                  <path
                    d={arcPath2}
                    fill="none"
                    stroke={palette.arcColor}
                    strokeWidth={0.6}
                    opacity={0.45}
                  />
                  <path
                    d={arcPath}
                    fill="none"
                    stroke={palette.arcGroove}
                    strokeWidth={0.6}
                    opacity={0.6}
                  />
                  {ROMAN_TICKS.map(({ frac, label }) => {
                    const tx = frac * W;
                    const arcY = ARC_BASE_Y - ARC_HEIGHT * 4 * frac * (1 - frac);
                    return (
                      <g key={`tick-${frac}`}>
                        <line
                          x1={tx}
                          y1={arcY - 4}
                          x2={tx}
                          y2={arcY + 4}
                          stroke={palette.tickColor}
                          strokeWidth={0.7}
                          opacity={0.45}
                        />
                        <text
                          x={tx}
                          y={ARC_BASE_Y + 10}
                          textAnchor="middle"
                          fontSize={6}
                          fontFamily={SERIF}
                          fill={palette.tickColor}
                          opacity={0.42}
                          letterSpacing="0.06em"
                        >
                          {label}
                        </text>
                      </g>
                    );
                  })}
                  <line
                    ref={gnomonRef}
                    x1={initPos.x}
                    y1={initPos.y}
                    x2={initPos.x}
                    y2={ARC_BASE_Y}
                    stroke={palette.shadowColor}
                    strokeWidth={1.0}
                    strokeDasharray="1.5 2.5"
                    opacity={showGnomon ? 0.42 : 0}
                    style={{
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  />
                  <g
                    ref={orbGroupRef}
                    transform={`translate(${initPos.x.toFixed(1)},${initPos.y.toFixed(1)})`}
                    style={{
                      opacity: orbDimOpacity,
                      transition: 'opacity 0.9s ease-in-out',
                    }}
                  >
                    <circle
                      cx={0}
                      cy={0}
                      r={22}
                      fill={palette.orbGlow}
                      filter="url(#sundial-orb-glow)"
                    />
                    <circle
                      cx={0}
                      cy={0}
                      r={9}
                      fill={palette.orbFill}
                      filter="url(#sundial-orb-core)"
                    />
                    <circle cx={-3} cy={-3} r={2.5} fill="rgba(255,255,255,0.42)" />
                  </g>
                </svg>

                {/* z=5 Weather layer */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveCat ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveCat && (
                    <WeatherLayer
                      category={effectiveCat}
                      skin="sundial"
                      opacity={isDaytime ? 0.72 : 0.88}
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

                {/* z=6 Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 6 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: SERIF,
                          fontSize: 24,
                          fontStyle: 'italic',
                          fontWeight: 400,
                          letterSpacing: '0.12em',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{
                          duration: 1.8,
                        }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        style={{
                          fontFamily: SERIF,
                          fontSize: 10,
                          fontStyle: 'italic',
                          marginTop: 3,
                          letterSpacing: '0.08em',
                          opacity: 0.68,
                        }}
                        animate={{
                          color: palette.textSecondary,
                        }}
                        transition={{
                          duration: 1.8,
                        }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 20,
                        fontStyle: 'italic',
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1.8 }}
                    >
                      {dispTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* z=6 Bottom row — country name as italic serif text (flag would be anachronistic) */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 6 }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 1.8 }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 9,
                      letterSpacing: '0.10em',
                      opacity: coordsReady && solar.isReady ? 0.42 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    VI · {sunriseFmt}
                  </span>
                  {flagActive && (
                    <motion.span
                      initial={{ opacity: 0, y: 3 }}
                      animate={{
                        opacity: 0.55,
                        y: 0,
                      }}
                      transition={{ duration: 0.5 }}
                      style={{
                        fontFamily: SERIF,
                        fontStyle: 'italic',
                        fontSize: 8,
                        letterSpacing: '0.14em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: palette.textSecondary,
                      }}
                    >
                      {countryInfo?.name}
                    </motion.span>
                  )}
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 9,
                      letterSpacing: '0.10em',
                      opacity: coordsReady && solar.isReady ? 0.42 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    {sunsetFmt} · XVIII
                  </span>
                </motion.div>

                {/* z=7 Stone sheen */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zIndex: 7,
                    borderRadius: '1.6rem',
                    background:
                      'linear-gradient(to bottom, rgba(255,255,255,0.07) 0%, transparent 30%, rgba(0,0,0,0.05) 70%, transparent 100%)',
                  }}
                />

                {/* z=8 Collapse button */}
                {!forceExpanded &&
                  (() => {
                    const side = collapseButtonSide(expandDirection);
                    const isRight = side === 'right';
                    return (
                      <motion.button
                        onClick={() => setIsExpanded(false)}
                        initial={{
                          opacity: 0,
                          scale: 0.6,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.6,
                        }}
                        transition={{
                          ...SPRING_CONTENT,
                          delay: 0.18,
                        }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        aria-label="Collapse sundial widget"
                        style={{
                          position: 'absolute',
                          zIndex: 8,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 1.6rem 0 10px' : '1.6rem 0 10px 0',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path
                            d="M2 2 L6 6 M6 2 L2 6"
                            stroke={palette.pillText}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.70"
                          />
                        </svg>
                      </motion.button>
                    );
                  })()}
              </motion.div>
            </div>
            {/* end scale wrapper */}
          </motion.div>
        ) : (
          // ── PILL ────────────────────────────────────────────────────────
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.75, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: -8 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 34,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 12,
              minWidth: pillMinWidth,
              background: effectivePillBg,
              border: `1px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 16px rgba(0,0,0,0.22), 0 0 22px 4px ${palette.outerGlow}`,
              backdropFilter: 'blur(8px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.95 } : { scale: expandScale * 0.98 }}
            aria-label={`Sundial widget — ${palette.label}. Click to expand.`}
          >
            {/* Phase / weather icon */}
            <span
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                flexShrink: 0,
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {pillShowWeather && effectiveCat ? (
                  <motion.span
                    key={`glyph-${effectiveCat}`}
                    initial={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    transition={{
                      duration: 0.18,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PillWeatherGlyph
                      skin="sundial"
                      category={effectiveCat}
                      color={palette.pillText}
                      accentColor={palette.orbFill}
                      phaseIcon={pillPhaseIcon}
                      size={20}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-icon"
                    initial={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    transition={{
                      duration: 0.18,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SundialIcon color={palette.pillText} size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            {/*
             * Flag badge — stone material treatment.
             * PillFlagBadge with skin="sundial": warm amber wash (day) or cool
             * slate wash (night), 2px carved-recess rect shape. No glow halo
             * (intentionally omitted — sundial has no soft light emission).
             */}
            {showFlag && (
              <motion.span
                animate={{ opacity: flagActive ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}
              >
                {flagActive && (
                  <PillFlagBadge
                    code={countryInfo?.code}
                    skin="sundial"
                    mode={palette.mode}
                    accent={palette.orbFill}
                    shadow={palette.bg[0]}
                    highlight={palette.textPrimary}
                    glow={palette.outerGlow}
                  />
                )}
              </motion.span>
            )}

            {/* Temperature */}
            <motion.span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: 13,
                fontWeight: 400,
                letterSpacing: '-0.01em',
                minWidth: 28,
              }}
              animate={{ color: palette.pillText, opacity: hasTempData ? 1 : 0 }}
              transition={{ duration: 2 }}
            >
              {hasTempData ? (temperatureUnit === 'F' ? `${toF(tempC)}°` : `${tempC}°`) : '\u00A0'}
            </motion.span>

            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: palette.pillBorder,
                flexShrink: 0,
              }}
            />

            {/* Phase label */}
            <motion.span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: 10,
                fontWeight: 400,
                letterSpacing: '0.12em',
                whiteSpace: 'nowrap',
              }}
              animate={{ color: palette.textSecondary }}
              transition={{ duration: 2 }}
            >
              {palette.label}
            </motion.span>

            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ marginLeft: 2, opacity: 0.55 }}
            >
              <path
                d={pillArrowPath(expandDirection)}
                stroke={palette.pillText}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
