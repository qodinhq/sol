'use client';

/**
 * skins/aurora/aurora.component.tsx showcase
 *
 * Aurora skin — layered animated northern lights aesthetic.
 *
 * MOBILE EXPAND FIX (v5):
 *   The expanded card's layout dimensions are now W*expandScale × H*expandScale
 *   so the browser grid positions it using the correct visual footprint.
 *   A inner scale wrapper (position:absolute, transformOrigin:'top left')
 *   renders the full W×H card content scaled down inside that box.
 *   This means justify-items: center/end land correctly on narrow viewports.
 *
 * ICON SWAP (v4):
 *   Clear weather → show only the phase icon.
 *   Any other weather → show PillWeatherGlyph (skin="aurora") in the pill.
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

// ─── AuroraPalette ────────────────────────────────────────────────────────────

export interface AuroraPalette {
  bg: [string, string, string];
  band1: string;
  band2: string;
  band3: string;
  auroraOpacity: number;
  coronaInner: string;
  coronaOuter: string;
  orbFill: string;
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
  outerGlow: string;
  mode: 'light' | 'dim' | 'dark';
  showMoon: boolean;
  icon: 'sun' | 'moon' | 'dawn' | 'dusk';
}

// ─── AURORA_PALETTES ──────────────────────────────────────────────────────────

export const AURORA_PALETTES: Record<SolarPhase, AuroraPalette> = {
  midnight: {
    bg: ['#040814', '#060C1C', '#0A1028'],
    band1: '#204080',
    band2: '#104858',
    band3: '#301860',
    auroraOpacity: 0.88,
    coronaInner: 'rgba(80,140,220,0.55)',
    coronaOuter: 'rgba(60,100,180,0.22)',
    orbFill: '#80B8F0',
    arc: 'rgba(100,160,240,0.32)',
    arcOpacity: 0.32,
    textPrimary: '#B8D0F0',
    textSecondary: 'rgba(152,184,224,0.55)',
    pillBg: 'rgba(6,12,28,0.97)',
    pillBorder: 'rgba(80,140,220,0.35)',
    pillText: '#90B8E8',
    label: 'Midnight',
    sublabel: 'Aurora active',
    accentColor: '#5090D0',
    outerGlow: 'rgba(48,100,200,0.28)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  night: {
    bg: ['#040C0C', '#060E10', '#081218'],
    band1: '#105838',
    band2: '#0A4858',
    band3: '#183860',
    auroraOpacity: 0.92,
    coronaInner: 'rgba(64,200,140,0.60)',
    coronaOuter: 'rgba(40,160,100,0.24)',
    orbFill: '#80F0C0',
    arc: 'rgba(80,200,140,0.35)',
    arcOpacity: 0.35,
    textPrimary: '#A8EED0',
    textSecondary: 'rgba(136,216,184,0.55)',
    pillBg: 'rgba(4,12,12,0.97)',
    pillBorder: 'rgba(64,200,140,0.38)',
    pillText: '#80D8B0',
    label: 'Night',
    sublabel: 'Aurora active',
    accentColor: '#40B880',
    outerGlow: 'rgba(40,160,100,0.30)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  dawn: {
    bg: ['#180820', '#241030', '#341840'],
    band1: '#803050',
    band2: '#603870',
    band3: '#402860',
    auroraOpacity: 0.72,
    coronaInner: 'rgba(200,100,160,0.52)',
    coronaOuter: 'rgba(160,72,120,0.22)',
    orbFill: '#F0A0C0',
    arc: 'rgba(200,120,160,0.40)',
    arcOpacity: 0.4,
    textPrimary: '#F0C8E0',
    textSecondary: 'rgba(220,176,200,0.58)',
    pillBg: 'rgba(24,8,32,0.97)',
    pillBorder: 'rgba(200,100,160,0.38)',
    pillText: '#E0A8C8',
    label: 'Dawn',
    sublabel: 'Aurora fading',
    accentColor: '#C06898',
    outerGlow: 'rgba(160,72,120,0.28)',
    mode: 'dark',
    showMoon: false,
    icon: 'dawn',
  },
  sunrise: {
    bg: ['#2A1010', '#401820', '#602030'],
    band1: '#804028',
    band2: '#603050',
    band3: '#502840',
    auroraOpacity: 0.4,
    coronaInner: 'rgba(240,140,80,0.48)',
    coronaOuter: 'rgba(200,100,48,0.20)',
    orbFill: '#FFB870',
    arc: 'rgba(240,160,80,0.45)',
    arcOpacity: 0.45,
    textPrimary: '#FFE8C8',
    textSecondary: 'rgba(240,200,160,0.60)',
    pillBg: 'rgba(40,16,16,0.97)',
    pillBorder: 'rgba(240,140,80,0.38)',
    pillText: '#FFD0A0',
    label: 'Sunrise',
    sublabel: 'Dawn sky',
    accentColor: '#E09040',
    outerGlow: 'rgba(200,100,48,0.28)',
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  morning: {
    bg: ['#E8E0D0', '#F0E8D8', '#F8F4EC'],
    band1: '#C8B080',
    band2: '#C0A870',
    band3: '#B8A060',
    auroraOpacity: 0.08,
    coronaInner: 'rgba(200,160,80,0.28)',
    coronaOuter: 'rgba(180,140,60,0.10)',
    orbFill: '#D4A020',
    arc: 'rgba(180,140,48,0.40)',
    arcOpacity: 0.4,
    textPrimary: '#201808',
    textSecondary: 'rgba(56,40,16,0.52)',
    pillBg: 'rgba(240,232,216,0.97)',
    pillBorder: 'rgba(180,140,48,0.30)',
    pillText: '#181008',
    label: 'Morning',
    sublabel: 'Clear sky',
    accentColor: '#B08820',
    outerGlow: 'rgba(180,140,48,0.18)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  'solar-noon': {
    bg: ['#D8E8F4', '#E4F0F8', '#F0F8FF'],
    band1: '#88B8D8',
    band2: '#90C0E0',
    band3: '#A0C8E8',
    auroraOpacity: 0.05,
    coronaInner: 'rgba(80,160,240,0.22)',
    coronaOuter: 'rgba(60,140,220,0.08)',
    orbFill: '#3090E8',
    arc: 'rgba(60,140,220,0.35)',
    arcOpacity: 0.35,
    textPrimary: '#101C2C',
    textSecondary: 'rgba(20,48,80,0.50)',
    pillBg: 'rgba(220,236,248,0.97)',
    pillBorder: 'rgba(60,140,220,0.28)',
    pillText: '#0C1828',
    label: 'Solar noon',
    sublabel: 'Clear sky',
    accentColor: '#3080C8',
    outerGlow: 'rgba(60,140,220,0.16)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  afternoon: {
    bg: ['#E4DCCC', '#EEE4D4', '#F6F0E4'],
    band1: '#C8A860',
    band2: '#C0A058',
    band3: '#B89850',
    auroraOpacity: 0.06,
    coronaInner: 'rgba(200,160,64,0.28)',
    coronaOuter: 'rgba(180,140,48,0.10)',
    orbFill: '#D09820',
    arc: 'rgba(180,140,40,0.40)',
    arcOpacity: 0.4,
    textPrimary: '#1C1508',
    textSecondary: 'rgba(48,36,12,0.52)',
    pillBg: 'rgba(238,228,212,0.97)',
    pillBorder: 'rgba(180,140,40,0.30)',
    pillText: '#161008',
    label: 'Afternoon',
    sublabel: 'Clear sky',
    accentColor: '#B09018',
    outerGlow: 'rgba(180,140,40,0.16)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  sunset: {
    bg: ['#180810', '#281018', '#3A1820'],
    band1: '#804828',
    band2: '#703858',
    band3: '#582850',
    auroraOpacity: 0.55,
    coronaInner: 'rgba(220,120,80,0.50)',
    coronaOuter: 'rgba(180,80,48,0.22)',
    orbFill: '#F09060',
    arc: 'rgba(220,120,80,0.42)',
    arcOpacity: 0.42,
    textPrimary: '#FFE0C8',
    textSecondary: 'rgba(240,196,160,0.58)',
    pillBg: 'rgba(24,8,16,0.97)',
    pillBorder: 'rgba(220,120,80,0.40)',
    pillText: '#FFD0A8',
    label: 'Sunset',
    sublabel: 'Aurora emerging',
    accentColor: '#D07848',
    outerGlow: 'rgba(180,80,48,0.30)',
    mode: 'dim',
    showMoon: false,
    icon: 'dusk',
  },
  dusk: {
    bg: ['#100818', '#180C24', '#241030'],
    band1: '#603080',
    band2: '#803868',
    band3: '#402870',
    auroraOpacity: 0.78,
    coronaInner: 'rgba(160,80,220,0.55)',
    coronaOuter: 'rgba(120,48,180,0.22)',
    orbFill: '#C080F0',
    arc: 'rgba(160,100,220,0.38)',
    arcOpacity: 0.38,
    textPrimary: '#E8C8FF',
    textSecondary: 'rgba(208,176,240,0.58)',
    pillBg: 'rgba(16,8,24,0.97)',
    pillBorder: 'rgba(160,80,220,0.38)',
    pillText: '#D0A8F8',
    label: 'Dusk',
    sublabel: 'Aurora rising',
    accentColor: '#9848D0',
    outerGlow: 'rgba(120,48,180,0.30)',
    mode: 'dark',
    showMoon: true,
    icon: 'dusk',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAuroraPalette(from: AuroraPalette, to: AuroraPalette, t: number): AuroraPalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    band1: lerpColor(from.band1, to.band1, t),
    band2: lerpColor(from.band2, to.band2, t),
    band3: lerpColor(from.band3, to.band3, t),
    auroraOpacity: lerpNum(from.auroraOpacity, to.auroraOpacity, t),
    coronaInner: lerpColor(from.coronaInner, to.coronaInner, t),
    coronaOuter: lerpColor(from.coronaOuter, to.coronaOuter, t),
    orbFill: lerpColor(from.orbFill, to.orbFill, t),
    arc: lerpColor(from.arc, to.arc, t),
    arcOpacity: lerpNum(from.arcOpacity, to.arcOpacity, t),
    textPrimary: lerpColor(from.textPrimary, to.textPrimary, t),
    textSecondary: lerpColor(from.textSecondary, to.textSecondary, t),
    pillBg: lerpColor(from.pillBg, to.pillBg, t),
    pillBorder: lerpColor(from.pillBorder, to.pillBorder, t),
    pillText: lerpColor(from.pillText, to.pillText, t),
    accentColor: lerpColor(from.accentColor, to.accentColor, t),
    outerGlow: lerpColor(from.outerGlow, to.outerGlow, t),
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

interface AuroraOrbRefs {
  coronaFar: React.RefObject<SVGCircleElement>;
  coronaNear: React.RefObject<SVGCircleElement>;
  center: React.RefObject<SVGCircleElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useAuroraOrbRaf(refs: AuroraOrbRefs) {
  const curProg = useRef(-1);
  const tgtProg = useRef(0);
  const curArc = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);

  const setPos = (x: number, y: number) => {
    for (const r of [refs.coronaFar, refs.coronaNear, refs.center]) {
      r.current?.setAttribute('cx', String(x));
      r.current?.setAttribute('cy', String(y));
    }
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

// ─── Aurora band CSS keyframes ────────────────────────────────────────────────

const AURORA_KEYFRAMES = `
@keyframes aurora-band-1 {
  0%   { transform: translateX(0%) translateY(0px) scaleY(1); }
  33%  { transform: translateX(-12%) translateY(4px) scaleY(1.08); }
  66%  { transform: translateX(-6%) translateY(-3px) scaleY(0.94); }
  100% { transform: translateX(0%) translateY(0px) scaleY(1); }
}
@keyframes aurora-band-2 {
  0%   { transform: translateX(-8%) translateY(0px) scaleY(1); }
  40%  { transform: translateX(4%) translateY(-5px) scaleY(1.12); }
  75%  { transform: translateX(-4%) translateY(3px) scaleY(0.92); }
  100% { transform: translateX(-8%) translateY(0px) scaleY(1); }
}
@keyframes aurora-band-3 {
  0%   { transform: translateX(6%) translateY(0px) scaleY(1); }
  30%  { transform: translateX(-5%) translateY(6px) scaleY(0.90); }
  70%  { transform: translateX(8%) translateY(-4px) scaleY(1.10); }
  100% { transform: translateX(6%) translateY(0px) scaleY(1); }
}
`;

function AuroraBands({
  band1,
  band2,
  band3,
  opacity,
}: {
  band1: string;
  band2: string;
  band3: string;
  opacity: number;
}) {
  if (opacity < 0.02) return null;
  return (
    <>
      <style>{AURORA_KEYFRAMES}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
          opacity,
          zIndex: 1,
          borderRadius: 'inherit',
          transition: 'opacity 2s ease-in-out',
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: '-50%',
            top: '15%',
            width: '200%',
            height: '45%',
            background: `radial-gradient(ellipse 80% 100% at 50% 50%, ${band1}CC 0%, ${band1}66 40%, transparent 75%)`,
            filter: 'blur(28px)',
            animation: 'aurora-band-1 22s ease-in-out infinite',
            opacity: 0.85,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '-40%',
            top: '28%',
            width: '180%',
            height: '30%',
            background: `radial-gradient(ellipse 70% 100% at 45% 50%, ${band2}BB 0%, ${band2}55 45%, transparent 78%)`,
            filter: 'blur(22px)',
            animation: 'aurora-band-2 17s ease-in-out infinite',
            opacity: 0.75,
          }}
        />
        <div
          style={{
            position: 'absolute',
            left: '-30%',
            top: '8%',
            width: '160%',
            height: '25%',
            background: `radial-gradient(ellipse 60% 100% at 55% 50%, ${band3}99 0%, ${band3}44 50%, transparent 80%)`,
            filter: 'blur(18px)',
            animation: 'aurora-band-3 13s ease-in-out infinite',
            opacity: 0.65,
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 0,
            left: '-20%',
            width: '140%',
            height: '22%',
            background: `radial-gradient(ellipse 80% 100% at 50% 100%, ${band1}44 0%, transparent 70%)`,
            filter: 'blur(16px)',
            animation: 'aurora-band-1 28s ease-in-out infinite reverse',
            opacity: 0.4,
          }}
        />
      </div>
    </>
  );
}

// ─── Weather helpers ──────────────────────────────────────────────────────────

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

// ─── Misc helpers ─────────────────────────────────────────────────────────────

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 500,
  damping: 40,
  mass: 0.85,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 520, damping: 42 };
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
    case 'bottom-right':
      return 'M1 1 L7 7 M4 7 L7 7 L7 4';
    case 'bottom-left':
      return 'M7 1 L1 7 M4 7 L1 7 L1 4';
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

function SunIcon({ color }: { color: string }) {
  const R = Math.PI / 180;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <circle cx="8" cy="8" r="3.5" fill={color} />
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <line
          key={a}
          x1={8 + 5.2 * Math.cos(a * R)}
          y1={8 + 5.2 * Math.sin(a * R)}
          x2={8 + 7 * Math.cos(a * R)}
          y2={8 + 7 * Math.sin(a * R)}
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

export interface AuroraExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── AuroraWidget ─────────────────────────────────────────────────────────────

export function AuroraWidget({
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
}: WidgetSkinProps & AuroraExtras) {
  const { coordsReady } = useSolarTheme();
  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('aurora-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('aurora-widget-expanded', JSON.stringify(next));
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
  const currentArc = effectiveIsDaytime ? 'day' : 'night';
  const progressTarget = solar.isDaytime ? solar.dayProgress : solar.nightProgress;

  const internalPalette = lerpAuroraPalette(
    AURORA_PALETTES[blend.phase],
    AURORA_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'aurora');

  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const coronaFarRef = useRef<SVGCircleElement>(null);
  const coronaNearRef = useRef<SVGCircleElement>(null);
  const centerRef = useRef<SVGCircleElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const { setTarget, resetFirstCall } = useAuroraOrbRaf({
    coronaFar: coronaFarRef,
    coronaNear: coronaNearRef,
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
    if (coronaFarRef.current) {
      coronaFarRef.current.style.fill = palette.coronaOuter;
      coronaFarRef.current.setAttribute('r', '28');
    }
    if (coronaNearRef.current) {
      coronaNearRef.current.style.fill = palette.coronaInner;
      coronaNearRef.current.setAttribute('r', '16');
    }
    if (centerRef.current) {
      centerRef.current.style.fill = palette.orbFill;
    }
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
    const baseScale = size ? (SIZE_SCALE[size] ?? 0.9) : 0.9;
    if (size) {
      const vw = typeof window !== 'undefined' ? window.innerWidth : 1024;
      const mobileMax = Math.min((vw - 24) / W, 1);
      setExpandScale(vw < 640 ? Math.min(baseScale, mobileMax) : baseScale);
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
    showWeather && effectiveWeatherCategory !== null && effectiveWeatherCategory !== 'clear';

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
      data-skin="aurora"
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
           * This means the CSS grid in showcase-content sees the correct size
           * and justify-items: center / end work on narrow mobile screens.
           *
           * The scale animation on the outer div goes 0.86 → 1 (no expandScale
           * baked in), because expandScale is already absorbed into width/height.
           *
           * An inner "scale wrapper" div (position:absolute, transformOrigin
           * 'top left') renders the full W×H card content scaled by expandScale,
           * exactly filling the W*expandScale sized outer box with no overflow.
           */
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.86, y: yNudge }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: yNudge * 0.8 }}
            transition={SPRING_EXPAND}
            style={{
              // Layout box = visual footprint — grid positions this correctly
              width: W * expandScale,
              height: H * expandScale,
              transformOrigin: origin,
              position: 'relative',
            }}
            className="select-none"
          >
            {/* Outer glow — fills the layout box (W*expandScale × H*expandScale) */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: '1.8rem' }}
              animate={{
                boxShadow: `0 0 60px 16px ${palette.outerGlow}, 0 4px 20px rgba(0,0,0,0.30)`,
              }}
              transition={{ duration: 1.4 }}
            />

            {/*
             * Scale wrapper — renders W×H content scaled down to fit the
             * W*expandScale layout box. transformOrigin 'top left' means
             * the card's top-left corner is pinned to the outer div's
             * top-left corner, so all nine expand directions work correctly.
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
              {/* Card */}
              <motion.div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: '1.8rem',
                  border: '1px solid rgba(255,255,255,0.08)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.10)',
                }}
              >
                {/* z=0 Sky background */}
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(175deg,${palette.bg[0]} 0%,${palette.bg[1]} 55%,${
                      palette.bg[2]
                    } 100%)`,
                  }}
                  transition={{
                    duration: 1.4,
                    ease: 'easeInOut',
                  }}
                />

                {/* z=1 Aurora bands */}
                <AuroraBands
                  band1={palette.band1}
                  band2={palette.band2}
                  band3={palette.band3}
                  opacity={palette.auroraOpacity}
                />

                {showWeather && (
                  <motion.div
                    animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                  >
                    {effectiveWeatherCategory && (
                      <WeatherBackdrop
                        category={effectiveWeatherCategory}
                        skin="aurora"
                        phaseColors={phaseColors}
                      />
                    )}
                  </motion.div>
                )}

                {/* z=3 Arc + corona orb */}
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
                    <filter id="aurora-corona" x="-150%" y="-150%" width="400%" height="400%">
                      <feGaussianBlur stdDeviation="12" result="b" />
                    </filter>
                    <filter id="aurora-near" x="-100%" y="-100%" width="300%" height="300%">
                      <feGaussianBlur stdDeviation="5" result="b" />
                    </filter>
                  </defs>
                  <path
                    ref={arcRef}
                    d={ARC_D}
                    fill="none"
                    strokeWidth="1.2"
                    strokeLinecap="round"
                    stroke={palette.arc}
                    strokeOpacity={palette.arcOpacity}
                  />
                  <circle
                    ref={coronaFarRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={28}
                    filter="url(#aurora-corona)"
                    style={{
                      fill: palette.coronaOuter,
                      transition: 'fill 1.4s ease-in-out',
                    }}
                  />
                  <circle
                    ref={coronaNearRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={16}
                    filter="url(#aurora-near)"
                    style={{
                      fill: palette.coronaInner,
                      transition: 'fill 1.4s ease-in-out',
                    }}
                  />
                  <circle
                    ref={centerRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={5}
                    style={{
                      fill: palette.orbFill,
                      transition: 'fill 1.4s ease-in-out',
                    }}
                  />
                </svg>

                {showWeather && effectiveWeatherCategory && (
                  <WeatherLayer
                    category={effectiveWeatherCategory}
                    skin="aurora"
                    opacity={effectiveIsDaytime ? 0.7 : 0.88}
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
                          fontSize: 22,
                          fontWeight: 400,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{
                          duration: 1.4,
                        }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 10,
                          fontWeight: 400,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          marginTop: 4,
                        }}
                        animate={{
                          color: palette.textSecondary,
                        }}
                        transition={{
                          duration: 1.4,
                        }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SANS,
                        fontSize: 19,
                        fontWeight: 300,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1.4 }}
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
                  transition={{ duration: 1.4 }}
                >
                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 10,
                      fontWeight: 400,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↑ {sunriseFmt}
                  </span>

                  {showFlag && (
                    <motion.span
                      key={countryInfo?.name}
                      animate={{
                        opacity: flagActive ? 0.75 : 0,
                      }}
                      transition={CONTENT_FADE}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        fontFamily: SANS,
                        fontSize: 9,
                        letterSpacing: '0.20em',
                        textTransform: 'uppercase',
                        color: palette.textSecondary,
                      }}
                    >
                      <span
                        style={{
                          display: 'block',
                          width: 14,
                          height: 1,
                          background: 'currentColor',
                          opacity: 0.4,
                        }}
                      />
                      {countryInfo?.name ?? '\u00A0'}
                      <span
                        style={{
                          display: 'block',
                          width: 14,
                          height: 1,
                          background: 'currentColor',
                          opacity: 0.4,
                        }}
                      />
                    </motion.span>
                  )}

                  <span
                    style={{
                      fontFamily: SANS,
                      fontSize: 10,
                      fontWeight: 400,
                      letterSpacing: '0.10em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ {sunsetFmt}
                  </span>
                </motion.div>

                {/* z=6 Top edge catch-light */}
                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none"
                  style={{
                    zIndex: 6,
                    height: 1,
                    borderRadius: '1.8rem 1.8rem 0 0',
                    background:
                      'linear-gradient(to right, transparent 0%, rgba(255,255,255,0.12) 30%, rgba(255,255,255,0.12) 70%, transparent 100%)',
                  }}
                />

                {/* z=7 Collapse button */}
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
                        aria-label="Collapse aurora widget"
                        style={{
                          position: 'absolute',
                          zIndex: 7,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 1.8rem 0 12px' : '1.8rem 0 12px 0',
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
          /* ══ PILL ══ */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.78, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.78, y: -8 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 36,
              minWidth: pillMinWidth,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 18,
              background: effectivePillBg,
              border: `1.5px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.28), 0 0 20px 4px ${palette.outerGlow}`,
              backdropFilter: 'blur(12px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={{ scale: expandScale * 0.95 }}
            aria-label={`Aurora solar widget — ${palette.label}. Click to expand.`}
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
                      skin="aurora"
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
                  fontSize: 13,
                  fontWeight: 400,
                  letterSpacing: '-0.01em',
                  minWidth: 28,
                }}
                animate={{ color: palette.pillText, opacity: pillTempStr ? 1 : 0 }}
                transition={{ duration: 1.4 }}
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
              transition={{ duration: 1.4 }}
            >
              {palette.label}
            </motion.span>

            {showFlag && (
              <motion.span
                animate={{ opacity: flagActive ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  width: 20,
                  flexShrink: 0,
                }}
              >
                {flagActive && (
                  <PillFlagBadge
                    code={countryInfo.code}
                    skin="aurora"
                    mode={palette.mode}
                    accent={palette.accentColor}
                    shadow={palette.bg[0]}
                    highlight={palette.textPrimary}
                    glow={palette.outerGlow}
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
