'use client';

// paper.compact.tsx [v5 — circular wrap-around fix]
//
// ORB WRAP-AROUND FIX (v5):
//   usePaperCompactOrbRaf previously had no circular-distance detection at
//   all. It operated in pixel space (setTarget received `x` directly), had
//   no curP ref to track progress, and had no fade/snap path.
//
//   When progress wrapped from ~0 to ~1 (or vice versa) the raw pixel delta
//   was large and the ink blot lerped slowly across the full track width.
//
//   Fix applied:
//     - setTarget now receives `progress` (0-1) as well as `x` (pixels)
//     - curP ref tracks progress for circular-distance comparison
//     - Circular delta computed: |rawDelta| > 0.5 → wrap → fade + snap
//     - wrapRef added: a <g> that wraps the ink blot group for the fade
//     - The watercolor wash ellipse and dashed baseline stay outside wrapRef
//       so the track's "paper" feel persists during the snap transition
//     - Call site updated: useEffect passes both `progress * trackW` and
//       `progress` to setTarget
//
// FLAG BADGE UPDATE:
//   Removed the old inline `CompactFlag` component which applied a CSS
//   `filter` string on the container element. Now uses `CompactFlagBadge`
//   from shared/flag-badge with skin="paper".
//
//   The neutral SVG filter (gentle desaturate + mode-aware brightness)
//   operates on the flag's own SVG paths — not a CSS wrapper — so the
//   treatment is genuinely integrated with the paper palette rather than
//   being a tinted box. In dark/night phases the flag dims naturally to
//   match the ink-on-stock aesthetic; in light phases it stays near-vivid.
//
//   No glow passed — paper is a matte, non-emissive world.
//
// Weather integration unchanged from v4.

import * as ct from 'countries-and-timezones';
import { motion } from 'motion/react';
import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useSolarPosition } from '../../hooks/useSolarPosition';
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
import { PAPER_PALETTES, type PaperPalette, lerpPaperPalette } from './paper.component';

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 10, trackH: 20, labelSize: 10, timeSize: 8 },
  md: { width: 240, height: 88, px: 14, py: 11, trackH: 24, labelSize: 11, timeSize: 9 },
  lg: { width: 280, height: 104, px: 16, py: 12, trackH: 28, labelSize: 12, timeSize: 10 },
};

const ITALIC_PHASES = new Set<string>([
  'dawn',
  'sunrise',
  'morning',
  'afternoon',
  'sunset',
  'dusk',
]);

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

// ─── Ink track refs ───────────────────────────────────────────────────────────

interface InkTrackRefs {
  washEl: React.RefObject<SVGEllipseElement>;
  featherEl: React.RefObject<SVGEllipseElement>;
  outerBlob: React.RefObject<SVGCircleElement>;
  coreBlob: React.RefObject<SVGCircleElement>;
  wrapG: React.RefObject<SVGGElement>;
}

// ─── Paper compact orb RAF ────────────────────────────────────────────────────
//
// FIX (v5): Added curP (progress tracker), circular-distance check, and
// fade+snap path. setTarget now takes both x (pixels) and progress (0-1).
//
// The watercolor wash (washEl) sits outside wrapG because it represents the
// "stain already left on the paper" — it should stay visible even when the
// ink blot itself teleports. Only outerBlob and coreBlob are inside wrapG.

function usePaperCompactOrbRaf(refs: InkTrackRefs) {
  const curX = useRef(-1);
  const curP = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (x: number) => {
    refs.washEl.current?.setAttribute('cx', String(x / 2));
    refs.washEl.current?.setAttribute('rx', String(Math.max(0, x / 2)));
    refs.featherEl.current?.setAttribute('cx', String(x));
    refs.outerBlob.current?.setAttribute('cx', String(x));
    refs.coreBlob.current?.setAttribute('cx', String(x));
  };

  const setWrapOpacity = (v: number) => {
    if (refs.wrapG.current) refs.wrapG.current.style.opacity = String(v);
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

  const setTarget = (x: number, progress: number) => {
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

// ─── InkWashTrack ─────────────────────────────────────────────────────────────

function InkWashTrack({
  trackW,
  trackH,
  pal,
  isDaytime,
  initX,
  washRef,
  featherRef,
  outerRef,
  coreRef,
  wrapGRef,
  orbOpacity = 1,
}: {
  trackW: number;
  trackH: number;
  pal: PaperPalette;
  isDaytime: boolean;
  initX: number;
  washRef: React.RefObject<SVGEllipseElement>;
  featherRef: React.RefObject<SVGEllipseElement>;
  outerRef: React.RefObject<SVGCircleElement>;
  coreRef: React.RefObject<SVGCircleElement>;
  wrapGRef: React.RefObject<SVGGElement>;
  orbOpacity?: number;
}) {
  const orbR = isDaytime ? trackH * 0.48 : trackH * 0.36;
  const lineY = trackH / 2 + trackH * 0.05;
  const filterId = `pw${useId().replace(/:/g, '')}`;

  return (
    <svg
      aria-hidden="true"
      width={trackW}
      height={trackH}
      viewBox={`0 0 ${trackW} ${trackH}`}
      style={{ overflow: 'hidden' }}
    >
      <defs>
        <filter id={`${filterId}-blob`} x="-100%" y="-100%" width="300%" height="300%">
          <feGaussianBlur stdDeviation="3.5" />
        </filter>
        <filter id={`${filterId}-core`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="1.5" />
        </filter>
        <linearGradient
          id={`${filterId}-wash`}
          x1="0"
          y1="0"
          x2="1"
          y2="0"
          gradientUnits="objectBoundingBox"
        >
          <stop offset="0%" stopColor={pal.accentColor} stopOpacity={0.08} />
          <stop offset="60%" stopColor={pal.accentColor} stopOpacity={0.28} />
          <stop offset="100%" stopColor={pal.accentColor} stopOpacity={0.55} />
        </linearGradient>
      </defs>

      {/* Dashed baseline — always full opacity (structural) */}
      <line
        x1={0}
        y1={lineY}
        x2={trackW}
        y2={lineY}
        stroke={pal.pillBorder}
        strokeWidth={0.6}
        strokeDasharray="3 4"
        opacity={0.55}
      />

      {/*
       * Watercolor wash — "stain already left on the paper".
       * Stays visible during snap: represents history, not current position.
       * Outside wrapGRef intentionally.
       */}
      <ellipse
        ref={washRef as React.Ref<SVGEllipseElement>}
        cx={initX / 2}
        cy={lineY - trackH * 0.1}
        rx={Math.max(0, initX / 2)}
        ry={trackH * 0.35}
        fill={`url(#${filterId}-wash)`}
        opacity={0.75}
        style={{ filter: 'blur(1px)' }}
      />

      {/* Ink feather — outside wrapGRef, blends with the wash */}
      <ellipse
        ref={featherRef}
        cx={initX}
        cy={lineY}
        rx={orbR * 0.8}
        ry={trackH * 0.22}
        fill={pal.accentColor}
        opacity={0.18}
        style={{ filter: 'blur(4px)' }}
      />

      {/*
       * Ink blot wrap group — fades on wrap-around snap + dims for weather.
       * wash + feather above stay visible through both effects.
       */}
      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <circle
          ref={outerRef}
          cx={initX}
          cy={lineY - trackH * 0.15}
          r={isDaytime ? orbR * 1.3 : orbR * 1.0}
          fill={pal.inkBloom}
          opacity={0.3}
          filter={`url(#${filterId}-blob)`}
        />
        <circle
          ref={coreRef}
          cx={initX}
          cy={lineY - trackH * 0.15}
          r={isDaytime ? orbR * 0.55 : orbR * 0.45}
          fill={pal.inkOrb}
          opacity={0.72}
          filter={`url(#${filterId}-core)`}
          style={{ mixBlendMode: 'multiply' }}
        />
      </g>

      {/* Endpoint ticks */}
      <line
        x1={1}
        y1={lineY - 4}
        x2={1}
        y2={lineY + 2}
        stroke={pal.pillBorder}
        strokeWidth={0.6}
        opacity={0.5}
      />
      <line
        x1={trackW - 1}
        y1={lineY - 4}
        x2={trackW - 1}
        y2={lineY + 2}
        stroke={pal.pillBorder}
        strokeWidth={0.6}
        opacity={0.5}
      />
    </svg>
  );
}

// ─── PaperCompact ─────────────────────────────────────────────────────────────

export function PaperCompact({
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
  const internalPal = useMemo(
    () => lerpPaperPalette(PAPER_PALETTES[blend.phase], PAPER_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };
  const phaseColors = derivePhaseColors(blend, 'paper');
  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime =
    phase !== 'midnight' && phase !== 'night' && phase !== 'dawn' && phase !== 'dusk';
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

  const orbOpacity =
    showWeather && effectiveWeatherCategory ? WEATHER_ORB_DIM[effectiveWeatherCategory] : 1;

  // Country code only — CompactFlagBadge handles SVG lookup internally
  const countryCode = useMemo(() => {
    if (!timezone || !showFlag) return null;
    const tz = ct.getTimezone(timezone);
    return tz?.countries?.[0] ?? null;
  }, [timezone, showFlag]);

  const grainId = `pg${useId().replace(/:/g, '')}`;
  const trackW = size.width - size.px * 2;
  const isItalic = ITALIC_PHASES.has(phase);
  const row1H = size.labelSize + 2;
  const row3H = size.timeSize + 2;
  const innerH = size.height - size.py * 2;
  const gapY = Math.max(2, Math.floor((innerH - row1H - size.trackH - row3H) / 2));

  const washRef = useRef<SVGEllipseElement>(null);
  const featherRef = useRef<SVGEllipseElement>(null);
  const outerRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const { setTarget } = usePaperCompactOrbRaf({
    washEl: washRef,
    featherEl: featherRef,
    outerBlob: outerRef,
    coreBlob: coreRef,
    wrapG: wrapGRef,
  });

  useEffect(() => {
    setTarget(progress * trackW, progress);
  });

  useEffect(() => {
    if (outerRef.current) outerRef.current.style.fill = pal.inkBloom;
    if (coreRef.current) coreRef.current.style.fill = pal.inkOrb;
  });

  const initX = progress * trackW;
  const serifFam = isItalic
    ? "'Instrument Serif', Georgia, serif"
    : "'Courier New', Courier, monospace";
  const monoFam = "'Courier New', monospace";

  return (
    <motion.div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        borderRadius: 6,
        overflow: 'hidden',
        border: `1px solid ${pal.pillBorder}`,
        boxShadow: `0 2px 16px rgba(0,0,0,0.28), 0 0 20px 4px ${pal.inkBloom}`,
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      {/* z=0  Background */}
      <motion.div
        style={{ position: 'absolute', inset: 0 }}
        animate={{ background: `linear-gradient(135deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 100%)` }}
        transition={{ duration: 1.4, ease: 'easeInOut' }}
      />

      {/* z=1  Grain texture */}
      <svg
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          zIndex: 1,
          opacity: pal.grain,
          pointerEvents: 'none',
        }}
      >
        <filter id={grainId}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.70"
            numOctaves="4"
            stitchTiles="stitch"
          />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100%" height="100%" filter={`url(#${grainId})`} />
      </svg>

      {/* z=2  Letterpress top rule */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 1,
          zIndex: 2,
          background: `linear-gradient(to right, transparent, ${pal.accentColor}44, transparent)`,
        }}
      />

      {/* z=3  Weather backdrop */}
      <motion.div
        animate={{ opacity: showWeather && effectiveWeatherCategory ? 1 : 0 }}
        transition={CONTENT_FADE}
        style={{ position: 'absolute', inset: 0, zIndex: 3 }}
      >
        {showWeather && effectiveWeatherCategory && (
          <WeatherBackdrop
            category={effectiveWeatherCategory}
            skin="paper"
            phaseColors={phaseColors}
          />
        )}
      </motion.div>

      {/* z=4  Weather layer */}
      {showWeather && effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 4 }}>
          <WeatherLayer
            category={effectiveWeatherCategory}
            skin="paper"
            opacity={effectiveWeatherCategory === 'thunder' ? 0.5 : 0.38}
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
                fontFamily: serifFam,
                fontSize: isItalic ? size.labelSize + 1 : size.labelSize,
                fontStyle: isItalic ? 'italic' : 'normal',
                letterSpacing: isItalic ? '0.01em' : '0.08em',
                lineHeight: 1,
                fontWeight: 400,
              }}
              animate={{ color: pal.textPrimary }}
              transition={{ duration: 1.2 }}
            >
              {pal.label}
            </motion.span>

            {/*
             * FLAG — paper compact.
             * CompactFlagBadge with skin="paper" (neutral SVG filter).
             * The filter desaturates to 0.62–0.90 and pulls brightness in
             * dark phases — matching the ink-on-stock feel of the card bg.
             * In midnight/night the flag reads as a dark, muted rectangle;
             * in morning/solar-noon it stays close to full colour.
             *
             * No glow — paper is non-emissive. The flag sits flush after the
             * phase label, in the same row-1 left cluster as before.
             *
             * shadow=pal.bg[0] passes the deepest background shade so the
             * mineral/neutral duotone anchor matches the card in dark phases.
             * highlight=pal.textPrimary gives the bright end of the duotone
             * the same warm-ink tone as the card's primary text colour.
             */}
            {showFlag && (
              <motion.span
                animate={{ opacity: countryCode ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'flex', alignItems: 'center', width: 16, flexShrink: 0 }}
              >
                {countryCode && (
                  <CompactFlagBadge
                    code={countryCode}
                    skin="paper"
                    mode={pal.mode}
                    accent={pal.accentColor}
                    shadow={pal.bg[0]}
                    highlight={pal.textPrimary}
                  />
                )}
              </motion.span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <motion.span
                style={{
                  fontFamily: monoFam,
                  fontSize: size.labelSize,
                  letterSpacing: '0.04em',
                  fontWeight: 400,
                  lineHeight: 1,
                  opacity: 0.6,
                }}
                animate={{ color: pal.textPrimary }}
                transition={{ duration: 1.2 }}
              >
                {time}
              </motion.span>
            )}
            {showTemperature && (
              <motion.span
                style={{
                  fontFamily: serifFam,
                  fontStyle: isItalic ? 'italic' : 'normal',
                  fontSize: size.labelSize,
                  lineHeight: 1,
                  fontWeight: 500,
                  textAlign: 'right', 
                }}
                animate={{ color: pal.textPrimary, opacity: tempStr ? 1 : 0 }}
                transition={CONTENT_FADE}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: ink wash track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <InkWashTrack
            trackW={trackW}
            trackH={size.trackH}
            pal={pal}
            isDaytime={isDaytime}
            initX={initX}
            washRef={washRef}
            featherRef={featherRef}
            outerRef={outerRef}
            coreRef={coreRef}
            wrapGRef={wrapGRef}
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
            opacity: solar.isReady ? 1 : 0,
            transition: 'opacity 0.6s ease-in-out',
          }}
        >
          <motion.span
            style={{
              fontFamily: monoFam,
              fontSize: size.timeSize,
              letterSpacing: '0.06em',
              lineHeight: 1,
              opacity: 0.38,
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.2 }}
          >
            {sunriseStr}
          </motion.span>
          {location && (
            <motion.span
              style={{
                fontFamily: monoFam,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.04em',
                lineHeight: 1,
                opacity: 0.28,
              }}
              animate={{ color: pal.textSecondary }}
              transition={{ duration: 1.2 }}
            >
              {location}
            </motion.span>
          )}
          <motion.span
            style={{
              fontFamily: monoFam,
              fontSize: size.timeSize,
              letterSpacing: '0.06em',
              lineHeight: 1,
              opacity: 0.38,
            }}
            animate={{ color: pal.textSecondary }}
            transition={{ duration: 1.2 }}
          >
            {sunsetStr}
          </motion.span>
        </div>
      </div>
    </motion.div>
  );
}
