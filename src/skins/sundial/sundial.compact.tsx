'use client';

/**
 * skins/sundial/sundial.compact.tsx  [v3 — flag-badge update]
 *
 * ORB WRAP-AROUND FIX (v2): unchanged — see v2 comments for details.
 *
 * FLAG BADGE UPDATE (v3):
 *   Replaced custom CompactFlag component (country-flag-icons/react/3x2) with
 *   CompactFlagBadge from shared/flag-badge using skin="sundial".
 *
 *   The sundial SVG filter applies a warm ochre-amber soft-light wash for day
 *   phases and a cool slate wash for night phases — the flag reads as embedded
 *   in the same stone material as the widget rather than inserted from outside.
 *   Shape is a 2px rect with a directional carved-recess inset shadow.
 *
 *   Props mapping:
 *     accent    → pal.orbFill      (warm amber/slate depending on phase)
 *     shadow    → pal.shadow       (deepest stone bg tone for any duotone blend)
 *     highlight → pal.textPrimary  (stone text for the bright duotone anchor)
 *     glow      → pal.orbGlow      (passed through; sundial shape ignores glow,
 *                                   only aurora/mineral use the halo overlay)
 *
 * Weather integration strategy unchanged from v1 — see that version for details.
 */

import * as ct from 'countries-and-timezones';
import { motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
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

// ─── Palette ──────────────────────────────────────────────────────────────────

interface SundialPalette {
  bg: [string, string, string];
  luster: string;
  accentColor: string;
  arcColor: string;
  shadowColor: string;
  orbFill: string;
  orbGlow: string;
  tickColor: string;
  textPrimary: string;
  textSecondary: string;
  pillBorder: string;
  shadow: string;
  mode: 'light' | 'dark' | 'dim';
  label: string;
}

export const SUNDIAL_PALETTES: Record<SolarPhase, SundialPalette> = {
  midnight: {
    bg: ['#0E1018', '#141620', '#1A1C28'],
    luster: 'rgba(100,110,150,0.12)',
    accentColor: '#8090B8',
    arcColor: '#505878',
    shadowColor: '#383C50',
    orbFill: '#6878A8',
    orbGlow: '#485888',
    tickColor: '#4A5270',
    textPrimary: '#A8B0C8',
    textSecondary: '#607090',
    pillBorder: '#303850',
    shadow: '#0A0C14',
    mode: 'dark',
    label: 'NOX',
  },
  night: {
    bg: ['#10141C', '#161C26', '#1E2430'],
    luster: 'rgba(90,110,160,0.14)',
    accentColor: '#7888B8',
    arcColor: '#485070',
    shadowColor: '#303848',
    orbFill: '#5868A0',
    orbGlow: '#405080',
    tickColor: '#404860',
    textPrimary: '#98A8C0',
    textSecondary: '#587090',
    pillBorder: '#2E3850',
    shadow: '#0C1018',
    mode: 'dark',
    label: 'NOCTIS',
  },
  dawn: {
    bg: ['#D8C0A0', '#E8D0B0', '#F0DCC0'],
    luster: 'rgba(220,180,120,0.18)',
    accentColor: '#C08840',
    arcColor: '#A87830',
    shadowColor: '#906030',
    orbFill: '#D09040',
    orbGlow: '#C08030',
    tickColor: '#988050',
    textPrimary: '#604020',
    textSecondary: '#907050',
    pillBorder: '#B89060',
    shadow: '#D0B888',
    mode: 'dim',
    label: 'AURORA',
  },
  sunrise: {
    bg: ['#E0C890', '#EED8A8', '#F8E8C0'],
    luster: 'rgba(240,200,100,0.20)',
    accentColor: '#C87820',
    arcColor: '#B06010',
    shadowColor: '#905010',
    orbFill: '#E09030',
    orbGlow: '#D07818',
    tickColor: '#A07840',
    textPrimary: '#503010',
    textSecondary: '#907040',
    pillBorder: '#C8A058',
    shadow: '#D8C080',
    mode: 'dim',
    label: 'ORTUS',
  },
  morning: {
    bg: ['#F0E8D0', '#F8F0E0', '#FFFDF4'],
    luster: 'rgba(240,220,160,0.16)',
    accentColor: '#B87820',
    arcColor: '#A06818',
    shadowColor: '#885810',
    orbFill: '#D89028',
    orbGlow: '#C07818',
    tickColor: '#907040',
    textPrimary: '#402808',
    textSecondary: '#806040',
    pillBorder: '#C0A048',
    shadow: '#E8D8A8',
    mode: 'light',
    label: 'MANE',
  },
  'solar-noon': {
    bg: ['#F8F4E8', '#FEFAEE', '#FFFEF8'],
    luster: 'rgba(240,230,180,0.14)',
    accentColor: '#A87020',
    arcColor: '#906010',
    shadowColor: '#785008',
    orbFill: '#C88820',
    orbGlow: '#B07010',
    tickColor: '#806830',
    textPrimary: '#302008',
    textSecondary: '#705030',
    pillBorder: '#B89040',
    shadow: '#F0E8C8',
    mode: 'light',
    label: 'MERIDIES',
  },
  afternoon: {
    bg: ['#EEE0C8', '#F8ECDA', '#FEF5E8'],
    luster: 'rgba(230,190,120,0.18)',
    accentColor: '#C07828',
    arcColor: '#A86020',
    shadowColor: '#905018',
    orbFill: '#D88030',
    orbGlow: '#C07020',
    tickColor: '#906838',
    textPrimary: '#482810',
    textSecondary: '#806040',
    pillBorder: '#C09050',
    shadow: '#E8D0A8',
    mode: 'light',
    label: 'POSTMERIDIEM',
  },
  sunset: {
    bg: ['#C89070', '#D8A888', '#E8C0A0'],
    luster: 'rgba(210,150,90,0.20)',
    accentColor: '#B06038',
    arcColor: '#985028',
    shadowColor: '#804020',
    orbFill: '#C87040',
    orbGlow: '#A85828',
    tickColor: '#906050',
    textPrimary: '#503020',
    textSecondary: '#806050',
    pillBorder: '#B07848',
    shadow: '#C08868',
    mode: 'dim',
    label: 'OCCASUS',
  },
  dusk: {
    bg: ['#201828', '#2A2038', '#343050'],
    luster: 'rgba(100,80,140,0.14)',
    accentColor: '#7868A8',
    arcColor: '#585888',
    shadowColor: '#404068',
    orbFill: '#6858A0',
    orbGlow: '#504880',
    tickColor: '#504870',
    textPrimary: '#988CB8',
    textSecondary: '#606090',
    pillBorder: '#405080',
    shadow: '#181428',
    mode: 'dark',
    label: 'VESPER',
  },
};

export function lerpSundialPalette(
  a: SundialPalette,
  b: SundialPalette,
  t: number,
): SundialPalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = (ca: string, cb: string) => lerpColor(ca, cb, t);
  return {
    bg: [c(a.bg[0], b.bg[0]), c(a.bg[1], b.bg[1]), c(a.bg[2], b.bg[2])],
    luster: t < 0.5 ? a.luster : b.luster,
    accentColor: c(a.accentColor, b.accentColor),
    arcColor: c(a.arcColor, b.arcColor),
    shadowColor: c(a.shadowColor, b.shadowColor),
    orbFill: c(a.orbFill, b.orbFill),
    orbGlow: c(a.orbGlow, b.orbGlow),
    tickColor: c(a.tickColor, b.tickColor),
    textPrimary: c(a.textPrimary, b.textPrimary),
    textSecondary: c(a.textSecondary, b.textSecondary),
    pillBorder: c(a.pillBorder, b.pillBorder),
    shadow: c(a.shadow, b.shadow),
    mode: t < 0.5 ? a.mode : b.mode,
    label: t < 0.5 ? a.label : b.label,
  };
}

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 10, trackH: 24, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 28, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 12, trackH: 34, labelSize: 12, timeSize: 10 },
};

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Sundial arc RAF ──────────────────────────────────────────────────────────
//
// FIX (v2): refs.wrap was declared in ArcOrbRefs but ArcTrack never created
// or passed a wrapRef — so refs.wrap.current was always null, the fade block
// silently did nothing, and the orb lerped across the full arc on every wrap.
//
// Now ArcTrack creates wrapGRef and passes it here. The fade correctly
// targets the orb group as a single unit.

interface ArcOrbRefs {
  orbGroup: React.RefObject<SVGGElement>;
  shadowLine: React.RefObject<SVGLineElement>;
  wrap: React.RefObject<SVGGElement>;
}

function useSundialOrbRaf(
  refs: ArcOrbRefs,
  paramsRef: React.RefObject<{ trackW: number; baseY: number; arcHeight: number }>,
) {
  const curX = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const curP = useRef(0);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setWrapOpacity = (v: number) => {
    if (refs.wrap.current) refs.wrap.current.style.opacity = String(v);
  };

  const setPos = (x: number) => {
    const p = paramsRef.current;
    if (!p) return;
    const t = x / p.trackW;
    const y = p.baseY - p.arcHeight * 4 * t * (1 - t);
    refs.orbGroup.current?.setAttribute('transform', `translate(${x.toFixed(2)},${y.toFixed(2)})`);
    if (refs.shadowLine.current) {
      refs.shadowLine.current.setAttribute('x1', String(x.toFixed(2)));
      refs.shadowLine.current.setAttribute('x2', String(x.toFixed(2)));
      refs.shadowLine.current.setAttribute('y1', String(y.toFixed(2)));
    }
  };

  const anim = () => {
    const diff = tgtX.current - curX.current;
    if (Math.abs(diff) > 0.15) {
      curX.current += diff * 0.12;
      setPos(curX.current);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curX.current = tgtX.current;
      setPos(curX.current);
      rafId.current = null;
    }
  };

  const setTarget = (progress: number) => {
    const p = paramsRef.current;
    if (!p) return;
    const x = Math.max(0.01, Math.min(0.99, progress)) * p.trackW;
    tgtX.current = x;

    if (firstCall.current) {
      firstCall.current = false;
      curP.current = progress;
      curX.current = x;
      setPos(x);
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
        setPos(x);
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

// ─── ArcTrack ─────────────────────────────────────────────────────────────────

function ArcTrack({
  progress,
  trackW,
  trackH,
  pal,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: SundialPalette;
  orbOpacity?: number;
}) {
  const baseY = trackH - 5;
  const topY = trackH * 0.06;
  const arcHeight = baseY - topY;
  const orbR = trackH * 0.2;

  const arcPath = Array.from({ length: 80 }, (_, i) => {
    const t = i / 79;
    const x = t * trackW;
    const y = baseY - arcHeight * 4 * t * (1 - t);
    return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  const progress01 = Math.max(0.01, Math.min(0.99, progress));
  const initOrbX = progress01 * trackW;
  const initOrbY = baseY - arcHeight * 4 * progress01 * (1 - progress01);

  const orbGroupRef = useRef<SVGGElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);
  const shadowLineRef = useRef<SVGLineElement>(null);
  const paramsRef = useRef({ trackW, baseY, arcHeight });
  useEffect(() => {
    paramsRef.current = { trackW, baseY, arcHeight };
  });

  const { setTarget } = useSundialOrbRaf(
    { orbGroup: orbGroupRef, shadowLine: shadowLineRef, wrap: wrapGRef },
    paramsRef,
  );
  useEffect(() => {
    setTarget(progress);
  });

  useEffect(() => {
    for (const el of orbGroupRef.current?.querySelectorAll<SVGCircleElement>('[data-orb-fill]') ??
      []) {
      el.style.fill = pal.orbFill;
    }
    for (const el of orbGroupRef.current?.querySelectorAll<SVGCircleElement>('[data-orb-glow]') ??
      []) {
      el.style.fill = pal.orbGlow;
    }
  });

  const filterId = `sd${useId().replace(/:/g, '')}`;

  const ROMAN_TICKS = ['VI', 'IX', 'XII', 'III', 'VI'];

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={`${filterId}-glow`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation={orbR * 0.9} />
        </filter>
      </defs>

      {/* Baseline */}
      <line
        x1={0}
        y1={baseY}
        x2={trackW}
        y2={baseY}
        stroke={pal.arcColor}
        strokeWidth={0.8}
        opacity={0.5}
      />

      {/* Arc — sun's path */}
      <path d={arcPath} fill="none" stroke={pal.arcColor} strokeWidth={1.0} opacity={0.55} />

      {/* Roman numeral ticks */}
      {ROMAN_TICKS.map((label, i) => {
        const tx = (i / 4) * trackW;
        const ty_arc = baseY - arcHeight * 4 * (i / 4) * (1 - i / 4);
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative array, order is stable
          <g key={i}>
            <line
              x1={tx}
              y1={ty_arc - 3}
              x2={tx}
              y2={ty_arc + 3}
              stroke={pal.tickColor}
              strokeWidth={0.6}
              opacity={0.35}
            />
            <text
              x={tx}
              y={baseY + 7}
              textAnchor="middle"
              fontSize={5}
              fontFamily="'Palatino Linotype','Palatino','Book Antiqua',serif"
              fill={pal.tickColor}
              opacity={0.35}
              letterSpacing="0.05em"
            >
              {label}
            </text>
          </g>
        );
      })}

      {/*
       * Shadow gnomon — outside wrapGRef.
       * Stays visible during wrap-around snap (represents the shadow already
       * cast on the stone face, not the orb itself).
       */}
      <line
        ref={shadowLineRef}
        x1={initOrbX}
        y1={initOrbY}
        x2={initOrbX}
        y2={baseY}
        stroke={pal.shadowColor}
        strokeWidth={1.0}
        strokeDasharray="1 2"
        opacity={0.4}
      />

      {/*
       * Orb wrap group — two-layer opacity:
       *   outer (wrapGRef): fades to 0 on wrap-around snap;
       *                     CSS transition for weather orbOpacity
       *   inner (orbGroupRef): positioned by RAF via transform attribute
       */}
      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <g ref={orbGroupRef} transform={`translate(${initOrbX.toFixed(1)},${initOrbY.toFixed(1)})`}>
          {/* Glow bloom */}
          <circle
            data-orb-glow
            cx={0}
            cy={0}
            r={orbR * 2.0}
            style={{ fill: pal.orbGlow }}
            opacity={0.28}
            filter={`url(#${filterId}-glow)`}
          />
          {/* Core orb */}
          <circle data-orb-fill cx={0} cy={0} r={orbR} style={{ fill: pal.orbFill }} />
          {/* Specular */}
          <circle cx={-orbR * 0.3} cy={-orbR * 0.35} r={orbR * 0.22} fill="white" opacity={0.4} />
        </g>
      </g>
    </svg>
  );
}

// ─── Live temperature ─────────────────────────────────────────────────────────

function useTemperatureData(lat: number | null, lon: number | null) {
  const [temp, setTemp] = useState<number | null>(null);
  useEffect(() => {
    if (!lat || !lon) return;
    let dead = false;
    const fetch_ = () =>
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m&forecast_days=1`,
      )
        .then((r) => r.json())
        .then((d: { current: { temperature_2m: number } }) => {
          if (!dead) setTemp(Math.round(d.current.temperature_2m));
        })
        .catch(() => {});
    fetch_();
    const id = setInterval(fetch_, 30 * 60 * 1000);
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [lat, lon]);
  return temp;
}

// ─── SundialCompact ───────────────────────────────────────────────────────────

export function SundialCompact({
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
  const SERIF = "'Palatino Linotype','Palatino','Book Antiqua','Georgia',serif";
  const SANS = "'Inter','SF Pro Display','Helvetica Neue',sans-serif";

  const internalPal = useMemo(
    () =>
      lerpSundialPalette(SUNDIAL_PALETTES[blend.phase], SUNDIAL_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'sundial');
  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;
  const sunriseStr = solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetStr = solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const liveTemp = useTemperatureData(latitude ?? null, longitude ?? null);
  const tempC = liveTemperatureC ?? liveTemp ?? null;
  const tempStr = temperature ?? (tempC != null ? `${tempC}°` : null);

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weather ?? null)
        : null;

  const orbOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  // ── Country info ───────────────────────────────────────────────────────────
  // Returns only the ISO code — CompactFlagBadge handles the rest.
  const countryInfo = useMemo(() => {
    if (!timezone || !showFlag) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    return code ? { code } : null;
  }, [timezone, showFlag]);

  const trackW = size.width - size.px * 2;
  const row1H = size.labelSize + 2;
  const row3H = size.timeSize + 2;
  const innerH = size.height - size.py * 2;
  const gapY = Math.max(1, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  return (
    <motion.div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${pal.pillBorder}`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.35), 0 0 18px 2px ${pal.shadow}`,
        cursor: 'default',
        userSelect: 'none',
      }}
      animate={{
        background: `linear-gradient(145deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 55%, ${pal.bg[2]} 100%)`,
      }}
      transition={{ duration: 1.8, ease: 'easeInOut' }}
    >
      {/* Stone luster */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          background: `radial-gradient(ellipse 55% 50% at 35% 30%, ${pal.luster} 0%, transparent 70%)`,
          transition: 'background 1.8s ease-in-out',
        }}
      />

      {/* z=3 Weather backdrop */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: showWeather && effectiveWeatherCategory ? 1 : 0 }}
        transition={CONTENT_FADE}
      >
        {showWeather && effectiveWeatherCategory && (
          <WeatherBackdrop
            category={effectiveWeatherCategory}
            skin="sundial"
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=4 Weather layer */}
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
            skin="sundial"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.55 : 0.45}
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=5 3-row content */}
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
        {/* Row 1 */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: row1H,
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <motion.span
              style={{
                fontFamily: SERIF,
                fontSize: size.labelSize + 1,
                letterSpacing: '0.12em',
                fontStyle: 'italic',
                lineHeight: 1,
                fontWeight: 400,
              }}
              animate={{ color: pal.textPrimary }}
              transition={{ duration: 1.8 }}
            >
              {pal.label}
            </motion.span>

            {/*
             * Flag badge — stone material treatment.
             * CompactFlagBadge with skin="sundial": warm amber or cool slate
             * soft-light wash, 2px carved-recess rect shape.
             * Props: accent=orbFill (phase's warm/cool stone tone), shadow=bg[0],
             * highlight=textPrimary, glow=orbGlow (passed through, shape ignores it).
             */}
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryInfo && (
                  <CompactFlagBadge
                    code={countryInfo.code}
                    skin="sundial"
                    mode={pal.mode}
                    accent={pal.orbFill}
                    shadow={pal.shadow}
                    highlight={pal.textPrimary}
                    glow={pal.orbGlow}
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
                  letterSpacing: '0.02em',
                  fontWeight: 300,
                  lineHeight: 1,
                  opacity: 0.55,
                }}
                animate={{ color: pal.textPrimary }}
                transition={{ duration: 1.8 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SERIF,
                  fontStyle: 'italic',
                  fontSize: size.labelSize,
                  lineHeight: 1,
                  fontWeight: 400,
                  textAlign: 'right', 
                }}
                animate={{ color: pal.accentColor, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.8 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: Arc track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <ArcTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            pal={pal}
            orbOpacity={orbOpacity}
          />
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 3 */}
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
              letterSpacing: '0.08em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.38 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.8 }}
          >
            {sunriseStr}
          </motion.span>
          {location && (
            <motion.span
              style={{
                fontFamily: SERIF,
                fontStyle: 'italic',
                fontSize: size.timeSize - 1,
                letterSpacing: '0.06em',
                lineHeight: 1,
                opacity: 0.26,
                textAlign: 'center',
              }}
              animate={{ color: pal.textSecondary }}
              transition={{ duration: 1.8 }}
            >
              {location}
            </motion.span>
          )}
          <motion.span
            style={{
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.08em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.38 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.8 }}
          >
            {sunsetStr}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
