'use client';

/**
 * widgets/compact-widget.shell.tsx
 *
 * Shell for the compact solar widget — a slim pill/bar format.
 *
 * simulatedDate prop wins over ctx.simulatedDate (set by SolarDevTools),
 * which wins over undefined (live time). This means the devtools timeline
 * scrubber moves the orb in compact widgets without requiring any prop wiring.
 */

import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import type { SolarBlend, SolarPhase } from '../hooks/useSolarPosition';
import { lerpHex } from '../lib/solar-lerp';
import { useSolarTheme } from '../provider/solar-theme-provider';
import type { DesignMode, SkinDefinition, WidgetPalette } from '../skins/types/widget-skin.types';
import type { CustomPalettes } from './solar-widget.shell';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeatherCategory =
  | 'clear'
  | 'partly-cloudy'
  | 'overcast'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'heavy-rain'
  | 'snow'
  | 'heavy-snow'
  | 'thunder';

export type CompactSize = 'sm' | 'md' | 'lg';

// ─── WMO weather code map ─────────────────────────────────────────────────────

const WMO_MAP: Record<number, WeatherCategory> = {
  0: 'clear',
  1: 'clear',
  2: 'partly-cloudy',
  3: 'overcast',
  45: 'fog',
  48: 'fog',
  51: 'drizzle',
  53: 'drizzle',
  55: 'drizzle',
  61: 'rain',
  63: 'rain',
  65: 'heavy-rain',
  71: 'snow',
  73: 'snow',
  75: 'heavy-snow',
  80: 'rain',
  82: 'heavy-rain',
  85: 'snow',
  86: 'heavy-snow',
  95: 'thunder',
  96: 'thunder',
  99: 'thunder',
};

// ─── Centralised weather fetch ────────────────────────────────────────────────

interface LiveWeather {
  temperatureC: number;
  category: WeatherCategory;
}

async function fetchWeather(lat: number, lon: number): Promise<LiveWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('forecast_days', '1');
  const data = (await fetch(url.toString()).then((r) => r.json())) as {
    current: { temperature_2m: number; weather_code: number };
  };
  return {
    temperatureC: Math.round(data.current.temperature_2m),
    category: WMO_MAP[data.current.weather_code] ?? 'clear',
  };
}

function useWeatherData(lat: number | null, lon: number | null) {
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

// ─── Props passed to every compact skin component ─────────────────────────────

export interface CompactSkinProps {
  phase: SolarPhase;
  blend: SolarBlend;
  time: string;
  location: string;
  flag?: string;
  temperature?: string;
  weather?: WeatherCategory | null;
  liveWeatherCategory: WeatherCategory | null;
  liveTemperatureC: number | null;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  simulatedDate?: Date;
  showFlag: boolean;
  showWeather: boolean;
  showTemperature: boolean;
  size: CompactSize;
  palette: WidgetPalette;
}

// ─── Public props for the shell ───────────────────────────────────────────────

export interface CompactWidgetProps {
  design?: DesignMode;
  overridePhase?: SolarPhase | null;
  time?: string;
  location?: string;
  flag?: string;
  temperature?: string;
  weather?: WeatherCategory | null;
  weatherCategoryOverride?: WeatherCategory | null;
  showFlag?: boolean;
  showWeather?: boolean;
  showTemperature?: boolean;
  size?: CompactSize;
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  /** Override background colors per phase */
  customPalettes?: CustomPalettes;
  /** Explicit simulated date. Falls back to ctx.simulatedDate (from SolarDevTools)
   *  then to real current time. */
  simulatedDate?: Date;
  className?: string;
}

// ─── Palette blending ─────────────────────────────────────────────────────────

function blendPalette(skin: SkinDefinition, blend: SolarBlend): WidgetPalette {
  const from = skin.widgetPalettes[blend.phase];
  const to = skin.widgetPalettes[blend.nextPhase];
  const t = blend.t;
  if (t === 0) return from;
  const lerp = (a: string, b: string) => lerpHex(a, b, t);
  return {
    bg: [lerp(from.bg[0], to.bg[0]), lerp(from.bg[1], to.bg[1]), lerp(from.bg[2], to.bg[2])] as [
      string,
      string,
      string,
    ],
    textColor: lerp(from.textColor, to.textColor),
    accentColor: lerp(from.accentColor, to.accentColor),
    orb: lerp(from.orb, to.orb),
    outerGlow: lerp(from.outerGlow, to.outerGlow),
    mode: from.mode,
  };
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export function CompactWidget({
  design: designOverride,
  overridePhase,
  time,
  location = '',
  flag,
  temperature,
  weather = null,
  weatherCategoryOverride,
  showFlag = false,
  showWeather = false,
  showTemperature = true,
  size = 'md',
  latitude,
  longitude,
  timezone,
  customPalettes,
  simulatedDate: simulatedDateProp,
  className = '',
}: CompactWidgetProps) {
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => setMounted(true), []);

  const ctx = useSolarTheme();

  // Register customPalettes into context so DevTools can read them
  useEffect(() => {
    ctx.setCustomPalettes(customPalettes);
    return () => ctx.setCustomPalettes(undefined);
  }, [customPalettes, ctx.setCustomPalettes]);

  // prop wins → context (devtools) → undefined (live)
  const simulatedDate = simulatedDateProp ?? ctx.simulatedDate;

  const skin = useMemo(() => {
    if (!designOverride || designOverride === ctx.design) return ctx.activeSkin;
    return ctx.activeSkin;
  }, [designOverride, ctx.design, ctx.activeSkin]);

  const phase = overridePhase ?? ctx.phase;
  const blend = overridePhase
    ? { phase: overridePhase, nextPhase: overridePhase, t: 0 }
    : ctx.blend;

  const blendedPalette = useMemo(() => blendPalette(skin, blend), [skin, blend]);

  const palette: WidgetPalette = useMemo(() => {
    if (!customPalettes?.[phase]) return blendedPalette;
    return { ...blendedPalette, bg: customPalettes[phase]?.bg };
  }, [blendedPalette, customPalettes, phase]);

  const resolvedLat = latitude ?? ctx.latitude;
  const resolvedLon = longitude ?? ctx.longitude;
  const resolvedTz = timezone ?? ctx.timezone;

  // ── Centralised weather fetch ────────────────────────────────────────────
  const liveWeather = useWeatherData(resolvedLat ?? null, resolvedLon ?? null);

  const liveWeatherCategory: WeatherCategory | null = showWeather
    ? (weatherCategoryOverride ?? weather ?? liveWeather?.category ?? null)
    : null;

  const liveTemperatureC: number | null = liveWeather?.temperatureC ?? null;

  // ── Resolve time string ──────────────────────────────────────────────────
  // If caller passes an explicit time string, use it. Otherwise derive from
  // simulatedDate (or real time) so the clock display matches the orb.
  const resolvedTime = useMemo(() => {
    if (time) return time;
    const d = simulatedDate ?? new Date();
    const opts: Intl.DateTimeFormatOptions = {
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    };
    if (resolvedTz) opts.timeZone = resolvedTz;
    const parts = new Intl.DateTimeFormat('en-GB', opts).formatToParts(d);
    const hh = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const mm = parts.find((p) => p.type === 'minute')?.value ?? '00';
    return `${hh}:${mm}`;
  }, [time, simulatedDate, resolvedTz]);

  const props: CompactSkinProps = {
    phase,
    blend,
    time: resolvedTime,
    location,
    flag,
    temperature,
    weather,
    liveWeatherCategory,
    liveTemperatureC,
    latitude: resolvedLat,
    longitude: resolvedLon,
    timezone: resolvedTz,
    simulatedDate,
    showFlag,
    showWeather,
    showTemperature,
    size,
    palette,
  };

  const CompactComponent = (
    skin as SkinDefinition & {
      CompactComponent?: React.ComponentType<CompactSkinProps>;
    }
  ).CompactComponent;

  if (!CompactComponent) {
    return (
      <div className={className} style={{ opacity: 0.4, fontSize: 11, color: '#888' }}>
        Compact not implemented for {skin.id}
      </div>
    );
  }

  return (
    <div
      className={className}
      style={{ visibility: mounted ? 'visible' : 'hidden', isolation: 'isolate' }}
    >
      <CompactComponent {...props} />
    </div>
  );
}
