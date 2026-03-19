'use client';

/**
 * skins/meridian/meridian.component.tsx
 *
 * Meridian skin — clean, modern, airy. The anti-Foundry.
 *
 * ICON SWAP (v3):
 *   Clear weather → show only the phase icon (stroke-only sun/moon/horizon).
 *   Any other weather → show only the weather glyph (hairline Meridian marks).
 *   No layering. AnimatePresence drives a clean cross-fade with mode="wait".
 * MOBILE EXPAND FIX (v4):
 *   The expanded card's layout dimensions are now W*expandScale × H*expandScale
 *   so the browser grid positions it using the correct visual footprint.
 *   An inner scale wrapper (position:absolute, transformOrigin:'top left')
 *   renders the full W×H card content scaled down inside that box.
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
import { WeatherIcon, type WeatherIconKey } from '../../shared/solar-weather-icons';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { ExpandDirection, WeatherCategory } from '../../widgets/solar-widget.shell';
import type { WidgetSkinProps } from '../types/widget-skin.types';

// ─── MeridianPalette ──────────────────────────────────────────────────────────

export interface MeridianPalette {
  bg: [string, string, string];
  surface: string;
  orbFill: string;
  orbRing: string;
  arc: string;
  textPrimary: string;
  textSecondary: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  accentColor: string;
  shadow: string;
  mode: 'light' | 'dim' | 'dark';
  showMoon: boolean;
  icon: 'sun' | 'moon' | 'dawn' | 'dusk';
}

// ─── MERIDIAN_PALETTES ────────────────────────────────────────────────────────

export const MERIDIAN_PALETTES: Record<SolarPhase, MeridianPalette> = {
  midnight: {
    bg: ['#111318', '#141720', '#181C26'],
    surface: '#141720',
    orbFill: '#4A6080',
    orbRing: 'rgba(74,96,128,0.35)',
    arc: 'rgba(120,148,184,0.30)',
    textPrimary: '#C8D4E8',
    textSecondary: 'rgba(160,176,200,0.60)',
    pillBg: 'rgba(20,23,32,0.96)',
    pillBorder: 'rgba(120,148,184,0.22)',
    pillText: '#A8BCD4',
    label: 'Midnight',
    sublabel: 'Deep night',
    accentColor: '#5878A0',
    shadow: 'rgba(0,0,0,0.40)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  night: {
    bg: ['#111520', '#141826', '#18202E'],
    surface: '#141826',
    orbFill: '#5080A8',
    orbRing: 'rgba(80,128,168,0.32)',
    arc: 'rgba(120,160,200,0.32)',
    textPrimary: '#C0D0E8',
    textSecondary: 'rgba(152,172,200,0.58)',
    pillBg: 'rgba(20,24,38,0.96)',
    pillBorder: 'rgba(120,160,200,0.22)',
    pillText: '#A0B8D4',
    label: 'Night',
    sublabel: 'Still & clear',
    accentColor: '#5080A8',
    shadow: 'rgba(0,0,0,0.36)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  dawn: {
    bg: ['#F0EAE0', '#F5EFE6', '#FAF5EE'],
    surface: '#F5EFE6',
    orbFill: '#C08050',
    orbRing: 'rgba(192,128,80,0.22)',
    arc: 'rgba(176,120,72,0.35)',
    textPrimary: '#2A2018',
    textSecondary: 'rgba(64,48,32,0.50)',
    pillBg: 'rgba(245,239,230,0.96)',
    pillBorder: 'rgba(176,128,80,0.28)',
    pillText: '#3A2818',
    label: 'Dawn',
    sublabel: 'First light',
    accentColor: '#B87040',
    shadow: 'rgba(48,32,16,0.14)',
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  sunrise: {
    bg: ['#F2EAD8', '#F8F0E0', '#FDF8F0'],
    surface: '#F8F0E0',
    orbFill: '#D09040',
    orbRing: 'rgba(208,144,64,0.22)',
    arc: 'rgba(192,136,56,0.38)',
    textPrimary: '#201808',
    textSecondary: 'rgba(56,40,16,0.52)',
    pillBg: 'rgba(248,240,224,0.96)',
    pillBorder: 'rgba(192,136,56,0.30)',
    pillText: '#2E2010',
    label: 'Sunrise',
    sublabel: 'Golden hour',
    accentColor: '#C08030',
    shadow: 'rgba(48,28,8,0.14)',
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  morning: {
    bg: ['#F5F5F0', '#F9F9F5', '#FDFDFB'],
    surface: '#F9F9F5',
    orbFill: '#D4A020',
    orbRing: 'rgba(212,160,32,0.20)',
    arc: 'rgba(192,148,24,0.35)',
    textPrimary: '#181810',
    textSecondary: 'rgba(40,40,20,0.50)',
    pillBg: 'rgba(249,249,245,0.97)',
    pillBorder: 'rgba(192,148,24,0.26)',
    pillText: '#201C08',
    label: 'Morning',
    sublabel: 'Bright & clear',
    accentColor: '#B89018',
    shadow: 'rgba(32,28,8,0.12)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  'solar-noon': {
    bg: ['#F4F6FA', '#F8FAFD', '#FCFDFF'],
    surface: '#F8FAFD',
    orbFill: '#4890D8',
    orbRing: 'rgba(72,144,216,0.18)',
    arc: 'rgba(64,136,208,0.32)',
    textPrimary: '#101820',
    textSecondary: 'rgba(24,40,64,0.48)',
    pillBg: 'rgba(248,250,253,0.97)',
    pillBorder: 'rgba(64,136,208,0.24)',
    pillText: '#141C28',
    label: 'Solar noon',
    sublabel: 'Peak sun',
    accentColor: '#3880C8',
    shadow: 'rgba(16,32,64,0.10)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  afternoon: {
    bg: ['#F5F2EC', '#F9F6F0', '#FDFAF6'],
    surface: '#F9F6F0',
    orbFill: '#C89030',
    orbRing: 'rgba(200,144,48,0.20)',
    arc: 'rgba(184,132,40,0.35)',
    textPrimary: '#1C1608',
    textSecondary: 'rgba(48,36,12,0.50)',
    pillBg: 'rgba(249,246,240,0.97)',
    pillBorder: 'rgba(184,132,40,0.26)',
    pillText: '#241808',
    label: 'Afternoon',
    sublabel: 'Warm glow',
    accentColor: '#B08020',
    shadow: 'rgba(36,24,8,0.12)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  sunset: {
    bg: ['#EDE0D4', '#F2E8DC', '#F8F0E8'],
    surface: '#F2E8DC',
    orbFill: '#C07050',
    orbRing: 'rgba(192,112,80,0.22)',
    arc: 'rgba(176,104,72,0.36)',
    textPrimary: '#241410',
    textSecondary: 'rgba(60,32,24,0.52)',
    pillBg: 'rgba(242,232,220,0.96)',
    pillBorder: 'rgba(176,104,72,0.28)',
    pillText: '#301810',
    label: 'Sunset',
    sublabel: 'Golden hour',
    accentColor: '#B06040',
    shadow: 'rgba(48,20,8,0.14)',
    mode: 'dim',
    showMoon: false,
    icon: 'dusk',
  },
  dusk: {
    bg: ['#1A1C28', '#1E2030', '#222538'],
    surface: '#1E2030',
    orbFill: '#7060A8',
    orbRing: 'rgba(112,96,168,0.30)',
    arc: 'rgba(140,120,192,0.28)',
    textPrimary: '#C0B8E0',
    textSecondary: 'rgba(160,152,200,0.58)',
    pillBg: 'rgba(30,32,48,0.96)',
    pillBorder: 'rgba(140,120,192,0.24)',
    pillText: '#A898D0',
    label: 'Dusk',
    sublabel: 'Evening twilight',
    accentColor: '#6858A0',
    shadow: 'rgba(0,0,0,0.32)',
    mode: 'dark',
    showMoon: true,
    icon: 'dusk',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

export function lerpMeridianPalette(
  from: MeridianPalette,
  to: MeridianPalette,
  t: number,
): MeridianPalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    surface: lerpColor(from.surface, to.surface, t),
    orbFill: lerpColor(from.orbFill, to.orbFill, t),
    orbRing: lerpColor(from.orbRing, to.orbRing, t),
    arc: lerpColor(from.arc, to.arc, t),
    textPrimary: lerpColor(from.textPrimary, to.textPrimary, t),
    textSecondary: lerpColor(from.textSecondary, to.textSecondary, t),
    pillBg: lerpColor(from.pillBg, to.pillBg, t),
    pillBorder: lerpColor(from.pillBorder, to.pillBorder, t),
    pillText: lerpColor(from.pillText, to.pillText, t),
    accentColor: lerpColor(from.accentColor, to.accentColor, t),
    shadow: lerpColor(from.shadow, to.shadow, t),
    mode: t < 0.5 ? from.mode : to.mode,
  };
}

// ─── Arc geometry ─────────────────────────────────────────────────────────────

const W = 360;
const H = 180;
const CX = 180;
const CY = 200;
const RX = 169.2;
const RY = 171;
const ARC_D = `M ${CX - RX} ${CY} A ${RX} ${RY} 0 0 1 ${CX + RX} ${CY}`;

function arcPt(t: number) {
  const angle = Math.PI * (1 - t);
  return { x: CX + RX * Math.cos(angle), y: CY - RY * Math.sin(angle) };
}

// ─── Orb RAF ──────────────────────────────────────────────────────────────────

interface OrbRefs {
  ring: React.RefObject<SVGCircleElement>;
  fill: React.RefObject<SVGCircleElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useOrbRaf(refs: OrbRefs) {
  const curProg = useRef(-1);
  const tgtProg = useRef(0);
  const curArc = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);

  const setPos = (x: number, y: number) => {
    refs.ring.current?.setAttribute('cx', String(x));
    refs.ring.current?.setAttribute('cy', String(y));
    refs.fill.current?.setAttribute('cx', String(x));
    refs.fill.current?.setAttribute('cy', String(y));
  };

  const anim = () => {
    const diff = tgtProg.current - curProg.current;
    if (Math.abs(diff) > 0.0002) {
      curProg.current += diff * 0.12;
      const { x, y } = arcPt(curProg.current);
      setPos(x, y);
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

// ─── Weather data ─────────────────────────────────────────────────────────────

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

// ─── Shared helpers ───────────────────────────────────────────────────────────

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 540,
  damping: 42,
  mass: 0.8,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 560, damping: 44 };
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
function pillArrowPath(dir: ExpandDirection) {
  switch (dir) {
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
    case 'center-left':
      return 'M1 4 L7 4 M5 1 L7 4 L5 7';
    case 'center-right':
      return 'M7 4 L1 4 M3 1 L1 4 L3 7';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
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
    default:
      return 'M2 2 L6 6 M6 2 L2 6';
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

// ─── Stroke-only icons (Meridian's clean language) ────────────────────────────

function SunIcon({ color }: { color: string }) {
  const R = Math.PI / 180;
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <circle cx="7.5" cy="7.5" r="2.8" stroke={color} strokeWidth="1.2" fill="none" />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={7.5 + 4.6 * Math.cos(a * R)}
          y1={7.5 + 4.6 * Math.sin(a * R)}
          x2={7.5 + 6.2 * Math.cos(a * R)}
          y2={7.5 + 6.2 * Math.sin(a * R)}
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
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <path
        d="M12 9A5 5 0 0 1 6 3c0-.26.02-.52.06-.77A5 5 0 1 0 12 9z"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
function HorizonIcon({ color }: { color: string }) {
  return (
    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" aria-hidden="true">
      <line
        x1="1.5"
        y1="9.5"
        x2="13.5"
        y2="9.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
      />
      <path
        d="M4 9.5 A3.5 3.5 0 0 1 11 9.5"
        stroke={color}
        strokeWidth="1.2"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

// ─── MeridianExtras ───────────────────────────────────────────────────────────

export interface MeridianExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── MeridianWidget ───────────────────────────────────────────────────────────

export function MeridianWidget({
  phase,
  blend,
  expandDirection = 'top-right',
  size = 'lg',
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
  palette: passedPalette,
}: WidgetSkinProps & MeridianExtras) {
  const { coordsReady } = useSolarTheme();
  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('meridian-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('meridian-widget-expanded', JSON.stringify(next));
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

  const internalPalette = lerpMeridianPalette(
    MERIDIAN_PALETTES[blend.phase],
    MERIDIAN_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'meridian');

  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const ringRef = useRef<SVGCircleElement>(null);
  const fillRef = useRef<SVGCircleElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const { setTarget, resetFirstCall } = useOrbRaf({
    ring: ringRef,
    fill: fillRef,
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
    if (ringRef.current) {
      ringRef.current.style.stroke = palette.orbRing;
      ringRef.current.setAttribute('r', isNight ? '16' : '20');
    }
    if (fillRef.current) {
      fillRef.current.style.fill = palette.orbFill;
      fillRef.current.setAttribute('r', isNight ? '5' : '7');
    }
    setTarget(currentArc, progressTarget);
  });
  useEffect(() => {
    if (arcRef.current) {
      arcRef.current.setAttribute('stroke', palette.arc);
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

  const pillShowWeather =
    showWeather && effectiveWeatherIcon !== null && effectiveWeatherIcon !== 'clear';

  const pillMinWidth = useMemo(() => {
    let w = 82;
    if (showWeather) w += 36;
    if (showFlag) w += 28;
    return w;
  }, [showWeather, showFlag]);

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

  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  return (
    <div
      data-skin="meridian"
      data-phase={phase}
      className={`relative ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          /*
           * ── EXPANDED ──────────────────────────────────────────────────────
           *
           * KEY FIX: The outer motion.div now has layout dimensions of
           * W*expandScale × H*expandScale (the widget's true visual footprint).
           * Scale animation is 0.86 → 1 (expandScale is NOT baked in here).
           *
           * An inner "scale wrapper" div (position:absolute, transformOrigin
           * 'top left') renders the full W×H card content scaled by expandScale,
           * exactly filling the outer box with no overflow.
           */
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
            {/* Outer shadow — fills the layout box */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{
                boxShadow: `0 4px 24px 0px ${palette.shadow}, 0 1px 4px 0px ${palette.shadow}`,
              }}
              transition={{ duration: 1.5 }}
            />

            {/*
             * Scale wrapper — renders W×H content scaled down to fit the
             * W*expandScale layout box. transformOrigin 'top left' pins the
             * card's top-left corner so all nine expand directions work.
             */}
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
                className="relative w-full h-full rounded-2xl overflow-hidden"
                animate={{ background: palette.surface }}
                transition={{
                  duration: 1.5,
                  ease: 'easeInOut',
                }}
                style={{
                  border: `1px solid rgba(0,0,0,${palette.mode === 'dark' ? '0.20' : '0.08'})`,
                }}
              >
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveWeatherCategory ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveWeatherCategory && (
                    <WeatherBackdrop
                      category={effectiveWeatherCategory}
                      skin="meridian"
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

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
                  <path
                    ref={arcRef}
                    d={ARC_D}
                    fill="none"
                    strokeWidth="1"
                    strokeLinecap="round"
                    stroke={palette.arc}
                  />
                  <circle
                    ref={ringRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={isNight ? 16 : 20}
                    fill="none"
                    strokeWidth="1"
                    style={{
                      stroke: palette.orbRing,
                      transition: 'stroke 1.5s ease-in-out',
                    }}
                  />
                  <circle
                    ref={fillRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={isNight ? 5 : 7}
                    style={{
                      fill: palette.orbFill,
                      transition: 'fill 1.5s ease-in-out',
                    }}
                  />
                </svg>

                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveWeatherCategory ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveWeatherCategory && (
                    <WeatherLayer
                      category={effectiveWeatherCategory}
                      skin="meridian"
                      opacity={effectiveIsDaytime ? 0.62 : 0.78}
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 20,
                          fontWeight: 500,
                          letterSpacing: '-0.025em',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{
                          duration: 1.5,
                        }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 11,
                          fontWeight: 400,
                          letterSpacing: '0.01em',
                          marginTop: 4,
                        }}
                        animate={{
                          color: palette.textSecondary,
                        }}
                        transition={{
                          duration: 1.5,
                        }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SANS,
                        fontSize: 18,
                        fontWeight: 400,
                        letterSpacing: '-0.02em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1.5 }}
                    >
                      {displayTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* Bottom row */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 5 }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 1.5 }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 10,
                      fontWeight: 400,
                      letterSpacing: '0.04em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↑ {sunriseFmt}
                  </span>
                  {flagActive ? (
                    <motion.span
                      key={countryInfo?.name}
                      initial={{
                        opacity: 0,
                        y: 3,
                      }}
                      animate={{
                        opacity: 0.65,
                        y: 0,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{
                        duration: 0.5,
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontFamily: SANS,
                        fontSize: 9,
                        letterSpacing: '0.18em',
                        textTransform: 'uppercase',
                        color: palette.textSecondary,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: 12,
                          height: 1,
                          background: 'currentColor',
                          opacity: 0.4,
                        }}
                      />
                      {countryInfo?.name}
                      <span
                        style={{
                          display: 'block',
                          width: 12,
                          height: 1,
                          background: 'currentColor',
                          opacity: 0.4,
                        }}
                      />
                    </motion.span>
                  ) : showWeather && effectiveWeatherIcon ? (
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 0.75 }}
                      transition={{
                        duration: 0.5,
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                      }}
                    >
                      <WeatherIcon
                        type={effectiveWeatherIcon}
                        mode={palette.mode}
                        accentColor={palette.accentColor}
                        size={16}
                        animate
                        skin="meridian"
                        phaseColors={phaseColors}
                      />
                    </motion.span>
                  ) : (
                    <motion.span
                      animate={{
                        borderColor: `rgba(0,0,0,${palette.mode === 'dark' ? '0.15' : '0.10'})`,
                      }}
                      transition={{
                        duration: 1.5,
                      }}
                      style={{
                        display: 'block',
                        flex: 1,
                        margin: '0 16px',
                        height: 0,
                        borderTop: '1px solid rgba(0,0,0,0.10)',
                      }}
                    />
                  )}
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 10,
                      fontWeight: 400,
                      letterSpacing: '0.04em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ {sunsetFmt}
                  </span>
                </motion.div>

                {/* Collapse */}
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
                          delay: 0.16,
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                        aria-label="Collapse meridian widget"
                        style={{
                          position: 'absolute',
                          zIndex: 6,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 16px 0 10px' : '16px 0 10px 0',
                          background: 'transparent',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path
                            d="M2 2 L6 6 M6 2 L2 6"
                            stroke={palette.textSecondary}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.60"
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
          /* ══ PILL ══ */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.8, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: -6 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 34,
              minWidth: pillMinWidth,
              paddingLeft: 10,
              paddingRight: 13,
              borderRadius: 17,
              background: effectivePillBg,
              border: `1px solid ${effectivePillBorder}`,
              boxShadow: `0 2px 12px ${palette.shadow}`,
              backdropFilter: palette.mode === 'light' ? 'blur(8px)' : 'none',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.04 } : undefined}
            whileTap={{ scale: expandScale * 0.96 }}
            aria-label={`Meridian solar widget — ${palette.label}. Click to expand.`}
          >
            <span
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 18,
                height: 18,
                flexShrink: 0,
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {pillShowWeather && effectiveWeatherCategory ? (
                  <motion.span
                    key={`glyph-${effectiveWeatherCategory}`}
                    initial={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    transition={{
                      duration: 0.2,
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
                      category={effectiveWeatherCategory}
                      skin="meridian"
                      color={palette.pillText}
                      accentColor={palette.accentColor}
                      phaseIcon={palette.icon}
                      size={18}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-icon"
                    initial={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.7,
                    }}
                    transition={{
                      duration: 0.2,
                      ease: 'easeOut',
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

            {showWeather && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: 12,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  minWidth: 28,
                }}
                animate={{ color: palette.pillText, opacity: pillTempStr ? 1 : 0 }}
                transition={{ duration: 1.5 }}
              >
                {pillTempStr || '\u00A0'}
              </motion.span>
            )}

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
                fontFamily: SANS,
                fontSize: 11,
                fontWeight: 400,
                letterSpacing: '0.01em',
                whiteSpace: 'nowrap',
              }}
              animate={{ color: palette.textSecondary }}
              transition={{ duration: 1.5 }}
            >
              {palette.label}
            </motion.span>

            {showFlag && (
              <motion.span
                animate={{ opacity: flagActive ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}
              >
                {flagActive && (
                  <PillFlagBadge
                    code={countryInfo.code}
                    skin="meridian"
                    mode={palette.mode}
                    accent={palette.accentColor}
                    shadow={palette.surface}
                    highlight={palette.textPrimary}
                    glow={palette.shadow}
                  />
                )}
              </motion.span>
            )}

            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ marginLeft: 2, opacity: 0.45 }}
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
