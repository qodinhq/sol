'use client';

// signal.compact.tsx [v6 — flag as text]
//
// FLAG UPDATE (v6):
//   Removed the local CompactFlag function that rendered a flag SVG via
//   country-flag-icons/react/3x2. Signal is a terminal skin — it speaks in
//   codes (SR:, SS:, WX:). Location is rendered as "LOC:XX" in the same
//   monospace style as all other data fields in Row 1.
//   No flag badge, no SVG, no border box — just text, matching the aesthetic.
//
// ORB WRAP-AROUND FIX (v5):
//   useSignalCompactOrbRaf had the circular-distance logic written correctly
//   but setTarget was called as setTarget(x, midY) — missing the `progress`
//   argument. This meant curP.current was always set to `undefined`, so
//   rawDelta was always NaN, isWrap was always false, and the wrap detection
//   never fired. The reticle lerped across the full track on every wrap.
//
//   Fix: the call site now passes progress as the third argument:
//     setTarget(progress * trackW, midY, progress)
//
//   Also added a wrapRef <g> in TerminalTrack so the reticle fades cleanly
//   as a single unit. Block segments stay outside and remain full opacity.

import * as ct from 'countries-and-timezones';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useSolarPosition } from '../../hooks/useSolarPosition';
import { CONTENT_FADE } from '../../shared/content-fade';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { CompactSkinProps } from '../../widgets/compact-widget.shell';
import type { WeatherCategory } from '../../widgets/solar-widget.shell';
import {
  Reticle,
  SIGNAL_PALETTES,
  type SignalPalette,
  lerpSignalPalette,
} from './signal.component';

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 10, py: 9, trackH: 18, labelSize: 9, timeSize: 8, segs: 14 },
  md: { width: 240, height: 88, px: 12, py: 10, trackH: 22, labelSize: 10, timeSize: 9, segs: 16 },
  lg: {
    width: 280,
    height: 104,
    px: 14,
    py: 11,
    trackH: 26,
    labelSize: 11,
    timeSize: 10,
    segs: 18,
  },
};

const MONO = "'JetBrains Mono','Fira Code','Cascadia Code','Menlo',monospace";

interface ReticleTrackRefs {
  group: React.RefObject<SVGGElement>;
  halo: React.RefObject<SVGCircleElement>;
  wrapG: React.RefObject<SVGGElement>;
}

// ─── Signal compact orb RAF ───────────────────────────────────────────────────

function useSignalCompactOrbRaf(refs: ReticleTrackRefs) {
  const curX = useRef(-1);
  const tgtX = useRef(0);
  const curP = useRef(-1);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setWrapOpacity = (v: number) => {
    if (refs.wrapG.current) refs.wrapG.current.style.opacity = String(v);
  };

  const setPos = (x: number, midY: number) => {
    refs.group.current?.setAttribute('transform', `translate(${x}, ${midY})`);
    refs.halo.current?.setAttribute('cx', String(x));
  };

  const anim = (midY: number) => {
    const diff = tgtX.current - curX.current;
    if (Math.abs(diff) > 0.15) {
      curX.current += diff * 0.12;
      setPos(curX.current, midY);
      rafId.current = requestAnimationFrame(() => anim(midY));
    } else {
      curX.current = tgtX.current;
      setPos(curX.current, midY);
      rafId.current = null;
    }
  };

  const setTarget = (x: number, midY: number, progress: number) => {
    tgtX.current = x;

    if (firstCall.current) {
      firstCall.current = false;
      curX.current = x;
      curP.current = progress;
      setPos(x, midY);
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
      orbFading.current = true;
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      setWrapOpacity(0);
      fadeTimer.current = setTimeout(() => {
        curX.current = x;
        setPos(x, midY);
        setWrapOpacity(1);
        orbFading.current = false;
        fadeTimer.current = null;
        if (!rafId.current) rafId.current = requestAnimationFrame(() => anim(midY));
      }, 160);
    } else if (!orbFading.current) {
      if (!rafId.current) rafId.current = requestAnimationFrame(() => anim(midY));
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

// ─── TerminalTrack ────────────────────────────────────────────────────────────

function TerminalTrack({
  trackW,
  trackH,
  segs,
  pal,
  initX,
  reticleOpacity = 1,
  groupRef,
  haloRef,
  wrapGRef,
}: {
  trackW: number;
  trackH: number;
  segs: number;
  pal: SignalPalette;
  initX: number;
  reticleOpacity?: number;
  groupRef: React.RefObject<SVGGElement>;
  haloRef: React.RefObject<SVGCircleElement>;
  wrapGRef: React.RefObject<SVGGElement>;
}) {
  const midY = trackH / 2;
  const orbR = (trackH * 0.55) / 2;
  const segW = trackW / segs;
  const filled = Math.round((initX / trackW) * segs);

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'hidden' }}
    >
      <defs>
        <filter id="sig-halo-compact" x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>

      {/* Block segments — outside wrapGRef, always full opacity */}
      {Array.from({ length: segs }, (_, i) => {
        const x = i * segW;
        const isFilled = i < filled;
        const segH = isFilled ? trackH * 0.55 : trackH * 0.4;
        return (
          <rect
            key={`seg-${x}`}
            x={x + 0.5}
            y={midY - segH / 2}
            width={segW - 1.5}
            height={segH}
            fill={isFilled ? pal.accent : 'none'}
            stroke={isFilled ? 'none' : pal.accent}
            strokeWidth={0.5}
            opacity={isFilled ? 0.85 : 0.2}
            rx={0.5}
          />
        );
      })}

      {/* Reticle wrap group — fades on wrap-around AND dims for weather */}
      <g ref={wrapGRef} style={{ opacity: reticleOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <circle
          ref={haloRef}
          cx={initX}
          cy={midY}
          r={orbR * 1.5}
          fill={pal.accent}
          opacity={0.18}
          filter="url(#sig-halo-compact)"
        />
        <g ref={groupRef} transform={`translate(${initX}, ${midY})`}>
          <Reticle accent={pal.accent} size={orbR * 0.85} />
        </g>
      </g>
    </svg>
  );
}

// ─── Weather + temperature hooks ──────────────────────────────────────────────

interface LiveTemp {
  temperatureC: number;
}

async function fetchTemperature(lat: number, lon: number): Promise<LiveTemp> {
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

function useTemperatureData(lat: number | null, lon: number | null) {
  const [temp, setTemp] = useState<LiveTemp | null>(null);
  useEffect(() => {
    if (!lat || !lon) return;
    let dead = false;
    fetchTemperature(lat, lon)
      .then((t) => {
        if (!dead) setTemp(t);
      })
      .catch(() => {});
    const id = setInterval(
      () =>
        fetchTemperature(lat, lon)
          .then((t) => {
            if (!dead) setTemp(t);
          })
          .catch(() => {}),
      30 * 60 * 1000,
    );
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [lat, lon]);
  return temp;
}

// ─── Country code helper ──────────────────────────────────────────────────────
// Returns the ISO 3166-1 alpha-2 code for the widget's timezone.
// Rendered as "LOC:XX" — a monospace terminal data field, not a flag image.

function useCountryCode(timezone: string | undefined | null): string | null {
  return useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    return tz?.countries?.[0] ?? null;
  }, [timezone]);
}

// ─── SignalCompact ────────────────────────────────────────────────────────────

export function SignalCompact({
  phase,
  blend,
  time,
  location,
  temperature,
  weather = null,
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
  const internalPal = useMemo(
    () =>
      lerpSignalPalette(SIGNAL_PALETTES[blend.phase], SIGNAL_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };
  const phaseColors = derivePhaseColors(blend, 'signal');
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
  const tempC = liveTemperatureC ?? liveTemp?.temperatureC ?? null;
  const tempStr = temperature ?? (tempC != null ? `${tempC}°` : null);

  const effectiveWeatherCategory: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weather ?? null)
        : null;

  const reticleOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  // Country code as text — "LOC:GB" not a flag SVG
  const countryCode = useCountryCode(timezone);
  const flagActive = showFlag && countryCode !== null;

  const [blink, setBlink] = useState(true);
  useEffect(() => {
    const id = setInterval(() => setBlink((b) => !b), 530);
    return () => clearInterval(id);
  }, []);

  const trackW = size.width - size.px * 2;
  const row1H = size.labelSize + 2;
  const row3H = size.timeSize + 2;
  const innerH = size.height - size.py * 2;
  const gapY = Math.max(2, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  const wrapGRef = useRef<SVGGElement>(null);
  const haloRef = useRef<SVGCircleElement>(null);
  const groupRef = useRef<SVGGElement>(null);

  const { setTarget } = useSignalCompactOrbRaf({ group: groupRef, halo: haloRef, wrapG: wrapGRef });

  const midY = size.trackH / 2;
  const initX = progress * trackW;

  useEffect(() => {
    setTarget(progress * trackW, midY, progress);
  });

  useEffect(() => {
    if (groupRef.current) {
      for (const el of groupRef.current.querySelectorAll<SVGElement>('circle, line')) {
        if (el.getAttribute('stroke')) el.setAttribute('stroke', pal.accent);
        if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none')
          el.setAttribute('fill', pal.accent);
      }
    }
    if (haloRef.current) haloRef.current.style.fill = pal.accent;
  });

  return (
    <div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 2,
        overflow: 'hidden',
        background: pal.bg[0],
        border: `1px solid ${pal.pillBorder}`,
        boxShadow: `0 0 0 1px ${pal.accentDim}, 0 4px 24px rgba(0,0,0,0.65), 0 0 20px 2px ${pal.accentDim}`,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* z=3  Weather backdrop */}
      {showWeather && effectiveWeatherCategory && (
        <motion.div
          style={{ position: 'absolute', inset: 0, zIndex: 3 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={CONTENT_FADE}
        >
          <WeatherBackdrop
            category={effectiveWeatherCategory}
            skin="signal"
            phaseColors={phaseColors}
          />
        </motion.div>
      )}

      {/* z=4  Weather layer */}
      {showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
        <motion.div
          style={{ position: 'absolute', inset: 0, zIndex: 4 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={CONTENT_FADE}
        >
          <WeatherLayer
            category={effectiveWeatherCategory}
            skin="signal"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.45 : 0.35}
            phaseColors={phaseColors}
          />
        </motion.div>
      )}

      {/* z=1  Scanlines */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          backgroundImage:
            'repeating-linear-gradient(to bottom, rgba(0,0,0,0.0) 0px, rgba(0,0,0,0.0) 1px, rgba(0,0,0,0.10) 1px, rgba(0,0,0,0.10) 2px)',
          backgroundSize: '100% 2px',
        }}
      />

      {/* z=2  Top accent line */}
      <motion.div
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, zIndex: 2 }}
        animate={{
          background: `linear-gradient(to right, transparent, ${pal.accent}, transparent)`,
        }}
        transition={{ duration: 0.8 }}
      />

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
            {/* Phase code */}
            <motion.span
              style={{
                fontFamily: MONO,
                fontSize: size.labelSize,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 700,
              }}
              animate={{ color: pal.accent }}
              transition={{ duration: 0.6 }}
            >
              {pal.phaseCode}
            </motion.span>
            {/*
             * LOC:XX — country code as a monospace terminal label, no flag SVG.
             * Rendered at the same size and style as the phase code, slightly muted.
             * Signal: codes only — WX:, SR:, SS:, LOC: — consistent data-readout pattern.
             */}
            {showFlag && (
              <motion.span
                style={{
                  fontFamily: MONO,
                  fontSize: size.labelSize,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  lineHeight: 1,
                  fontWeight: 400,
                }}
                animate={{ color: pal.textMuted, opacity: flagActive ? 1 : 0 }}
                transition={CONTENT_FADE}
              >
                LOC:{countryCode || '\u00A0\u00A0'}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            {time && (
              <motion.span
                style={{
                  fontFamily: MONO,
                  fontSize: size.labelSize,
                  letterSpacing: '0.06em',
                  fontWeight: 700,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
                animate={{ color: pal.accent }}
                transition={{ duration: 0.6 }}
              >
                {time}
                <span style={{ opacity: blink ? 1 : 0 }}>_</span>
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: MONO,
                  fontSize: size.labelSize,
                  letterSpacing: '0.04em',
                  fontWeight: 700,
                  lineHeight: 1,
                  textAlign: 'right', 
                }}
                animate={{ color: pal.accent, opacity: tempStr ? 1 : 0 }}
                transition={CONTENT_FADE}
              >
                {tempStr ? tempStr.toUpperCase() : '\u00A0'}
              </motion.span>
            )}
            {showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
              <motion.span
                style={{
                  fontFamily: MONO,
                  fontSize: size.labelSize - 1,
                  letterSpacing: '0.08em',
                  fontWeight: 400,
                  lineHeight: 1,
                  opacity: 0.55,
                }}
                animate={{ color: pal.accent }}
                transition={{ duration: 0.6 }}
              >
                WX:{effectiveWeatherCategory.toUpperCase().replace('-', '')}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: terminal track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <TerminalTrack
            trackW={trackW}
            trackH={size.trackH}
            segs={size.segs}
            pal={pal}
            initX={initX}
            reticleOpacity={reticleOpacity}
            groupRef={groupRef}
            haloRef={haloRef}
            wrapGRef={wrapGRef}
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
            opacity: solar.isReady ? 1 : 0,
            transition: 'opacity 0.5s linear',
          }}
        >
          <motion.span
            style={{
              fontFamily: MONO,
              fontSize: size.timeSize,
              letterSpacing: '0.06em',
              lineHeight: 1,
              opacity: 0.42,
            }}
            animate={{ color: pal.accent }}
            transition={{ duration: 0.6 }}
          >
            SR:{sunriseStr}
          </motion.span>
          {location && (
            <motion.span
              style={{
                fontFamily: MONO,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                lineHeight: 1,
                opacity: 0.28,
              }}
              animate={{ color: pal.accent }}
              transition={{ duration: 0.6 }}
            >
              {location}
            </motion.span>
          )}
          <motion.span
            style={{
              fontFamily: MONO,
              fontSize: size.timeSize,
              letterSpacing: '0.06em',
              lineHeight: 1,
              opacity: 0.42,
            }}
            animate={{ color: pal.accent }}
            transition={{ duration: 0.6 }}
          >
            SS:{sunsetStr}
          </motion.span>
        </div>
      </div>
    </div>
  );
}
