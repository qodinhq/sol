'use client';

/**
 * skins/mineral/mineral.component.tsx
 *
 * FLAG FIX (v5 — flag-badge integration):
 *   Replaced PillFlag helper (CountryFlags React component + CSS filter +
 *   manual octagon clipPath) with PillFlagBadge from shared/flag-badge.
 *   - Removed CountryFlags import and PillFlag function
 *   - countryInfo useMemo now returns just { code, name } (no FlagComponent)
 *   - flagActive guard simplified (no FlagComponent null-check needed)
 *   - Pill render uses <PillFlagBadge skin="mineral" shadow=bg[0] highlight=textPrimary>
 *     for the full gem duotone treatment + octagonal clip + glow halo
 *
 * ICON SWAP (v3): clear → phase icon only; weather → weather glyph only.
 * MOBILE EXPAND FIX (v4): layout box = W*expandScale × H*expandScale.
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

// ─── MineralPalette ───────────────────────────────────────────────────────────

export interface MineralPalette {
  bg: [string, string, string];
  luster: string;
  lustre2: string;
  facetStroke: string;
  facetFill: string;
  arc: string;
  arcOpacity: number;
  edgeGlow: string;
  textPrimary: string;
  textSecondary: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  stone: string;
  accentColor: string;
  outerGlow: string;
  mode: 'light' | 'dim' | 'dark';
  showMoon: boolean;
  facetGlow: string;
  icon: 'sun' | 'moon' | 'dawn' | 'dusk';
}

// ─── MINERAL_PALETTES ─────────────────────────────────────────────────────────

export const MINERAL_PALETTES: Record<SolarPhase, MineralPalette> = {
  midnight: {
    bg: ['#0A0A0E', '#0E0E14', '#14141C'],
    luster: 'rgba(80,80,110,0.18)',
    lustre2: 'rgba(50,50,75,0.10)',
    facetStroke: 'rgba(180,180,220,0.75)',
    facetFill: 'rgba(70,70,105,0.92)',
    facetGlow: 'rgba(140,140,200,0.45)',
    arc: 'rgba(140,140,180,0.30)',
    arcOpacity: 0.3,
    edgeGlow: 'rgba(120,120,160,0.20)',
    textPrimary: '#C0C0D8',
    textSecondary: 'rgba(160,160,192,0.55)',
    pillBg: 'rgba(14,14,20,0.97)',
    pillBorder: 'rgba(120,120,160,0.35)',
    pillText: '#A0A0C0',
    label: 'Midnight',
    sublabel: 'Obsidian',
    stone: 'Obsidian',
    accentColor: '#8080A8',
    outerGlow: 'rgba(80,80,120,0.20)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  night: {
    bg: ['#0C1240', '#102050', '#163060'],
    luster: 'rgba(80,120,240,0.22)',
    lustre2: 'rgba(40,80,200,0.12)',
    facetStroke: 'rgba(220,180,80,0.80)',
    facetFill: 'rgba(40,60,130,0.92)',
    facetGlow: 'rgba(100,140,255,0.50)',
    arc: 'rgba(160,180,255,0.38)',
    arcOpacity: 0.38,
    edgeGlow: 'rgba(100,140,255,0.22)',
    textPrimary: '#C0D0FF',
    textSecondary: 'rgba(160,180,240,0.58)',
    pillBg: 'rgba(12,20,64,0.97)',
    pillBorder: 'rgba(160,180,255,0.35)',
    pillText: '#A0B8F0',
    label: 'Night',
    sublabel: 'Lapis Lazuli',
    stone: 'Lapis Lazuli',
    accentColor: '#6080D0',
    outerGlow: 'rgba(60,100,220,0.28)',
    mode: 'dark',
    showMoon: true,
    icon: 'moon',
  },
  dawn: {
    bg: ['#E8C8CC', '#F0D4D8', '#F8E4E8'],
    luster: 'rgba(255,210,220,0.55)',
    lustre2: 'rgba(240,180,196,0.30)',
    facetStroke: 'rgba(200,120,140,0.55)',
    facetFill: 'rgba(228,168,180,0.85)',
    facetGlow: 'rgba(240,160,180,0.40)',
    arc: 'rgba(180,100,120,0.45)',
    arcOpacity: 0.45,
    edgeGlow: 'rgba(220,160,175,0.35)',
    textPrimary: '#4A2028',
    textSecondary: 'rgba(100,56,68,0.58)',
    pillBg: 'rgba(240,212,218,0.96)',
    pillBorder: 'rgba(180,100,120,0.38)',
    pillText: '#3A1820',
    label: 'Dawn',
    sublabel: 'Rose Quartz',
    stone: 'Rose Quartz',
    accentColor: '#C07080',
    outerGlow: 'rgba(200,120,140,0.25)',
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  sunrise: {
    bg: ['#A83010', '#C84020', '#E05030'],
    luster: 'rgba(255,160,80,0.38)',
    lustre2: 'rgba(240,120,48,0.20)',
    facetStroke: 'rgba(255,220,140,0.75)',
    facetFill: 'rgba(192,64,32,0.90)',
    facetGlow: 'rgba(255,160,80,0.50)',
    arc: 'rgba(255,200,120,0.50)',
    arcOpacity: 0.5,
    edgeGlow: 'rgba(255,160,80,0.28)',
    textPrimary: '#FFF0E0',
    textSecondary: 'rgba(255,224,192,0.65)',
    pillBg: 'rgba(160,48,16,0.96)',
    pillBorder: 'rgba(255,160,80,0.45)',
    pillText: '#FFE8D0',
    label: 'Sunrise',
    sublabel: 'Carnelian',
    stone: 'Carnelian',
    accentColor: '#F08040',
    outerGlow: 'rgba(240,120,48,0.35)',
    mode: 'dim',
    showMoon: false,
    icon: 'dawn',
  },
  morning: {
    bg: ['#D4A010', '#E8B820', '#F8D040'],
    luster: 'rgba(255,240,160,0.60)',
    lustre2: 'rgba(255,220,80,0.30)',
    facetStroke: 'rgba(180,120,8,0.55)',
    facetFill: 'rgba(220,168,24,0.88)',
    facetGlow: 'rgba(255,220,80,0.45)',
    arc: 'rgba(160,100,8,0.45)',
    arcOpacity: 0.45,
    edgeGlow: 'rgba(255,220,80,0.40)',
    textPrimary: '#2A1A00',
    textSecondary: 'rgba(64,40,0,0.58)',
    pillBg: 'rgba(200,152,16,0.97)',
    pillBorder: 'rgba(160,100,8,0.40)',
    pillText: '#1C1200',
    label: 'Morning',
    sublabel: 'Citrine',
    stone: 'Citrine',
    accentColor: '#C09010',
    outerGlow: 'rgba(220,168,24,0.30)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  'solar-noon': {
    bg: ['#40A890', '#50C0A8', '#70D8C0'],
    luster: 'rgba(200,255,248,0.55)',
    lustre2: 'rgba(140,240,220,0.28)',
    facetStroke: 'rgba(16,80,68,0.50)',
    facetFill: 'rgba(64,176,152,0.88)',
    facetGlow: 'rgba(120,240,210,0.40)',
    arc: 'rgba(16,80,68,0.42)',
    arcOpacity: 0.42,
    edgeGlow: 'rgba(160,240,224,0.40)',
    textPrimary: '#082820',
    textSecondary: 'rgba(16,60,48,0.58)',
    pillBg: 'rgba(56,152,128,0.97)',
    pillBorder: 'rgba(16,80,68,0.38)',
    pillText: '#041C14',
    label: 'Solar noon',
    sublabel: 'Aquamarine',
    stone: 'Aquamarine',
    accentColor: '#208068',
    outerGlow: 'rgba(64,176,152,0.30)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  afternoon: {
    bg: ['#B87010', '#D08820', '#E8A030'],
    luster: 'rgba(255,220,120,0.48)',
    lustre2: 'rgba(240,180,64,0.25)',
    facetStroke: 'rgba(255,240,160,0.70)',
    facetFill: 'rgba(196,128,24,0.90)',
    facetGlow: 'rgba(255,200,80,0.45)',
    arc: 'rgba(255,220,100,0.48)',
    arcOpacity: 0.48,
    edgeGlow: 'rgba(255,200,80,0.30)',
    textPrimary: '#FFF0D0',
    textSecondary: 'rgba(255,228,176,0.65)',
    pillBg: 'rgba(168,104,16,0.97)',
    pillBorder: 'rgba(255,200,80,0.45)',
    pillText: '#FFE8C0',
    label: 'Afternoon',
    sublabel: 'Amber',
    stone: 'Amber',
    accentColor: '#E89820',
    outerGlow: 'rgba(216,136,24,0.32)',
    mode: 'light',
    showMoon: false,
    icon: 'sun',
  },
  sunset: {
    bg: ['#5A0818', '#780C20', '#981428'],
    luster: 'rgba(200,60,80,0.30)',
    lustre2: 'rgba(160,32,56,0.18)',
    facetStroke: 'rgba(255,160,140,0.72)',
    facetFill: 'rgba(150,32,48,0.92)',
    facetGlow: 'rgba(255,100,100,0.45)',
    arc: 'rgba(255,140,120,0.45)',
    arcOpacity: 0.45,
    edgeGlow: 'rgba(200,60,80,0.28)',
    textPrimary: '#FFD8D8',
    textSecondary: 'rgba(255,200,200,0.60)',
    pillBg: 'rgba(80,8,24,0.97)',
    pillBorder: 'rgba(200,80,96,0.45)',
    pillText: '#FFC8C8',
    label: 'Sunset',
    sublabel: 'Garnet',
    stone: 'Garnet',
    accentColor: '#C04060',
    outerGlow: 'rgba(160,24,48,0.35)',
    mode: 'dim',
    showMoon: false,
    icon: 'dusk',
  },
  dusk: {
    bg: ['#280840', '#380C58', '#501070'],
    luster: 'rgba(160,80,240,0.28)',
    lustre2: 'rgba(120,48,200,0.16)',
    facetStroke: 'rgba(220,180,255,0.75)',
    facetFill: 'rgba(90,32,148,0.92)',
    facetGlow: 'rgba(180,120,255,0.50)',
    arc: 'rgba(200,160,255,0.42)',
    arcOpacity: 0.42,
    edgeGlow: 'rgba(160,80,240,0.25)',
    textPrimary: '#EED8FF',
    textSecondary: 'rgba(220,192,255,0.60)',
    pillBg: 'rgba(36,8,64,0.97)',
    pillBorder: 'rgba(160,100,240,0.42)',
    pillText: '#DCC0FF',
    label: 'Dusk',
    sublabel: 'Amethyst',
    stone: 'Amethyst',
    accentColor: '#9040C0',
    outerGlow: 'rgba(120,32,200,0.32)',
    mode: 'dark',
    showMoon: true,
    icon: 'dusk',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpMineralPalette(
  from: MineralPalette,
  to: MineralPalette,
  t: number,
): MineralPalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    luster: lerpColor(from.luster, to.luster, t),
    lustre2: lerpColor(from.lustre2, to.lustre2, t),
    facetStroke: lerpColor(from.facetStroke, to.facetStroke, t),
    facetFill: lerpColor(from.facetFill, to.facetFill, t),
    facetGlow: lerpColor(from.facetGlow, to.facetGlow, t),
    arc: lerpColor(from.arc, to.arc, t),
    arcOpacity: lerpNum(from.arcOpacity, to.arcOpacity, t),
    edgeGlow: lerpColor(from.edgeGlow, to.edgeGlow, t),
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

// ─── Facet orb RAF ────────────────────────────────────────────────────────────

function useFacetRaf(groupRef: React.RefObject<SVGGElement>) {
  const curProg = useRef(-1);
  const tgtProg = useRef(0.5);
  const curArc = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);

  const setPos = (x: number, y: number) => {
    if (groupRef.current) {
      groupRef.current.setAttribute('transform', `translate(${x},${y})`);
    }
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

// ─── CrystalSunOrb ────────────────────────────────────────────────────────────

export function CrystalSunOrb({
  fill,
  stroke,
  size = 14,
}: { fill: string; stroke: string; size?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 30) * Math.PI) / 180;
    return [size * Math.cos(a), size * Math.sin(a)];
  });
  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 30) * Math.PI) / 180;
    return [size * 0.62 * Math.cos(a), size * 0.62 * Math.sin(a)];
  });
  const hexPts = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const innerPts = inner.map(([x, y]) => `${x},${y}`).join(' ');
  const hiPts = [pts[5], pts[0], pts[1]].map(([x, y]) => `${x},${y}`).join(' ');
  const specPts = [inner[5], pts[0], inner[0]].map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <g>
      <defs>
        <linearGradient
          id="csun-grad"
          x1={-size}
          y1={-size}
          x2={size}
          y2={size}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.60)" />
          <stop offset="35%" stopColor={fill} />
          <stop offset="100%" stopColor={`${fill}BB`} />
        </linearGradient>
        <linearGradient
          id="csun-shine"
          x1={-size * 0.5}
          y1={-size}
          x2={size * 0.5}
          y2={size}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor="rgba(255,255,255,0.22)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
        </linearGradient>
      </defs>
      <polygon
        points={hexPts}
        fill="url(#csun-grad)"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <polygon
        points={innerPts}
        fill="url(#csun-shine)"
        stroke="rgba(255,255,255,0.22)"
        strokeWidth="0.8"
        strokeLinejoin="round"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1={inner[i][0]}
          y1={inner[i][1]}
          x2={pts[i][0]}
          y2={pts[i][1]}
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="0.7"
        />
      ))}
      <polygon points={hiPts} fill="rgba(255,255,255,0.28)" stroke="none" />
      <polygon points={specPts} fill="rgba(255,255,255,0.44)" stroke="none" />
    </g>
  );
}

// ─── DarkGemOrb ───────────────────────────────────────────────────────────────

export function DarkGemOrb({
  fill,
  stroke,
  size = 14,
}: { fill: string; stroke: string; size?: number }) {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 30) * Math.PI) / 180;
    return [size * Math.cos(a), size * Math.sin(a)];
  });
  const inner = Array.from({ length: 6 }, (_, i) => {
    const a = ((i * 60 - 30) * Math.PI) / 180;
    return [size * 0.55 * Math.cos(a), size * 0.55 * Math.sin(a)];
  });
  const hexPts = pts.map(([x, y]) => `${x},${y}`).join(' ');
  const innerPts = inner.map(([x, y]) => `${x},${y}`).join(' ');
  const crescentPts = [pts[5], pts[0], inner[0], inner[5]].map(([x, y]) => `${x},${y}`).join(' ');
  return (
    <g>
      <defs>
        <radialGradient
          id="dgem-body"
          cx={-size * 0.15}
          cy={-size * 0.15}
          r={size * 1.1}
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0%" stopColor={fill} />
          <stop offset="55%" stopColor={`${fill}AA`} />
          <stop offset="100%" stopColor="rgba(0,0,0,0.82)" />
        </radialGradient>
        <radialGradient id="dgem-core" cx="0" cy="0" r={size * 0.55} gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="rgba(255,255,255,0.50)" />
          <stop offset="55%" stopColor="rgba(255,255,255,0.10)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.00)" />
        </radialGradient>
      </defs>
      <polygon
        points={hexPts}
        fill="url(#dgem-body)"
        stroke={stroke}
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <line
          key={i}
          x1={inner[i][0]}
          y1={inner[i][1]}
          x2={pts[i][0]}
          y2={pts[i][1]}
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="0.7"
        />
      ))}
      <polygon
        points={innerPts}
        fill="url(#dgem-core)"
        stroke="rgba(255,255,255,0.18)"
        strokeWidth="0.6"
        strokeLinejoin="round"
      />
      <polygon points={crescentPts} fill="rgba(255,255,255,0.20)" stroke="none" />
    </g>
  );
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

export interface MineralExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── MineralWidget ────────────────────────────────────────────────────────────

export function MineralWidget({
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
}: WidgetSkinProps & MineralExtras) {
  const { coordsReady } = useSolarTheme();
  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('mineral-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('mineral-widget-expanded', JSON.stringify(next));
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
  const isDarkGem = !effectiveIsDaytime;

  const internalPalette = lerpMineralPalette(
    MINERAL_PALETTES[blend.phase],
    MINERAL_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'mineral');

  // ── Flag — code + name only; PillFlagBadge handles rendering ──────────────
  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const facetGroupRef = useRef<SVGGElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const { setTarget, resetFirstCall } = useFacetRaf(facetGroupRef);

  const prevCoordsReady = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoordsReady.current) {
      prevCoordsReady.current = true;
      resetFirstCall();
    }
  }, [coordsReady, resetFirstCall]);
  useEffect(() => {
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
      : palette.stone;

  const pillShowWeather =
    showWeather && effectiveWeatherIcon !== null && effectiveWeatherIcon !== 'clear';

  const pillMinWidth = useMemo(() => {
    let w = 82; // base: icon(20) + gap(8) + dot(3) + gap(8) + label(~35) + arrow(10+2)
    if (showWeather) w += 36; // temp text slot
    if (showFlag) w += 28; // flag badge slot
    return w;
  }, [showWeather, showFlag]);

  function fmtMin(m: number) {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const baseOrbOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;
  const orbOpacity = coordsReady ? baseOrbOpacity : 0.7;

  function PhaseIcon() {
    const c = palette.pillText;
    if (palette.icon === 'moon') return <MoonIcon color={c} />;
    if (palette.icon === 'sun') return <SunIcon color={c} />;
    return <HorizonIcon color={c} />;
  }

  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  return (
    <div
      data-skin="mineral"
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
              className="absolute inset-0 rounded-[1.6rem] pointer-events-none"
              animate={{
                boxShadow: `0 0 48px 12px ${palette.outerGlow}, 0 4px 20px rgba(0,0,0,0.30)`,
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
                  borderRadius: '1.6rem',
                  boxShadow: `inset 0 1px 0 ${palette.edgeGlow}, inset 0 -1px 0 rgba(0,0,0,0.20)`,
                }}
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(145deg,${palette.bg[0]} 0%,${palette.bg[1]} 50%,${
                      palette.bg[2]
                    } 100%)`,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 1 }}
                  animate={{
                    background: `radial-gradient(ellipse 60% 55% at 38% 35%, ${palette.luster} 0%, ${palette.lustre2} 45%, transparent 75%)`,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                />
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ zIndex: 2 }}
                  animate={{
                    background: `radial-gradient(ellipse 40% 30% at 72% 68%, ${palette.lustre2} 0%, transparent 65%)`,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                />

                {showWeather && (
                  <motion.div
                    animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, zIndex: 4 }}
                  >
                    {effectiveWeatherCategory && (
                      <WeatherBackdrop
                        category={effectiveWeatherCategory}
                        skin="mineral"
                        phaseColors={phaseColors}
                      />
                    )}
                  </motion.div>
                )}

                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 3,
                    overflow: 'visible',
                    opacity: orbOpacity,
                    transition: 'opacity 0.8s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    <filter id="mineral-facet-shadow" x="-80%" y="-80%" width="260%" height="260%">
                      <feDropShadow
                        dx="0"
                        dy="2"
                        stdDeviation="3"
                        floodColor="rgba(0,0,0,0.45)"
                        result="shadow"
                      />
                      <feMerge>
                        <feMergeNode in="shadow" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="mineral-facet-glow" x="-200%" y="-200%" width="500%" height="500%">
                      <feGaussianBlur stdDeviation="8" />
                    </filter>
                  </defs>
                  <path
                    ref={arcRef}
                    d={ARC_D}
                    fill="none"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    stroke={palette.arc}
                    strokeOpacity={palette.arcOpacity}
                  />
                  <g
                    ref={facetGroupRef}
                    transform={`translate(${arcPt(progressTarget).x},${arcPt(progressTarget).y})`}
                  >
                    <circle r={22} fill={palette.facetGlow} filter="url(#mineral-facet-glow)" />
                    <g filter="url(#mineral-facet-shadow)">
                      {isDarkGem ? (
                        <DarkGemOrb
                          fill={palette.facetFill}
                          stroke={palette.facetStroke}
                          size={14}
                        />
                      ) : (
                        <CrystalSunOrb
                          fill={palette.facetFill}
                          stroke={palette.facetStroke}
                          size={14}
                        />
                      )}
                    </g>
                  </g>
                </svg>

                {showWeather && (
                  <motion.div
                    animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: 0, zIndex: 5 }}
                  >
                    {effectiveWeatherCategory && (
                      <WeatherLayer
                        category={effectiveWeatherCategory}
                        skin="mineral"
                        opacity={effectiveIsDaytime ? 0.78 : 0.95}
                        phaseColors={phaseColors}
                      />
                    )}
                  </motion.div>
                )}

                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 22,
                          fontWeight: 500,
                          letterSpacing: '-0.02em',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{
                          duration: 1.2,
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
                          duration: 1.2,
                        }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SANS,
                        fontSize: 19,
                        fontWeight: 400,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1.2 }}
                    >
                      {displayTempStr}
                    </motion.div>
                  </div>
                </div>

                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 5 }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 1.2 }}
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
                  {flagActive && (
                    <motion.span
                      key={countryInfo?.name}
                      initial={{ opacity: 0, y: 3 }}
                      animate={{
                        opacity: 0.75,
                        y: 0,
                      }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.5 }}
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
                      {countryInfo?.name}
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

                <div
                  className="absolute top-0 left-0 right-0 pointer-events-none"
                  style={{
                    zIndex: 6,
                    height: 1,
                    borderRadius: '1.6rem 1.6rem 0 0',
                    background: `linear-gradient(to right, transparent 0%, ${palette.edgeGlow} 30%, ${palette.edgeGlow} 70%, transparent 100%)`,
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
                        aria-label="Collapse mineral widget"
                        style={{
                          position: 'absolute',
                          zIndex: 7,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 1.6rem 0 12px' : '1.6rem 0 12px 0',
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
                            opacity="0.75"
                          />
                        </svg>
                      </motion.button>
                    );
                  })()}
              </motion.div>
            </div>
          </motion.div>
        ) : (
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
              boxShadow: `0 4px 20px rgba(0,0,0,0.28), 0 0 18px 3px ${palette.outerGlow}`,
              backdropFilter: 'blur(10px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={{ scale: expandScale * 0.95 }}
            aria-label={`Mineral solar widget — ${palette.label}. Click to expand.`}
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
                      skin="mineral"
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

            {showWeather && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: 13,
                  fontWeight: 500,
                  letterSpacing: '-0.01em',
                  minWidth: 28,
                }}
                animate={{ color: palette.pillText, opacity: pillTempStr ? 1 : 0 }}
                transition={{ duration: 1.2 }}
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
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
              animate={{ color: palette.textSecondary }}
              transition={{ duration: 1.2 }}
            >
              {palette.stone}
            </motion.span>

            {/* FLAG — mineral skin: octagonal duotone gem treatment */}
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
                    code={countryInfo?.code}
                    skin="mineral"
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
