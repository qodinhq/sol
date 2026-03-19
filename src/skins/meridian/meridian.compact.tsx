'use client';

/**
 * skins/meridian/meridian.compact.tsx  [v5 — flag-badge integration]
 *
 * FLAG FIX (v5):
 *   Replaced the old CompactFlag wrapper (which used CountryFlags React
 *   components) with CompactFlagBadge from shared/flag-badge — identical
 *   to the pattern used by foundry.compact and aurora.compact.
 *   - Removed CountryFlags import and CompactFlag function
 *   - countryInfo useMemo now returns just { code } (no FlagComponent lookup)
 *   - Render uses <CompactFlagBadge skin="meridian" ...> with meridian palette props
 *
 * ORB WRAP-AROUND FIX (v4):
 *   useMeridianDotRaf tracks curP (0-1 progress) separately from curX.
 *   Uses circular distance to detect wraps in EITHER direction.
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
import { MERIDIAN_PALETTES, type MeridianPalette, lerpMeridianPalette } from './meridian.component';

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

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 10, trackH: 18, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 22, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 12, trackH: 26, labelSize: 12, timeSize: 10 },
};

// ─── Weather hook ─────────────────────────────────────────────────────────────

interface LiveWeather {
  temperatureC: number;
}

async function fetchWeather(lat: number, lon: number): Promise<LiveWeather> {
  const url = new URL('https://api.open-meteo.com/v1/forecast');
  url.searchParams.set('latitude', String(lat));
  url.searchParams.set('longitude', String(lon));
  url.searchParams.set('current', 'temperature_2m');
  url.searchParams.set('forecast_days', '1');
  const data = (await fetch(url.toString()).then((r) => r.json())) as {
    current: { temperature_2m: number };
  };
  return { temperatureC: Math.round(data.current.temperature_2m) };
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

// ─── Time formatting ──────────────────────────────────────────────────────────

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Compact dot RAF ──────────────────────────────────────────────────────────

function useMeridianDotRaf(
  refs: {
    ring: React.RefObject<SVGCircleElement>;
    dot: React.RefObject<SVGCircleElement>;
    crescent: React.RefObject<SVGCircleElement>;
    travelLine: React.RefObject<SVGLineElement>;
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
  const dotRRef = useRef(0);

  const setX = (x: number) => {
    const cx = String(x);
    refs.ring.current?.setAttribute('cx', cx);
    refs.dot.current?.setAttribute('cx', cx);
    if (refs.crescent.current) {
      refs.crescent.current.setAttribute('cx', String(x + dotRRef.current * 0.45));
    }
    if (refs.travelLine.current) {
      refs.travelLine.current.setAttribute('x2', String(Math.max(0, x - dotRRef.current - 2)));
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

  const setTarget = (progress: number, dotR: number) => {
    dotRRef.current = dotR;
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

// ─── Hairline track ───────────────────────────────────────────────────────────

function HairlineTrack({
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
  pal: MeridianPalette;
  isNight: boolean;
  orbOpacity?: number;
}) {
  const lineY = trackH / 2;
  const dotR = isNight ? 3.5 : 4.5;
  const ringR = dotR + 4;

  const ringRef = useRef<SVGCircleElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);
  const crescentRef = useRef<SVGCircleElement>(null);
  const travelLineRef = useRef<SVGLineElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const { setTarget } = useMeridianDotRaf(
    {
      ring: ringRef,
      dot: dotRef,
      crescent: crescentRef,
      travelLine: travelLineRef,
      wrapG: wrapGRef,
    },
    trackW,
  );

  useEffect(() => {
    setTarget(progress, dotR);
  });

  useEffect(() => {
    if (ringRef.current) ringRef.current.style.stroke = pal.accentColor;
    if (dotRef.current) dotRef.current.style.fill = pal.orbFill;
    if (crescentRef.current) crescentRef.current.style.fill = pal.surface;
    if (travelLineRef.current) travelLineRef.current.style.stroke = pal.accentColor;
  });

  const initX = Math.max(0.01, Math.min(0.99, progress)) * trackW;

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'visible' }}
    >
      <line
        x1={0}
        y1={lineY}
        x2={trackW}
        y2={lineY}
        stroke={pal.pillBorder}
        strokeWidth={0.8}
        opacity={0.7}
      />
      <line
        ref={travelLineRef}
        x1={0}
        y1={lineY}
        x2={Math.max(0, initX - dotR - 2)}
        y2={lineY}
        strokeWidth={1}
        opacity={0.45}
        style={{ stroke: pal.accentColor }}
      />
      <line
        x1={0}
        y1={lineY - 4}
        x2={0}
        y2={lineY + 4}
        stroke={pal.pillBorder}
        strokeWidth={0.7}
        opacity={0.4}
      />
      <line
        x1={trackW}
        y1={lineY - 4}
        x2={trackW}
        y2={lineY + 4}
        stroke={pal.pillBorder}
        strokeWidth={0.7}
        opacity={0.4}
      />

      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <circle
          ref={ringRef}
          cx={initX}
          cy={lineY}
          r={ringR}
          fill="none"
          strokeWidth={0.7}
          opacity={isNight ? 0.25 : 0.22}
          style={{ stroke: pal.accentColor }}
        />
        <circle ref={dotRef} cx={initX} cy={lineY} r={dotR} style={{ fill: pal.orbFill }} />
        <circle
          ref={crescentRef}
          cx={initX + dotR * 0.45}
          cy={lineY - dotR * 0.25}
          r={dotR * 0.72}
          style={
            {
              fill: pal.surface,
              opacity: isNight ? 1 : 0,
              transition: 'opacity 0.8s ease-in-out',
            } as React.CSSProperties
          }
        />
      </g>
    </svg>
  );
}

// ─── MeridianCompact ──────────────────────────────────────────────────────────

export function MeridianCompact({
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
  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  const internalPal = useMemo(
    () =>
      lerpMeridianPalette(
        MERIDIAN_PALETTES[blend.phase],
        MERIDIAN_PALETTES[blend.nextPhase],
        blend.t,
      ),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'meridian');

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

  // ── Weather resolution ─────────────────────────────────────────────────────
  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);
  const tempC = liveTemperatureC ?? liveWeather?.temperatureC ?? null;
  const tempStr = temperature ?? (tempC != null ? `${tempC}°` : null);

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weather ?? null)
        : null;

  const orbOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  // ── Flag — resolved from timezone, code only (FlagBadge handles rendering) ──
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
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${pal.pillBorder}`,
        boxShadow: `0 1px 12px rgba(0,0,0,0.18), 0 0 16px 2px ${pal.shadow}`,
        cursor: 'default',
        userSelect: 'none',
      }}
      animate={{ background: pal.surface }}
      transition={{ duration: 1.5, ease: 'easeInOut' }}
    >
      {/* z=2  Top accent hairline */}
      <motion.div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 2 }}
        animate={{
          background: `linear-gradient(to right, transparent 0%, ${pal.accentColor} 40%, ${pal.accentColor} 60%, transparent 100%)`,
        }}
        transition={{ duration: 1.5 }}
      />

      {/* z=3  Weather backdrop */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
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

      {/* z=4  Weather layer */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 4 }}
        initial={{ opacity: 0 }}
        animate={{
          opacity:
            showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' ? 1 : 0,
        }}
        transition={CONTENT_FADE}
      >
        {showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
          <WeatherLayer
            category={effectiveWeatherCategory}
            skin="meridian"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.42 : 0.32}
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=5  3-row content */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 5,
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
                fontFamily: SANS,
                fontSize: size.labelSize,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 300,
              }}
              animate={{ color: pal.textPrimary }}
              transition={{ duration: 1.5 }}
            >
              {pal.label}
            </motion.span>

            {/* FLAG — meridian skin: sharp rect, near-greyscale, hairline border */}
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryInfo && (
                  <CompactFlagBadge
                    code={countryInfo.code}
                    skin="meridian"
                    mode={pal.mode}
                    accent={pal.accentColor}
                    shadow={pal.surface}
                    highlight={pal.textPrimary}
                    glow={pal.shadow}
                  />
                )}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '-0.02em',
                  fontWeight: 200,
                  lineHeight: 1,
                  opacity: 0.58,
                }}
                animate={{ color: pal.textPrimary }}
                transition={{ duration: 1.5 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '0.04em',
                  fontWeight: 400,
                  lineHeight: 1,
                  textAlign: 'right', 

                }}
                animate={{ color: pal.textPrimary, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.5 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* ── Row 2: hairline track ── */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <HairlineTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            pal={pal}
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
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.10em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.38 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.5 }}
          >
            ↑ {sunriseStr}
          </motion.span>

          {location && (
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.08em',
                lineHeight: 1,
                opacity: 0.26,
                textAlign: 'center',
              }}
              animate={{ color: pal.textSecondary }}
              transition={{ duration: 1.5 }}
            >
              {location}
            </motion.span>
          )}

          <motion.span
            style={{
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.10em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.38 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.5 }}
          >
            ↓ {sunsetStr}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
