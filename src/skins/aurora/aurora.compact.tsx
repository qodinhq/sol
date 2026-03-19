'use client';

/**
 * skins/aurora/aurora.compact.tsx  [v5 — circular wrap-around fix]
 *
 * ORB WRAP-AROUND FIX (v5):
 *   useCompactOrbRaf now tracks progress (0-1) separately from pixel X.
 *   Uses circular distance to detect wraps in EITHER direction.
 *   Going backwards past 0 → orb fades, snaps to near trackW, continues backwards.
 *   Going forwards past 1  → orb fades, snaps to near 0, continues forwards.
 *   Matches the wrap logic in the full foundry.component RAF hook exactly.
 *
 * Weather integration strategy unchanged from v4 — see that version for details.
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

// ─── Phase palette ────────────────────────────────────────────────────────────

interface AuroraCompactPhase {
  bg: [string, string, string];
  text: string;
  sub: string;
  glow1: string;
  glow2: string;
  border: string;
  label: string;
  aurora: boolean;
  auroraOpacity: number;
  track: [string, string, string];
  orbFill: string;
  mode: 'light' | 'dim' | 'dark';
}

const AUR: Record<SolarPhase, AuroraCompactPhase> = {
  midnight: {
    bg: ['#040814', '#060C1C', '#0A1028'],
    text: '#B8D0F0',
    sub: '#98B8E0',
    glow1: 'rgba(80,140,220,0.55)',
    glow2: 'rgba(48,100,200,0.28)',
    border: 'rgba(80,140,220,0.35)',
    label: 'Midnight',
    aurora: true,
    auroraOpacity: 0.88,
    track: ['#204080', '#104858', '#301860'],
    orbFill: '#80B8F0',
    mode: 'dark',
  },
  night: {
    bg: ['#040C0C', '#060E10', '#081218'],
    text: '#A8EED0',
    sub: '#88D8B8',
    glow1: 'rgba(64,200,140,0.60)',
    glow2: 'rgba(40,160,100,0.30)',
    border: 'rgba(64,200,140,0.38)',
    label: 'Night',
    aurora: true,
    auroraOpacity: 0.92,
    track: ['#105838', '#0A4858', '#183860'],
    orbFill: '#80F0C0',
    mode: 'dark',
  },
  dawn: {
    bg: ['#180820', '#241030', '#341840'],
    text: '#F0C8E0',
    sub: '#DCC8D8',
    glow1: 'rgba(200,100,160,0.52)',
    glow2: 'rgba(160,72,120,0.28)',
    border: 'rgba(200,100,160,0.38)',
    label: 'Dawn',
    aurora: true,
    auroraOpacity: 0.72,
    track: ['#803050', '#603870', '#402860'],
    orbFill: '#F0A0C0',
    mode: 'dark',
  },
  sunrise: {
    bg: ['#2A1010', '#401820', '#602030'],
    text: '#FFE8C8',
    sub: '#F0C8A0',
    glow1: 'rgba(240,140,80,0.48)',
    glow2: 'rgba(200,100,48,0.28)',
    border: 'rgba(240,140,80,0.38)',
    label: 'Sunrise',
    aurora: true,
    auroraOpacity: 0.4,
    track: ['#804028', '#603050', '#502840'],
    orbFill: '#FFB870',
    mode: 'dim',
  },
  morning: {
    bg: ['#E8E0D0', '#F0E8D8', '#F8F4EC'],
    text: '#201808',
    sub: '#382810',
    glow1: 'rgba(200,160,80,0.28)',
    glow2: 'rgba(180,140,48,0.18)',
    border: 'rgba(180,140,48,0.30)',
    label: 'Morning',
    aurora: false,
    auroraOpacity: 0.08,
    track: ['#C8B080', '#C0A870', '#B8A060'],
    orbFill: '#D4A020',
    mode: 'light',
  },
  'solar-noon': {
    bg: ['#D8E8F4', '#E4F0F8', '#F0F8FF'],
    text: '#101C2C',
    sub: '#143050',
    glow1: 'rgba(80,160,240,0.22)',
    glow2: 'rgba(60,140,220,0.16)',
    border: 'rgba(60,140,220,0.28)',
    label: 'Solar Noon',
    aurora: false,
    auroraOpacity: 0.05,
    track: ['#88B8D8', '#90C0E0', '#A0C8E8'],
    orbFill: '#3090E8',
    mode: 'light',
  },
  afternoon: {
    bg: ['#E4DCCC', '#EEE4D4', '#F6F0E4'],
    text: '#1C1508',
    sub: '#30240C',
    glow1: 'rgba(200,160,64,0.28)',
    glow2: 'rgba(180,140,40,0.16)',
    border: 'rgba(180,140,40,0.30)',
    label: 'Afternoon',
    aurora: false,
    auroraOpacity: 0.06,
    track: ['#C8A860', '#C0A058', '#B89850'],
    orbFill: '#D09820',
    mode: 'light',
  },
  sunset: {
    bg: ['#180810', '#281018', '#3A1820'],
    text: '#FFE0C8',
    sub: '#F0C4A0',
    glow1: 'rgba(220,120,80,0.50)',
    glow2: 'rgba(180,80,48,0.30)',
    border: 'rgba(220,120,80,0.40)',
    label: 'Sunset',
    aurora: true,
    auroraOpacity: 0.55,
    track: ['#804828', '#703858', '#582850'],
    orbFill: '#F09060',
    mode: 'dim',
  },
  dusk: {
    bg: ['#100818', '#180C24', '#241030'],
    text: '#E8C8FF',
    sub: '#D0B0F0',
    glow1: 'rgba(160,80,220,0.55)',
    glow2: 'rgba(120,48,180,0.30)',
    border: 'rgba(160,80,220,0.38)',
    label: 'Dusk',
    aurora: true,
    auroraOpacity: 0.78,
    track: ['#603080', '#803868', '#402870'],
    orbFill: '#C080F0',
    mode: 'dark',
  },
};

// ─── Palette lerp ─────────────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function lerpAur(from: AuroraCompactPhase, to: AuroraCompactPhase, t: number): AuroraCompactPhase {
  if (t === 0) return from;
  const lc = lerpColor;
  return {
    ...from,
    bg: [lc(from.bg[0], to.bg[0], t), lc(from.bg[1], to.bg[1], t), lc(from.bg[2], to.bg[2], t)] as [
      string,
      string,
      string,
    ],
    text: lc(from.text, to.text, t),
    sub: lc(from.sub, to.sub, t),
    glow1: lc(from.glow1, to.glow1, t),
    glow2: lc(from.glow2, to.glow2, t),
    border: lc(from.border, to.border, t),
    track: [
      lc(from.track[0], to.track[0], t),
      lc(from.track[1], to.track[1], t),
      lc(from.track[2], to.track[2], t),
    ] as [string, string, string],
    orbFill: lc(from.orbFill, to.orbFill, t),
    auroraOpacity: lerpNum(from.auroraOpacity, to.auroraOpacity, t),
    aurora: t < 0.5 ? from.aurora : to.aurora,
    mode: t < 0.5 ? from.mode : to.mode,
  };
}

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 9, trackH: 20, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 26, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 13, trackH: 30, labelSize: 12, timeSize: 10 },
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
      () => {
        if (lat == null || lon == null) return;
        fetchWeather(lat, lon)
          .then((w) => {
            if (!dead) setWeather(w);
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
  return weather;
}

// ─── Aurora CSS keyframes ─────────────────────────────────────────────────────

const AURORA_COMPACT_KF = `
@keyframes aur-cmp-drift-1 {
  0%   { transform: translateX(0%)   scaleY(1.00); }
  35%  { transform: translateX(-9%)  scaleY(1.12); }
  70%  { transform: translateX(5%)   scaleY(0.92); }
  100% { transform: translateX(0%)   scaleY(1.00); }
}
@keyframes aur-cmp-drift-2 {
  0%   { transform: translateX(-5%)  scaleY(1.00); }
  45%  { transform: translateX(7%)   scaleY(0.90); }
  100% { transform: translateX(-5%)  scaleY(1.00); }
}
`;

// ─── Compact orb RAF ──────────────────────────────────────────────────────────

function useCompactOrbRaf(
  refs: {
    far: React.RefObject<SVGCircleElement>;
    near: React.RefObject<SVGCircleElement>;
    core: React.RefObject<SVGCircleElement>;
    fill: React.RefObject<SVGRectElement>;
    wrap: React.RefObject<SVGGElement>;
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
    const cx = String(x);
    refs.far.current?.setAttribute('cx', cx);
    refs.near.current?.setAttribute('cx', cx);
    refs.core.current?.setAttribute('cx', cx);
    if (refs.fill.current) {
      refs.fill.current.setAttribute('width', String(Math.max(0, x - 6)));
    }
  };

  const setWrapOpacity = (v: number) => {
    if (refs.wrap.current) refs.wrap.current.style.opacity = String(v);
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

// ─── Aurora band track ────────────────────────────────────────────────────────

function AuroraTrack({
  progress,
  trackW,
  trackH,
  pal,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: AuroraCompactPhase;
  orbOpacity?: number;
}) {
  const orbR = trackH * 0.46;
  const cy = trackH / 2;
  const bandOp = pal.auroraOpacity;

  const farRef = useRef<SVGCircleElement>(null);
  const nearRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const fillRef = useRef<SVGRectElement>(null);
  const wrapRef = useRef<SVGGElement>(null);

  const { setTarget } = useCompactOrbRaf(
    { far: farRef, near: nearRef, core: coreRef, fill: fillRef, wrap: wrapRef },
    trackW,
  );

  useEffect(() => {
    setTarget(progress);
  });

  useEffect(() => {
    if (fillRef.current) fillRef.current.setAttribute('fill', pal.track[1]);
  });

  const initX = Math.max(0.01, Math.min(0.99, progress)) * trackW;

  return (
    <>
      {bandOp > 0.06 && <style>{AURORA_COMPACT_KF}</style>}
      <svg
        aria-hidden="true"
        width={trackW}
        height={trackH}
        viewBox={`0 0 ${trackW} ${trackH}`}
        style={{ overflow: 'visible' }}
      >
        <defs>
          <linearGradient
            id="aur-cmp-band"
            x1="0"
            y1="0"
            x2="1"
            y2="0"
            gradientUnits="objectBoundingBox"
          >
            <stop offset="0%" stopColor={pal.track[0]} stopOpacity={0.25} />
            <stop offset="50%" stopColor={pal.track[1]} stopOpacity={0.7} />
            <stop offset="100%" stopColor={pal.track[2]} stopOpacity={0.25} />
          </linearGradient>
          <filter id="aur-cmp-far" x="-150%" y="-150%" width="400%" height="400%">
            <feGaussianBlur stdDeviation={orbR * 0.8} />
          </filter>
          <filter id="aur-cmp-near" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation={orbR * 0.38} />
          </filter>
        </defs>

        {/* Spectral band */}
        <rect
          x={0}
          y={cy - 1.5}
          width={trackW}
          height={3}
          rx={1.5}
          fill="url(#aur-cmp-band)"
          style={{ filter: 'blur(0.5px)' }}
        />

        {/* Travelled fill */}
        <rect
          ref={fillRef}
          x={0}
          y={cy - 1}
          width={Math.max(0, initX - 6)}
          height={2}
          rx={1}
          fill={pal.track[1]}
          opacity={0.55}
        />

        <g ref={wrapRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
          <motion.circle
            ref={farRef}
            cx={initX}
            cy={cy}
            fill={pal.glow1}
            filter="url(#aur-cmp-far)"
            animate={{
              r: [orbR * 1.6, orbR * 2.1, orbR * 1.6],
              opacity: [bandOp * 0.5, bandOp * 0.7, bandOp * 0.5],
            }}
            transition={{ duration: 3.2, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
          />

          <motion.circle
            ref={nearRef}
            cx={initX}
            cy={cy}
            fill={pal.glow1}
            filter="url(#aur-cmp-near)"
            animate={{
              r: [orbR * 0.8, orbR * 1.05, orbR * 0.8],
              opacity: [0.6, 0.85, 0.6],
            }}
            transition={{
              duration: 2.4,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: 0.4,
            }}
          />

          <motion.circle
            ref={coreRef}
            cx={initX}
            cy={cy}
            fill={pal.orbFill}
            opacity={0.95}
            animate={{ r: [orbR * 0.3, orbR * 0.4, orbR * 0.3] }}
            transition={{
              duration: 1.9,
              repeat: Number.POSITIVE_INFINITY,
              ease: 'easeInOut',
              delay: 0.2,
            }}
          />
        </g>
      </svg>
    </>
  );
}

// ─── Time formatting ──────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── AuroraCompact ────────────────────────────────────────────────────────────

export function AuroraCompact({
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
  showTemperature = true,
  showFlag = false,
  showWeather = false,
  size: sizeName = 'md',
  palette: passedPalette,
}: CompactSkinProps) {
  const size = SIZE_DIMS[sizeName] ?? SIZE_DIMS.md;
  const SANS = "'SF Pro Text','Helvetica Neue',sans-serif";

  const internalPal = useMemo(
    () => lerpAur(AUR[blend.phase], AUR[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'aurora');

  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;

  const sunriseStr = solar.isReady ? fmtMinutes(solar.times.sunrise) : '--:--';
  const sunsetStr = solar.isReady ? fmtMinutes(solar.times.sunset) : '--:--';

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

  const auroraBandOpacity =
    showWeather && effectiveWeatherCategory
      ? Math.max(0.18, pal.auroraOpacity * (WEATHER_ORB_DIM[effectiveWeatherCategory] * 0.6 + 0.4))
      : pal.auroraOpacity;

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
        borderRadius: 14,
        overflow: 'hidden',
        border: `1px solid ${pal.border}`,
        boxShadow: `0 4px 28px rgba(0,0,0,0.40), 0 0 36px 6px ${pal.glow2}`,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* z=1  Sky background */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        animate={{
          background: `linear-gradient(165deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 55%, ${pal.bg[2]} 100%)`,
        }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />

      {/* z=2  Aurora ambient sweep */}
      {pal.aurora && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            pointerEvents: 'none',
            overflow: 'hidden',
            opacity: auroraBandOpacity * 0.32,
            transition: 'opacity 1.4s ease-in-out',
          }}
        >
          <div
            style={{
              position: 'absolute',
              top: '-15%',
              left: '-30%',
              width: '160%',
              height: '70%',
              background: `radial-gradient(ellipse 75% 60% at 45% 55%, ${pal.track[1]}99 0%, ${pal.track[0]}44 48%, transparent 75%)`,
              filter: 'blur(12px)',
              animation: 'aur-cmp-drift-1 16s ease-in-out infinite',
            }}
          />
          <div
            style={{
              position: 'absolute',
              top: '5%',
              left: '-15%',
              width: '130%',
              height: '50%',
              background: `radial-gradient(ellipse 60% 45% at 60% 45%, ${pal.track[2]}66 0%, transparent 72%)`,
              filter: 'blur(9px)',
              animation: 'aur-cmp-drift-2 11s ease-in-out infinite',
            }}
          />
        </div>
      )}

      {/* z=3  Weather backdrop */}
      {showWeather && (
        <motion.div
          animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, zIndex: 3 }}
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

      {/* z=4  Weather layer */}
      {showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
          <WeatherLayer
            category={effectiveWeatherCategory}
            skin="aurora"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.55 : 0.42}
            phaseColors={phaseColors}
          />
        </div>
      )}

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
                letterSpacing: '0.13em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 300,
              }}
              animate={{ color: pal.text }}
              transition={{ duration: 1.4 }}
            >
              {AUR[phase].label}
            </motion.span>
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'flex', alignItems: 'center', width: 16, flexShrink: 0 }}
              >
                {countryInfo && (
                  <CompactFlagBadge
                    code={countryInfo.code}
                    skin="aurora"
                    mode={pal.mode}
                    accent={pal.glow1}
                    shadow={pal.bg[0]}
                    highlight={pal.text}
                    glow={pal.glow2}
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
                  letterSpacing: '-0.01em',
                  fontWeight: 200,
                  lineHeight: 1,
                  opacity: 0.55,
                }}
                animate={{ color: pal.text }}
                transition={{ duration: 1.4 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '0.03em',
                  fontWeight: 400,
                  lineHeight: 1,
                  textAlign: 'right', 

                }}
                animate={{ color: pal.text, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.4 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* ── Row 2: aurora band track ── */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <AuroraTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            pal={pal}
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
              fontWeight: 300,
            }}
            animate={{
              color: pal.sub,
              opacity: solar.isReady ? 0.65 : 0,
            }}
            transition={{ duration: 1.2 }}
          >
            ↑ {sunriseStr}
          </motion.span>

          {location && (
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.06em',
                lineHeight: 1,
                textAlign: 'center',
                opacity: 0.28,
              }}
              animate={{ color: pal.sub }}
              transition={{ duration: 1.2 }}
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
              fontWeight: 300,
            }}
            animate={{
              color: pal.sub,
              opacity: solar.isReady ? 0.65 : 0,
            }}
            transition={{ duration: 1.2 }}
          >
            ↓ {sunsetStr}
          </motion.span>
        </div>
      </div>

      {/* z=6  Top edge catchlight */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          zIndex: 6,
          pointerEvents: 'none',
          background: `linear-gradient(to right,
            transparent 0%,
            rgba(255,255,255,${pal.mode === 'dark' ? '0.10' : '0.18'}) 25%,
            rgba(255,255,255,${pal.mode === 'dark' ? '0.10' : '0.18'}) 75%,
            transparent 100%)`,
        }}
      />
    </motion.div>
  );
}
