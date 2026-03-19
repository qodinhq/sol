'use client';

/**
 * skins/tide/tide.compact.tsx  [v3 — flag badge migration]
 *
 * ORB WRAP-AROUND FIX (v2 — unchanged):
 *   useTideOrbRaf had wrapRef in WaveOrbRefs and setWrapOpacity was
 *   correctly written, but WaveTrack called:
 *     useTideOrbRaf({ glowRef, coreRef, specRef }, paramsRef)
 *   — wrapRef was never passed, so refs.wrapRef.current was always null,
 *   the fade silently did nothing, and the orb lerped across the full
 *   wave track on every wrap.
 *
 *   Fix:
 *     - WaveTrack creates wrapGRef and passes it as refs.wrapRef
 *     - The orb group (glow bloom + core + specular) is wrapped inside
 *       <g ref={wrapGRef}> so opacity transitions affect it as a unit
 *     - The water fill path and wave stroke line stay OUTSIDE wrapGRef —
 *       the ocean surface persists during the snap; only the sun/moon
 *       riding on it disappears and reappears
 *     - The outer <g style={{ opacity: orbOpacity }}> is replaced by the
 *       two-layer pattern: wrapGRef (fade target) wrapping the orb group
 *
 * FLAG BADGE MIGRATION (v3):
 *   Replaced local CompactFlag (country-flag-icons/react/3x2 React component
 *   + CSS filter 'saturate(0.80) brightness(0.78)') with CompactFlagBadge
 *   from shared/flag-badge using skin="tide".
 *
 *   Why the old CSS filter was insufficient:
 *     - Mode-unaware: same saturate/brightness regardless of light vs dark phase
 *     - No material wash: no connection to the phase accent color
 *     - Applies to the container element, not to the SVG paths themselves —
 *       interaction with surrounding colors is different from a proper SVG filter
 *
 *   New treatment (skin="tide"):
 *     - feColorMatrix saturate: 0.80 (light), 0.70 (dim), 0.60 (dark) — all
 *       above the 0.45 recognizability floor. Water transmits colour generously.
 *     - feComponentTransfer brightness: 0.86 (dark), 0.93 (dim), 1.00 (light)
 *     - feFlood + feBlend screen at 0.08–0.12 opacity: the phase accent color
 *       provides a very low surface-shimmer wash. screen adds reflected light
 *       rather than embedding in material (contrast: sundial uses soft-light).
 *     - feComposite in: clips to the flag's original alpha shape
 *
 *   Props passed to CompactFlagBadge:
 *     accent    → pal.accentColor  (phase accent for the screen wash)
 *     shadow    → pal.shadow       (darkest bg for duotone anchor)
 *     highlight → pal.textPrimary  (bright anchor for flag light regions)
 *     glow      → pal.orbGlow      (compact skin doesn't use the halo but
 *                                   passed for completeness; CompactFlagBadge
 *                                   does not render a glow halo)
 *
 * FILTER ID HYDRATION FIX (v3):
 *   WaveTrack previously used Math.random() to generate the SVG filter id:
 *     const filterId = useMemo(() => `tf-${Math.random().toString(36).slice(2, 6)}`, []);
 *   This causes React SSR hydration mismatches — the server and client generate
 *   different random values. Fixed to a stable derivation from the phase label:
 *     const filterId = useMemo(() => `tf-cmp-${pal.label.toLowerCase()}`, [pal.label]);
 *   The label ('slack', 'flood', 'ebb', etc.) is deterministic given the same
 *   blend input on both server and client.
 *
 * Weather integration unchanged from v2.
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

// ─── Palette ──────────────────────────────────────────────────────────────────

interface TidePalette {
  bg: [string, string, string];
  surface: string;
  accentColor: string;
  waveStroke: string;
  waveFill: string;
  orbFill: string;
  orbGlow: string;
  textPrimary: string;
  textSecondary: string;
  pillBorder: string;
  shadow: string;
  mode: 'light' | 'dark' | 'dim';
  label: string;
  waveAmp: number;
}

export const TIDE_PALETTES: Record<SolarPhase, TidePalette> = {
  midnight: {
    bg: ['#060C18', '#0A1428', '#0E1C3C'],
    surface: '#080E1E',
    accentColor: '#4CC8E0',
    waveStroke: '#3A9ECC',
    waveFill: '#2A7AAE',
    orbFill: '#5ADCF0',
    orbGlow: '#30B0D8',
    textPrimary: '#A0D8F0',
    textSecondary: '#5890B0',
    pillBorder: '#1E4870',
    shadow: '#0A1428',
    mode: 'dark',
    label: 'SLACK',
    waveAmp: 0.85,
  },
  night: {
    bg: ['#080E1E', '#0C1628', '#121E38'],
    surface: '#0A1020',
    accentColor: '#50CCDC',
    waveStroke: '#3A9EC0',
    waveFill: '#2A78A8',
    orbFill: '#60E0F0',
    orbGlow: '#38B8DC',
    textPrimary: '#A8DCF0',
    textSecondary: '#5E98BC',
    pillBorder: '#1E4868',
    shadow: '#0C1628',
    mode: 'dark',
    label: 'FLOOD',
    waveAmp: 0.78,
  },
  dawn: {
    bg: ['#1E2E40', '#2A3E58', '#3A5070'],
    surface: '#1A2838',
    accentColor: '#78B8D0',
    waveStroke: '#5898C0',
    waveFill: '#3A7898',
    orbFill: '#88C8E0',
    orbGlow: '#60A8CC',
    textPrimary: '#C0D8E8',
    textSecondary: '#7898B8',
    pillBorder: '#305878',
    shadow: '#1E2E40',
    mode: 'dark',
    label: 'EBB',
    waveAmp: 0.6,
  },
  sunrise: {
    bg: ['#C84830', '#E06848', '#F09060'],
    surface: '#C04030',
    accentColor: '#F8B080',
    waveStroke: '#E88060',
    waveFill: '#D06040',
    orbFill: '#FFD0A0',
    orbGlow: '#F0A070',
    textPrimary: '#FFF0E8',
    textSecondary: '#F0C0A0',
    pillBorder: '#D07050',
    shadow: '#C04030',
    mode: 'dim',
    label: 'SURGE',
    waveAmp: 0.55,
  },
  morning: {
    bg: ['#48B8B8', '#60CCCC', '#80DCDC'],
    surface: '#44B0B0',
    accentColor: '#309898',
    waveStroke: '#208888',
    waveFill: '#107878',
    orbFill: '#40B8B8',
    orbGlow: '#289898',
    textPrimary: '#E8FCFC',
    textSecondary: '#80C8C8',
    pillBorder: '#209090',
    shadow: '#44B0B0',
    mode: 'light',
    label: 'NEAP',
    waveAmp: 0.32,
  },
  'solar-noon': {
    bg: ['#E8EEE0', '#F0F5E8', '#F8FCF4'],
    surface: '#EEF3E8',
    accentColor: '#609878',
    waveStroke: '#488878',
    waveFill: '#306860',
    orbFill: '#70A888',
    orbGlow: '#589880',
    textPrimary: '#304840',
    textSecondary: '#608070',
    pillBorder: '#90B8A0',
    shadow: '#E0EAD8',
    mode: 'light',
    label: 'STAND',
    waveAmp: 0.18,
  },
  afternoon: {
    bg: ['#C8D870', '#D8E888', '#E8F4A0'],
    surface: '#C0D068',
    accentColor: '#7A9830',
    waveStroke: '#6A8828',
    waveFill: '#507818',
    orbFill: '#98C040',
    orbGlow: '#80A830',
    textPrimary: '#384818',
    textSecondary: '#708040',
    pillBorder: '#90A840',
    shadow: '#C0D068',
    mode: 'light',
    label: 'RUN',
    waveAmp: 0.28,
  },
  sunset: {
    bg: ['#A82808', '#C83820', '#E05038'],
    surface: '#A02008',
    accentColor: '#F09060',
    waveStroke: '#E07050',
    waveFill: '#C85040',
    orbFill: '#FFB080',
    orbGlow: '#F08060',
    textPrimary: '#FFE8D8',
    textSecondary: '#F0B090',
    pillBorder: '#C05838',
    shadow: '#A02008',
    mode: 'dim',
    label: 'SET',
    waveAmp: 0.5,
  },
  dusk: {
    bg: ['#182040', '#202850', '#283060'],
    surface: '#141830',
    accentColor: '#6080C0',
    waveStroke: '#4870B0',
    waveFill: '#3058A0',
    orbFill: '#7898D0',
    orbGlow: '#5070C0',
    textPrimary: '#B0C0E0',
    textSecondary: '#6080A8',
    pillBorder: '#304878',
    shadow: '#182040',
    mode: 'dark',
    label: 'DRIFT',
    waveAmp: 0.68,
  },
};

export function lerpTidePalette(a: TidePalette, b: TidePalette, t: number): TidePalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = (ca: string, cb: string) => lerpColor(ca, cb, t);
  return {
    bg: [c(a.bg[0], b.bg[0]), c(a.bg[1], b.bg[1]), c(a.bg[2], b.bg[2])],
    surface: c(a.surface, b.surface),
    accentColor: c(a.accentColor, b.accentColor),
    waveStroke: c(a.waveStroke, b.waveStroke),
    waveFill: c(a.waveFill, b.waveFill),
    orbFill: c(a.orbFill, b.orbFill),
    orbGlow: c(a.orbGlow, b.orbGlow),
    textPrimary: c(a.textPrimary, b.textPrimary),
    textSecondary: c(a.textSecondary, b.textSecondary),
    pillBorder: c(a.pillBorder, b.pillBorder),
    shadow: c(a.shadow, b.shadow),
    mode: t < 0.5 ? a.mode : b.mode,
    label: t < 0.5 ? a.label : b.label,
    waveAmp: a.waveAmp + (b.waveAmp - a.waveAmp) * t,
  };
}

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 10, trackH: 22, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 26, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 12, trackH: 30, labelSize: 12, timeSize: 10 },
};

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Wave RAF ─────────────────────────────────────────────────────────────────
//
// FIX (v2): wrapRef was in WaveOrbRefs and setWrapOpacity was correct, but
// WaveTrack passed { glowRef, coreRef, specRef } — wrapRef was always null.
//
// Now WaveTrack creates wrapGRef and passes it here. The fade targets the
// entire orb group. The wave stroke and water fill stay outside wrapGRef.

interface WaveOrbRefs {
  glowRef: React.RefObject<SVGCircleElement>;
  coreRef: React.RefObject<SVGCircleElement>;
  specRef: React.RefObject<SVGCircleElement>;
  wrapRef: React.RefObject<SVGGElement>; // FIX: now actually passed in
}

function useTideOrbRaf(
  refs: WaveOrbRefs,
  params: React.RefObject<{
    trackW: number;
    midY: number;
    amplitude: number;
    cycles: number;
    orbR: number;
  }>,
) {
  const curX = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const curP = useRef(0);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setWrapOpacity = (v: number) => {
    if (refs.wrapRef.current) refs.wrapRef.current.style.opacity = String(v);
  };

  const setPos = (x: number) => {
    const p = params.current;
    if (!p) return;
    const y = p.midY + p.amplitude * Math.sin((x / p.trackW) * Math.PI * 2 * p.cycles);
    refs.glowRef.current?.setAttribute('cx', String(x));
    refs.glowRef.current?.setAttribute('cy', String(y));
    refs.coreRef.current?.setAttribute('cx', String(x));
    refs.coreRef.current?.setAttribute('cy', String(y));
    refs.specRef.current?.setAttribute('cx', String(x - p.orbR * 0.28));
    refs.specRef.current?.setAttribute('cy', String(y - p.orbR * 0.32));
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
    const p = params.current;
    if (!p) return;
    const x = Math.max(0.01, Math.min(0.99, progress)) * p.trackW;
    tgtX.current = x;

    if (firstCall.current) {
      firstCall.current = false;
      curX.current = x;
      curP.current = progress;
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

// ─── WaveTrack ────────────────────────────────────────────────────────────────

function WaveTrack({
  progress,
  trackW,
  trackH,
  pal,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: TidePalette;
  orbOpacity?: number;
}) {
  const CYCLES = 1.5;
  const midY = trackH * 0.58;
  const amplitude = trackH * 0.3 * pal.waveAmp;
  const orbR = trackH * 0.22;

  const PTS = 100;
  const wavePoints = Array.from({ length: PTS }, (_, i) => {
    const t = i / (PTS - 1);
    return { x: t * trackW, y: midY + amplitude * Math.sin(t * Math.PI * 2 * CYCLES) };
  });

  const progress01 = Math.max(0.01, Math.min(0.99, progress));
  const orbX = progress01 * trackW;
  const orbY = midY + amplitude * Math.sin(progress01 * Math.PI * 2 * CYCLES);

  const wavePath = wavePoints
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`)
    .join(' ');

  const filledPts = wavePoints.filter((p) => p.x <= orbX);
  const fillPath =
    filledPts.length > 1
      ? `${filledPts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')} L${orbX.toFixed(1)},${orbY.toFixed(1)} L${orbX.toFixed(1)},${trackH} L0,${trackH} Z`
      : '';

  const glowRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const specRef = useRef<SVGCircleElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const paramsRef = useRef({ trackW, midY, amplitude, cycles: CYCLES, orbR });
  useEffect(() => {
    paramsRef.current = { trackW, midY, amplitude, cycles: CYCLES, orbR };
  });

  const { setTarget } = useTideOrbRaf({ glowRef, coreRef, specRef, wrapRef: wrapGRef }, paramsRef);
  useEffect(() => {
    setTarget(progress);
  });

  useEffect(() => {
    if (glowRef.current) glowRef.current.style.fill = pal.orbGlow;
    if (coreRef.current) coreRef.current.style.fill = pal.orbFill;
  });

  /*
   * HYDRATION FIX (v3):
   * Previously: Math.random() — different value on server vs client → hydration mismatch.
   * Now: derived from pal.label which is deterministic for a given blend input.
   * The label is stable ('SLACK', 'FLOOD', etc.) so the filterId is stable across
   * the SSR and hydration render passes.
   */
  const filterId = useMemo(() => `tf-cmp-${pal.label.toLowerCase()}`, [pal.label]);

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'visible' }}
    >
      <defs>
        <filter id={`${filterId}-glow`} x="-80%" y="-80%" width="260%" height="260%">
          <feGaussianBlur stdDeviation={orbR * 0.8} />
        </filter>
        <clipPath id={`${filterId}-clip`}>
          <rect x={0} y={0} width={trackW} height={trackH} />
        </clipPath>
      </defs>

      {/*
       * Water fill + wave line — outside wrapGRef.
       * The ocean surface persists during snap; only the orb riding it fades.
       */}
      {fillPath && (
        <path d={fillPath} fill={pal.waveFill} opacity={0.3} clipPath={`url(#${filterId}-clip)`} />
      )}
      <path d={wavePath} fill="none" stroke={pal.waveStroke} strokeWidth={1.3} opacity={0.6} />

      {/* Endpoint ticks */}
      <line
        x1={0}
        y1={midY - 4}
        x2={0}
        y2={midY + 4}
        stroke={pal.pillBorder}
        strokeWidth={0.7}
        opacity={0.35}
      />
      <line
        x1={trackW}
        y1={midY - 4}
        x2={trackW}
        y2={midY + 4}
        stroke={pal.pillBorder}
        strokeWidth={0.7}
        opacity={0.35}
      />

      {/*
       * Orb wrap group — two-layer opacity:
       *   outer (wrapGRef): fades to 0 on wrap-around snap
       *                     CSS transition for weather orbOpacity
       *   inner circles: glow bloom + core + specular, all positioned by RAF
       */}
      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <circle
          ref={glowRef}
          cx={orbX}
          cy={orbY}
          r={orbR * 2.2}
          style={{ fill: pal.orbGlow }}
          opacity={0.3}
          filter={`url(#${filterId}-glow)`}
        />
        <circle ref={coreRef} cx={orbX} cy={orbY} r={orbR} style={{ fill: pal.orbFill }} />
        <circle
          ref={specRef}
          cx={orbX - orbR * 0.28}
          cy={orbY - orbR * 0.32}
          r={orbR * 0.25}
          fill="white"
          opacity={0.45}
        />
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

// ─── TideCompact ──────────────────────────────────────────────────────────────

export function TideCompact({
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
  const SANS = "'Inter Condensed','Barlow Condensed','SF Pro Display','Helvetica Neue',sans-serif";

  const internalPal = useMemo(
    () => lerpTidePalette(TIDE_PALETTES[blend.phase], TIDE_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'tide');
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

  // FC intentionally not fetched — CompactFlagBadge loads the SVG string
  // internally via country-flag-icons/string/3x2, not the React component.
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
  const gapY = Math.max(2, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  return (
    <motion.div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 2,
        overflow: 'hidden',
        border: `1px solid ${pal.pillBorder}`,
        boxShadow: `0 2px 18px rgba(0,0,0,0.45), 0 0 22px 3px ${pal.shadow}`,
        cursor: 'default',
        userSelect: 'none',
      }}
      animate={{
        background: `linear-gradient(160deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 55%, ${pal.bg[2]} 100%)`,
      }}
      transition={{ duration: 1.6, ease: 'easeInOut' }}
    >
      {/* z=2 Weather backdrop */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 2 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: showWeather && effectiveWeatherCategory ? 1 : 0 }}
        transition={CONTENT_FADE}
      >
        {showWeather && effectiveWeatherCategory && (
          <WeatherBackdrop
            category={effectiveWeatherCategory}
            skin="tide"
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=3 Weather layer */}
      <motion.div
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
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
            skin="tide"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.55 : 0.4}
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=4 3-row content */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.labelSize + 1,
                letterSpacing: '0.20em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 500,
              }}
              animate={{ color: pal.textPrimary }}
              transition={{ duration: 1.6 }}
            >
              {pal.label}
            </motion.span>

            {/*
             * Flag badge — aqueous screen-wash treatment (skin="tide").
             * accent=accentColor: phase accent feeds the low-opacity screen wash
             * shadow=shadow:      darkest bg for duotone anchor
             * highlight=textPrimary: bright anchor for flag light regions
             * glow=orbGlow:       passed through; CompactFlagBadge doesn't render
             *                     a halo but accepts the prop for API consistency
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
                    skin="tide"
                    mode={pal.mode}
                    accent={pal.accentColor}
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
                  letterSpacing: '0.04em',
                  fontWeight: 400,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
                animate={{ color: pal.textPrimary }}
                transition={{ duration: 1.6 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '0.06em',
                  fontWeight: 500,
                  lineHeight: 1,
                  textAlign: 'right', 
                }}
                animate={{ color: pal.accentColor, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.6 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: Wave track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <WaveTrack
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
              letterSpacing: '0.12em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.4 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.6 }}
          >
            ↑ {sunriseStr}
          </motion.span>
          {location && (
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.16em',
                lineHeight: 1,
                opacity: 0.28,
                textTransform: 'uppercase',
              }}
              animate={{ color: pal.textSecondary }}
              transition={{ duration: 1.6 }}
            >
              {location}
            </motion.span>
          )}
          <motion.span
            style={{
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.12em',
              lineHeight: 1,
              opacity: solar.isReady ? 0.4 : 0,
              transition: 'opacity 0.8s ease-in-out',
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.6 }}
          >
            ↓ {sunsetStr}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
