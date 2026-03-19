'use client';

/**
 * skins/parchment/parchment.compact.tsx
 *
 * PARCHMENT compact — Notion callout block aesthetic.
 *
 * WEATHER ICON UPDATE:
 *   When weather is active and non-clear, the phase emoji is now replaced
 *   by a PillWeatherGlyph — identical pattern to the pill slot in
 *   parchment.component.tsx.
 *
 *   Implementation:
 *     compactShowWeather = showWeather && category != null && category !== 'clear'
 *     AnimatePresence mode="wait" wraps both branches so the swap spring-animates
 *     (opacity 0→1 + scale 0.65→1, stiffness:480 / damping:32).
 *     PillWeatherGlyph receives skin="parchment", color=N_TEXT_MED,
 *     accentColor=N_TEXT_GHOST, size=labelSize+4.
 *     Phase emoji remains when weather is clear or inactive.
 *
 *   The icon slot is now a fixed-size relative container so both branches
 *   animate in-place without shifting the label or flag beside them.
 *
 * FLAG BADGE UPDATE:
 *   Was using a raw `CountryFlags` component with inline border styles.
 *   Now uses `CompactFlagBadge` with skin="parchment".
 *
 *   Design rationale for parchment compact:
 *     The compact widget sits inside a Notion page, often inline with text
 *     or database rows. A vivid flag badge would break the Notion colour
 *     vocabulary. CompactFlagBadge with skin="parchment" (neutral filter,
 *     saturation 0.62–0.90, mode=light) produces a flag that is fully
 *     recognisable but rendered with muted, near-greyscale values — matching
 *     how Notion itself renders page icons and inline images.
 *
 *     Shape: neutral fallback = borderRadius:3 (rounded rect), matching
 *     Notion's own chip corners. No glow. boxShadow uses a single faint
 *     neutral shadow (N_BORDER) to match the track line weight.
 *
 * At 240×80 (md), this reads like a Notion callout block:
 *   - Same rounded-rect container with a faint phase-tinted background
 *   - Phase emoji icon on the left (16px)
 *   - Phase name on top, temperature + time below
 *   - No arc in the most compact view — the track is a minimal 1px line
 *     with a 5px filled dot tracking position
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { CONTENT_FADE } from '../../shared/content-fade';
import { CompactFlagBadge } from '../../shared/flag-badge';
import { PillWeatherGlyph } from '../../shared/pill-weather-glyphs';
import { WEATHER_ORB_DIM } from '../../shared/weather-layer';
import type { CompactSkinProps } from '../../widgets/compact-widget.shell';
import type { WeatherCategory } from '../../widgets/solar-widget.shell';

// ─── Notion design tokens ─────────────────────────────────────────────────────

const N_TEXT = 'rgba(55,53,47,1)';
const N_TEXT_MED = 'rgba(55,53,47,0.65)';
const N_TEXT_LIGHT = 'rgba(55,53,47,0.45)';
const N_TEXT_GHOST = 'rgba(55,53,47,0.28)';
const N_BORDER = 'rgba(55,53,47,0.09)';
const N_BORDER_MED = 'rgba(55,53,47,0.16)';
const N_FILL = 'rgba(55,53,47,0.04)';
const N_SURFACE = '#FFFFFF';

const NOTION_FONT = `ui-sans-serif, -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif, "Segoe UI Emoji", "Segoe UI Symbol"`;

// ─── Phase data ───────────────────────────────────────────────────────────────

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

const PHASE_WASH: Record<SolarPhase, string> = {
  midnight: 'transparent',
  night: 'rgba(211,229,239,0.06)',
  dawn: 'rgba(232,222,238,0.07)',
  sunrise: 'rgba(251,236,221,0.08)',
  morning: 'rgba(251,243,219,0.07)',
  'solar-noon': 'rgba(211,229,239,0.06)',
  afternoon: 'rgba(251,236,221,0.07)',
  sunset: 'rgba(255,226,221,0.08)',
  dusk: 'rgba(232,222,238,0.08)',
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

// ─── Size definitions ─────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 68, px: 11, py: 9, trackH: 16, labelSize: 10, timeSize: 9 },
  md: { width: 240, height: 80, px: 13, py: 10, trackH: 18, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 96, px: 15, py: 12, trackH: 22, labelSize: 12, timeSize: 10 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

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

// ─── Compact orb RAF ──────────────────────────────────────────────────────────

function useParchmentCompactOrbRaf(
  refs: {
    orbDot: React.RefObject<SVGCircleElement>;
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

  const setX = (x: number) => {
    refs.orbDot.current?.setAttribute('cx', String(x));
    if (refs.fillRect.current) {
      refs.fillRect.current.setAttribute('width', String(Math.max(0, x)));
    }
  };

  const setWrapOpacity = (v: number) => {
    if (refs.wrapG.current) refs.wrapG.current.style.opacity = String(v);
  };

  const anim = () => {
    const diff = tgtX.current - curX.current;
    if (Math.abs(diff) > 0.15) {
      curX.current += diff * 0.12;
      setX(curX.current);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curX.current = tgtX.current;
      setX(curX.current);
      rafId.current = null;
    }
  };

  const setTarget = (progress: number) => {
    const x = Math.max(0.01, Math.min(0.99, progress)) * trackW;
    tgtX.current = x;

    if (firstCall.current) {
      firstCall.current = false;
      curX.current = x;
      curP.current = progress;
      setX(x);
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
        setX(x);
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

// ─── Notion track ─────────────────────────────────────────────────────────────

function NotionTrack({
  progress,
  trackW,
  trackH,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  orbOpacity?: number;
}) {
  const orbR = 4;
  const lineY = trackH / 2;
  const initX = Math.max(0.01, Math.min(0.99, progress)) * trackW;

  const orbDotRef = useRef<SVGCircleElement>(null);
  const fillRectRef = useRef<SVGRectElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const { setTarget } = useParchmentCompactOrbRaf(
    { orbDot: orbDotRef, fillRect: fillRectRef, wrapG: wrapGRef },
    trackW,
  );

  useEffect(() => {
    setTarget(progress);
  });

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'visible' }}
    >
      {[0.25, 0.5, 0.75].map((p) => (
        <line
          key={p}
          x1={p * trackW}
          y1={lineY - 3}
          x2={p * trackW}
          y2={lineY + 3}
          stroke={N_BORDER}
          strokeWidth={0.8}
        />
      ))}

      <line
        x1={0}
        y1={lineY}
        x2={trackW}
        y2={lineY}
        stroke={N_BORDER_MED}
        strokeWidth={1}
        strokeLinecap="round"
      />

      <rect ref={fillRectRef} x={0} y={lineY - 0.5} width={initX} height={1} fill={N_TEXT_GHOST} />

      <g ref={wrapGRef} style={{ transition: 'opacity 0.9s ease-in-out' }}>
        <circle
          ref={orbDotRef}
          cx={initX}
          cy={lineY}
          r={orbR}
          fill={N_TEXT_MED}
          style={{ opacity: orbOpacity, transition: 'opacity 0.3s ease-in-out' }}
        />
      </g>
    </svg>
  );
}

// ─── ParchmentCompact ─────────────────────────────────────────────────────────

export function ParchmentCompact({
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

  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
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

  const tempC = liveTemperatureC ?? liveWeather?.temperatureC ?? null;
  const tempStr = temperature ?? (tempC != null ? `${tempC}°` : null);

  // Country code only — CompactFlagBadge handles the SVG lookup
  const countryCode = useMemo(() => {
    if (!timezone || !showFlag) return null;
    const tz = ct.getTimezone(timezone);
    return tz?.countries?.[0] ?? null;
  }, [timezone, showFlag]);

  const trackW = size.width - size.px * 2;

  const phaseWash = PHASE_WASH[phase];
  const weatherTint = effectiveWeatherCategory
    ? WEATHER_CALLOUT_TINT[effectiveWeatherCategory]
    : 'transparent';

  const orbOpacity = effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  const sublabel =
    showWeather && effectiveWeatherCategory ? WEATHER_DESC[effectiveWeatherCategory] : undefined;

  // When weather is active and non-clear, the phase emoji is replaced by
  // a PillWeatherGlyph — same pattern as the pill slot in parchment.component.tsx.
  const compactShowWeather =
    showWeather && effectiveWeatherCategory != null && effectiveWeatherCategory !== 'clear';

  return (
    <motion.div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 6,
        overflow: 'hidden',
        border: `1px solid ${N_BORDER_MED}`,
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
        background: `linear-gradient(135deg, ${passedPalette.bg[0]} 0%, ${passedPalette.bg[1]} 50%, ${passedPalette.bg[2]} 100%)`,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {phaseWash !== 'transparent' && (
        <motion.div
          style={{ position: 'absolute', inset: 0 }}
          animate={{ background: phaseWash }}
          transition={{ duration: 1.8, ease: 'easeInOut' }}
        />
      )}

      {weatherTint !== 'transparent' && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: weatherTint,
            transition: 'background 1.2s ease-in-out',
          }}
        />
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          paddingTop: size.py,
          paddingBottom: size.py,
          paddingLeft: size.px,
          paddingRight: size.px,
          gap: 4,
        }}
      >
        {/* Row 1: emoji + label + optional flag + temp/time */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 6,
            flexShrink: 0,
            minHeight: size.labelSize + size.timeSize + 3,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {/* Icon slot — weather glyph or phase emoji */}
            <span
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: size.labelSize + 4,
                height: size.labelSize + 4,
                flexShrink: 0,
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {compactShowWeather && effectiveWeatherCategory ? (
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
                      size={size.labelSize + 4}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-emoji"
                    initial={{ opacity: 0, scale: 0.65 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.65 }}
                    transition={{ type: 'spring', stiffness: 480, damping: 32, mass: 0.7 }}
                    style={{ position: 'absolute', fontSize: size.labelSize + 1, lineHeight: 1 }}
                  >
                    {PHASE_EMOJI[phase]}
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                transform: sublabel ? 'translateY(0)' : `translateY(${(size.timeSize + 1) / 2}px)`,
                transition: 'transform 0.5s ease',
              }}
            >
              <span
                style={{
                  fontFamily: NOTION_FONT,
                  fontSize: size.labelSize,
                  fontWeight: 600,
                  color: N_TEXT,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                }}
              >
                {PHASE_LABEL[phase]}
              </span>
              <span
                style={{
                  fontFamily: NOTION_FONT,
                  fontSize: size.timeSize,
                  fontWeight: 400,
                  color: N_TEXT_LIGHT,
                  letterSpacing: '0.01em',
                  lineHeight: 1,
                  opacity: sublabel ? 1 : 0,
                  transform: sublabel ? 'translateY(0)' : 'translateY(-2px)',
                  transition: 'opacity 0.5s ease, transform 0.5s ease',
                }}
              >
                {sublabel ?? '\u00A0'}
              </span>
            </div>

            {/*
             * FLAG — compact row 1.
             * CompactFlagBadge with skin="parchment" (neutral filter).
             * Sits inline after the label, reading left-to-right:
             * emoji → phase name [+ weather sublabel] → flag.
             *
             * The flag at compact size (16×11px) is most useful as a
             * quick country indicator. The neutral filter ensures it
             * doesn't draw colour attention away from the phase name,
             * which is the primary content in the Notion context.
             *
             * opacity:0.85 — matches the subdued treatment used throughout
             * parchment for secondary UI elements.
             */}
            {showFlag && (
              <motion.span
                animate={{ opacity: countryCode ? 0.85 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryCode && (
                  <CompactFlagBadge
                    code={countryCode}
                    skin="parchment"
                    mode="light"
                    accent={N_TEXT_GHOST}
                    shadow={N_SURFACE}
                    highlight={N_TEXT}
                  />
                )}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <span
                style={{
                  fontFamily: NOTION_FONT,
                  fontSize: size.labelSize,
                  fontWeight: 400,
                  color: N_TEXT_LIGHT,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                }}
              >
                {time}
              </span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: NOTION_FONT,
                  fontSize: size.labelSize,
                  fontWeight: 500,
                  color: N_TEXT,
                  letterSpacing: '-0.01em',
                  fontVariantNumeric: 'tabular-nums',
                  lineHeight: 1,
                  textAlign: 'right', 
                }}
                animate={{ opacity: tempStr ? 1 : 0 }}
                transition={CONTENT_FADE}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        {/* Row 2: Notion track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <NotionTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            orbOpacity={orbOpacity}
          />
        </div>

        {/* Row 3: sunrise / location / sunset */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontFamily: NOTION_FONT,
              fontSize: size.timeSize,
              fontWeight: 400,
              color: N_TEXT_GHOST,
              letterSpacing: '0.04em',
              lineHeight: 1,
              opacity: solar.isReady ? 1 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
          >
            ↑ {sunriseStr}
          </span>

          {location && (
            <span
              style={{
                fontFamily: NOTION_FONT,
                fontSize: size.timeSize - 1,
                fontWeight: 400,
                color: N_TEXT_GHOST,
                letterSpacing: '0.04em',
                lineHeight: 1,
                textAlign: 'center',
              }}
            >
              {location}
            </span>
          )}

          <span
            style={{
              fontFamily: NOTION_FONT,
              fontSize: size.timeSize,
              fontWeight: 400,
              color: N_TEXT_GHOST,
              letterSpacing: '0.04em',
              lineHeight: 1,
              opacity: solar.isReady ? 1 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
          >
            ↓ {sunsetStr}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
