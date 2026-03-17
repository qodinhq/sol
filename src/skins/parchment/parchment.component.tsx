'use client';

/**
 * skins/parchment/parchment.component.tsx
 *
 * PARCHMENT — Notion-native document skin.
 *
 * WEATHER LAYER UPDATE:
 *   Previously weather was communicated only via:
 *     - WEATHER_CALLOUT_TINT (a Notion tag-palette tint div at z=1)
 *     - WEATHER_ORB_DIM (opacity on the orb circle)
 *
 *   Now uses the full shared weather layer stack, tuned for parchment's
 *   restraint. The z-stack in the expanded card is:
 *
 *     z=0  phaseWash          — faint Notion semantic tint (unchanged)
 *     z=1  WeatherBackdrop    — atmospheric gradient at opacity:0.28
 *     z=2  weatherTint div    — Notion callout-palette overlay (unchanged)
 *     z=3  orb arc SVG        — bumped from z=2
 *     z=4  WeatherLayer       — particles/effects at 0.20 (day) / 0.26 (night)
 *     z=5  header / footer / divider rule
 *     z=6  collapse button
 *
 *   Design rationale:
 *     Parchment is a white document surface. Weather effects must read as
 *     subtle paper annotations — not dramatic sky effects. The low opacities
 *     (0.28 backdrop, 0.20–0.26 layer) ensure rain streaks or snow look like
 *     a fine-art wash rather than an animation. WeatherLayer is suppressed
 *     entirely for 'clear' and 'partly-cloudy' since the tint alone is
 *     sufficient. The parchment skin="parchment" passed to WeatherBackdrop
 *     and WeatherLayer causes derivePhaseColors to return near-neutral hues,
 *     keeping gradients desaturated and document-safe.
 *
 * FLAG BADGE UPDATE:
 *   Expanded view: flag is shown as a Notion inline-mention chip with the raw
 *   flag SVG (CountryFlags) — this is the correct Notion-native treatment for
 *   the expanded card, matching a property or database chip exactly. No change.
 *
 *   Pill: was using raw CountryFlags + inline filter string. Now uses
 *   PillFlagBadge with skin="parchment". The neutral filter (desaturate 0.62–0.90
 *   + brightness pull) produces a muted, near-greyscale flag that sits completely
 *   inside the Notion colour vocabulary — the flag is recognisable but never
 *   draws colour attention in a white document. No glow (parchment emits nothing).
 *   Shape: the neutral skin fallback produces borderRadius:3 (rounded rect) which
 *   matches Notion's own inline image/icon chip shape.
 *
 * Philosophy: this widget should feel like it was shipped by Notion itself.
 * Aggressively restrained. Off-white surface, near-black text, 1px hairline
 * borders, zero gradients on the card body, zero glows, zero shadows with
 * any color component. The only "color" is a faint phase-keyed semantic wash
 * at opacity 0.05–0.07 on the card background — identical to how Notion
 * uses its own tag palette. Everything else is `rgba(55,53,47,…)`.
 */

import * as ct from 'countries-and-timezones';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { useSolarTheme } from '../../provider/solar-theme-provider';
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

// ─── Notion design tokens ─────────────────────────────────────────────────────

const N_TEXT = 'rgba(55,53,47,1)';
const N_TEXT_MED = 'rgba(55,53,47,0.65)';
const N_TEXT_LIGHT = 'rgba(55,53,47,0.45)';
const N_TEXT_GHOST = 'rgba(55,53,47,0.28)';
const N_BORDER = 'rgba(55,53,47,0.09)';
const N_BORDER_MED = 'rgba(55,53,47,0.16)';
const N_FILL = 'rgba(55,53,47,0.06)';
const N_FILL_DARK = 'rgba(55,53,47,0.08)';
const N_SURFACE = '#FFFFFF';
const N_SURFACE_2 = '#F7F6F3';
const NOTION_FONT = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"`;

// ─── Phase semantic wash palette ─────────────────────────────────────────────

const PHASE_WASH: Record<SolarPhase, string> = {
  midnight: 'transparent',
  night: 'rgba(211,229,239,0.05)',
  dawn: 'rgba(232,222,238,0.06)',
  sunrise: 'rgba(251,236,221,0.07)',
  morning: 'rgba(251,243,219,0.06)',
  'solar-noon': 'rgba(211,229,239,0.05)',
  afternoon: 'rgba(251,236,221,0.06)',
  sunset: 'rgba(255,226,221,0.07)',
  dusk: 'rgba(232,222,238,0.07)',
};

// ─── Phase labels ─────────────────────────────────────────────────────────────

const PHASE_LABEL: Record<SolarPhase, string> = {
  midnight: 'Midnight',
  night: 'Night',
  dawn: 'Dawn',
  sunrise: 'Sunrise',
  morning: 'Morning',
  'solar-noon': 'Solar noon',
  afternoon: 'Afternoon',
  sunset: 'Sunset',
  dusk: 'Dusk',
};

const PHASE_SUBLABEL: Record<SolarPhase, string> = {
  midnight: 'Deep night',
  night: 'Clear sky',
  dawn: 'Civil twilight',
  sunrise: 'Golden hour',
  morning: 'Bright & clear',
  'solar-noon': 'Peak sun',
  afternoon: 'Warm glow',
  sunset: 'Golden hour',
  dusk: 'Evening twilight',
};

const PHASE_EMOJI: Record<SolarPhase, string> = {
  midnight: '🌑',
  night: '🌙',
  dawn: '🌄',
  sunrise: '🌅',
  morning: '☀️',
  'solar-noon': '☀️',
  afternoon: '🌤️',
  sunset: '🌇',
  dusk: '🌆',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function toF(c: number): number {
  return Math.round((c * 9) / 5 + 32);
}

const SIZE_SCALE: Record<string, number> = { xs: 0.55, sm: 0.7, md: 0.82, lg: 0.92, xl: 1.05 };

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
  if (dir === 'top-left' || dir === 'bottom-left' || dir === 'center-left') return 'left';
  return 'right';
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

const WEATHER_DESC: Record<WeatherCategory, string> = {
  clear: 'Clear',
  'partly-cloudy': 'Partly cloudy',
  overcast: 'Overcast',
  fog: 'Fog',
  drizzle: 'Drizzle',
  rain: 'Rain',
  'heavy-rain': 'Heavy rain',
  snow: 'Snow',
  'heavy-snow': 'Heavy snow',
  thunder: 'Thunderstorm',
};

const WEATHER_CALLOUT_TINT: Record<WeatherCategory, string> = {
  clear: 'transparent',
  'partly-cloudy': 'rgba(235,236,237,0.40)',
  overcast: 'rgba(235,236,237,0.55)',
  fog: 'rgba(235,236,237,0.50)',
  drizzle: 'rgba(211,229,239,0.40)',
  rain: 'rgba(211,229,239,0.55)',
  'heavy-rain': 'rgba(211,229,239,0.65)',
  snow: 'rgba(211,229,239,0.35)',
  'heavy-snow': 'rgba(211,229,239,0.45)',
  thunder: 'rgba(235,236,237,0.60)',
};

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

// ─── RAF orb hook ─────────────────────────────────────────────────────────────

interface ParchmentOrbRefs {
  orbDot: React.RefObject<SVGCircleElement>;
  arcPath: React.RefObject<SVGPathElement>;
}

function useParchmentOrbRaf(refs: ParchmentOrbRefs) {
  const curProgRef = useRef(-1);
  const tgtProgRef = useRef(0);
  const curArcRef = useRef<string | null>(null);
  const orbFading = useRef(false);
  const rafId = useRef<number | null>(null);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstCall = useRef(true);

  const setOrbPos = (x: number, y: number) => {
    refs.orbDot.current?.setAttribute('cx', String(x));
    refs.orbDot.current?.setAttribute('cy', String(y));
  };

  const setOrbOpacity = (o: number) => {
    if (refs.orbDot.current) refs.orbDot.current.style.opacity = String(o);
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

  const setTarget = (newArc: string, prog: number) => {
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
        if (!rafId.current) rafId.current = requestAnimationFrame(animOrb);
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
    resetFirstCall: () => {
      firstCall.current = true;
    },
  };
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

const SPRING_EXPAND = { type: 'spring' as const, stiffness: 520, damping: 38, mass: 0.8 };
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 550, damping: 42 };

// ─── ParchmentWidget ──────────────────────────────────────────────────────────

export interface ParchmentExtras {
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

export function ParchmentWidget({
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
  temperatureUnit = 'C',
  forceExpanded,
  className = '',
  palette: passedPalette,
  liveWeatherCategory,
  liveTemperatureC,
}: WidgetSkinProps & ParchmentExtras) {
  const { coordsReady } = useSolarTheme();

  const [storedExpanded, setStoredExpanded] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('solar-widget-parchment-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStoredExpanded(next);
    try {
      localStorage.setItem('solar-widget-parchment-expanded', JSON.stringify(next));
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

  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);

  const hasTempData = liveTemperatureC != null || liveWeather != null;
  const tempC = liveTemperatureC ?? liveWeather?.temperatureC ?? null;
  const displayTempStr =
    hasTempData && tempC != null
      ? temperatureUnit === 'F'
        ? `${toF(tempC)}°F`
        : `${tempC}°C`
      : '';
  const pillTempStr =
    hasTempData && tempC != null ? (temperatureUnit === 'F' ? `${toF(tempC)}°` : `${tempC}°`) : '';

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weatherCategoryOverride ?? liveWeather?.category ?? null)
        : null;

  const weatherDesc = effectiveWeatherCategory
    ? (liveWeather?.description ?? WEATHER_DESC[effectiveWeatherCategory])
    : null;

  const expandedSublabel =
    showWeather && effectiveWeatherCategory
      ? `${weatherDesc} · ${temperatureUnit === 'F' && tempC != null ? `${toF(tempC)}°F` : tempC != null ? `${tempC}°C` : '--'}`
      : PHASE_SUBLABEL[phase];

  const phaseWash = PHASE_WASH[phase];
  const weatherTint = effectiveWeatherCategory
    ? WEATHER_CALLOUT_TINT[effectiveWeatherCategory]
    : 'transparent';

  const orbOpacity = effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  // phaseColors drives WeatherBackdrop and WeatherLayer colour hints.
  // Parchment is always "light" — derivePhaseColors returns near-neutral tones
  // when skin="parchment", which means the weather layers inherit parchment's
  // near-greyscale vocabulary rather than the vivid hues of Aurora or Paper.
  const phaseColors = derivePhaseColors(blend, 'parchment');

  const pillShowWeather =
    showWeather && effectiveWeatherCategory != null && effectiveWeatherCategory !== 'clear';

  // Country info — code for FlagBadge, name + raw FC for expanded chip
  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    const FC =
      (CountryFlags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[
        code
      ] ?? null;
    return { code, name: country?.name ?? code, FlagComponent: FC };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const orbDotRef = useRef<SVGCircleElement>(null);
  const arcPathRef = useRef<SVGPathElement>(null);

  const { setTarget, resetFirstCall } = useParchmentOrbRaf({
    orbDot: orbDotRef,
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
    setTarget(currentArc, progressTarget);
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

  const initPt = arcPt(progressTarget);

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.88, y: yNudge }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.88, y: yNudge * 0.8 }}
            transition={SPRING_EXPAND}
            style={{
              width: W * expandScale,
              height: H * expandScale,
              transformOrigin: origin,
              position: 'relative',
            }}
            className="select-none"
          >
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
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  borderRadius: 6,
                  overflow: 'hidden',
                  border: `1px solid ${N_BORDER_MED}`,
                  boxShadow: '0 1px 3px rgba(0,0,0,0.06), 0 2px 8px rgba(0,0,0,0.04)',
                  background: `linear-gradient(135deg, ${passedPalette.bg[0]} 0%, ${passedPalette.bg[1]} 50%, ${passedPalette.bg[2]} 100%)`,
                }}
              >
                {/* z=0  Phase semantic wash — faint Notion tag-palette tint */}
                {phaseWash !== 'transparent' && (
                  <motion.div
                    style={{ position: 'absolute', inset: 0, zIndex: 0 }}
                    animate={{ background: phaseWash }}
                    transition={{ duration: 1.8, ease: 'easeInOut' }}
                  />
                )}

                {/*
                 * z=1  WeatherBackdrop — atmospheric sky gradient layer.
                 *
                 * Parchment-specific treatment: opacity is set very low (0.28)
                 * so the effect reads as a barely-there paper stain rather than
                 * a dramatic sky. The backdrop uses skin="parchment" so
                 * derivePhaseColors returns near-neutral tones, keeping the
                 * gradient desaturated and document-safe. The Notion callout
                 * tint (z=2) then layers on top to bring the weather indication
                 * back into Notion's own colour vocabulary.
                 */}
                {showWeather && effectiveWeatherCategory && (
                  <div style={{ position: 'absolute', inset: 0, zIndex: 1, opacity: 0.28 }}>
                    <WeatherBackdrop
                      category={effectiveWeatherCategory}
                      skin="parchment"
                      phaseColors={phaseColors}
                    />
                  </div>
                )}

                {/*
                 * z=2  Notion callout tint — the document-native weather signal.
                 *
                 * This is parchment's primary weather communication layer. The
                 * WEATHER_CALLOUT_TINT values are derived from Notion's own tag
                 * colour palette (blue for rain, grey for overcast, etc.) at
                 * opacity 0.35–0.65 — matching how Notion itself tints callout
                 * blocks. It sits above WeatherBackdrop so the atmospheric
                 * gradient is softened through the document-white surface.
                 *
                 * Intentionally kept even when WeatherBackdrop is not shown
                 * (e.g. if showWeather is true but category is 'clear') —
                 * 'clear' maps to 'transparent' so it's a no-op.
                 */}
                {weatherTint !== 'transparent' && (
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      zIndex: 2,
                      background: weatherTint,
                      transition: 'background 1.2s ease-in-out',
                    }}
                  />
                )}

                {/* z=3  Orb arc SVG — bumped from z=2 */}
                <svg
                  aria-hidden="true"
                  style={{
                    position: 'absolute',
                    inset: 0,
                    zIndex: 3,
                    opacity: coordsReady ? 1 : 0,
                    transition: 'opacity 0.8s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <path
                    ref={arcPathRef}
                    d={ARC_D}
                    fill="none"
                    stroke={N_BORDER_MED}
                    strokeWidth={1}
                    strokeLinecap="round"
                  />
                  <circle
                    ref={orbDotRef}
                    cx={initPt.x}
                    cy={initPt.y}
                    r={6}
                    fill={N_TEXT_MED}
                    style={{ opacity: orbOpacity, transition: 'opacity 0.3s ease-in-out' }}
                  />
                </svg>

                {/*
                 * z=4  WeatherLayer — animated weather particles / effects.
                 *
                 * Parchment keeps this at very low opacity (0.20 day / 0.26
                 * night) — enough for rain streaks or snow to be perceptible
                 * as texture without the card feeling like a weather widget.
                 * Layers above the orb SVG so particles drift over the arc,
                 * but below the header/footer (z=5) so text remains legible.
                 *
                 * 'clear' and 'partly-cloudy' skip WeatherLayer entirely since
                 * the backdrop + tint already communicate those states.
                 */}
                {showWeather &&
                  effectiveWeatherCategory &&
                  effectiveWeatherCategory !== 'clear' &&
                  effectiveWeatherCategory !== 'partly-cloudy' && (
                    <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
                      <WeatherLayer
                        category={effectiveWeatherCategory}
                        skin="parchment"
                        opacity={effectiveIsDaytime ? 0.2 : 0.26}
                        phaseColors={phaseColors}
                      />
                    </div>
                  )}

                {/* z=5 Header — bumped from z=3 */}
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    padding: '20px 22px 0',
                    zIndex: 5,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontFamily: NOTION_FONT,
                          fontSize: 20,
                          fontWeight: 600,
                          color: N_TEXT,
                          letterSpacing: '-0.01em',
                          lineHeight: 1.2,
                          margin: 0,
                        }}
                      >
                        {PHASE_LABEL[phase]}
                      </p>
                      <p
                        style={{
                          fontFamily: NOTION_FONT,
                          fontSize: 12,
                          fontWeight: 400,
                          color: N_TEXT_LIGHT,
                          letterSpacing: '0.01em',
                          margin: '3px 0 0',
                        }}
                      >
                        {expandedSublabel}
                      </p>
                    </div>
                    {hasTempData && (
                      <span
                        style={{
                          fontFamily: NOTION_FONT,
                          fontSize: 18,
                          fontWeight: 400,
                          color: N_TEXT,
                          letterSpacing: '-0.01em',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {displayTempStr}
                      </span>
                    )}
                  </div>
                </div>

                {/* z=5 Footer — bumped from z=3 */}
                <div
                  style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    padding: '0 22px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    zIndex: 5,
                  }}
                >
                  <span
                    style={{
                      fontFamily: NOTION_FONT,
                      fontSize: 11,
                      fontWeight: 400,
                      color: N_TEXT_GHOST,
                      letterSpacing: '0.04em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↑ {sunriseFmt}
                  </span>

                  {/*
                   * FLAG — expanded footer (Notion inline mention chip).
                   *
                   * Parchment's expanded view is document-native: the flag
                   * appears as a Notion property chip — a tiny inline flag
                   * SVG + country name in a faintly filled rounded rect.
                   * We keep the raw CountryFlags component here (NOT FlagBadge)
                   * because the chip's own background and border already
                   * integrate it into the Notion vocabulary — no SVG filter
                   * is needed when the flag sits in a styled container.
                   *
                   * The flag is rendered at 14×10px with N_BORDER, which is
                   * exactly how Notion renders page icons in database views.
                   */}
                  {flagActive && (
                    <motion.div
                      key={countryInfo?.name}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: N_FILL,
                        border: `1px solid ${N_BORDER}`,
                        borderRadius: 4,
                        padding: '2px 6px',
                      }}
                    >
                      {countryInfo?.FlagComponent && (
                        <span
                          style={{
                            display: 'inline-flex',
                            width: 14,
                            height: 10,
                            borderRadius: 2,
                            overflow: 'hidden',
                            flexShrink: 0,
                            border: `1px solid ${N_BORDER}`,
                          }}
                        >
                          <countryInfo.FlagComponent
                            style={{ width: '100%', height: '100%', display: 'block' }}
                          />
                        </span>
                      )}
                      <span
                        style={{
                          fontFamily: NOTION_FONT,
                          fontSize: 10,
                          fontWeight: 400,
                          color: N_TEXT_MED,
                          letterSpacing: '0.04em',
                        }}
                      >
                        {countryInfo?.name}
                      </span>
                    </motion.div>
                  )}

                  <span
                    style={{
                      fontFamily: NOTION_FONT,
                      fontSize: 11,
                      fontWeight: 400,
                      color: N_TEXT_GHOST,
                      letterSpacing: '0.04em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ {sunsetFmt}
                  </span>
                </div>

                {/* z=6 Collapse button — bumped from z=4 */}
                {!forceExpanded &&
                  (() => {
                    const side = collapseButtonSide(expandDirection);
                    const isRight = side === 'right';
                    return (
                      <motion.button
                        onClick={() => setIsExpanded(false)}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ ...SPRING_CONTENT, delay: 0.18 }}
                        whileHover={{ background: N_FILL_DARK }}
                        whileTap={{ scale: 0.94 }}
                        aria-label="Collapse solar widget"
                        style={{
                          position: 'absolute',
                          zIndex: 6,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 28,
                          height: 28,
                          borderRadius: isRight ? '0 6px 0 6px' : '6px 0 6px 0',
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path
                            d="M2 2 L6 6 M6 2 L2 6"
                            stroke={N_TEXT_GHOST}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </motion.button>
                    );
                  })()}

                <div
                  style={{
                    position: 'absolute',
                    top: 48,
                    left: 22,
                    right: 22,
                    zIndex: 5,
                    height: 1,
                    background: N_BORDER,
                  }}
                />
              </div>
            </div>
          </motion.div>
        ) : (
          /*
           * ── COLLAPSED ─────────────────────────────────────────────────────
           * FLAG — pill (Notion inline mention / property chip style).
           *
           * Uses PillFlagBadge with skin="parchment".
           * The neutral SVG filter desaturates to 0.62–0.90 (mode=light all
           * phases) and applies a near-zero accent wash — the flag becomes a
           * quiet, greyscale-adjacent rectangle that reads like a Notion page
           * icon rather than a colourful badge. No glow.
           *
           * Shape: neutral skin fallback = borderRadius:3, which matches
           * Notion's own inline icon chip corners exactly.
           *
           * The flag sits after the divider dot and before the phase label,
           * the same slot as in Aurora — consistent muscle memory for users
           * switching between skins.
           */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.78, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.78, y: -6 }}
            transition={SPRING_EXPAND}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 28,
              paddingLeft: 8,
              paddingRight: 10,
              borderRadius: 6,
              background: N_FILL,
              border: `1px solid ${N_BORDER_MED}`,
              boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
              cursor: 'pointer',
              userSelect: 'none',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { background: N_FILL_DARK } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.97 } : { scale: expandScale * 0.99 }}
            aria-label={`Solar widget — ${PHASE_LABEL[phase]}. Click to expand.`}
          >
            {/* Icon slot — weather glyph or phase emoji */}
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
                    initial={{ opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PillWeatherGlyph
                      category={effectiveWeatherCategory}
                      skin="parchment"
                      color={N_TEXT_MED}
                      accentColor={N_TEXT_GHOST}
                      phaseIcon={phase}
                      size={20}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-emoji"
                    initial={{ opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
                    style={{ position: 'absolute', fontSize: 14, lineHeight: 1 }}
                  >
                    {PHASE_EMOJI[phase]}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            {/* Divider dot */}
            <span
              style={{
                width: 2,
                height: 2,
                borderRadius: '50%',
                background: N_TEXT_GHOST,
                flexShrink: 0,
              }}
            />

            {/* Temperature */}
            {pillTempStr && (
              <span
                style={{
                  fontFamily: NOTION_FONT,
                  fontSize: 12,
                  fontWeight: 500,
                  color: N_TEXT,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {pillTempStr}
              </span>
            )}

            {pillTempStr && (
              <span
                style={{
                  width: 2,
                  height: 2,
                  borderRadius: '50%',
                  background: N_TEXT_GHOST,
                  flexShrink: 0,
                }}
              />
            )}

            {/* Phase label */}
            <span
              style={{
                fontFamily: NOTION_FONT,
                fontSize: 12,
                fontWeight: 400,
                color: N_TEXT_MED,
                letterSpacing: '0.01em',
              }}
            >
              {PHASE_LABEL[phase]}
            </span>

            {/*
             * Flag badge — after phase label, before expand arrow.
             * Placed last in the pill so it anchors right, near the arrow,
             * keeping the left side clean for the icon+temp+label reading order.
             * Uses a subtle opacity transition to avoid a jarring pop-in.
             */}
            {flagActive && (
              <motion.span
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 0.85, scale: 1 }}
                transition={{ duration: 0.38, ease: [0.34, 1.56, 0.64, 1] }}
                style={{ display: 'flex', alignItems: 'center' }}
              >
                <PillFlagBadge
                  code={countryInfo?.code}
                  skin="parchment"
                  mode="light"
                  accent={N_TEXT_GHOST}
                  shadow={N_SURFACE}
                  highlight={N_TEXT}
                />
              </motion.span>
            )}

            {/* Expand arrow */}
            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ opacity: 0.4, marginLeft: 1 }}
            >
              <path
                d={pillArrowPath(expandDirection)}
                stroke={N_TEXT}
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
