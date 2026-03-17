'use client';

/**
 * skins/paper/paper.component.tsx
 *
 * Paper skin — uncoated-stock editorial aesthetic.
 *
 * FLAG BADGE UPDATE:
 *   Replaced the old inline `PillFlag` component (which used raw CountryFlags
 *   and applied a CSS filter string) with `PillFlagBadge` from shared/flag-badge.
 *   Paper uses skin="paper" which falls through to the neutral filter treatment:
 *   gentle desaturate + mode-aware brightness pull. This means night/dark phases
 *   dim the flag naturally to match the ink-on-parchment aesthetic, while light
 *   phases keep the flag close to full saturation.
 *
 *   The expanded bottom row uses `PillFlagBadge` (size="pill") rather than a
 *   raw flag, consistent with the pill treatment — the flag stays recognisable
 *   but is tinted warm to sit inside the paper world.
 *
 * FIXES (v3):
 *   1. Pill icon stack: PhaseIcon always visible, WeatherIcon layers on top
 *      with AnimatePresence. Phase icon opacity fades by weather severity so
 *      heavy rain / thunder nearly eclipse the moon/sun, while partly-cloudy
 *      barely dims it. Creates a "weather rolling in" narrative.
 *   2. WeatherIcon bumped to size=22 for pill legibility.
 *   3. Expanded bottom row: weather icon removed — WeatherLayer handles it.
 * MOBILE EXPAND FIX (v4):
 *   Layout dimensions are W*expandScale × H*expandScale; inner scale wrapper
 *   renders full W×H content scaled down with transformOrigin:'top left'.
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { useSolarTheme } from '../../provider/solar-theme-provider';
import { PillFlagBadge } from '../../shared/flag-badge';
import { PillWeatherGlyph } from '../../shared/pill-weather-glyphs';
import { WeatherIcon, type WeatherIconKey } from '../../shared/solar-weather-icons';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { ExpandDirection, WeatherCategory } from '../../widgets/solar-widget.shell';
import type { WidgetSkinProps } from '../types/widget-skin.types';

// ─── PaperPalette ─────────────────────────────────────────────────────────────

export interface PaperPalette {
  bg: [string, string, string];
  inkOrb: string;
  inkBloom: string;
  arc: string;
  arcOpacity: number;
  textPrimary: string;
  textSecondary: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  accentColor: string;
  dropShadow: string;
  grain: number;
  mode: 'light' | 'dim' | 'dark';
  showMoon: boolean;
  icon: 'sun' | 'moon' | 'dawn' | 'dusk';
}

// ─── PAPER_PALETTES ───────────────────────────────────────────────────────────

export const PAPER_PALETTES: Record<SolarPhase, PaperPalette> = {
  midnight: {
    bg: ['#060502', '#0A0804', '#110C06'],
    inkOrb: '#5A4A30',
    inkBloom: 'rgba(90,74,48,0.65)',
    arc: 'rgba(176,144,96,0.42)',
    arcOpacity: 0.42,
    textPrimary: '#C8B890',
    textSecondary: '#7A6848',
    pillBg: 'rgba(10,8,4,0.95)',
    pillBorder: 'rgba(160,128,80,0.25)',
    pillText: '#B8A870',
    label: 'Midnight',
    sublabel: 'Deep Night',
    accentColor: '#907060',
    dropShadow: 'rgba(0,0,0,0.55)',
    grain: 0.32,
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  night: {
    bg: ['#0A0804', '#100C06', '#180E08'],
    inkOrb: '#6A5838',
    inkBloom: 'rgba(106,88,56,0.68)',
    arc: 'rgba(192,160,108,0.45)',
    arcOpacity: 0.45,
    textPrimary: '#D8C8A0',
    textSecondary: '#8A7050',
    pillBg: 'rgba(16,12,6,0.94)',
    pillBorder: 'rgba(176,144,96,0.30)',
    pillText: '#C8B080',
    label: 'Night',
    sublabel: 'Still & Dark',
    accentColor: '#A08060',
    dropShadow: 'rgba(0,0,0,0.48)',
    grain: 0.3,
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  dawn: {
    bg: ['#E8D0A8', '#F0DEC0', '#F8EAD0'],
    inkOrb: '#C08050',
    inkBloom: 'rgba(192,128,80,0.45)',
    arc: 'rgba(160,104,56,0.58)',
    arcOpacity: 0.58,
    textPrimary: '#5A3818',
    textSecondary: '#9A7050',
    pillBg: 'rgba(240,222,192,0.92)',
    pillBorder: 'rgba(160,112,64,0.38)',
    pillText: '#4A2E10',
    label: 'Dawn',
    sublabel: 'First Light',
    accentColor: '#C07840',
    dropShadow: 'rgba(80,48,16,0.22)',
    grain: 0.25,
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  sunrise: {
    bg: ['#EDD8A8', '#F5E8C8', '#FBF2DC'],
    inkOrb: '#C87830',
    inkBloom: 'rgba(200,120,48,0.40)',
    arc: 'rgba(176,120,48,0.62)',
    arcOpacity: 0.62,
    textPrimary: '#4A2E10',
    textSecondary: '#8A6030',
    pillBg: 'rgba(245,232,200,0.92)',
    pillBorder: 'rgba(176,120,48,0.42)',
    pillText: '#3A2008',
    label: 'Sunrise',
    sublabel: 'Golden Hour',
    accentColor: '#C07828',
    dropShadow: 'rgba(80,48,8,0.25)',
    grain: 0.24,
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  morning: {
    bg: ['#F5F0D8', '#FAF6E8', '#FEFEFCF4'],
    inkOrb: '#A07830',
    inkBloom: 'rgba(160,120,48,0.38)',
    arc: 'rgba(144,112,48,0.56)',
    arcOpacity: 0.56,
    textPrimary: '#2A1E08',
    textSecondary: '#6A5020',
    pillBg: 'rgba(252,248,236,0.94)',
    pillBorder: 'rgba(144,112,48,0.35)',
    pillText: '#1E1408',
    label: 'Morning',
    sublabel: 'Bright & Clear',
    accentColor: '#907028',
    dropShadow: 'rgba(48,32,8,0.18)',
    grain: 0.22,
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  'solar-noon': {
    bg: ['#F5F5E5', '#FAFAF0', '#FEFEFC'],
    inkOrb: '#787840',
    inkBloom: 'rgba(120,120,64,0.28)',
    arc: 'rgba(108,108,56,0.52)',
    arcOpacity: 0.52,
    textPrimary: '#141408',
    textSecondary: '#484820',
    pillBg: 'rgba(254,254,248,0.96)',
    pillBorder: 'rgba(108,108,56,0.30)',
    pillText: '#101008',
    label: 'Solar Noon',
    sublabel: 'Peak Sun',
    accentColor: '#686830',
    dropShadow: 'rgba(32,32,8,0.14)',
    grain: 0.18,
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  afternoon: {
    bg: ['#F2E8C0', '#F8F0D0', '#FCF6E4'],
    inkOrb: '#9A6820',
    inkBloom: 'rgba(154,104,32,0.40)',
    arc: 'rgba(136,88,24,0.58)',
    arcOpacity: 0.58,
    textPrimary: '#281808',
    textSecondary: '#604828',
    pillBg: 'rgba(250,242,212,0.94)',
    pillBorder: 'rgba(136,88,24,0.38)',
    pillText: '#201408',
    label: 'Afternoon',
    sublabel: 'Warm Glow',
    accentColor: '#886020',
    dropShadow: 'rgba(56,32,8,0.20)',
    grain: 0.22,
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  sunset: {
    bg: ['#E4C098', '#EED0B0', '#F5DEC4'],
    inkOrb: '#B06840',
    inkBloom: 'rgba(176,104,64,0.44)',
    arc: 'rgba(160,96,56,0.60)',
    arcOpacity: 0.6,
    textPrimary: '#482818',
    textSecondary: '#886040',
    pillBg: 'rgba(236,210,176,0.92)',
    pillBorder: 'rgba(160,96,56,0.42)',
    pillText: '#3A2010',
    label: 'Sunset',
    sublabel: 'Dusk Glow',
    accentColor: '#A86038',
    dropShadow: 'rgba(72,32,8,0.25)',
    grain: 0.26,
    mode: 'dim',
    showMoon: false,
    icon: 'dusk',
  },
  dusk: {
    bg: ['#C8B888', '#D8C8A0', '#E4D4B0'],
    inkOrb: '#886040',
    inkBloom: 'rgba(136,96,64,0.44)',
    arc: 'rgba(120,88,56,0.55)',
    arcOpacity: 0.55,
    textPrimary: '#382818',
    textSecondary: '#786040',
    pillBg: 'rgba(214,202,160,0.92)',
    pillBorder: 'rgba(120,88,56,0.38)',
    pillText: '#2E2010',
    label: 'Dusk',
    sublabel: 'Evening Twilight',
    accentColor: '#806038',
    dropShadow: 'rgba(48,28,8,0.28)',
    grain: 0.28,
    mode: 'dark',
    showMoon: true,
    icon: 'dusk',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpPaperPalette(from: PaperPalette, to: PaperPalette, t: number): PaperPalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    inkOrb: lerpColor(from.inkOrb, to.inkOrb, t),
    inkBloom: lerpColor(from.inkBloom, to.inkBloom, t),
    arc: lerpColor(from.arc, to.arc, t),
    arcOpacity: lerpNum(from.arcOpacity, to.arcOpacity, t),
    textPrimary: lerpColor(from.textPrimary, to.textPrimary, t),
    textSecondary: lerpColor(from.textSecondary, to.textSecondary, t),
    pillBg: lerpColor(from.pillBg, to.pillBg, t),
    pillBorder: lerpColor(from.pillBorder, to.pillBorder, t),
    pillText: lerpColor(from.pillText, to.pillText, t),
    accentColor: lerpColor(from.accentColor, to.accentColor, t),
    dropShadow: lerpColor(from.dropShadow, to.dropShadow, t),
    grain: lerpNum(from.grain, to.grain, t),
  };
}

// ─── Arc math ─────────────────────────────────────────────────────────────────

const W = 360;
const H = 180;
const CX = 180;
const CY = 200;
const RX = 169.2;
const RY = 171;
const ARC_D = `M ${CX - RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`;
function arcPt(t: number) {
  const a = Math.PI * (1 - t);
  return { x: CX + RX * Math.cos(a), y: CY - RY * Math.sin(a) };
}

// ─── Ink blot orb RAF ─────────────────────────────────────────────────────────

interface InkRefs {
  bloom: React.RefObject<SVGCircleElement>;
  center: React.RefObject<SVGCircleElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useInkOrbRaf(refs: InkRefs) {
  const curProg = useRef(-1);
  const tgtProg = useRef(0);
  const curArc = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);

  const setPos = (x: number, y: number) => {
    refs.bloom.current?.setAttribute('cx', String(x));
    refs.bloom.current?.setAttribute('cy', String(y));
    refs.center.current?.setAttribute('cx', String(x));
    refs.center.current?.setAttribute('cy', String(y));
  };

  const anim = () => {
    const diff = tgtProg.current - curProg.current;
    if (Math.abs(diff) > 0.0002) {
      curProg.current += diff * 0.12;
      setPos(arcPt(curProg.current).x, arcPt(curProg.current).y);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curProg.current = tgtProg.current;
      setPos(arcPt(curProg.current).x, arcPt(curProg.current).y);
      rafId.current = null;
    }
  };

  const setTarget = (newArc: string, prog: number) => {
    const arcChanged = curArc.current !== null && curArc.current !== newArc;
    const jumpedBack = !arcChanged && prog < curProg.current - 0.15;
    curArc.current = newArc;
    tgtProg.current = prog;
    if (firstCall.current) {
      firstCall.current = false;
      curProg.current = prog;
      setPos(arcPt(prog).x, arcPt(prog).y);
      return;
    }
    if (arcChanged || jumpedBack) {
      curProg.current = prog;
      setPos(arcPt(prog).x, arcPt(prog).y);
      return;
    }
    if (!rafId.current) rafId.current = requestAnimationFrame(anim);
  };

  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
    },
    [],
  );
  return {
    setTarget,
    resetFirstCall: () => {
      firstCall.current = true;
    },
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function SunIcon({ color }: { color: string }) {
  const R = Math.PI / 180;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3" fill={color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={8 + 5 * Math.cos(a * R)}
          y1={8 + 5 * Math.sin(a * R)}
          x2={8 + 6.8 * Math.cos(a * R)}
          y2={8 + 6.8 * Math.sin(a * R)}
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}
function MoonIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M13 9.5A5.5 5.5 0 0 1 6.5 3c0-.28.02-.56.06-.83A5.5 5.5 0 1 0 13 9.5z"
        fill={color}
      />
    </svg>
  );
}
function HorizonIcon({ color }: { color: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <line x1="1" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.2" strokeLinecap="round" />
      <path
        d="M4 10 A4 4 0 0 1 12 10"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="8" cy="10" r="1.8" fill={color} />
    </svg>
  );
}

const GRAIN_SVG = `<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.72' numOctaves='4' stitchTiles='stitch'/><feColorMatrix type='saturate' values='0'/></filter><rect width='240' height='240' filter='url(#n)' opacity='1'/></svg>`;
const GRAIN_URL = `url("data:image/svg+xml,${encodeURIComponent(GRAIN_SVG)}")`;

interface LiveWeather {
  temperatureC: number;
  feelsLikeC: number;
  description: string;
  category: WeatherCategory;
  windspeedKmh: number;
  humidity: number;
}
const WMO_MAP: Record<number, { description: string; category: WeatherCategory }> = {
  0: { description: 'Clear', category: 'clear' },
  1: { description: 'Mainly clear', category: 'clear' },
  2: { description: 'Partly cloudy', category: 'partly-cloudy' },
  3: { description: 'Overcast', category: 'overcast' },
  45: { description: 'Fog', category: 'fog' },
  48: { description: 'Freezing fog', category: 'fog' },
  51: { description: 'Light drizzle', category: 'drizzle' },
  53: { description: 'Drizzle', category: 'drizzle' },
  55: { description: 'Heavy drizzle', category: 'drizzle' },
  61: { description: 'Slight rain', category: 'rain' },
  63: { description: 'Rain', category: 'rain' },
  65: { description: 'Heavy rain', category: 'heavy-rain' },
  71: { description: 'Slight snow', category: 'snow' },
  73: { description: 'Snow', category: 'snow' },
  75: { description: 'Heavy snow', category: 'heavy-snow' },
  80: { description: 'Rain showers', category: 'rain' },
  81: { description: 'Rain showers', category: 'rain' },
  82: { description: 'Violent rain', category: 'heavy-rain' },
  85: { description: 'Snow showers', category: 'snow' },
  86: { description: 'Heavy snow', category: 'heavy-snow' },
  95: { description: 'Thunderstorm', category: 'thunder' },
  96: { description: 'Thunderstorm', category: 'thunder' },
  99: { description: 'Thunderstorm', category: 'thunder' },
};
async function fetchWeather(lat: number, lon: number): Promise<LiveWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set(
    'current',
    'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m',
  );
  url.searchParams.set('forecast_days', '1');
  const data = (await fetch(url.toString()).then((r) => r.json())) as {
    current: {
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };
  const c = data.current;
  const info = WMO_MAP[c.weather_code] ?? {
    description: 'Unknown',
    category: 'clear' as WeatherCategory,
  };
  return {
    temperatureC: Math.round(c.temperature_2m),
    feelsLikeC: Math.round(c.apparent_temperature),
    description: info.description,
    category: info.category,
    windspeedKmh: Math.round(c.wind_speed_10m),
    humidity: c.relative_humidity_2m,
  };
}
function useWeatherData(lat: number | null, lon: number | null): LiveWeather | null {
  const [weather, setWeather] = useState<LiveWeather | null>(null);
  useEffect(() => {
    if (!lat || !lon) return;
    let dead = false;
    fetchWeather(lat, lon)
      .then((w) => {
        if (!dead) setWeather(w);
      })
      .catch(() => {});
    const id = setInterval(
      () =>
        fetchWeather(lat, lon)
          .then((w) => {
            if (!dead) setWeather(w);
          })
          .catch(() => {}),
      30 * 60 * 1000,
    );
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [lat, lon]);
  return weather;
}

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 420,
  damping: 36,
  mass: 0.9,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 440, damping: 40 };
const SIZE_SCALE: Record<string, number> = {
  xs: 0.55,
  sm: 0.7,
  md: 0.82,
  lg: 0.92,
  xl: 1.05,
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
function toF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}
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
function getYNudge(dir: ExpandDirection) {
  if (dir.startsWith('bottom')) return 12;
  if (dir.startsWith('center')) return 0;
  return -12;
}
function collapseButtonSide(dir: ExpandDirection) {
  if (dir === 'top-left' || dir === 'bottom-left' || dir === 'center-left') {
    return 'left';
  }
  return 'right';
}
function collapseArrowPath(dir: ExpandDirection) {
  switch (dir) {
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
    case 'center-left':
      return 'M7 4 L1 4 M3 1 L1 4 L3 7';
    case 'center-right':
      return 'M1 4 L7 4 M5 1 L7 4 L5 7';
    case 'center':
      return 'M2 2 L6 6 M6 2 L2 6';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}
function pillArrowPath(dir: ExpandDirection) {
  switch (dir) {
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
      return 'M4 7 L4 1 M1 3 L4 1 L7 3';
    case 'center-left':
      return 'M1 4 L7 4 M5 1 L7 4 L5 7';
    case 'center-right':
      return 'M7 4 L1 4 M3 1 L1 4 L3 7';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}
const CATEGORY_META: Record<WeatherCategory, { description: string }> = {
  clear: { description: 'Clear' },
  'partly-cloudy': { description: 'Partly cloudy' },
  overcast: { description: 'Overcast' },
  fog: { description: 'Fog' },
  drizzle: { description: 'Drizzle' },
  rain: { description: 'Rain' },
  'heavy-rain': { description: 'Heavy rain' },
  snow: { description: 'Snow' },
  'heavy-snow': { description: 'Heavy snow' },
  thunder: { description: 'Thunderstorm' },
};
const SERIF = "'Georgia','Times New Roman',serif";

export interface PaperExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── PaperWidget ──────────────────────────────────────────────────────────────

export function PaperWidget({
  phase,
  blend,
  expandDirection = 'top-right',
  size = 'lg',
  palette: passedPalette,
  showFlag = false,
  showWeather = false,
  hoverEffect = true,
  weather: weatherCategoryOverride = null,
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
}: WidgetSkinProps & PaperExtras) {
  const { coordsReady } = useSolarTheme();
  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('paper-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('paper-widget-expanded', JSON.stringify(next));
    } catch {}
  }, []);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : storedExpanded;
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
  const effectiveIsDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
  const isNight = !effectiveIsDaytime || phase === 'dusk';
  const currentArc = effectiveIsDaytime ? 'day' : 'night';
  const progressTarget = solar.isDaytime ? solar.dayProgress : solar.nightProgress;

  const internalPalette = lerpPaperPalette(
    PAPER_PALETTES[blend.phase],
    PAPER_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'paper');

  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const bloomRef = useRef<SVGCircleElement>(null);
  const centerRef = useRef<SVGCircleElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const { setTarget, resetFirstCall } = useInkOrbRaf({
    bloom: bloomRef,
    center: centerRef,
    arcPath: arcRef,
  });

  const prevCoordsReady = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoordsReady.current) {
      prevCoordsReady.current = true;
      resetFirstCall();
    }
  }, [coordsReady, resetFirstCall]);
  useEffect(() => {
    if (bloomRef.current) bloomRef.current.style.fill = palette.inkBloom;
    if (centerRef.current) centerRef.current.style.fill = palette.inkOrb;
    setTarget(currentArc, progressTarget);
  });
  useEffect(() => {
    if (arcRef.current) {
      arcRef.current.setAttribute('stroke', palette.arc);
      arcRef.current.setAttribute('stroke-opacity', String(palette.arcOpacity));
    }
  });

  const [expandScale, setExpandScale] = useState(SIZE_SCALE[size] ?? 0.9);
  useEffect(() => {
    if (size) {
      setExpandScale(SIZE_SCALE[size] ?? 0.9);
      return;
    }
    const update = () => {
      const vw = window.innerWidth;
      setExpandScale(vw < 640 ? Math.min((vw - 24) / W, 1) : vw < 1024 ? 0.82 : 0.9);
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [size]);

  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);
  const hasTempData =
    temperatureOverride != null || liveTemperatureC != null || liveWeather != null;
  const tempC =
    temperatureOverride ??
    liveTemperatureC ??
    (liveWeather ? liveWeather.temperatureC : PHASE_TEMP[phase]);
  const displayTempStr = hasTempData
    ? temperatureUnit === 'F'
      ? `${toF(tempC)}°F`
      : `${tempC}°C`
    : '';
  const pillTempStr = hasTempData ? (temperatureUnit === 'F' ? `${toF(tempC)}°` : `${tempC}°`) : '';

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weatherCategoryOverride ?? liveWeather?.category ?? null)
        : null;
  const effectiveWeatherIcon: WeatherIconKey | null = effectiveWeatherCategory;
  const effectiveWeatherDescription = effectiveWeatherCategory
    ? weatherCategoryOverride
      ? CATEGORY_META[weatherCategoryOverride].description
      : (liveWeather?.description ?? CATEGORY_META[effectiveWeatherCategory].description)
    : null;
  const expandedSublabel =
    showWeather && effectiveWeatherCategory
      ? `${effectiveWeatherDescription} · ${
          temperatureUnit === 'F' ? `${toF(tempC)}°F` : `${tempC}°C`
        }`
      : palette.sublabel;

  const pillShowWeather = showWeather && effectiveWeatherIcon !== null;

  function fmtMin(m: number) {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';
  const initPt = arcPt(progressTarget);

  function PhaseIcon() {
    const c = palette.pillText;
    if (palette.icon === 'moon') return <MoonIcon color={c} />;
    if (palette.icon === 'sun') return <SunIcon color={c} />;
    return <HorizonIcon color={c} />;
  }

  return (
    <div
      data-skin="paper"
      data-phase={phase}
      className={`relative ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
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
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: 24 }}
              animate={{
                boxShadow: `0 8px 48px 0px ${palette.dropShadow}, 0 2px 12px 0px ${palette.dropShadow}`,
              }}
              transition={{ duration: 1.2 }}
            />

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
                  borderRadius: 24,
                  border: '1px solid rgba(0,0,0,0.10)',
                  boxShadow:
                    'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(0,0,0,0.06)',
                }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(155deg,${palette.bg[0]} 0%,${palette.bg[1]} 52%,${
                      palette.bg[2]
                    } 100%)`,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                />

                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zIndex: 1,
                    backgroundImage: GRAIN_URL,
                    backgroundRepeat: 'repeat',
                    backgroundSize: '240px 240px',
                    mixBlendMode: palette.mode === 'dark' ? 'overlay' : 'multiply',
                    opacity: palette.grain,
                    borderRadius: 24,
                  }}
                />

                <motion.div
                  className="absolute inset-0 overflow-hidden"
                  style={{ zIndex: 2, borderRadius: 24 }}
                  animate={{
                    opacity: isNight ? 0.55 : 0,
                  }}
                  transition={{ duration: 1.2 }}
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative array, order is stable
                      key={i}
                      className="absolute rounded-full"
                      style={{
                        width: Number((sr(i * 3) * 1.2 + 0.4).toFixed(3)),
                        height: Number((sr(i * 3) * 1.2 + 0.4).toFixed(3)),
                        left: `${(sr(i * 7 + 1) * 95).toFixed(3)}%`,
                        top: `${(sr(i * 11 + 2) * 55).toFixed(3)}%`,
                        background: palette.textSecondary,
                        opacity: Number((sr(i * 13) * 0.6 + 0.15).toFixed(3)),
                      }}
                    />
                  ))}
                </motion.div>

                {showWeather && effectiveWeatherCategory && (
                  <WeatherBackdrop
                    category={effectiveWeatherCategory}
                    skin="paper"
                    phaseColors={phaseColors}
                  />
                )}

                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 3,
                    overflow: 'hidden',
                    opacity: coordsReady
                      ? showWeather && effectiveWeatherCategory
                        ? WEATHER_ORB_DIM[effectiveWeatherCategory]
                        : 1
                      : 0,
                    transition: 'opacity 0.8s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    <filter id="paper-bloom" x="-150%" y="-150%" width="400%" height="400%">
                      <feGaussianBlur stdDeviation="14" />
                    </filter>
                    <filter id="paper-arc-soft" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="1.5" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    ref={arcRef}
                    d={ARC_D}
                    fill="none"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    strokeDasharray="4 8"
                    filter="url(#paper-arc-soft)"
                    stroke={palette.arc}
                    strokeOpacity={palette.arcOpacity}
                  />
                  <circle
                    ref={bloomRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={isNight ? 22 : 28}
                    filter="url(#paper-bloom)"
                    style={{
                      fill: palette.inkBloom,
                      transition: 'fill 1.2s ease-in-out',
                    }}
                  />
                  <circle
                    ref={centerRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={isNight ? 7 : 10}
                    style={{
                      fill: palette.inkOrb,
                      filter: 'blur(2px)',
                      transition: 'fill 1.2s ease-in-out',
                    }}
                  />
                </svg>

                {showWeather && effectiveWeatherCategory && (
                  <WeatherLayer
                    category={effectiveWeatherCategory}
                    skin="paper"
                    opacity={effectiveIsDaytime ? 0.72 : 0.88}
                    phaseColors={phaseColors}
                  />
                )}

                {/* z=5 Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-[18px]" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: SERIF,
                          fontStyle: 'italic',
                          fontSize: 24,
                          fontWeight: 400,
                          letterSpacing: '-0.01em',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{ duration: 1 }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        style={{
                          fontFamily: SERIF,
                          fontStyle: 'normal',
                          fontSize: 10,
                          letterSpacing: '0.18em',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                        animate={{
                          color: palette.textSecondary,
                        }}
                        transition={{ duration: 1 }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SERIF,
                        fontSize: 18,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1 }}
                    >
                      {displayTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* z=5 Bottom row */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 5 }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 1 }}
                >
                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↑ {sunriseFmt}
                  </span>

                  {/*
                   * FLAG — expanded bottom row.
                   * Paper's editorial aesthetic suits a small flag badge with
                   * the country name on either side (like a print byline).
                   * PillFlagBadge uses skin="paper" (neutral filter), so the
                   * flag is gently desaturated to match the ink-on-stock world.
                   * No glow — paper doesn't emit light.
                   */}
                  {flagActive && (
                    <motion.span
                      key={countryInfo?.name}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{
                        opacity: 0.82,
                        y: 0,
                      }}
                      exit={{ opacity: 0, y: 3 }}
                      transition={{ duration: 0.55 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: SERIF,
                        fontSize: 9,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        color: palette.textSecondary,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: 14,
                          height: 1,
                          borderRadius: 1,
                          background: 'currentColor',
                          opacity: 0.45,
                        }}
                      />

                      {countryInfo?.name}
                      <span
                        style={{
                          display: 'block',
                          width: 14,
                          height: 1,
                          borderRadius: 1,
                          background: 'currentColor',
                          opacity: 0.45,
                        }}
                      />
                    </motion.span>
                  )}

                  <span
                    style={{
                      fontFamily: SERIF,
                      fontSize: 10,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ {sunsetFmt}
                  </span>
                </motion.div>

                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none"
                  style={{
                    zIndex: 6,
                    height: 1,
                    borderRadius: '24px 24px 0 0',
                    background:
                      'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.55) 30%, rgba(255,255,255,0.55) 70%, transparent 100%)',
                  }}
                />

                {!forceExpanded &&
                  (() => {
                    const side = collapseButtonSide(expandDirection);
                    const isRight = side === 'right';
                    return (
                      <motion.button
                        onClick={() => setIsExpanded(false)}
                        className="flex items-center justify-center cursor-pointer"
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
                        aria-label="Collapse paper widget"
                        style={{
                          position: 'absolute',
                          zIndex: 7,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 24px 0 10px' : '24px 0 10px 0',
                          background: 'transparent',
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
          </motion.div>
        ) : (
          /* ══ PILL ══ */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.75, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: -8 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 36,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 24,
              background: effectivePillBg,
              border: `1px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 18px rgba(0,0,0,0.18), 0 1px 4px ${palette.dropShadow}`,
              backdropFilter: 'blur(8px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.04 } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.95 } : { scale: expandScale * 0.98 }}
            aria-label={`Paper solar widget — ${palette.label}. Click to expand.`}
          >
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
                {pillShowWeather && effectiveWeatherCategory ? (
                  <motion.span
                    key={`glyph-${effectiveWeatherCategory}`}
                    initial={{
                      opacity: 0,
                      scale: 0.65,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.65,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 30,
                      mass: 0.8,
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PillWeatherGlyph
                      category={effectiveWeatherCategory}
                      skin="paper"
                      color={palette.pillText}
                      accentColor={palette.accentColor}
                      phaseIcon={palette.icon}
                      size={20}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-icon"
                    initial={{
                      opacity: 0,
                      scale: 0.65,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.65,
                    }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      damping: 30,
                      mass: 0.8,
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PhaseIcon />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            {/*
             * FLAG — pill.
             * Sits between the phase icon and temperature, using PillFlagBadge
             * with skin="paper". The flag uses a rounded-rect shape (foundry
             * falls through to default 3px borderRadius) which suits paper's
             * non-circular, non-sharp aesthetic. No glow — ink world is matte.
             */}
            {flagActive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.55 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{
                  duration: 0.4,
                  ease: [0.34, 1.56, 0.64, 1],
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <PillFlagBadge
                  code={countryInfo?.code}
                  skin="paper"
                  mode={palette.mode}
                  accent={palette.accentColor}
                  shadow={palette.bg[0]}
                  highlight={palette.textPrimary}
                />
              </motion.span>
            )}

            <motion.span
              style={{
                fontFamily: SERIF,
                fontSize: 13,
                fontWeight: 400,
                letterSpacing: '-0.01em',
              }}
              animate={{ color: palette.pillText }}
              transition={{ duration: 2 }}
            >
              {pillTempStr}
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

            <motion.span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: 11,
                letterSpacing: '0.08em',
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
              style={{ marginLeft: 2, opacity: 0.6 }}
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
