'use client';

/**
 * skins/foundry/foundry.compact.tsx  [v8 — circular wrap-around fix]
 *
 * ORB WRAP-AROUND FIX (v8):
 *   useFoundryCompactOrbRaf now tracks curP (0-1 progress) separately
 *   from curX (pixel position). Uses circular distance — identical to
 *   foundry.component — to detect wraps in EITHER direction:
 *     Backwards past 0 → orb fades, snaps to near trackW, continues backwards.
 *     Forwards  past 1 → orb fades, snaps to near 0,      continues forwards.
 *
 *   Previous bug: the hook compared pixel positions, so rawDelta for a
 *   backwards wrap (e.g. progress 0.03 → 0.97) was a large positive number,
 *   triggering a forward lerp across the whole track instead of a snap-back.
 *
 * Weather integration strategy unchanged from v7 — see that version for details.
 */

import * as ct from 'countries-and-timezones';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { CONTENT_FADE } from '../../shared/content-fade';
import { CompactFlagBadge } from '../../shared/flag-badge';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { CompactSkinProps } from '../../widgets/compact-widget.shell';
import type { WeatherCategory } from '../../widgets/solar-widget.shell';
import { PALETTES, type PhasePalette } from './foundry.component';

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

// ─── Phase helpers ────────────────────────────────────────────────────────────

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

// ─── Orb phase-fade by weather severity ──────────────────────────────────────

const WEATHER_ORB_PHASE_FADE: Record<WeatherCategory, number> = {
  clear: 0.88,
  'partly-cloudy': 0.6,
  overcast: 0.32,
  fog: 0.22,
  drizzle: 0.3,
  rain: 0.18,
  'heavy-rain': 0.08,
  snow: 0.22,
  'heavy-snow': 0.08,
  thunder: 0.04,
};

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 9, trackH: 18, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 22, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 13, trackH: 26, labelSize: 12, timeSize: 10 },
};

// ─── Weather hook ─────────────────────────────────────────────────────────────

interface LiveWeather {
  temperatureC: number;
  description: string;
  category: WeatherCategory;
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
  81: { description: 'Showers', category: 'rain' },
  82: { description: 'Heavy showers', category: 'heavy-rain' },
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
  url.searchParams.set('current', 'temperature_2m,weather_code');
  url.searchParams.set('forecast_days', '1');
  const data = (await fetch(url.toString()).then((r) => r.json())) as {
    current: { temperature_2m: number; weather_code: number };
  };
  const c = data.current;
  const info = WMO_MAP[c.weather_code] ?? {
    description: 'Clear',
    category: 'clear' as WeatherCategory,
  };
  return {
    temperatureC: Math.round(c.temperature_2m),
    description: info.description,
    category: info.category,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function sr(seed: number) {
  const x = Math.sin(seed + 1) * 10000;
  return x - Math.floor(x);
}

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Compact orb RAF ──────────────────────────────────────────────────────────

function useFoundryCompactOrbRaf(
  refs: {
    moonG: React.RefObject<SVGGElement>;
    orbHalo: React.RefObject<SVGCircleElement>;
    orbCore: React.RefObject<SVGCircleElement>;
    fillRect: React.RefObject<SVGRectElement>;
    wrapG: React.RefObject<SVGGElement>;
  },
  trackW: number,
) {
  const curX = useRef(-1);
  const curP = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const orbRRef = useRef(0);

  const setX = (x: number, orbR: number) => {
    const channelY = orbR;
    refs.moonG.current?.setAttribute('transform', `translate(${x}, ${channelY})`);
    refs.orbHalo.current?.setAttribute('cx', String(x));
    refs.orbCore.current?.setAttribute('cx', String(x));
    if (refs.fillRect.current) {
      refs.fillRect.current.setAttribute('width', String(Math.max(0, x - orbR * 0.6)));
    }
  };

  const setWrapOpacity = (v: number) => {
    if (refs.wrapG.current) refs.wrapG.current.style.opacity = String(v);
  };

  const anim = () => {
    const diff = tgtX.current - curX.current;
    if (Math.abs(diff) > 0.15) {
      curX.current += diff * 0.12;
      setX(curX.current, orbRRef.current);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curX.current = tgtX.current;
      setX(curX.current, orbRRef.current);
      rafId.current = null;
    }
  };

  const setTarget = (progress: number, orbR: number) => {
    orbRRef.current = orbR;
    const x = Math.max(0.01, Math.min(0.99, progress)) * trackW;
    tgtX.current = x;

    if (firstCall.current) {
      firstCall.current = false;
      curX.current = x;
      curP.current = progress;
      setX(x, orbR);
      return;
    }

    const rawDelta = progress - curP.current;
    let circDelta = rawDelta;
    if (circDelta > 0.5) circDelta -= 1;
    if (circDelta < -0.5) circDelta += 1;

    const isWrap = Math.abs(rawDelta) > 0.5;
    const needsSnap = isWrap || Math.abs(circDelta) > 0.15;

    curP.current = progress;

    if (needsSnap && !orbFading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      orbFading.current = true;
      setWrapOpacity(0);
      fadeTimer.current = setTimeout(() => {
        curX.current = x;
        setX(x, orbR);
        setWrapOpacity(1);
        orbFading.current = false;
        fadeTimer.current = null;
        if (!rafId.current) rafId.current = requestAnimationFrame(anim);
      }, 160);
    } else if (!orbFading.current) {
      if (!rafId.current) rafId.current = requestAnimationFrame(anim);
    }
  };

  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );

  return { setTarget };
}

// ─── Machined channel track ───────────────────────────────────────────────────

function MachinedTrack({
  progress,
  trackW,
  trackH,
  pal,
  isNight,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: PhasePalette;
  isNight: boolean;
  orbOpacity?: number;
}) {
  const orbR = trackH / 2;
  const channelY = trackH / 2;
  const channelH = Math.max(3, trackH * 0.35);
  const S = orbR / 9;

  const moonGRef = useRef<SVGGElement>(null);
  const orbHaloRef = useRef<SVGCircleElement>(null);
  const orbCoreRef = useRef<SVGCircleElement>(null);
  const fillRectRef = useRef<SVGRectElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const { setTarget } = useFoundryCompactOrbRaf(
    {
      moonG: moonGRef,
      orbHalo: orbHaloRef,
      orbCore: orbCoreRef,
      fillRect: fillRectRef,
      wrapG: wrapGRef,
    },
    trackW,
  );

  useEffect(() => {
    setTarget(progress, orbR);
  });

  useEffect(() => {
    const moonBody = moonGRef.current?.querySelector<SVGCircleElement>('.moon-body');
    const moonCut = moonGRef.current?.querySelector<SVGCircleElement>('.moon-cut');
    if (moonBody) moonBody.style.fill = pal.orb;
    if (moonCut) moonCut.style.fill = pal.bg[1];
    if (orbHaloRef.current) orbHaloRef.current.style.fill = pal.orbGlow;
    if (orbCoreRef.current) orbCoreRef.current.style.fill = pal.orb;
  });

  const initX = Math.max(0.01, Math.min(0.99, progress)) * trackW;
  const haloBlur = Math.max(3, Math.round(10 * S));
  const coreGlowSD = isNight ? 7 * S : 10 * S;

  const stars = useMemo(
    () =>
      Array.from({ length: 8 }, (_, i) => ({
        x: sr(i * 7 + 1) * 0.94 * trackW,
        y: channelY + (sr(i * 13 + 3) - 0.5) * channelH * 0.7,
        r: sr(i * 5 + 2) * 0.8 + 0.3,
        dur: 1.8 + sr(i * 5) * 2.2,
        delay: sr(i * 13) * 3.0,
      })),
    [trackW, channelH, channelY],
  );

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id="fc-cmp-core-glow" x="-150%" y="-150%" width="400%" height="400%">
          <feGaussianBlur stdDeviation={coreGlowSD} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="fc-cmp-channel" x="-5%" y="-20%" width="110%" height="140%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodColor="rgba(0,0,0,0.60)" />
        </filter>
        <linearGradient
          id="fc-cmp-fill"
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor={pal.orb} stopOpacity={0.55} />
          <stop offset="100%" stopColor={pal.accentColor} stopOpacity={0.75} />
        </linearGradient>
      </defs>

      {/* Channel groove */}
      <rect
        x={0}
        y={channelY - channelH / 2}
        width={trackW}
        height={channelH}
        rx={channelH / 2}
        fill="rgba(0,0,0,0.52)"
        stroke={pal.pillBorder}
        strokeWidth={1}
        filter="url(#fc-cmp-channel)"
      />
      <rect
        x={2}
        y={channelY - channelH / 2}
        width={trackW - 4}
        height={1}
        rx={0.5}
        fill="rgba(255,255,255,0.10)"
      />

      {/* Stars */}
      {isNight &&
        stars.map((s) => (
          <motion.circle
            key={`${s.x}-${s.y}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="white"
            animate={{ opacity: [0.15, 0.7, 0.15] }}
            transition={{
              duration: s.dur,
              repeat: Number.POSITIVE_INFINITY,
              delay: s.delay,
              ease: 'easeInOut',
            }}
          />
        ))}

      {/* Quarter tick marks */}
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={p * trackW}
          y1={channelY - channelH / 2 - 2.5}
          x2={p * trackW}
          y2={channelY - channelH / 2}
          stroke={pal.pillBorder}
          strokeWidth={0.8}
          opacity={0.45}
        />
      ))}

      {/* Fill rect */}
      <rect
        ref={fillRectRef}
        x={0}
        y={channelY - channelH / 2 + 1}
        width={Math.max(0, initX - orbR * 0.6)}
        height={channelH - 2}
        rx={channelH / 2 - 1}
        fill="url(#fc-cmp-fill)"
        opacity={0.85}
      />

      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        {/* 1. Moon crescent */}
        <g
          ref={moonGRef}
          transform={`translate(${initX}, ${channelY})`}
          opacity={isNight && pal.showMoon ? 0.85 : 0}
          style={{ transition: 'opacity 0.8s ease-in-out' }}
        >
          <circle className="moon-body" cx={0} cy={0} r={orbR} fill={pal.orb} />
          <circle className="moon-cut" cx={5 * S} cy={-3 * S} r={7 * S} fill={pal.bg[1]} />
        </g>

        {/* 2. Halo */}
        <circle
          ref={orbHaloRef}
          cx={initX}
          cy={channelY}
          r={isNight ? orbR * 2 : orbR * 2.667}
          style={{
            fill: pal.orbGlow,
            filter: `blur(${haloBlur}px)`,
            transition: 'fill 1.2s ease-in-out',
          }}
        />

        {/* 3. Core sun disc */}
        <circle
          ref={orbCoreRef}
          cx={initX}
          cy={channelY}
          r={orbR * (11 / 9)}
          filter="url(#fc-cmp-core-glow)"
          style={
            {
              fill: pal.orb,
              opacity: pal.showMoon ? 0 : 1,
              transition: 'opacity 0.8s ease-in-out, fill 1.2s ease-in-out',
            } as React.CSSProperties
          }
        />
      </g>
    </svg>
  );
}

// ─── FoundryCompact ───────────────────────────────────────────────────────────

export function FoundryCompact({
  phase,
  blend,
  time,
  location,
  temperature,
  weather,
  liveWeatherCategory,
  liveTemperatureC,
  latitude,
  longitude,
  timezone,
  simulatedDate,
  showFlag = false,
  showWeather = false,
  showTemperature = true,
  size: sizeName = 'md',
  palette: passedPalette,
}: CompactSkinProps) {
  const size = SIZE_DIMS[sizeName] ?? SIZE_DIMS.md;
  const SANS_DISPLAY = "'SF Pro Display','Helvetica Neue',sans-serif";
  const SANS_TEXT = "'SF Pro Text','Helvetica Neue',sans-serif";

  const internalPalette = useMemo(
    () => lerpPalette(PALETTES[blend.phase], PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'foundry');

  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
  const isNight = !isDaytime || phase === 'dusk';
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;

  const sunriseStr = solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetStr = solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weather ?? liveWeather?.category ?? null)
        : null;

  const orbOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_PHASE_FADE[effectiveWeatherCategory] : 1;

  const tempC = liveTemperatureC ?? liveWeather?.temperatureC ?? null;
  const tempStr = temperature ?? (tempC != null ? `${tempC}°` : null);

  const countryInfo = useMemo(() => {
    if (!timezone || !showFlag) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    return { code };
  }, [timezone, showFlag]);

  const trackW = size.width - size.px * 2;
  const row1H = size.labelSize + 2;
  const row3H = size.timeSize + 2;
  const innerH = size.height - size.py * 2;
  const gapY = Math.max(2, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  return (
    <motion.div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 10,
        overflow: 'hidden',
        border: `1.5px solid ${palette.pillBorder}`,
        boxShadow: `0 4px 24px rgba(0,0,0,0.38), 0 0 28px 6px ${palette.outerGlow}`,
        backdropFilter: 'blur(14px)',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* z=1  Background gradient */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        animate={{
          background: `linear-gradient(120deg, ${palette.bg[0]} 0%, ${palette.bg[1]} 55%, ${palette.bg[2]} 100%)`,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />

      {/* z=2  Weather backdrop */}
      {showWeather && (
        <motion.div
          animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, zIndex: 2 }}
        >
          {effectiveWeatherCategory && (
            <WeatherBackdrop
              category={effectiveWeatherCategory}
              skin="foundry"
              phaseColors={phaseColors}
            />
          )}
        </motion.div>
      )}

      {/* z=3  Weather layer */}
      {showWeather && (
        <motion.div
          animate={{
            opacity: effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' ? 1 : 0,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        >
          {effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
            <WeatherLayer
              category={effectiveWeatherCategory}
              skin="foundry"
              opacity={effectiveWeatherCategory === 'thunder' ? 0.65 : 0.55}
              phaseColors={phaseColors}
            />
          )}
        </motion.div>
      )}

      {/* z=4  3-row content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: size.py,
          paddingBottom: size.py,
          paddingLeft: size.px,
          paddingRight: size.px,
        }}
      >
        {/* ── Row 1 ── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: row1H,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.span
              style={{
                fontFamily: SANS_DISPLAY,
                fontSize: size.labelSize,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 400,
              }}
              animate={{ color: palette.pillText }}
              transition={{ duration: 1 }}
            >
              {palette.label}
            </motion.span>
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryInfo && (
                  <CompactFlagBadge
                    code={countryInfo.code}
                    skin="foundry"
                    mode={palette.mode}
                    accent={palette.accentColor}
                    shadow={palette.bg[0]}
                    highlight={palette.textPrimary}
                    glow={palette.flagGlow}
                  />
                )}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <motion.span
                style={
                  {
                    fontFamily: SANS_DISPLAY,
                    fontSize: size.labelSize,
                    letterSpacing: '-0.02em',
                    fontWeight: 300,
                    lineHeight: 1,
                    fontVariantNumeric: 'tabular-nums',
                    opacity: 0.65,
                  } as React.CSSProperties
                }
                animate={{ color: palette.textPrimary }}
                transition={{ duration: 1 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SANS_DISPLAY,
                  fontSize: size.labelSize,
                  letterSpacing: '-0.01em',
                  fontWeight: 500,
                  lineHeight: 1,
                  textAlign: 'right', 
                }}
                animate={{ color: palette.pillText, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.2 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* ── Row 2: machined track ── */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <MachinedTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            pal={palette}
            isNight={isNight}
            orbOpacity={orbOpacity}
          />
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* ── Row 3 ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            height: row3H,
            flexShrink: 0,
          }}
        >
          <motion.span
            style={{
              fontFamily: SANS_TEXT,
              fontSize: size.timeSize,
              letterSpacing: '0.08em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.42 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: palette.textSecondary }}
            transition={{ duration: 1 }}
          >
            ↑ {sunriseStr}
          </motion.span>

          {location && (
            <motion.span
              style={{
                fontFamily: SANS_TEXT,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.06em',
                lineHeight: 1,
                opacity: 0.28,
                textAlign: 'center',
              }}
              animate={{ color: palette.textSecondary }}
              transition={{ duration: 1 }}
            >
              {location}
            </motion.span>
          )}

          <motion.span
            style={{
              fontFamily: SANS_TEXT,
              fontSize: size.timeSize,
              letterSpacing: '0.08em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.42 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: palette.textSecondary }}
            transition={{ duration: 1 }}
          >
            ↓ {sunsetStr}
          </motion.span>
        </div>
      </div>

      {/* z=5  Glass sheen */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
          pointerEvents: 'none',
          background: 'linear-gradient(165deg, rgba(255,255,255,0.11) 0%, transparent 40%)',
          borderRadius: 10,
        }}
      />
    </motion.div>
  );
}
