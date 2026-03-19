'use client';

/**
 * skins/mineral/mineral.compact.tsx  [v5 — flag-badge integration]
 *
 * FLAG FIX (v5):
 *   Replaced CompactFlag wrapper (CountryFlags React components + CSS filter +
 *   manual octagon clipPath) with CompactFlagBadge from shared/flag-badge.
 *   - Removed CountryFlags import and CompactFlag function
 *   - countryInfo useMemo now returns just { code }
 *   - Render uses <CompactFlagBadge skin="mineral" shadow=bg[0] highlight=textPrimary>
 *     giving it the full gem duotone treatment via the mineral SVG filter
 *
 * ORB WRAP-AROUND FIX (v4): unchanged.
 */

import * as ct from 'countries-and-timezones';
import { motion } from 'motion/react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
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
import {
  CrystalSunOrb,
  DarkGemOrb,
  MINERAL_PALETTES,
  type MineralPalette,
  lerpMineralPalette,
} from './mineral.component';

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

const SIZE_DIMS = {
  sm: { width: 200, height: 72, px: 12, py: 9, trackH: 18, labelSize: 10, subSize: 7, timeSize: 8 },
  md: {
    width: 240,
    height: 88,
    px: 14,
    py: 11,
    trackH: 22,
    labelSize: 11,
    subSize: 8,
    timeSize: 9,
  },
  lg: {
    width: 280,
    height: 104,
    px: 16,
    py: 13,
    trackH: 26,
    labelSize: 12,
    subSize: 9,
    timeSize: 10,
  },
};

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

function fmtMin(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const mm = Math.round(m % 60);
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

// ─── Compact facet RAF ────────────────────────────────────────────────────────

function useCompactFacetRaf(
  groupRef: React.RefObject<SVGGElement>,
  wrapRef: React.RefObject<SVGGElement>,
  trackW: number,
  midY: number,
) {
  const curX = useRef(-1);
  const tgtX = useRef(0);
  const rafId = useRef<number | null>(null);
  const firstCall = useRef(true);
  const curP = useRef(0);
  const orbFading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (x: number) => {
    if (groupRef.current) groupRef.current.setAttribute('transform', `translate(${x},${midY})`);
  };

  const setWrapOpacity = (v: number) => {
    if (wrapRef.current) wrapRef.current.style.opacity = String(v);
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

// ─── FacetTrack ───────────────────────────────────────────────────────────────

function FacetTrack({
  progress,
  trackW,
  trackH,
  pal,
  isDark,
  orbOpacity = 1,
}: {
  progress: number;
  trackW: number;
  trackH: number;
  pal: MineralPalette;
  isDark: boolean;
  orbOpacity?: number;
}) {
  const midY = trackH / 2;
  const gemSize = trackH * 0.38;
  const facetW = 8;
  const facetH = trackH * 0.55;
  const facetHalf = facetH / 2;
  const count = Math.floor(trackW / facetW);
  const initX = Math.max(0.01, Math.min(0.99, progress)) * trackW;

  const orbGroupRef = useRef<SVGGElement>(null);
  const wrapGRef = useRef<SVGGElement>(null);

  const { setTarget } = useCompactFacetRaf(orbGroupRef, wrapGRef, trackW, midY);
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
      <defs>
        <filter id="mcmp-shadow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" floodColor="rgba(0,0,0,0.45)" result="s" />
          <feMerge>
            <feMergeNode in="s" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="mcmp-glow" x="-200%" y="-200%" width="500%" height="500%">
          <feGaussianBlur stdDeviation={gemSize * 0.8} />
        </filter>
      </defs>

      {Array.from({ length: count }, (_, i) => {
        const cx = i * facetW + facetW / 2;
        const filled = cx < initX;
        const bright = filled && cx > initX - facetW * 4;
        return (
          <polygon
            key={`facet-${cx}`}
            points={`${cx},${midY - facetHalf} ${cx + facetW / 2},${midY} ${cx},${midY + facetHalf} ${cx - facetW / 2},${midY}`}
            fill={filled ? pal.facetFill : 'none'}
            stroke={filled ? pal.facetStroke : pal.pillBorder}
            strokeWidth={filled ? 0.4 : 0.5}
            opacity={filled ? (bright ? 0.95 : 0.6) : 0.2}
          />
        );
      })}

      {Array.from({ length: count }, (_, i) => {
        const cx = i * facetW + facetW / 2;
        if (cx >= initX) return null;
        return (
          <polygon
            key={`hi-${cx}`}
            points={`${cx},${midY - facetHalf} ${cx + facetW / 2},${midY} ${cx},${midY}`}
            fill="white"
            opacity={0.14}
          />
        );
      })}

      <g ref={wrapGRef} style={{ opacity: orbOpacity, transition: 'opacity 0.9s ease-in-out' }}>
        <g ref={orbGroupRef} transform={`translate(${initX},${midY})`}>
          <circle r={gemSize * 1.6} fill={pal.facetGlow} filter="url(#mcmp-glow)" />
          <g filter="url(#mcmp-shadow)">
            {isDark ? (
              <DarkGemOrb fill={pal.facetFill} stroke={pal.facetStroke} size={gemSize} />
            ) : (
              <CrystalSunOrb fill={pal.facetFill} stroke={pal.facetStroke} size={gemSize} />
            )}
          </g>
        </g>
      </g>
    </svg>
  );
}

// ─── MineralCompact ───────────────────────────────────────────────────────────

export function MineralCompact({
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
      lerpMineralPalette(MINERAL_PALETTES[blend.phase], MINERAL_PALETTES[blend.nextPhase], blend.t),
    [blend],
  );
  const pal = { ...internalPal, bg: passedPalette.bg };

  const phaseColors = derivePhaseColors(blend, 'mineral');
  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
  const isDark = !isDaytime || phase === 'dusk';
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;

  const sunriseStr = solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetStr = solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

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

  // ── Flag — code only; FlagBadge applies the mineral duotone SVG filter ─────
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
  const facetCorner = size.height * 0.12;

  return (
    <div
      style={{
        position: 'relative',
        width: size.width,
        height: size.height,
        clipPath: `polygon(0px ${facetCorner}px, ${facetCorner}px 0px, ${size.width - facetCorner}px 0px, ${size.width}px ${facetCorner}px, ${size.width}px ${size.height - facetCorner}px, ${size.width - facetCorner}px ${size.height}px, ${facetCorner}px ${size.height}px, 0px ${size.height - facetCorner}px)`,
        overflow: 'hidden',
        cursor: 'default',
        userSelect: 'none',
      }}
    >
      <motion.div
        style={{ position: 'absolute', inset: 0 }}
        animate={{
          background: `linear-gradient(135deg, ${pal.bg[0]} 0%, ${pal.bg[1]} 50%, ${pal.bg[2]} 100%)`,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />

      <motion.div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 1 }}
        animate={{
          background: `radial-gradient(ellipse 60% 55% at 38% 35%, ${pal.luster} 0%, ${pal.lustre2} 45%, transparent 75%)`,
        }}
        transition={{ duration: 1.2, ease: 'easeInOut' }}
      />

      <motion.div
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }}
        animate={{
          boxShadow: `inset 0 0 0 1px ${pal.pillBorder}, 0 4px 24px rgba(0,0,0,0.40), 0 0 20px 3px ${pal.outerGlow}`,
        }}
        transition={{ duration: 1 }}
      />

      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '40%',
          height: '45%',
          background: `linear-gradient(135deg, ${pal.edgeGlow} 0%, transparent 70%)`,
          pointerEvents: 'none',
          zIndex: 3,
        }}
      />

      {showWeather && (
        <motion.div
          animate={{ opacity: effectiveWeatherCategory ? 1 : 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, zIndex: 4 }}
        >
          {effectiveWeatherCategory && (
            <WeatherBackdrop
              category={effectiveWeatherCategory}
              skin="mineral"
              phaseColors={phaseColors}
            />
          )}
        </motion.div>
      )}

      {showWeather && (
        <motion.div
          animate={{
            opacity: effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' ? 1 : 0,
          }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          style={{ position: 'absolute', inset: 0, zIndex: 5 }}
        >
          {effectiveWeatherCategory && effectiveWeatherCategory !== 'clear' && (
            <WeatherLayer
              category={effectiveWeatherCategory}
              skin="mineral"
              opacity={effectiveWeatherCategory === 'thunder' ? 0.6 : 0.5}
              phaseColors={phaseColors}
            />
          )}
        </motion.div>
      )}

      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 6,
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
                fontFamily: SANS,
                fontSize: size.labelSize,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                lineHeight: 1,
                fontWeight: 500,
              }}
              animate={{ color: pal.textPrimary }}
              transition={{ duration: 1.2 }}
            >
              {pal.label}
            </motion.span>
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.subSize,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                lineHeight: 1,
                opacity: 0.48,
              }}
              animate={{ color: pal.accentColor }}
              transition={{ duration: 1.2 }}
            >
              {pal.stone}
            </motion.span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {time && (
              <motion.span
                style={{
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  fontWeight: 300,
                  letterSpacing: '-0.01em',
                  lineHeight: 1,
                  opacity: 0.58,
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
                  fontFamily: SANS,
                  fontSize: size.labelSize,
                  letterSpacing: '0.04em',
                  fontWeight: 600,
                  lineHeight: 1,
                  textAlign: 'right', 

                }}
                animate={{ color: pal.accentColor, opacity: tempStr ? 1 : 0 }}
                transition={{ duration: 1.2 }}
              >
                {tempStr || '\u00A0'}
              </motion.span>
            )}

            {/* FLAG — mineral duotone: darks→bg[0], lights→textPrimary */}
            {showFlag && (
              <motion.span
                animate={{ opacity: countryInfo ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'inline-flex', alignItems: 'center', width: 18, flexShrink: 0 }}
              >
                {countryInfo && (
                  <CompactFlagBadge
                    code={countryInfo.code}
                    skin="mineral"
                    mode={pal.mode}
                    accent={pal.accentColor}
                    shadow={pal.bg[0]}
                    highlight={pal.textPrimary}
                    glow={pal.outerGlow}
                  />
                )}
              </motion.span>
            )}
          </div>
        </div>

        <div style={{ height: gapY, flexShrink: 0 }} />

        {/* Row 2: facet track */}
        <div style={{ width: trackW, height: size.trackH, flexShrink: 0 }}>
          <FacetTrack
            progress={progress}
            trackW={trackW}
            trackH={size.trackH}
            pal={pal}
            isDark={isDark}
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
            transition={{ duration: 1.2 }}
          >{`\u2191 ${sunriseStr}`}</motion.span>

          {location && (
            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: size.timeSize - 1,
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                lineHeight: 1,
                opacity: 0.26,
                textAlign: 'center',
              }}
              animate={{ color: pal.textSecondary }}
              transition={{ duration: 1.2 }}
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
            transition={{ duration: 1.2 }}
          >{`\u2193 ${sunsetStr}`}</motion.span>
        </div>
      </div>
    </div>
  );
}
