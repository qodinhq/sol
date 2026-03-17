'use client';

/**
 * skins/foundry/foundry.component.tsx
 *
 * HYDRATION FIX (v2): Removed mounted pattern.
 * ICON STACK (v2): PhaseIcon fades by weather severity.
 * PHASE-AWARE WEATHER ICONS (v3): pill WeatherIcon receives phaseIcon.
 * ORB WRAP-AROUND (v4):
 *   Uses circular distance to detect wraps in EITHER direction.
 *   Going backwards past 0 → orb snaps to near 1 and continues backwards.
 *   Going forwards past 1 → orb snaps to near 0 and continues forwards.
 *   The snap direction is determined by the sign of the circular delta so
 *   scrubbing against the clock works identically to scrubbing with it.
 * ICON SWAP (v5):
 *   Clear weather → show only the phase icon (no weather glyph).
 *   Any other weather → show only the weather glyph (phase icon hidden).
 *   No more double-icon layering. Clean binary swap.
 * MOBILE EXPAND FIX (v6):
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

// ─── PhasePalette ─────────────────────────────────────────────────────────────

export interface PhasePalette {
  bg: [string, string, string];
  orb: string;
  orbGlow: string;
  arc: string;
  arcOpacity: number;
  textPrimary: string;
  textSecondary: string;
  outerGlow: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  accentColor: string;
  mode: 'light' | 'dim' | 'dark';
  brightness: number;
  showStars: boolean;
  showMoon: boolean;
  icon: 'sun' | 'moon' | 'dawn' | 'dusk';
  flagGlow: string;
}

// ─── PALETTES ─────────────────────────────────────────────────────────────────

export const PALETTES: Record<SolarPhase, PhasePalette> = {
  dawn: {
    bg: ['#3B1054', '#C4614A', '#EF9E6A'],
    orb: '#FFE0A0',
    orbGlow: 'rgba(255,195,75,0.65)',
    arc: 'rgba(255,235,190,0.82)',
    arcOpacity: 0.85,
    textPrimary: '#FFFFFF',
    textSecondary: 'rgba(255,255,255,0.72)',
    outerGlow: 'rgba(240,140,70,0.32)',
    pillBg: 'rgba(59,16,84,0.85)',
    pillBorder: 'rgba(239,158,106,0.45)',
    pillText: '#FFE0A0',
    label: 'Dawn',
    sublabel: 'Civil Twilight',
    accentColor: '#EF9E6A',
    mode: 'dim',
    brightness: 0.15,
    showStars: true,
    showMoon: false,
    icon: 'dawn',
    flagGlow: 'rgba(239,158,106,0.50)',
  },
  sunrise: {
    bg: ['#5A1A1A', '#D4552A', '#F5A050'],
    orb: '#FFF0B0',
    orbGlow: 'rgba(255,220,80,0.80)',
    arc: 'rgba(255,245,210,0.90)',
    arcOpacity: 0.95,
    textPrimary: '#FFF8F0',
    textSecondary: 'rgba(255,240,210,0.78)',
    outerGlow: 'rgba(240,110,40,0.40)',
    pillBg: 'rgba(90,26,26,0.88)',
    pillBorder: 'rgba(245,160,80,0.50)',
    pillText: '#FFF0B0',
    label: 'Sunrise',
    sublabel: 'Golden Hour',
    accentColor: '#F5A050',
    mode: 'dim',
    brightness: 0.35,
    showStars: false,
    showMoon: false,
    icon: 'dawn',
    flagGlow: 'rgba(245,160,80,0.55)',
  },
  morning: {
    bg: ['#E87A3A', '#F5C06A', '#FFE4A5'],
    orb: '#FFFDE0',
    orbGlow: 'rgba(255,248,160,0.85)',
    arc: 'rgba(255,255,235,0.92)',
    arcOpacity: 1,
    textPrimary: '#3A2000',
    textSecondary: 'rgba(58,32,0,0.60)',
    outerGlow: 'rgba(255,170,50,0.28)',
    pillBg: 'rgba(255,235,180,0.92)',
    pillBorder: 'rgba(200,128,32,0.35)',
    pillText: '#3A2000',
    label: 'Morning',
    sublabel: 'Bright & Clear',
    accentColor: '#F5C06A',
    mode: 'light',
    brightness: 0.65,
    showStars: false,
    showMoon: false,
    icon: 'sun',
    flagGlow: 'rgba(245,192,106,0.50)',
  },
  'solar-noon': {
    bg: ['#3A8FD4', '#62B8F0', '#AADCFF'],
    orb: '#FFFEF0',
    orbGlow: 'rgba(255,255,200,0.95)',
    arc: 'rgba(255,255,255,0.98)',
    arcOpacity: 1,
    textPrimary: '#0C2A4A',
    textSecondary: 'rgba(12,42,74,0.60)',
    outerGlow: 'rgba(80,170,255,0.28)',
    pillBg: 'rgba(210,238,255,0.92)',
    pillBorder: 'rgba(40,120,200,0.30)',
    pillText: '#0C2A4A',
    label: 'Solar Noon',
    sublabel: 'Peak Sun',
    accentColor: '#62B8F0',
    mode: 'light',
    brightness: 1,
    showStars: false,
    showMoon: false,
    icon: 'sun',
    flagGlow: 'rgba(98,184,240,0.50)',
  },
  afternoon: {
    bg: ['#C05800', '#E8A030', '#FFE095'],
    orb: '#FFEEAA',
    orbGlow: 'rgba(255,218,95,0.82)',
    arc: 'rgba(255,248,215,0.90)',
    arcOpacity: 0.95,
    textPrimary: '#2A1600',
    textSecondary: 'rgba(42,22,0,0.68)',
    outerGlow: 'rgba(255,145,35,0.28)',
    pillBg: 'rgba(255,240,200,0.94)',
    pillBorder: 'rgba(140,90,15,0.45)',
    pillText: '#2A1600',
    label: 'Afternoon',
    sublabel: 'Warm Glow',
    accentColor: '#E8A030',
    mode: 'light',
    brightness: 0.8,
    showStars: false,
    showMoon: false,
    icon: 'sun',
    flagGlow: 'rgba(232,160,48,0.50)',
  },
  sunset: {
    bg: ['#7A1010', '#C83020', '#E86040'],
    orb: '#FFD0A0',
    orbGlow: 'rgba(255,155,75,0.82)',
    arc: 'rgba(255,215,175,0.82)',
    arcOpacity: 0.82,
    textPrimary: '#FFE8E0',
    textSecondary: 'rgba(255,220,200,0.70)',
    outerGlow: 'rgba(210,75,35,0.40)',
    pillBg: 'rgba(100,16,16,0.88)',
    pillBorder: 'rgba(232,96,64,0.50)',
    pillText: '#FFD0A0',
    label: 'Sunset',
    sublabel: 'Golden Hour',
    accentColor: '#E86040',
    mode: 'dim',
    brightness: 0.3,
    showStars: false,
    showMoon: false,
    icon: 'dusk',
    flagGlow: 'rgba(232,96,64,0.50)',
  },
  dusk: {
    bg: ['#1A0840', '#2E1864', '#4E2888'],
    orb: '#D0C0F8',
    orbGlow: 'rgba(170,145,255,0.55)',
    arc: 'rgba(195,175,255,0.55)',
    arcOpacity: 0.55,
    textPrimary: '#E8DCFF',
    textSecondary: 'rgba(196,182,255,0.68)',
    outerGlow: 'rgba(78,38,150,0.38)',
    pillBg: 'rgba(26,8,64,0.90)',
    pillBorder: 'rgba(144,112,208,0.50)',
    pillText: '#D0C0F8',
    label: 'Dusk',
    sublabel: 'Evening Twilight',
    accentColor: '#9070D0',
    mode: 'dim',
    brightness: 0.1,
    showStars: true,
    showMoon: true,
    icon: 'dusk',
    flagGlow: 'rgba(144,112,208,0.50)',
  },
  night: {
    bg: ['#040810', '#0A1428', '#152038'],
    orb: '#FFFFFF',
    orbGlow: 'rgba(200,220,255,0.90)',
    arc: 'rgba(175,200,240,0.48)',
    arcOpacity: 0.48,
    textPrimary: '#C8DEFF',
    textSecondary: 'rgba(155,195,255,0.62)',
    outerGlow: 'rgba(35,75,155,0.28)',
    pillBg: 'rgba(4,8,20,0.92)',
    pillBorder: 'rgba(48,96,160,0.55)',
    pillText: '#C8DEFF',
    label: 'Night',
    sublabel: 'Clear Sky',
    accentColor: '#3060A0',
    mode: 'dark',
    brightness: 0.02,
    showStars: true,
    showMoon: true,
    icon: 'moon',
    flagGlow: 'rgba(48,96,160,0.50)',
  },
  midnight: {
    bg: ['#010204', '#03070E', '#070F1C'],
    orb: '#C0D5FF',
    orbGlow: 'rgba(135,175,255,0.55)',
    arc: 'rgba(95,135,215,0.28)',
    arcOpacity: 0.3,
    textPrimary: '#88A8C8',
    textSecondary: 'rgba(115,155,195,0.52)',
    outerGlow: 'rgba(18,38,95,0.22)',
    pillBg: 'rgba(1,2,6,0.95)',
    pillBorder: 'rgba(30,56,96,0.55)',
    pillText: '#88A8C8',
    label: 'Midnight',
    sublabel: 'Deep Night',
    accentColor: '#1E3860',
    mode: 'dark',
    brightness: 0,
    showStars: true,
    showMoon: true,
    icon: 'moon',
    flagGlow: 'rgba(30,56,96,0.45)',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpPalette(from: PhasePalette, to: PhasePalette, t: number): PhasePalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    orb: lerpColor(from.orb, to.orb, t),
    orbGlow: lerpColor(from.orbGlow, to.orbGlow, t),
    arc: lerpColor(from.arc, to.arc, t),
    arcOpacity: lerpNum(from.arcOpacity, to.arcOpacity, t),
    textPrimary: lerpColor(from.textPrimary, to.textPrimary, t),
    textSecondary: lerpColor(from.textSecondary, to.textSecondary, t),
    outerGlow: lerpColor(from.outerGlow, to.outerGlow, t),
    pillBg: lerpColor(from.pillBg, to.pillBg, t),
    pillBorder: lerpColor(from.pillBorder, to.pillBorder, t),
    pillText: lerpColor(from.pillText, to.pillText, t),
    accentColor: lerpColor(from.accentColor, to.accentColor, t),
    flagGlow: lerpColor(from.flagGlow, to.flagGlow, t),
    brightness: lerpNum(from.brightness, to.brightness, t),
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
  const angle = Math.PI * (1 - t);
  return { x: CX + RX * Math.cos(angle), y: CY - RY * Math.sin(angle) };
}

// ─── useOrbRaf ────────────────────────────────────────────────────────────────

interface OrbRefs {
  halo: React.RefObject<SVGCircleElement>;
  core: React.RefObject<SVGCircleElement>;
  moonBody: React.RefObject<SVGCircleElement>;
  moonCut: React.RefObject<SVGCircleElement>;
  moonG: React.RefObject<SVGGElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useOrbRaf(refs: OrbRefs) {
  const curProgRef = useRef(-1);
  const tgtProgRef = useRef(0);
  const curArcRef = useRef<string | null>(null);
  const curShowMoon = useRef(false);
  const orbFading = useRef(false);
  const rafId = useRef<number | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstCall = useRef(true);

  const setOrbPos = (x: number, y: number) => {
    refs.halo.current?.setAttribute('cx', String(x));
    refs.halo.current?.setAttribute('cy', String(y));
    refs.core.current?.setAttribute('cx', String(x));
    refs.core.current?.setAttribute('cy', String(y));
    refs.moonBody.current?.setAttribute('cx', String(x));
    refs.moonBody.current?.setAttribute('cy', String(y));
    refs.moonCut.current?.setAttribute('cx', String(x + 5));
    refs.moonCut.current?.setAttribute('cy', String(y - 3));
  };

  const setOrbOpacity = (o: number) => {
    const moon = curShowMoon.current;
    if (refs.halo.current) refs.halo.current.style.opacity = String(o);
    if (refs.core.current) {
      refs.core.current.style.opacity = moon ? '0' : String(o);
    }
    if (refs.moonG.current) {
      refs.moonG.current.style.opacity = moon ? String(o * 0.85) : '0';
    }
  };

  const animOrb = () => {
    const diff = tgtProgRef.current - curProgRef.current;
    if (Math.abs(diff) > 0.0002) {
      curProgRef.current += diff * 0.12;
      const { x, y } = arcPt(curProgRef.current);
      setOrbPos(x, y);
      rafId.current = requestAnimationFrame(animOrb);
    } else {
      curProgRef.current = tgtProgRef.current;
      const { x, y } = arcPt(curProgRef.current);
      setOrbPos(x, y);
      rafId.current = null;
    }
  };

  const setTarget = (newArc: string, prog: number, showMoon: boolean) => {
    curShowMoon.current = showMoon;

    if (firstCall.current) {
      firstCall.current = false;
      curArcRef.current = newArc;
      curProgRef.current = prog;
      tgtProgRef.current = prog;
      const { x, y } = arcPt(prog);
      setOrbPos(x, y);
      setOrbOpacity(1);
      return;
    }

    const arcChanged = curArcRef.current !== null && curArcRef.current !== newArc;

    const rawDelta = prog - curProgRef.current;
    let circDelta = rawDelta;
    if (circDelta > 0.5) circDelta -= 1;
    if (circDelta < -0.5) circDelta += 1;

    const isWrap = Math.abs(rawDelta) > 0.5;
    const smallCorrection = !arcChanged && Math.abs(circDelta) < 0.03;

    if (smallCorrection && !orbFading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      curProgRef.current = prog;
      tgtProgRef.current = prog;
      const { x, y } = arcPt(prog);
      setOrbPos(x, y);
      return;
    }

    const needsSnap = arcChanged || isWrap || Math.abs(circDelta) > 0.15;

    curArcRef.current = newArc;
    tgtProgRef.current = prog;

    if (needsSnap && !orbFading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      orbFading.current = true;
      setOrbOpacity(0);
      fadeTimer.current = setTimeout(() => {
        curProgRef.current = prog;
        const { x, y } = arcPt(prog);
        setOrbPos(x, y);
        setOrbOpacity(1);
        orbFading.current = false;
        if (!rafId.current) {
          rafId.current = requestAnimationFrame(animOrb);
        }
        fadeTimer.current = null;
      }, 160);
    } else if (!orbFading.current) {
      if (!rafId.current) rafId.current = requestAnimationFrame(animOrb);
    }
  };

  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  return {
    setTarget,
    setOrbOpacity,
    resetFirstCall: () => {
      firstCall.current = true;
    },
  };
}

// ─── Seeded random (stars) ────────────────────────────────────────────────────

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Phase icons ──────────────────────────────────────────────────────────────

function SunIcon({ color }: { color: string }) {
  const RAD = Math.PI / 180;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" fill={color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={8 + 5.2 * Math.cos(a * RAD)}
          y1={8 + 5.2 * Math.sin(a * RAD)}
          x2={8 + 7 * Math.cos(a * RAD)}
          y2={8 + 7 * Math.sin(a * RAD)}
          stroke={color}
          strokeWidth="1.5"
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
      <line x1="1" y1="10" x2="15" y2="10" stroke={color} strokeWidth="1.5" strokeLinecap="round" />
      <path
        d="M4 10 A4 4 0 0 1 12 10"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="8" cy="10" r="2" fill={color} />
    </svg>
  );
}

// ─── Weather data hook ────────────────────────────────────────────────────────

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

// ─── Motion springs ───────────────────────────────────────────────────────────

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.8,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 550, damping: 42 };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function getYNudge(dir: ExpandDirection): number {
  if (dir.startsWith('bottom')) return 12;
  if (dir.startsWith('center')) return 0;
  return -12;
}
function collapseArrowPath(dir: ExpandDirection): string {
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
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}
function pillArrowPath(dir: ExpandDirection): string {
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
function collapseButtonSide(dir: ExpandDirection): 'right' | 'left' {
  if (dir === 'top-left' || dir === 'bottom-left' || dir === 'center-left') {
    return 'left';
  }
  return 'right';
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

// ─── FoundryWidget ────────────────────────────────────────────────────────────

export interface FoundryExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;

  className?: string;
}

export function FoundryWidget({
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
  palette: passedPalette,
  className = '',
  liveWeatherCategory,
  liveTemperatureC,
}: WidgetSkinProps & FoundryExtras) {
  const { coordsReady } = useSolarTheme();

  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('solar-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('solar-widget-expanded', JSON.stringify(next));
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

  const rawPalette = lerpPalette(PALETTES[blend.phase], PALETTES[blend.nextPhase], blend.t);
  const palette = { ...rawPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== rawPalette.bg[0] ||
    passedPalette.bg[1] !== rawPalette.bg[1] ||
    passedPalette.bg[2] !== rawPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'foundry');

  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const haloRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const moonBodyRef = useRef<SVGCircleElement>(null);
  const moonCutRef = useRef<SVGCircleElement>(null);
  const moonGRef = useRef<SVGGElement>(null);
  const arcPathRef = useRef<SVGPathElement>(null);

  const { setTarget, resetFirstCall } = useOrbRaf({
    halo: haloRef,
    core: coreRef,
    moonBody: moonBodyRef,
    moonCut: moonCutRef,
    moonG: moonGRef,
    arcPath: arcPathRef,
  });

  const prevCoordsReady = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoordsReady.current) {
      prevCoordsReady.current = true;
      resetFirstCall();
    }
  }, [coordsReady, resetFirstCall]);

  useEffect(() => {
    if (haloRef.current) {
      haloRef.current.setAttribute('r', isNight ? '18' : '24');
      haloRef.current.style.fill = palette.orbGlow;
    }
    if (coreRef.current) {
      coreRef.current.style.fill = palette.orb;
    }
    if (moonBodyRef.current) moonBodyRef.current.style.fill = palette.orb;
    if (moonCutRef.current) moonCutRef.current.style.fill = palette.bg[1];
    setTarget(currentArc, progressTarget, palette.showMoon);
  });
  useEffect(() => {
    if (arcPathRef.current) {
      arcPathRef.current.setAttribute('stroke', palette.arc);
      arcPathRef.current.setAttribute('stroke-opacity', String(palette.arcOpacity));
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

  function fmtMin(m: number) {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  function PhaseIcon() {
    const c = palette.pillText;
    if (palette.icon === 'moon') return <MoonIcon color={c} />;
    if (palette.icon === 'sun') return <SunIcon color={c} />;
    return <HorizonIcon color={c} />;
  }

  const initPt = arcPt(progressTarget);

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
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
            {/* Outer glow — fills the layout box */}
            <motion.div
              className="absolute inset-0 rounded-[1.8rem] pointer-events-none"
              animate={{
                boxShadow: `0 0 55px 18px ${palette.outerGlow}`,
              }}
              transition={{ duration: 1.2 }}
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
                className="relative w-full h-full rounded-[1.8rem] overflow-hidden"
                style={{
                  border: '2.5px solid rgba(255,255,255,0.20)',
                  boxShadow:
                    'inset 0 1.5px 1px rgba(255,255,255,0.16), 0 8px 40px rgba(0,0,0,0.22)',
                }}
              >
                {/* z=0 Background */}
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

                {/* z=1 Stars */}
                <motion.div
                  className="absolute inset-0 overflow-hidden"
                  style={{ zIndex: 1 }}
                  animate={{
                    opacity: palette.showStars ? 0.75 : 0,
                  }}
                  transition={{ duration: 1 }}
                >
                  {Array.from({ length: 32 }).map((_, i) => (
                    <motion.div
                      // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative array, order is stable
                      key={i}
                      className="absolute rounded-full bg-white"
                      style={{
                        width: sr(i * 3) * 1.5 + 0.5,
                        height: sr(i * 3) * 1.5 + 0.5,
                        left: `${sr(i * 7 + 1) * 95}%`,
                        top: `${sr(i * 11 + 2) * 55}%`,
                      }}
                      animate={{
                        opacity: [0.25, 0.9, 0.25],
                      }}
                      transition={{
                        duration: 1.8 + sr(i * 5) * 2.5,
                        repeat: Number.POSITIVE_INFINITY,
                        delay: sr(i * 13) * 3.5,
                        ease: 'easeInOut',
                      }}
                    />
                  ))}
                </motion.div>

                {/* z=2 Weather backdrop */}
                {showWeather && effectiveWeatherCategory && (
                  <WeatherBackdrop
                    category={effectiveWeatherCategory}
                    skin="foundry"
                    phaseColors={phaseColors}
                  />
                )}

                {/* z=3 Arc + orb */}
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
                    <filter id="sw-og" x="-150%" y="-150%" width="400%" height="400%">
                      <feGaussianBlur stdDeviation={isNight ? 7 : 10} result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="sw-ag" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="2.5" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path
                    ref={arcPathRef}
                    d={ARC_D}
                    fill="none"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    filter="url(#sw-ag)"
                    stroke={palette.arc}
                    strokeOpacity={palette.arcOpacity}
                  />
                  <g
                    ref={moonGRef}
                    opacity={isNight && palette.showMoon ? '0.85' : '0'}
                    style={{
                      transition: 'opacity 0.8s',
                    }}
                  >
                    <circle
                      ref={moonBodyRef}
                      cx={initPt.x}
                      cy={initPt.y}
                      r={9}
                      fill={palette.orb}
                    />
                    <circle
                      ref={moonCutRef}
                      cx={initPt.x + 5}
                      cy={initPt.y - 3}
                      r={7}
                      fill={palette.bg[1]}
                    />
                  </g>
                  <circle
                    ref={haloRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={isNight ? 18 : 24}
                    style={{
                      filter: 'blur(10px)',
                      fill: palette.orbGlow,
                      transition: 'fill 1.2s ease-in-out',
                    }}
                  />
                  <circle
                    ref={coreRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={11}
                    filter="url(#sw-og)"
                    style={{
                      fill: palette.orb,
                      opacity: palette.showMoon ? 0 : 1,
                      transition: 'opacity 0.8s, fill 1.2s ease-in-out',
                    }}
                  />
                </svg>

                {/* z=4 Weather overlay */}
                {showWeather && effectiveWeatherCategory && (
                  <WeatherLayer
                    category={effectiveWeatherCategory}
                    skin="foundry"
                    opacity={effectiveIsDaytime ? 0.78 : 0.95}
                    phaseColors={phaseColors}
                  />
                )}

                {/* z=5 Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        className="text-[22px] font-light"
                        style={{
                          fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif",
                          letterSpacing: '0.015em',
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{ duration: 1 }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        className="text-[10px] mt-0.5 uppercase tracking-[0.15em]"
                        style={{
                          fontFamily: "'SF Pro Text','Helvetica Neue',sans-serif",
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
                      className="text-[19px] font-light tabular-nums"
                      style={{
                        fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif",
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
                    className="text-[10px] uppercase tracking-[0.12em]"
                    style={{
                      fontFamily: "'SF Pro Text','Helvetica Neue',sans-serif",
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
                        opacity: 0.75,
                        y: 0,
                      }}
                      exit={{ opacity: 0, y: 3 }}
                      transition={{
                        duration: 0.55,
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        fontFamily: "'SF Pro Text','Helvetica Neue',sans-serif",
                        fontSize: 9,
                        letterSpacing: '0.24em',
                        textTransform: 'uppercase',
                        color: palette.textSecondary,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: 16,
                          height: 1,
                          borderRadius: 1,
                          background: 'currentColor',
                          opacity: 0.5,
                        }}
                      />
                      {countryInfo?.name}
                      <span
                        style={{
                          display: 'block',
                          width: 16,
                          height: 1,
                          borderRadius: 1,
                          background: 'currentColor',
                          opacity: 0.5,
                        }}
                      />
                    </motion.span>
                  ) : null}
                  <span
                    className="text-[10px] uppercase tracking-[0.12em]"
                    style={{
                      fontFamily: "'SF Pro Text','Helvetica Neue',sans-serif",
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ {sunsetFmt}
                  </span>
                </motion.div>

                {/* z=6 Glass sheen */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background: 'linear-gradient(165deg,rgba(255,255,255,0.11) 0%,transparent 42%)',
                    borderRadius: '1.8rem',
                    zIndex: 6,
                  }}
                />

                {/* z=7 Collapse */}
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
                        aria-label="Collapse solar widget"
                        style={{
                          position: 'absolute',
                          zIndex: 7,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 0 0 12px' : '0 0 12px 0',
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
            {/* end scale wrapper */}
          </motion.div>
        ) : (
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
              borderRadius: 18,
              background: effectivePillBg,
              border: `1.5px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.28),0 0 20px 4px ${palette.outerGlow}`,
              backdropFilter: 'blur(12px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.95 } : { scale: expandScale * 0.98 }}
            aria-label={`Solar widget — ${palette.label}. Click to expand.`}
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
                      stiffness: 480,
                      damping: 32,
                      mass: 0.7,
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
                      skin="foundry"
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
                      stiffness: 480,
                      damping: 32,
                      mass: 0.7,
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
                  code={countryInfo.code}
                  skin="foundry"
                  mode={palette.mode}
                  accent={palette.accentColor}
                  shadow={palette.bg[0]}
                  highlight={palette.textPrimary}
                  glow={palette.flagGlow}
                />
              </motion.span>
            )}

            <motion.span
              className="tabular-nums text-[13px] font-light"
              style={{
                letterSpacing: '-0.01em',
                fontFamily: "'SF Pro Display','Helvetica Neue',sans-serif",
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
              className="text-[11px] uppercase tracking-[0.1em]"
              style={{
                fontFamily: "'SF Pro Text','Helvetica Neue',sans-serif",
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
