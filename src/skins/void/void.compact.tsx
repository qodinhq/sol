'use client';

/**
 * skins/void/void.compact.tsx  [v2 — wrap-around fix]
 *
 * ORB WRAP-AROUND FIX (v2):
 *   useVoidOrbRaf had `wrap` in the refs interface and setWrapOpacity was
 *   correctly written, but VoidTrack called:
 *     useVoidOrbRaf({ glowRef, coreRef }, trackW)
 *   — `wrap` was never passed, so refs.wrap.current was always null, the
 *   fade silently did nothing, and the orb lerped across the full track
 *   on every wrap.
 *
 *   Additionally the mid-glow ring `<circle>` had no ref — it was
 *   neither faded nor repositioned during wraps, causing a ghost ring
 *   to linger at the old position while glowRef and coreRef snapped.
 *
 *   Fix:
 *     - VoidTrack creates wrapGRef and passes it as refs.wrap
 *     - The entire orb (outer bloom + mid ring + hard core) is wrapped
 *       inside <g ref={wrapGRef}> so fade affects all three as a unit
 *     - glowRef and coreRef still exist for per-frame cx updates via RAF
 *     - The mid-glow ring is now inside wrapGRef so it moves and fades
 *       correctly — it no longer needs its own ref since it's a child
 *       of the group that gets transform'd... but wait: the void orb
 *       uses cx setAttribute, not group transform. So the mid-ring gets
 *       its own midRef for RAF cx updates too.
 *     - The track line stays outside wrapGRef — always visible
 *     - fadeTimer.current = null added after snap (minor leak fix)
 *
 * Weather integration unchanged from v1.
 */

import * as ct from 'countries-and-timezones';
import * as CountryFlags from 'country-flag-icons/react/3x2';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { CONTENT_FADE } from '../../shared/content-fade';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { CompactSkinProps } from '../../widgets/compact-widget.shell';
import type { WeatherCategory } from '../../widgets/solar-widget.shell';

// ─── Palette ──────────────────────────────────────────────────────────────────

interface VoidPalette {
  bg: [string, string];
  orbGlow: string;
  orbCore: string;
  textPrimary: string;
  textSecondary: string;
  pillBorder: string;
  shadow: string;
  label: string;
  mode: 'dark';
}

const VP = (
  bg0: string,
  bg1: string,
  glow: string,
  core: string,
  text: string,
  label: string,
): VoidPalette => ({
  bg: [bg0, bg1],
  orbGlow: glow,
  orbCore: core,
  textPrimary: text,
  textSecondary: text,
  pillBorder: glow,
  shadow: glow,
  label,
  mode: 'dark',
});

export const VOID_PALETTES: Record<SolarPhase, VoidPalette> = {
  midnight: VP(
    '#040404',
    '#060608',
    'rgba(80,80,110,0.85)',
    'rgba(160,160,200,1.0)',
    '#E0E0F0',
    'midnight',
  ),
  night: VP(
    '#040608',
    '#060A0E',
    'rgba(60,80,120,0.85)',
    'rgba(130,150,210,1.0)',
    '#D8E0F0',
    'night',
  ),
  dawn: VP('#070604', '#090806', 'rgba(110,70,40,0.85)', 'rgba(200,150,90,1.0)', '#F0E8D8', 'dawn'),
  sunrise: VP(
    '#090604',
    '#0B0806',
    'rgba(150,60,20,0.88)',
    'rgba(220,110,50,1.0)',
    '#F8E0D0',
    'sunrise',
  ),
  morning: VP(
    '#050808',
    '#070A0A',
    'rgba(40,110,70,0.85)',
    'rgba(110,200,140,1.0)',
    '#D8F0E8',
    'morning',
  ),
  'solar-noon': VP(
    '#080808',
    '#0A0A0A',
    'rgba(120,120,100,0.85)',
    'rgba(230,220,170,1.0)',
    '#F8F8F8',
    'noon',
  ),
  afternoon: VP(
    '#090706',
    '#0B0908',
    'rgba(120,80,20,0.85)',
    'rgba(210,155,50,1.0)',
    '#F8F0E0',
    'afternoon',
  ),
  sunset: VP(
    '#0A0504',
    '#0C0706',
    'rgba(160,36,20,0.88)',
    'rgba(230,90,50,1.0)',
    '#F8D8C8',
    'sunset',
  ),
  dusk: VP(
    '#060408',
    '#08060C',
    'rgba(70,50,110,0.85)',
    'rgba(150,120,210,1.0)',
    '#E8D8F8',
    'dusk',
  ),
};

export function lerpVoidPalette(a: VoidPalette, b: VoidPalette, t: number): VoidPalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  return {
    bg: [lerpColor(a.bg[0], b.bg[0], t), lerpColor(a.bg[1], b.bg[1], t)],
    orbGlow: lerpColor(a.orbGlow, b.orbGlow, t),
    orbCore: lerpColor(a.orbCore, b.orbCore, t),
    textPrimary: lerpColor(a.textPrimary, b.textPrimary, t),
    textSecondary: lerpColor(a.textSecondary, b.textSecondary, t),
    pillBorder: lerpColor(a.pillBorder, b.pillBorder, t),
    shadow: lerpColor(a.shadow, b.shadow, t),
    label: t < 0.5 ? a.label : b.label,
    mode: 'dark',
  };
}

// ─── Sizes ────────────────────────────────────────────────────────────────────

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 10, trackH: 16, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 20, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 12, trackH: 24, labelSize: 12, timeSize: 10 },
};

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Void orb RAF ─────────────────────────────────────────────────────────────
//
// FIX (v2): `wrap` was in the interface and setWrapOpacity was correct, but
// VoidTrack called useVoidOrbRaf({ glowRef, coreRef }, trackW) — `wrap` was
// always undefined/null. The fade path ran but did nothing.
//
// Additionally, the mid-glow ring was not ref'd — it had no cx update path
// so it ghosted at its initial position while glowRef and coreRef snapped.
//
// Now: midRef is added for the ring, wrapGRef is passed as `wrap`.
// All three circles (glow, mid, core) snap together inside the fade group.

function useVoidOrbRaf(
  refs: {
    glowRef: React.RefObject<SVGCircleElement>;
    midRef: React.RefObject<SVGCircleElement>; // NEW: mid-glow ring
    coreRef: React.RefObject<SVGCircleElement>;
    wrap: React.RefObject<SVGGElement>; // FIX: now actually passed in
  },
  trackW: number,
) {
  const curX = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const curP = useRef(0);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (x: number) => {
    refs.glowRef.current?.setAttribute('cx', String(x));
    refs.midRef.current?.setAttribute('cx', String(x));
    refs.coreRef.current?.setAttribute('cx', String(x));
  };

  const setWrapOpacity = (v: number) => {
    if (refs.wrap.current) refs.wrap.current.style.opacity = String(v);
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
    const x = Math.max(0.01, Math.min(0.99, progress)) * trackW;
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
        fadeTimer.current = null; // FIX: was missing
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

// ─── VoidTrack ────────────────────────────────────────────────────────────────

function VoidTrack({
  progress,
  trackW,
  trackH,
  pal,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: VoidPalette;
  orbOpacity?: number;
}) {
  const lineY = trackH / 2;
  const orbR = trackH * 0.38;

  const glowRef = useRef<SVGCircleElement>(null);
  const midRef = useRef<SVGCircleElement>(null); // NEW: mid-glow ring ref
  const coreRef = useRef<SVGCircleElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  // FIX: pass wrapGRef as `wrap` and midRef as `midRef`
  const { setTarget } = useVoidOrbRaf({ glowRef, midRef, coreRef, wrap: wrapGRef }, trackW);
  useEffect(() => {
    setTarget(progress);
  });

  useEffect(() => {
    if (glowRef.current) glowRef.current.style.fill = pal.orbGlow;
    if (midRef.current) midRef.current.style.fill = pal.orbGlow;
    if (coreRef.current) coreRef.current.style.fill = pal.orbCore;
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
      <defs>
        <filter id="void-orb-blur" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
        <filter id="void-orb-mid" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3" />
        </filter>
      </defs>

      {/* Track line — outside wrapGRef, always visible */}
      <line
        x1={0}
        y1={lineY}
        x2={trackW}
        y2={lineY}
        stroke={pal.pillBorder}
        strokeWidth={0.8}
        opacity={0.14}
      />

      {/*
       * Orb wrap group — two-layer opacity:
       *   outer (wrapGRef): fades to 0 on wrap-around snap
       *                     CSS transition for weather orbOpacity
       *   inner circles: all three positioned by RAF cx updates
       *
       * Track line above stays visible at all times.
       * All three layers (bloom, mid, core) now move and snap together.
       */}
      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        {/* Outer bloom — phase-hued glow */}
        <circle
          ref={glowRef}
          cx={initX}
          cy={lineY}
          r={orbR * 3.0}
          style={{ fill: pal.orbGlow }}
          opacity={0.65}
          filter="url(#void-orb-blur)"
        />
        {/* Mid glow ring — FIX: now ref'd so it snaps with the others */}
        <circle
          ref={midRef}
          cx={initX}
          cy={lineY}
          r={orbR * 1.6}
          style={{ fill: pal.orbGlow }}
          opacity={0.45}
          filter="url(#void-orb-mid)"
        />
        {/* Hard core */}
        <circle
          ref={coreRef}
          cx={initX}
          cy={lineY}
          r={orbR * 0.85}
          style={{ fill: pal.orbCore }}
          opacity={1.0}
        />
      </g>
    </svg>
  );
}

// ─── CompactFlag ──────────────────────────────────────────────────────────────

function CompactFlag({
  FlagComponent,
  border,
  mode,
}: {
  FlagComponent: React.ComponentType<{ style?: React.CSSProperties }>;
  border: string;
  mode: string;
}) {
  const flagFilter = mode === 'light' ? 'none' : 'saturate(0.80) brightness(0.78)';
  return (
    <span
      style={{
        display: 'inline-flex',
        width: 16,
        height: 11,
        borderRadius: 3,
        overflow: 'hidden',
        border,
        flexShrink: 0,
        opacity: 0.35,
        filter: flagFilter,
      }}
    >
      <FlagComponent style={{ width: '100%', height: '100%', display: 'block' }} />
    </span>
  );
}

// ─── VoidCompact ──────────────────────────────────────────────────────────────

export function VoidCompact({
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
    () => lerpVoidPalette(VOID_PALETTES[blend.phase], VOID_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = {
    ...internalPal,
    bg: [passedPalette.bg[0], passedPalette.bg[1]] as [string, string],
  };

  const phaseColors = derivePhaseColors(blend, 'void');
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

  const liveTemperature = liveTemperatureC;
  const tempStr = temperature ?? (liveTemperature != null ? `${liveTemperature}°` : null);

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weather ?? null)
        : null;

  const isThunder = effectiveWeatherCategory === 'thunder';
  const orbOpacity =
    showWeather && effectiveWeatherCategory && !isThunder
      ? WEATHER_ORB_DIM[effectiveWeatherCategory]
      : 1;

  const countryInfo = useMemo(() => {
    if (!timezone || !showFlag) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const FC =
      (CountryFlags as Record<string, React.ComponentType<{ style?: React.CSSProperties }>>)[
        code
      ] ?? null;
    return FC ? { code, FlagComponent: FC } : null;
  }, [timezone, showFlag]);

  const trackW = size.width - size.px * 2;
  const row1H = size.labelSize + 2;
  const row3H = size.timeSize + 2;
  const innerH = size.height - size.py * 2;
  const gapY = Math.max(2, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  return (
    <div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 3,
        overflow: 'hidden',
        border: `1px solid ${pal.pillBorder}40`,
        boxShadow: `0 2px 20px rgba(0,0,0,0.85), 0 0 30px 6px ${pal.orbGlow}30`,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* z=1 Background */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: `linear-gradient(135deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)`,
          transition: 'background 2s ease-in-out',
        }}
      />

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
            skin="void"
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
            skin="void"
            opacity={isThunder ? 0.92 : 0.12}
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
            <span
              style={{
                fontFamily: SANS,
                fontSize: size.labelSize,
                letterSpacing: '0.12em',
                textTransform: 'lowercase',
                lineHeight: 1,
                fontWeight: 200,
                color: pal.textPrimary,
                opacity: 0.38,
                transition: 'color 2s ease-in-out',
              }}
            >
              {pal.label}
            </span>
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo?.FlagComponent ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryInfo?.FlagComponent && (
                  <CompactFlag
                    FlagComponent={countryInfo.FlagComponent}
                    border={`1px solid ${pal.pillBorder}40`}
                    mode={pal.mode}
                  />
                )}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '-0.02em',
                  fontWeight: 100,
                  lineHeight: 1,
                  color: pal.textPrimary,
                  opacity: 0.32,
                  transition: 'color 2s ease-in-out',
                }}
              >
                {time}
              </span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '0.04em',
                  fontWeight: 300,
                  lineHeight: 1,
                  color: pal.textPrimary,
                  textAlign: 'right', 
                }}
                animate={{ opacity: tempStr ? 0.38 : 0 }}
                transition={CONTENT_FADE}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: Void track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <VoidTrack
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
            opacity: solar.isReady ? 0.28 : 0,
            transition: 'opacity 1s ease-in-out',
          }}
        >
          <span
            style={{
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.10em',
              lineHeight: 1,
              color: pal.textSecondary,
            }}
          >
            {sunriseStr}
          </span>
          {location && (
            <span
              style={{
                fontFamily: SANS,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.08em',
                lineHeight: 1,
                color: pal.textSecondary,
                opacity: 0.8,
              }}
            >
              {location}
            </span>
          )}
          <span
            style={{
              fontFamily: SANS,
              fontSize: size.timeSize,
              letterSpacing: '0.10em',
              lineHeight: 1,
              color: pal.textSecondary,
            }}
          >
            {sunsetStr}
          </span>
        </div>
      </div>
    </div>
  );
}
