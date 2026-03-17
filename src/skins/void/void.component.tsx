'use client';
// ════════════════════════════════════════════════════════════════════════════
// FILE: skins/void/void.component.tsx
// ════════════════════════════════════════════════════════════════════════════
/**
 * The anti-skin. Near-black everything.
 *
 * MOBILE EXPAND FIX (v5):
 *   Outer motion.div layout = W*expandScale × H*expandScale (true visual footprint).
 *   Inner scale wrapper (position:absolute, transformOrigin:'top left') renders
 *   the full W×H card content scaled down. Outer glow stays outside the wrapper.
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { useSolarTheme } from '../../provider/solar-theme-provider';
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

export interface VoidWidgetPalette {
  bg: [string, string];
  arcColor: string;
  orbGlow: string;
  orbCore: string;
  textPrimary: string;
  textSecondary: string;
  outerGlow: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  mode: 'dark';
}

export const VOID_WIDGET_PALETTES: Record<SolarPhase, VoidWidgetPalette> = {
  midnight: {
    bg: ['#040404', '#060608'],
    arcColor: '#282834',
    orbGlow: 'rgba(80,80,110,0.85)',
    orbCore: 'rgba(160,160,200,1.0)',
    textPrimary: '#E0E0F0',
    textSecondary: '#C0C0E0',
    outerGlow: 'rgba(28,28,40,0.30)',
    pillBg: 'rgba(4,4,6,0.96)',
    pillBorder: 'rgba(80,80,110,0.35)',
    pillText: 'rgba(224,224,240,0.40)',
    label: 'midnight',
    mode: 'dark',
  },
  night: {
    bg: ['#040608', '#060A0E'],
    arcColor: '#202838',
    orbGlow: 'rgba(60,80,120,0.85)',
    orbCore: 'rgba(130,150,210,1.0)',
    textPrimary: '#D8E0F0',
    textSecondary: '#B8C8E8',
    outerGlow: 'rgba(22,28,44,0.28)',
    pillBg: 'rgba(4,6,8,0.96)',
    pillBorder: 'rgba(60,80,120,0.32)',
    pillText: 'rgba(216,224,240,0.40)',
    label: 'night',
    mode: 'dark',
  },
  dawn: {
    bg: ['#070604', '#090806'],
    arcColor: '#2E2418',
    orbGlow: 'rgba(110,70,40,0.85)',
    orbCore: 'rgba(200,150,90,1.0)',
    textPrimary: '#F0E8D8',
    textSecondary: '#D8CCC0',
    outerGlow: 'rgba(36,24,14,0.28)',
    pillBg: 'rgba(7,6,4,0.96)',
    pillBorder: 'rgba(100,70,40,0.32)',
    pillText: 'rgba(240,232,216,0.40)',
    label: 'dawn',
    mode: 'dark',
  },
  sunrise: {
    bg: ['#090604', '#0B0806'],
    arcColor: '#381C0E',
    orbGlow: 'rgba(150,60,20,0.88)',
    orbCore: 'rgba(220,110,50,1.0)',
    textPrimary: '#F8E0D0',
    textSecondary: '#E0C4B0',
    outerGlow: 'rgba(44,16,8,0.34)',
    pillBg: 'rgba(9,6,4,0.96)',
    pillBorder: 'rgba(140,60,20,0.36)',
    pillText: 'rgba(248,224,208,0.40)',
    label: 'sunrise',
    mode: 'dark',
  },
  morning: {
    bg: ['#050808', '#070A0A'],
    arcColor: '#182820',
    orbGlow: 'rgba(40,110,70,0.85)',
    orbCore: 'rgba(110,200,140,1.0)',
    textPrimary: '#D8F0E8',
    textSecondary: '#B8D8CC',
    outerGlow: 'rgba(12,28,20,0.28)',
    pillBg: 'rgba(5,8,8,0.96)',
    pillBorder: 'rgba(40,110,70,0.32)',
    pillText: 'rgba(216,240,232,0.40)',
    label: 'morning',
    mode: 'dark',
  },
  'solar-noon': {
    bg: ['#080808', '#0A0A0A'],
    arcColor: '#282828',
    orbGlow: 'rgba(120,120,100,0.85)',
    orbCore: 'rgba(230,220,170,1.0)',
    textPrimary: '#F8F8F8',
    textSecondary: '#E0E0E0',
    outerGlow: 'rgba(28,28,28,0.30)',
    pillBg: 'rgba(8,8,8,0.96)',
    pillBorder: 'rgba(120,120,100,0.35)',
    pillText: 'rgba(248,248,248,0.40)',
    label: 'noon',
    mode: 'dark',
  },
  afternoon: {
    bg: ['#090706', '#0B0908'],
    arcColor: '#30200E',
    orbGlow: 'rgba(120,80,20,0.85)',
    orbCore: 'rgba(210,155,50,1.0)',
    textPrimary: '#F8F0E0',
    textSecondary: '#E0D4C0',
    outerGlow: 'rgba(36,20,8,0.30)',
    pillBg: 'rgba(9,7,6,0.96)',
    pillBorder: 'rgba(110,75,20,0.34)',
    pillText: 'rgba(248,240,224,0.40)',
    label: 'afternoon',
    mode: 'dark',
  },
  sunset: {
    bg: ['#0A0504', '#0C0706'],
    arcColor: '#3C100A',
    orbGlow: 'rgba(160,36,20,0.88)',
    orbCore: 'rgba(230,90,50,1.0)',
    textPrimary: '#F8D8C8',
    textSecondary: '#E0B8A8',
    outerGlow: 'rgba(48,10,6,0.34)',
    pillBg: 'rgba(10,5,4,0.96)',
    pillBorder: 'rgba(150,36,20,0.36)',
    pillText: 'rgba(248,216,200,0.40)',
    label: 'sunset',
    mode: 'dark',
  },
  dusk: {
    bg: ['#060408', '#08060C'],
    arcColor: '#201828',
    orbGlow: 'rgba(70,50,110,0.85)',
    orbCore: 'rgba(150,120,210,1.0)',
    textPrimary: '#E8D8F8',
    textSecondary: '#CCC0E8',
    outerGlow: 'rgba(20,14,30,0.30)',
    pillBg: 'rgba(6,4,8,0.96)',
    pillBorder: 'rgba(70,50,110,0.32)',
    pillText: 'rgba(232,216,248,0.40)',
    label: 'dusk',
    mode: 'dark',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

export function lerpVoidWidgetPalette(
  a: VoidWidgetPalette,
  b: VoidWidgetPalette,
  t: number,
): VoidWidgetPalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = lerpColor;
  return {
    bg: [c(a.bg[0], b.bg[0], t), c(a.bg[1], b.bg[1], t)] as [string, string],
    arcColor: c(a.arcColor, b.arcColor, t),
    orbGlow: c(a.orbGlow, b.orbGlow, t),
    orbCore: c(a.orbCore, b.orbCore, t),
    textPrimary: c(a.textPrimary, b.textPrimary, t),
    textSecondary: c(a.textSecondary, b.textSecondary, t),
    outerGlow: c(a.outerGlow, b.outerGlow, t),
    pillBg: c(a.pillBg, b.pillBg, t),
    pillBorder: c(a.pillBorder, b.pillBorder, t),
    pillText: c(a.pillText, b.pillText, t),
    label: t < 0.5 ? a.label : b.label,
    mode: 'dark',
  };
}

// ─── Arc constants ────────────────────────────────────────────────────────────

const W = 360;
const H = 180;
const ARC_BASE_Y = 165;
const ARC_ZENITH_Y = 30;
const ARC_H = ARC_BASE_Y - ARC_ZENITH_Y;

function arcOrbPos(progress: number) {
  const t = Math.max(0.01, Math.min(0.99, progress));
  return { x: t * W, y: ARC_BASE_Y - ARC_H * 4 * t * (1 - t) };
}

function buildArcPath(pts = 120): string {
  return Array.from({ length: pts }, (_, i) => {
    const t = i / (pts - 1);
    return `${i === 0 ? 'M' : 'L'}${(t * W).toFixed(1)},${(
      ARC_BASE_Y - ARC_H * 4 * t * (1 - t)
    ).toFixed(1)}`;
  }).join(' ');
}

// ─── Orb RAF ──────────────────────────────────────────────────────────────────

function useVoidOrbRaf(refs: {
  glow: React.RefObject<SVGCircleElement>;
  core: React.RefObject<SVGCircleElement>;
}) {
  const curP = useRef(-1);
  const tgtP = useRef(0);
  const rafId = useRef<number | null>(null);
  const first = useRef(true);
  const fading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (p: number) => {
    const t = Math.max(0.01, Math.min(0.99, p));
    const x = t * W;
    const y = ARC_BASE_Y - ARC_H * 4 * t * (1 - t);
    refs.glow.current?.setAttribute('cx', String(x));
    refs.glow.current?.setAttribute('cy', String(y));
    refs.core.current?.setAttribute('cx', String(x));
    refs.core.current?.setAttribute('cy', String(y));
  };
  const setOpacity = (o: number) => {
    if (refs.glow.current) refs.glow.current.style.opacity = String(o);
    if (refs.core.current) refs.core.current.style.opacity = String(o);
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
        if (!rafId.current) rafId.current = requestAnimationFrame(anim);
        fadeTimer.current = null;
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
      () => {
        if (lat == null || lon == null) return;
        fetchWeather(lat, lon)
          .then((x) => {
            if (!dead) setW(x);
          })
          .catch(() => {});
      },
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

// ─── VoidExtras ───────────────────────────────────────────────────────────────

export interface VoidExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── VoidWidget ───────────────────────────────────────────────────────────────

export function VoidWidget({
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
  palette: passedPalette,
  className = '',
  liveWeatherCategory,
  liveTemperatureC,
}: WidgetSkinProps & VoidExtras) {
  const { coordsReady } = useSolarTheme();
  const [stored, setStored] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('void-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStored(next);
    try {
      localStorage.setItem('void-widget-expanded', JSON.stringify(next));
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
  const internalPalette = lerpVoidWidgetPalette(
    VOID_WIDGET_PALETTES[blend.phase],
    VOID_WIDGET_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] || passedPalette.bg[1] !== internalPalette.bg[1];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'void');

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

  const isThunder = effectiveCat === 'thunder';
  const orbDimOpacity = effectiveCat && !isThunder ? WEATHER_ORB_DIM[effectiveCat] : 1;
  const pillShowWeather = showWeather && effectiveCat !== null && effectiveCat !== 'clear';
  const pillPhaseIcon: 'sun' | 'moon' | 'dawn' | 'dusk' =
    phase === 'midnight' || phase === 'night'
      ? 'moon'
      : phase === 'dawn' || phase === 'sunrise'
        ? 'dawn'
        : phase === 'sunset' || phase === 'dusk'
          ? 'dusk'
          : 'sun';

  const glowRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const { setTarget, resetFirst } = useVoidOrbRaf({
    glow: glowRef,
    core: coreRef,
  });
  const prevCoords = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoords.current) {
      prevCoords.current = true;
      resetFirst();
    }
  }, [coordsReady, resetFirst]);
  useEffect(() => {
    if (glowRef.current) glowRef.current.style.fill = palette.orbGlow;
    if (coreRef.current) coreRef.current.style.fill = palette.orbCore;
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

  const fmtMin = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(
      2,
      '0',
    )}`;
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          // ── EXPANDED: outer div = visual footprint (W*scale × H*scale) ──
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
                boxShadow: `0 0 32px 6px ${palette.outerGlow}`,
              }}
              transition={{ duration: 2 }}
            />

            {/* Scale wrapper */}
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
                  border: `1px solid ${palette.arcColor}14`,
                  boxShadow: 'inset 0 1px 1px rgba(255,255,255,0.04)',
                }}
              >
                {/* z=0 Background */}
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(135deg,${palette.bg[0]} 0%,${palette.bg[1]} 100%)`,
                  }}
                  transition={{
                    duration: 2,
                    ease: 'easeInOut',
                  }}
                />

                {/* z=1 Weather backdrop */}
                {showWeather && effectiveCat && (
                  <WeatherBackdrop category={effectiveCat} skin="void" phaseColors={phaseColors} />
                )}

                {/* z=2 Arc hairline */}
                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 2,
                    pointerEvents: 'none',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <path
                    d={arcPath}
                    fill="none"
                    stroke={palette.arcColor}
                    strokeWidth={0.8}
                    opacity={0.14}
                  />
                </svg>

                {/* z=3 Orb SVG */}
                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 3,
                    opacity: coordsReady ? orbDimOpacity : 0,
                    transition: 'opacity 0.9s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    <filter id="void-orb-bloom" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="18" />
                    </filter>
                    <filter id="void-orb-mid" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                  </defs>
                  <g>
                    <circle
                      ref={glowRef}
                      cx={initPos.x}
                      cy={initPos.y}
                      r={56}
                      style={{
                        fill: palette.orbGlow,
                        transition: 'fill 2s ease-in-out',
                      }}
                      filter="url(#void-orb-bloom)"
                    />
                    <circle
                      cx={initPos.x}
                      cy={initPos.y}
                      r={26}
                      style={{
                        fill: palette.orbGlow,
                        transition: 'fill 2s ease-in-out',
                      }}
                      filter="url(#void-orb-mid)"
                      opacity={0.75}
                    />
                    <circle
                      ref={coreRef}
                      cx={initPos.x}
                      cy={initPos.y}
                      r={7}
                      style={{
                        fill: palette.orbCore,
                        transition: 'fill 2s ease-in-out',
                      }}
                    />
                  </g>
                </svg>

                {/* z=4 Weather layer */}
                {showWeather && effectiveCat && (
                  <WeatherLayer
                    category={effectiveCat}
                    skin="void"
                    opacity={isThunder ? 0.92 : 0.12}
                    phaseColors={phaseColors}
                  />
                )}

                {/* z=5 Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 14,
                          fontWeight: 200,
                          letterSpacing: '0.18em',
                          textTransform: 'lowercase',
                          lineHeight: 1,
                          opacity: 0.38,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{ duration: 2 }}
                      >
                        {palette.label}
                      </motion.p>
                      <div
                        style={{
                          marginTop: 5,
                          opacity: 0.22,
                        }}
                      >
                        <span
                          style={{
                            fontFamily: SANS,
                            fontSize: 12,
                            color: palette.textSecondary,
                          }}
                        >
                          ·
                        </span>
                      </div>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SANS,
                        fontSize: 16,
                        fontWeight: 200,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 0.38 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 2 }}
                    >
                      {dispTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* z=5 Bottom row */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{
                    zIndex: 5,
                    opacity: coordsReady && solar.isReady ? 0.28 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                  }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 2 }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                    }}
                  >
                    {sunriseFmt}
                  </span>
                  {flagActive && countryInfo?.name && (
                    <span
                      style={{
                        fontFamily: SANS,
                        fontSize: 8,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                      }}
                    >
                      {countryInfo.name}
                    </span>
                  )}
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                    }}
                  >
                    {sunsetFmt}
                  </span>
                </motion.div>

                {/* z=6 Collapse */}
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
                        aria-label="Collapse void widget"
                        style={{
                          position: 'absolute',
                          zIndex: 6,
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
                        <svg aria-hidden="true" width="8" height="8" viewBox="0 0 8 8" fill="none">
                          {' '}
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
          /* ── PILL (unchanged) ── */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.75, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: -8 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none group"
            style={{
              height: 36,
              paddingLeft: 12,
              paddingRight: 14,
              borderRadius: 18,
              background: effectivePillBg,
              border: `1px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.60),0 0 12px 2px ${palette.outerGlow}`,
              backdropFilter: 'blur(8px)',
              transformOrigin: origin,
              scale: expandScale,
              transition: 'border-color 0.3s,box-shadow 0.3s',
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.95 } : { scale: expandScale * 0.98 }}
            aria-label={`Void widget — ${palette.label}. Click to expand.`}
          >
            <span
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 20,
                height: 20,
                flexShrink: 0,
                position: 'relative',
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
                      skin="void"
                      category={effectiveCat}
                      color={palette.pillText}
                      accentColor={palette.orbCore}
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
                    <span
                      style={{
                        position: 'absolute',
                        width: 16,
                        height: 16,
                        borderRadius: '50%',
                        background: palette.orbGlow,
                        filter: 'blur(5px)',
                        opacity: 0.8,
                      }}
                    />
                    <span
                      style={{
                        position: 'absolute',
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: palette.orbCore,
                      }}
                    />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 200,
                letterSpacing: '-0.01em',
                color: palette.textPrimary,
                opacity: 0.4,
              }}
              className="group-hover:opacity-68 transition-opacity duration-300"
            >
              {hasTempData ? (temperatureUnit === 'F' ? `${toF(tempC)}°` : `${tempC}°`) : ''}
            </motion.span>

            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: palette.pillBorder,
                opacity: 0.45,
                flexShrink: 0,
              }}
            />

            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: 10,
                fontWeight: 200,
                letterSpacing: '0.18em',
                textTransform: 'lowercase',
                color: palette.textPrimary,
                opacity: 0.4,
              }}
              className="group-hover:opacity-68 transition-opacity duration-300"
            >
              {palette.label}
            </motion.span>

            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ marginLeft: 2, opacity: 0.35 }}
              className="group-hover:opacity-60 transition-opacity duration-300"
            >
              <path
                d={pillArrowPath(expandDirection)}
                stroke={palette.textSecondary}
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
