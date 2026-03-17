'use client';

/**
 * skins/signal/signal.component.tsx
 *
 * Signal skin — brutalist terminal / ship-instrument aesthetic.
 *
 * FLAG UPDATE (v6):
 *   Signal speaks in codes, not icons. Flags are rendered as monospace text:
 *   - Expanded card header: "LOC: XX" — unchanged, already correct.
 *   - Collapsed pill: country code appended as "// XX" after the phase code,
 *     consistent with the pill's existing terminal data-stream pattern.
 *   No flag badge SVGs — this is intentional for the CRT/terminal aesthetic.
 *
 * ICON SWAP (v4):
 *   Clear weather → show only the reticle (Signal's phase orb).
 *   Any other weather → show PillWeatherGlyph skin="signal".
 * MOBILE EXPAND FIX (v5):
 *   Layout dimensions are W*expandScale × H*expandScale; inner scale wrapper
 *   renders full W×H content scaled down with transformOrigin:'top left'.
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { useSolarTheme } from '../../provider/solar-theme-provider';
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

// ─── SignalPalette ────────────────────────────────────────────────────────────

export interface SignalPalette {
  bg: [string, string, string];
  accent: string;
  accentDim: string;
  textPrimary: string;
  textMuted: string;
  pillBg: string;
  pillBorder: string;
  label: string;
  phaseCode: string;
  mode: 'light' | 'dim' | 'dark';
}

// ─── SIGNAL_PALETTES ──────────────────────────────────────────────────────────

export const SIGNAL_PALETTES: Record<SolarPhase, SignalPalette> = {
  midnight: {
    bg: ['#080810', '#0C0C14', '#10101A'],
    accent: '#1E90D4',
    accentDim: 'rgba(30,144,212,0.45)',
    textPrimary: '#90C8E8',
    textMuted: 'rgba(144,200,232,0.45)',
    pillBg: '#0C0C14',
    pillBorder: 'rgba(30,144,212,0.55)',
    label: 'MIDNIGHT',
    phaseCode: 'MIDNIGHT',
    mode: 'dark',
  },
  night: {
    bg: ['#080810', '#0C0C14', '#10101A'],
    accent: '#2E80C0',
    accentDim: 'rgba(46,128,192,0.45)',
    textPrimary: '#80B8D8',
    textMuted: 'rgba(128,184,216,0.45)',
    pillBg: '#0C0C14',
    pillBorder: 'rgba(46,128,192,0.55)',
    label: 'NIGHT',
    phaseCode: 'NIGHT',
    mode: 'dark',
  },
  dawn: {
    bg: ['#0C0A08', '#100E0A', '#14120C'],
    accent: '#D48020',
    accentDim: 'rgba(212,128,32,0.45)',
    textPrimary: '#D4A870',
    textMuted: 'rgba(212,168,112,0.45)',
    pillBg: '#100E0A',
    pillBorder: 'rgba(212,128,32,0.55)',
    label: 'DAWN',
    phaseCode: 'DAWN',
    mode: 'dark',
  },
  sunrise: {
    bg: ['#0C0A08', '#100E0A', '#14120C'],
    accent: '#D4A020',
    accentDim: 'rgba(212,160,32,0.45)',
    textPrimary: '#DEC070',
    textMuted: 'rgba(222,192,112,0.45)',
    pillBg: '#100E0A',
    pillBorder: 'rgba(212,160,32,0.55)',
    label: 'SUNRISE',
    phaseCode: 'SUNRISE',
    mode: 'dark',
  },
  morning: {
    bg: ['#0C0A06', '#100E08', '#14120A'],
    accent: '#C09010',
    accentDim: 'rgba(192,144,16,0.45)',
    textPrimary: '#C8A850',
    textMuted: 'rgba(200,168,80,0.45)',
    pillBg: '#100E08',
    pillBorder: 'rgba(192,144,16,0.55)',
    label: 'MORNING',
    phaseCode: 'MORNING',
    mode: 'dark',
  },
  'solar-noon': {
    bg: ['#0A0A0A', '#0E0E0E', '#141414'],
    accent: '#C8C8A8',
    accentDim: 'rgba(200,200,168,0.40)',
    textPrimary: '#D0D0B8',
    textMuted: 'rgba(208,208,184,0.45)',
    pillBg: '#0E0E0E',
    pillBorder: 'rgba(200,200,168,0.50)',
    label: 'SOLAR NOON',
    phaseCode: 'SOLAR-NOON',
    mode: 'dark',
  },
  afternoon: {
    bg: ['#0C0A06', '#100E08', '#14120A'],
    accent: '#C08820',
    accentDim: 'rgba(192,136,32,0.45)',
    textPrimary: '#C8A858',
    textMuted: 'rgba(200,168,88,0.45)',
    pillBg: '#100E08',
    pillBorder: 'rgba(192,136,32,0.55)',
    label: 'AFTERNOON',
    phaseCode: 'AFTERNOON',
    mode: 'dark',
  },
  sunset: {
    bg: ['#0C0808', '#100C0A', '#14100C'],
    accent: '#C04820',
    accentDim: 'rgba(192,72,32,0.45)',
    textPrimary: '#C88060',
    textMuted: 'rgba(200,128,96,0.45)',
    pillBg: '#100C0A',
    pillBorder: 'rgba(192,72,32,0.55)',
    label: 'SUNSET',
    phaseCode: 'SUNSET',
    mode: 'dark',
  },
  dusk: {
    bg: ['#0C0808', '#100C0A', '#14100C'],
    accent: '#B83020',
    accentDim: 'rgba(184,48,32,0.45)',
    textPrimary: '#C07060',
    textMuted: 'rgba(192,112,96,0.45)',
    pillBg: '#100C0A',
    pillBorder: 'rgba(184,48,32,0.55)',
    label: 'DUSK',
    phaseCode: 'DUSK',
    mode: 'dark',
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

export function lerpSignalPalette(
  from: SignalPalette,
  to: SignalPalette,
  t: number,
): SignalPalette {
  return {
    ...from,
    bg: [
      lerpColor(from.bg[0], to.bg[0], t),
      lerpColor(from.bg[1], to.bg[1], t),
      lerpColor(from.bg[2], to.bg[2], t),
    ] as [string, string, string],
    accent: lerpColor(from.accent, to.accent, t),
    accentDim: lerpColor(from.accentDim, to.accentDim, t),
    textPrimary: lerpColor(from.textPrimary, to.textPrimary, t),
    textMuted: lerpColor(from.textMuted, to.textMuted, t),
    pillBg: lerpColor(from.pillBg, to.pillBg, t),
    pillBorder: lerpColor(from.pillBorder, to.pillBorder, t),
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

// ─── Reticle orb RAF ──────────────────────────────────────────────────────────

interface ReticleRefs {
  group: React.RefObject<SVGGElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useReticleRaf(refs: ReticleRefs) {
  const curProg = useRef(-1);
  const tgtProg = useRef(0);
  const curArc = useRef<string | null>(null);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);

  const setPos = (x: number, y: number) => {
    if (refs.group.current) {
      refs.group.current.setAttribute('transform', `translate(${x},${y})`);
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
      const { x, y } = arcPt(curProg.current);
      setPos(x, y);
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

// ─── Reticle component ────────────────────────────────────────────────────────

export function Reticle({ accent, size = 14 }: { accent: string; size?: number }) {
  const r = size;
  const gap = r * 0.28;
  const arm = r * 0.55;
  return (
    <g>
      <circle cx="0" cy="0" r={r} stroke={accent} strokeWidth="1" fill="none" opacity="0.70" />
      <circle
        cx="0"
        cy="0"
        r={r * 0.35}
        stroke={accent}
        strokeWidth="0.7"
        fill="none"
        opacity="0.50"
      />
      <line
        x1={0}
        y1={-gap}
        x2={0}
        y2={-arm}
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.90"
      />
      <line
        x1={0}
        y1={gap}
        x2={0}
        y2={arm}
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.90"
      />
      <line
        x1={-gap}
        y1={0}
        x2={-arm}
        y2={0}
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.90"
      />
      <line
        x1={gap}
        y1={0}
        x2={arm}
        y2={0}
        stroke={accent}
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.90"
      />
      {[45, 135, 225, 315].map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const ix = Math.cos(rad) * (r + 3);
        const iy = Math.sin(rad) * (r + 3);
        const ox = Math.cos(rad) * (r + 7);
        const oy = Math.sin(rad) * (r + 7);
        return (
          <line
            key={deg}
            x1={ix}
            y1={iy}
            x2={ox}
            y2={oy}
            stroke={accent}
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.45"
          />
        );
      })}
    </g>
  );
}

// ─── Scanline CSS ─────────────────────────────────────────────────────────────

const SCANLINES_STYLE: React.CSSProperties = {
  backgroundImage:
    'repeating-linear-gradient(to bottom, transparent, transparent 2px, rgba(0,0,0,0.08) 2px, rgba(0,0,0,0.08) 4px)',
  pointerEvents: 'none',
};

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
  0: { description: 'CLEAR', category: 'clear' },
  1: { description: 'CLEAR', category: 'clear' },
  2: { description: 'PARTLY CLOUDY', category: 'partly-cloudy' },
  3: { description: 'OVERCAST', category: 'overcast' },
  45: { description: 'FOG', category: 'fog' },
  48: { description: 'FREEZING FOG', category: 'fog' },
  51: { description: 'DRIZZLE', category: 'drizzle' },
  53: { description: 'DRIZZLE', category: 'drizzle' },
  55: { description: 'DRIZZLE', category: 'drizzle' },
  61: { description: 'RAIN', category: 'rain' },
  63: { description: 'RAIN', category: 'rain' },
  65: { description: 'HVY RAIN', category: 'heavy-rain' },
  71: { description: 'SNOW', category: 'snow' },
  73: { description: 'SNOW', category: 'snow' },
  75: { description: 'HVY SNOW', category: 'heavy-snow' },
  80: { description: 'RAIN', category: 'rain' },
  81: { description: 'RAIN', category: 'rain' },
  82: { description: 'HVY RAIN', category: 'heavy-rain' },
  85: { description: 'SNOW', category: 'snow' },
  86: { description: 'HVY SNOW', category: 'heavy-snow' },
  95: { description: 'THUNDER', category: 'thunder' },
  96: { description: 'THUNDER', category: 'thunder' },
  99: { description: 'THUNDER', category: 'thunder' },
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
    description: 'UNKNOWN',
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

// ─── Motion config ────────────────────────────────────────────────────────────

const SLIDE_EXPAND = { duration: 0.2, ease: 'easeOut' as const };
const SLIDE_CONTENT = { duration: 0.15, ease: 'easeOut' as const };

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
function getYNudge(dir: ExpandDirection): number {
  if (dir.startsWith('bottom')) return 12;
  if (dir.startsWith('center')) return 0;
  return -12;
}
function collapseButtonSide(dir: ExpandDirection): 'right' | 'left' {
  if (dir === 'top-left' || dir === 'bottom-left' || dir === 'center-left') {
    return 'left';
  }
  return 'right';
}

export interface SignalExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

const MONO = "'JetBrains Mono','Fira Code','Cascadia Code','Menlo',monospace";

// ─── Country code helper ──────────────────────────────────────────────────────

function useCountryCode(timezone: string | undefined | null): string | null {
  return useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    return tz?.countries?.[0] ?? null;
  }, [timezone]);
}

// ─── SignalWidget ─────────────────────────────────────────────────────────────

export function SignalWidget({
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
}: WidgetSkinProps & SignalExtras) {
  const { coordsReady } = useSolarTheme();
  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('signal-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('signal-widget-expanded', JSON.stringify(next));
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

  const internalPalette = lerpSignalPalette(
    SIGNAL_PALETTES[blend.phase],
    SIGNAL_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'signal');

  // Country code — two-letter ISO code rendered as terminal text field
  const countryCode = useCountryCode(timezone);
  const flagActive = showFlag && countryCode !== null;

  const reticleGroupRef = useRef<SVGGElement>(null);
  const arcRef = useRef<SVGPathElement>(null);
  const { setTarget, resetFirstCall } = useReticleRaf({
    group: reticleGroupRef,
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
    setTarget(currentArc, progressTarget);
  });
  useEffect(() => {
    if (arcRef.current) {
      arcRef.current.setAttribute('stroke', palette.accentDim);
      arcRef.current.setAttribute('stroke-opacity', '0.55');
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

  const wxCode = effectiveWeatherCategory
    ? (liveWeather?.description ?? effectiveWeatherCategory.toUpperCase().replace('-', ' '))
    : null;

  const pillShowWeather =
    showWeather && effectiveWeatherIcon !== null && effectiveWeatherIcon !== 'clear';

  function fmtMin(m: number) {
    const h = Math.floor(m / 60) % 24;
    const mm = Math.round(m % 60);
    return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';
  const initPt = arcPt(progressTarget);

  const [hovered, setHovered] = useState(false);

  return (
    <div
      data-skin="signal"
      data-phase={phase}
      className={`relative ${className}`}
      style={{ isolation: 'isolate' }}
    >
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{
              opacity: 0,
              scale: 0.86,
              y: yNudge * 0.5,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: yNudge * 0.3 }}
            transition={SLIDE_EXPAND}
            style={{
              width: W * expandScale,
              height: H * expandScale,
              transformOrigin: origin,
              position: 'relative',
            }}
            className="select-none"
          >
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
              <div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: 6,
                  background: palette.bg[0],
                  border: `1.5px solid ${palette.accentDim}`,
                }}
              >
                {/* Scanlines */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    ...SCANLINES_STYLE,
                    zIndex: 8,
                    borderRadius: 6,
                  }}
                />

                {showWeather && effectiveWeatherCategory && (
                  <WeatherBackdrop
                    category={effectiveWeatherCategory}
                    skin="signal"
                    phaseColors={phaseColors}
                  />
                )}

                {/* Arc + reticle */}
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
                    transition: 'opacity 0.5s linear',
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
                    strokeDasharray="6 10"
                    stroke={palette.accentDim}
                    strokeOpacity="0.55"
                  />
                  <g ref={reticleGroupRef} transform={`translate(${initPt.x},${initPt.y})`}>
                    <Reticle accent={palette.accent} size={13} />
                  </g>
                </svg>

                {showWeather && effectiveWeatherCategory && (
                  <WeatherLayer
                    category={effectiveWeatherCategory}
                    skin="signal"
                    opacity={0.9}
                    phaseColors={phaseColors}
                  />
                )}

                {/* Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-4" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <motion.p
                        style={{
                          fontFamily: MONO,
                          fontSize: 13,
                          fontWeight: 700,
                          letterSpacing: '0.12em',
                          textTransform: 'uppercase',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.accent,
                        }}
                        transition={{
                          duration: 0.6,
                        }}
                      >
                        {palette.phaseCode}
                      </motion.p>
                      {wxCode && (
                        <motion.p
                          style={{
                            fontFamily: MONO,
                            fontSize: 9,
                            fontWeight: 400,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                          }}
                          animate={{
                            color: palette.textMuted,
                          }}
                          transition={{
                            duration: 0.6,
                          }}
                        >
                          WX: {wxCode}
                        </motion.p>
                      )}
                      {/*
                       * LOC: XX — two-letter country code as a terminal data field.
                       * Consistent with WX:, SR:, SS: — Signal speaks in codes not icons.
                       */}
                      {flagActive && (
                        <motion.p
                          style={{
                            fontFamily: MONO,
                            fontSize: 9,
                            fontWeight: 400,
                            letterSpacing: '0.16em',
                            textTransform: 'uppercase',
                          }}
                          animate={{
                            color: palette.textMuted,
                          }}
                          transition={{
                            duration: 0.6,
                          }}
                        >
                          LOC: {countryCode}
                        </motion.p>
                      )}
                    </div>
                    <motion.div
                      style={{
                        fontFamily: MONO,
                        fontSize: 18,
                        fontWeight: 700,
                        letterSpacing: '0.04em',
                        textAlign: 'right',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.5s linear',
                      }}
                      animate={{
                        color: palette.accent,
                      }}
                      transition={{ duration: 0.6 }}
                    >
                      {displayTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* Bottom row */}
                <div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 5 }}
                >
                  <motion.span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      fontWeight: 400,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.5s linear',
                    }}
                    animate={{
                      color: palette.textMuted,
                    }}
                    transition={{ duration: 0.6 }}
                  >
                    SR: {sunriseFmt}
                  </motion.span>
                  <motion.span
                    animate={{
                      borderColor: palette.accentDim,
                    }}
                    transition={{ duration: 0.6 }}
                    style={{
                      display: 'block',
                      flex: 1,
                      height: 1,
                      borderTop: `1px solid ${palette.accentDim}`,
                      margin: '0 12px',
                      opacity: 0.4,
                    }}
                  />
                  <motion.span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      fontWeight: 400,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.5s linear',
                    }}
                    animate={{
                      color: palette.textMuted,
                    }}
                    transition={{ duration: 0.6 }}
                  >
                    SS: {sunsetFmt}
                  </motion.span>
                </div>

                {/* Collapse */}
                {!forceExpanded &&
                  (() => {
                    const side = collapseButtonSide(expandDirection);
                    const isRight = side === 'right';
                    return (
                      <motion.button
                        onClick={() => setIsExpanded(false)}
                        className="flex items-center justify-center cursor-pointer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={SLIDE_CONTENT}
                        aria-label="Collapse signal widget"
                        style={{
                          position: 'absolute',
                          zIndex: 9,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 6px 0 4px' : '6px 0 4px 0',
                          background: 'transparent',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path
                            d="M1 1 L7 7 M7 1 L1 7"
                            stroke={palette.accent}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            opacity="0.70"
                          />
                        </svg>
                      </motion.button>
                    );
                  })()}
              </div>
            </div>
            {/* end scale wrapper */}
          </motion.div>
        ) : (
          /* ══ COLLAPSED PILL ══ */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            onHoverStart={() => setHovered(true)}
            onHoverEnd={() => setHovered(false)}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={SLIDE_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 34,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 6,
              background: effectivePillBg,
              border: `1.5px solid ${hovered ? palette.accent : effectivePillBorder}`,
              boxShadow: hovered ? `0 0 12px 2px ${palette.accentDim}` : 'none',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              transformOrigin: origin,
              scale: expandScale,
            }}
            aria-label={`Signal widget — ${palette.label}. Click to expand.`}
          >
            {/* Icon slot */}
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
                      scale: 0.5,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.5,
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
                      category={effectiveWeatherCategory}
                      skin="signal"
                      color={palette.accent}
                      accentColor={palette.accent}
                      phaseIcon={undefined}
                      size={20}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="reticle"
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
                    <svg
                      width="20"
                      height="20"
                      viewBox="-8 -8 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <Reticle accent={palette.accent} size={6} />
                    </svg>
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            {/* Temperature */}
            {pillTempStr && (
              <span
                style={{
                  fontFamily: MONO,
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.04em',
                  color: palette.accent,
                }}
              >
                {pillTempStr}
              </span>
            )}

            {/* Separator */}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: palette.accentDim,
                letterSpacing: '0em',
                fontWeight: 400,
                opacity: 0.7,
              }}
            >
              {'//'}
            </span>

            {/* Phase code */}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: palette.textPrimary,
              }}
            >
              {palette.phaseCode}
            </span>

            {/*
             * Country code — appended as "// XX" matching the pill's data-stream
             * pattern. Result: "MIDNIGHT // GB" — pure terminal, no flag image.
             */}
            {flagActive && (
              <>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    color: palette.accentDim,
                    letterSpacing: '0em',
                    fontWeight: 400,
                    opacity: 0.7,
                  }}
                >
                  {'//'}
                </span>
                <span
                  style={{
                    fontFamily: MONO,
                    fontSize: 10,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: palette.textMuted,
                  }}
                >
                  {countryCode}
                </span>
              </>
            )}

            {/* Expand indicator */}
            <span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                color: palette.accentDim,
                opacity: 0.7,
                marginLeft: 2,
              }}
            >
              &gt;
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
