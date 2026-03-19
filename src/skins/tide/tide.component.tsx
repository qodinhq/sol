'use client';
// ════════════════════════════════════════════════════════════════════════════
// FILE: skins/tide/tide.component.tsx
// ════════════════════════════════════════════════════════════════════════════
/**
 * Coastal instrument skin. The sun/moon rides a full-card sine wave.
 *
 * MOBILE EXPAND FIX (v5):
 *   Outer motion.div layout = W*expandScale × H*expandScale (true visual footprint).
 *   Inner scale wrapper (position:absolute, transformOrigin:'top left') renders
 *   the full W×H card content scaled down. Outer glow stays outside the wrapper.
 *
 * FLAG BADGE UPDATE (v6):
 *   Replaced local PillFlag (country-flag-icons/react/3x2 React component
 *   + CSS filter 'saturate(0.80) brightness(0.78)') with PillFlagBadge from
 *   shared/flag-badge using skin="tide".
 *
 *   Skin choice: "tide"
 *     The tide SVG filter applies a very-low-opacity screen wash using the
 *     phase accent color, producing a flag that reads as seen through salt
 *     water or wet glass — slightly desaturated, surface-lit, aqueous.
 *     Saturation floor 0.60 (dark) stays well above the 0.45 threshold.
 *
 *   Why screen rather than soft-light (sundial/foundry):
 *     screen adds reflected surface light — it brightens without shifting
 *     hue structure. This is correct for water. The flag colors are still
 *     readable; they're just lit from the surface above.
 *
 *   Why the phase accent as wash color:
 *     Tide's accent spans the full chromatic range (cyan night, orange
 *     sunrise, teal morning, yellow-green afternoon). Wash opacity is kept
 *     very low (0.08–0.12) so warm phases tint rather than dominate —
 *     at these levels the wash reads as atmospheric phase shimmer.
 *
 *   Glow halo: tide gets a bioluminescent diffuse glow halo in PillFlagBadge
 *     (blur 7px, inset -4, 70% opacity) — wider than aurora's tight ring,
 *     matching the spreading quality of underwater bioluminescence.
 *
 *   Expanded card: country name retained as MONO uppercase text only.
 *     A flag image in the expanded card would be decorative noise against
 *     the full-bleed wave. The ↑ HW — COUNTRY — ↓ LW layout already reads
 *     cleanly as nautical data; the flag badge belongs in the pill only.
 *
 *   Props passed to PillFlagBadge:
 *     accent    → palette.accentColor  (phase accent for the screen wash)
 *     shadow    → palette.sea[0]       (deepest sea bg for any duotone anchor)
 *     highlight → palette.textPrimary  (flag light anchor)
 *     glow      → palette.outerGlow    (feeds the bioluminescent halo)
 */

import * as ct from 'countries-and-timezones';
import { AnimatePresence, motion } from 'motion/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type SolarPhase, useSolarPosition } from '../../hooks/useSolarPosition';
import { lerpColor } from '../../lib/solar-lerp';
import { useSolarTheme } from '../../provider/solar-theme-provider';
import { CONTENT_FADE } from '../../shared/content-fade';
import { PillFlagBadge } from '../../shared/flag-badge';
import { PillWeatherGlyph } from '../../shared/pill-weather-glyphs';
import {
  WEATHER_ORB_DIM,
  WeatherBackdrop,
  WeatherLayer,
  derivePhaseColors,
} from '../../shared/weather-layer';
import type { ExpandDirection, WeatherCategory } from '../../widgets/solar-widget.shell';
import type { WidgetSkinProps } from '../types/widget-skin.types';

// ─── Palette ──────────────────────────────────────────────────────────────────

export interface TideWidgetPalette {
  bg: [string, string, string];
  sea: [string, string];
  waveStroke: string;
  waveFill: string;
  orbFill: string;
  orbGlow: string;
  bioLumColor: string;
  shimmerColor: string;
  textPrimary: string;
  textSecondary: string;
  outerGlow: string;
  pillBg: string;
  pillBorder: string;
  pillText: string;
  label: string;
  sublabel: string;
  accentColor: string;
  mode: 'light' | 'dim' | 'dark';
  waveAmp: number;
  showBioLume: boolean;
  showShimmer: boolean;
}

export const TIDE_WIDGET_PALETTES: Record<SolarPhase, TideWidgetPalette> = {
  midnight: {
    bg: ['#030A16', '#06112A', '#0A1A3C'],
    sea: ['#010508', '#02080F'],
    waveStroke: '#1A4870',
    waveFill: '#071B30',
    orbFill: '#60E4F8',
    orbGlow: 'rgba(48,200,230,0.70)',
    bioLumColor: 'rgba(72,220,240,0.80)',
    shimmerColor: 'rgba(72,180,220,0.30)',
    textPrimary: '#8AC8E8',
    textSecondary: 'rgba(96,156,196,0.58)',
    outerGlow: 'rgba(24,100,160,0.35)',
    pillBg: 'rgba(3,10,22,0.94)',
    pillBorder: 'rgba(48,140,195,0.38)',
    pillText: '#68B8DC',
    label: 'SLACK',
    sublabel: 'Tidal pause',
    accentColor: '#2888C0',
    mode: 'dark',
    waveAmp: 0.92,
    showBioLume: true,
    showShimmer: false,
  },
  night: {
    bg: ['#040C18', '#081624', '#0C1E34'],
    sea: ['#020608', '#040A12'],
    waveStroke: '#1C5070',
    waveFill: '#081F32',
    orbFill: '#68EAD0',
    orbGlow: 'rgba(52,210,180,0.72)',
    bioLumColor: 'rgba(72,240,200,0.78)',
    shimmerColor: 'rgba(72,210,185,0.28)',
    textPrimary: '#96CCDC',
    textSecondary: 'rgba(104,162,194,0.58)',
    outerGlow: 'rgba(28,110,150,0.32)',
    pillBg: 'rgba(4,12,24,0.94)',
    pillBorder: 'rgba(52,148,188,0.38)',
    pillText: '#74BECC',
    label: 'FLOOD',
    sublabel: 'Rising tide',
    accentColor: '#3096B0',
    mode: 'dark',
    waveAmp: 0.78,
    showBioLume: true,
    showShimmer: false,
  },
  dawn: {
    bg: ['#1A2A3C', '#2A3C52', '#3A5068'],
    sea: ['#0E1824', '#162230'],
    waveStroke: '#3A6888',
    waveFill: '#182838',
    orbFill: '#88C8DC',
    orbGlow: 'rgba(100,178,210,0.65)',
    bioLumColor: 'rgba(100,180,210,0.60)',
    shimmerColor: 'rgba(120,185,215,0.28)',
    textPrimary: '#B4CCE0',
    textSecondary: 'rgba(128,166,196,0.58)',
    outerGlow: 'rgba(56,120,170,0.28)',
    pillBg: 'rgba(26,42,60,0.92)',
    pillBorder: 'rgba(80,148,190,0.38)',
    pillText: '#96BED8',
    label: 'EBB',
    sublabel: 'Ebbing tide',
    accentColor: '#5898C0',
    mode: 'dark',
    waveAmp: 0.6,
    showBioLume: false,
    showShimmer: false,
  },
  sunrise: {
    bg: ['#C04030', '#D86048', '#EC8860'],
    sea: ['#7A1C10', '#A03020'],
    waveStroke: '#E87050',
    waveFill: '#A03820',
    orbFill: '#FFD0A0',
    orbGlow: 'rgba(255,165,90,0.80)',
    bioLumColor: 'rgba(255,165,90,0.65)',
    shimmerColor: 'rgba(255,200,130,0.45)',
    textPrimary: '#FFF0E8',
    textSecondary: 'rgba(240,200,170,0.70)',
    outerGlow: 'rgba(210,90,45,0.38)',
    pillBg: 'rgba(190,64,48,0.88)',
    pillBorder: 'rgba(240,130,80,0.45)',
    pillText: '#FFD8B0',
    label: 'SURGE',
    sublabel: 'Dawn surge',
    accentColor: '#F09060',
    mode: 'dim',
    waveAmp: 0.52,
    showBioLume: false,
    showShimmer: true,
  },
  morning: {
    bg: ['#42A8B4', '#58BCCC', '#72CCD8'],
    sea: ['#1E7888', '#2A8898'],
    waveStroke: '#28888C',
    waveFill: '#1E6878',
    orbFill: '#A0DCE8',
    orbGlow: 'rgba(110,205,225,0.80)',
    bioLumColor: 'rgba(110,205,225,0.60)',
    shimmerColor: 'rgba(180,235,248,0.50)',
    textPrimary: '#E8FAFC',
    textSecondary: 'rgba(180,225,235,0.65)',
    outerGlow: 'rgba(30,140,160,0.28)',
    pillBg: 'rgba(58,170,185,0.90)',
    pillBorder: 'rgba(40,148,162,0.40)',
    pillText: '#C0ECF4',
    label: 'NEAP',
    sublabel: 'Neap tide',
    accentColor: '#309898',
    mode: 'light',
    waveAmp: 0.3,
    showBioLume: false,
    showShimmer: true,
  },
  'solar-noon': {
    bg: ['#D4EDE8', '#E4F5F0', '#F0FAF8'],
    sea: ['#88C8C0', '#A0D4CC'],
    waveStroke: '#6AACAC',
    waveFill: '#80C0C0',
    orbFill: '#70A8A8',
    orbGlow: 'rgba(88,168,168,0.70)',
    bioLumColor: 'rgba(88,168,168,0.50)',
    shimmerColor: 'rgba(220,248,248,0.65)',
    textPrimary: '#283C3C',
    textSecondary: 'rgba(44,80,80,0.55)',
    outerGlow: 'rgba(60,150,148,0.22)',
    pillBg: 'rgba(215,242,240,0.94)',
    pillBorder: 'rgba(80,168,165,0.32)',
    pillText: '#2A5050',
    label: 'STAND',
    sublabel: 'Still water',
    accentColor: '#509898',
    mode: 'light',
    waveAmp: 0.14,
    showBioLume: false,
    showShimmer: true,
  },
  afternoon: {
    bg: ['#B8C838', '#CCDC58', '#E0EC78'],
    sea: ['#607010', '#788018'],
    waveStroke: '#808C20',
    waveFill: '#607018',
    orbFill: '#A0B820',
    orbGlow: 'rgba(150,184,20,0.72)',
    bioLumColor: 'rgba(150,184,20,0.55)',
    shimmerColor: 'rgba(230,248,100,0.45)',
    textPrimary: '#303808',
    textSecondary: 'rgba(58,72,10,0.55)',
    outerGlow: 'rgba(110,140,20,0.25)',
    pillBg: 'rgba(192,202,56,0.92)',
    pillBorder: 'rgba(104,128,20,0.38)',
    pillText: '#303808',
    label: 'RUN',
    sublabel: 'Tidal run',
    accentColor: '#789018',
    mode: 'light',
    waveAmp: 0.28,
    showBioLume: false,
    showShimmer: true,
  },
  sunset: {
    bg: ['#A02008', '#BC3020', '#D85038'],
    sea: ['#580808', '#780C0C'],
    waveStroke: '#D04030',
    waveFill: '#801010',
    orbFill: '#FFC090',
    orbGlow: 'rgba(255,155,80,0.80)',
    bioLumColor: 'rgba(255,155,80,0.62)',
    shimmerColor: 'rgba(255,175,100,0.40)',
    textPrimary: '#FFE8D8',
    textSecondary: 'rgba(240,192,158,0.70)',
    outerGlow: 'rgba(190,50,20,0.38)',
    pillBg: 'rgba(158,32,12,0.90)',
    pillBorder: 'rgba(220,80,48,0.44)',
    pillText: '#FFD0A8',
    label: 'SET',
    sublabel: 'Ebb setting',
    accentColor: '#E87050',
    mode: 'dim',
    waveAmp: 0.52,
    showBioLume: false,
    showShimmer: false,
  },
  dusk: {
    bg: ['#141828', '#1C2238', '#243048'],
    sea: ['#08090E', '#0C0E18'],
    waveStroke: '#3A4870',
    waveFill: '#141C38',
    orbFill: '#7898D0',
    orbGlow: 'rgba(90,130,205,0.65)',
    bioLumColor: 'rgba(90,130,205,0.68)',
    shimmerColor: 'rgba(110,145,215,0.28)',
    textPrimary: '#A8B8D8',
    textSecondary: 'rgba(120,145,195,0.58)',
    outerGlow: 'rgba(50,80,160,0.28)',
    pillBg: 'rgba(20,24,40,0.93)',
    pillBorder: 'rgba(70,110,185,0.38)',
    pillText: '#90A8C8',
    label: 'DRIFT',
    sublabel: 'Night drift',
    accentColor: '#5878C0',
    mode: 'dark',
    waveAmp: 0.7,
    showBioLume: true,
    showShimmer: false,
  },
};

// ─── Palette interpolation ────────────────────────────────────────────────────

function ln(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

export function lerpTideWidgetPalette(
  a: TideWidgetPalette,
  b: TideWidgetPalette,
  t: number,
): TideWidgetPalette {
  if (t <= 0) return a;
  if (t >= 1) return b;
  const c = lerpColor;
  return {
    bg: [c(a.bg[0], b.bg[0], t), c(a.bg[1], b.bg[1], t), c(a.bg[2], b.bg[2], t)] as [
      string,
      string,
      string,
    ],
    sea: [c(a.sea[0], b.sea[0], t), c(a.sea[1], b.sea[1], t)] as [string, string],
    waveStroke: c(a.waveStroke, b.waveStroke, t),
    waveFill: c(a.waveFill, b.waveFill, t),
    orbFill: c(a.orbFill, b.orbFill, t),
    orbGlow: c(a.orbGlow, b.orbGlow, t),
    bioLumColor: c(a.bioLumColor, b.bioLumColor, t),
    shimmerColor: c(a.shimmerColor, b.shimmerColor, t),
    textPrimary: c(a.textPrimary, b.textPrimary, t),
    textSecondary: c(a.textSecondary, b.textSecondary, t),
    outerGlow: c(a.outerGlow, b.outerGlow, t),
    pillBg: c(a.pillBg, b.pillBg, t),
    pillBorder: c(a.pillBorder, b.pillBorder, t),
    pillText: c(a.pillText, b.pillText, t),
    accentColor: c(a.accentColor, b.accentColor, t),
    label: t < 0.5 ? a.label : b.label,
    sublabel: t < 0.5 ? a.sublabel : b.sublabel,
    mode: t < 0.5 ? a.mode : b.mode,
    waveAmp: ln(a.waveAmp, b.waveAmp, t),
    showBioLume: t < 0.5 ? a.showBioLume : b.showBioLume,
    showShimmer: t < 0.5 ? a.showShimmer : b.showShimmer,
  };
}

// ─── Wave constants ───────────────────────────────────────────────────────────

const W = 360;
const H = 180;
const WAVE_Y = 118;
const WAVE_CYC = 1.5;
const MAX_AMP = 26;

const WEATHER_WAVE_MUL: Partial<Record<WeatherCategory, number>> = {
  drizzle: 1.18,
  rain: 1.42,
  'heavy-rain': 1.82,
  thunder: 2.2,
};

function waveOrbPos(progress: number, amp: number) {
  const x = Math.max(3, Math.min(W - 3, progress * W));
  const y = WAVE_Y + amp * Math.sin(progress * Math.PI * 2 * WAVE_CYC);
  return { x, y };
}

function buildWavePath(amp: number, pts = 120): string {
  return Array.from({ length: pts }, (_, i) => {
    const t = i / (pts - 1);
    return `${i === 0 ? 'M' : 'L'}${(t * W).toFixed(1)},${(
      WAVE_Y + amp * Math.sin(t * Math.PI * 2 * WAVE_CYC)
    ).toFixed(1)}`;
  }).join(' ');
}

function buildWaterFill(amp: number): string {
  return `${buildWavePath(amp)} L${W},${H} L0,${H} Z`;
}

// ─── Orb RAF ──────────────────────────────────────────────────────────────────

function useTideOrbRaf(
  refs: {
    glow: React.RefObject<SVGCircleElement>;
    core: React.RefObject<SVGCircleElement>;
    spec: React.RefObject<SVGCircleElement>;
  },
  ampRef: React.RefObject<number>,
) {
  const curP = useRef(-1);
  const tgtP = useRef(0);
  const rafId = useRef<number | null>(null);
  const first = useRef(true);
  const fading = useRef(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const setPos = (x: number, y: number) => {
    refs.glow.current?.setAttribute('cx', String(x));
    refs.glow.current?.setAttribute('cy', String(y));
    refs.core.current?.setAttribute('cx', String(x));
    refs.core.current?.setAttribute('cy', String(y));
    if (refs.spec.current) {
      refs.spec.current.setAttribute('cx', String(x - 3));
      refs.spec.current.setAttribute('cy', String(y - 3));
    }
  };
  const setOpacity = (o: number) => {
    if (refs.glow.current) refs.glow.current.style.opacity = String(o);
    if (refs.core.current) refs.core.current.style.opacity = String(o);
    if (refs.spec.current) refs.spec.current.style.opacity = String(o);
  };
  const anim = () => {
    const d = tgtP.current - curP.current;
    if (Math.abs(d) > 0.0004) {
      curP.current += d * 0.12;
      const { x, y } = waveOrbPos(curP.current, ampRef.current ?? MAX_AMP);
      setPos(x, y);
      rafId.current = requestAnimationFrame(anim);
    } else {
      curP.current = tgtP.current;
      const { x, y } = waveOrbPos(curP.current, ampRef.current ?? MAX_AMP);
      setPos(x, y);
      rafId.current = null;
    }
  };
  const setTarget = (prog: number) => {
    tgtP.current = Math.max(0.01, Math.min(0.99, prog));
    if (first.current) {
      first.current = false;
      curP.current = tgtP.current;
      const { x, y } = waveOrbPos(curP.current, ampRef.current ?? MAX_AMP);
      setPos(x, y);
      setOpacity(1);
      return;
    }
    const rawDelta = prog - curP.current;
    let circDelta = rawDelta;
    if (circDelta > 0.5) circDelta -= 1;
    if (circDelta < -0.5) circDelta += 1;
    if (Math.abs(circDelta) < 0.03 && !fading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      curP.current = tgtP.current;
      const { x, y } = waveOrbPos(curP.current, ampRef.current ?? MAX_AMP);
      setPos(x, y);
      return;
    }
    const needsSnap = Math.abs(rawDelta) > 0.5 || Math.abs(circDelta) > 0.15;
    if (needsSnap && !fading.current) {
      if (rafId.current) {
        cancelAnimationFrame(rafId.current);
        rafId.current = null;
      }
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
      fading.current = true;
      setOpacity(0);
      fadeTimer.current = setTimeout(() => {
        curP.current = tgtP.current;
        const { x, y } = waveOrbPos(curP.current, ampRef.current ?? MAX_AMP);
        setPos(x, y);
        setOpacity(1);
        fading.current = false;
        if (!rafId.current) rafId.current = requestAnimationFrame(anim);
        fadeTimer.current = null;
      }, 160);
    } else if (!fading.current) {
      if (!rafId.current) rafId.current = requestAnimationFrame(anim);
    }
  };
  const resetFirst = () => {
    first.current = true;
  };
  useEffect(
    () => () => {
      if (rafId.current) cancelAnimationFrame(rafId.current);
      if (fadeTimer.current) clearTimeout(fadeTimer.current);
    },
    [],
  );
  return { setTarget, resetFirst };
}

// ─── Seeded random ────────────────────────────────────────────────────────────

function sr(s: number) {
  const x = Math.sin(s + 1) * 10000;
  return x - Math.floor(x);
}

// ─── Wave pill icon ───────────────────────────────────────────────────────────

function WaveIcon({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <svg aria-hidden="true" width={size} height={size} viewBox="0 0 16 16" fill="none">
      <motion.path
        d="M0 8 Q2 5 4 8 Q6 11 8 8 Q10 5 12 8 Q14 11 16 8"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        fill="none"
        animate={{ x: [-2, 0, -2] }}
        transition={{
          duration: 2.5,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
        }}
      />
      <motion.path
        d="M0 11 Q2 9 4 11 Q6 13 8 11 Q10 9 12 11 Q14 13 16 11"
        stroke={color}
        strokeWidth={0.8}
        strokeLinecap="round"
        fill="none"
        opacity={0.45}
        animate={{ x: [0, -2, 0] }}
        transition={{
          duration: 3.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: 'easeInOut',
          delay: 0.6,
        }}
      />
    </svg>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const TRANSFORM_ORIGINS: Record<ExpandDirection, string> = {
  'top-right': 'top right',
  'top-left': 'top left',
  'top-center': 'top center',
  'center-left': 'center left',
  center: 'center center',
  'center-right': 'center right',
  'bottom-right': 'bottom right',
  'bottom-left': 'bottom left',
  'bottom-center': 'bottom center',
};
const SIZE_SCALE: Record<string, number> = {
  xs: 0.55,
  sm: 0.7,
  md: 0.82,
  lg: 0.92,
  xl: 1.05,
};
const PHASE_TEMP: Record<SolarPhase, number> = {
  midnight: 12,
  night: 13,
  dawn: 14,
  sunrise: 16,
  morning: 19,
  'solar-noon': 25,
  afternoon: 27,
  sunset: 23,
  dusk: 18,
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
function toF(c: number) {
  return Math.round((c * 9) / 5 + 32);
}
function getYNudge(d: ExpandDirection) {
  return d.startsWith('bottom') ? 12 : d.startsWith('center') ? 0 : -12;
}
function collapseButtonSide(d: ExpandDirection): 'right' | 'left' {
  return d === 'top-left' || d === 'bottom-left' || d === 'center-left' ? 'left' : 'right';
}
function collapseArrowPath(d: ExpandDirection) {
  switch (d) {
    case 'top-right':
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
    case 'top-left':
      return 'M7 7 L1 1 M4 1 L1 1 L1 4';
    case 'top-center':
      return 'M4 7 L4 1 M1 3 L4 1 L7 3';
    case 'bottom-right':
      return 'M1 1 L7 7 M4 7 L7 7 L7 4';
    case 'bottom-left':
      return 'M7 1 L1 7 M4 7 L1 7 L1 4';
    case 'bottom-center':
      return 'M4 1 L4 7 M1 5 L4 7 L7 5';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}
function pillArrowPath(d: ExpandDirection) {
  switch (d) {
    case 'top-right':
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
    case 'top-left':
      return 'M7 7 L1 1 M4 1 L1 1 L1 4';
    case 'top-center':
      return 'M4 1 L4 7 M1 5 L4 7 L7 5';
    case 'bottom-right':
      return 'M1 1 L7 7 M4 7 L7 7 L7 4';
    case 'bottom-left':
      return 'M7 1 L1 7 M4 7 L1 7 L1 4';
    case 'bottom-center':
      return 'M4 7 L4 1 M1 3 L4 1 L7 3';
    default:
      return 'M1 7 L7 1 M4 1 L7 1 L7 4';
  }
}

// ─── Live weather ─────────────────────────────────────────────────────────────

interface LiveWeather {
  temperatureC: number;
  category: WeatherCategory;
  description: string;
}
const WMO_MAP: Record<number, { description: string; category: WeatherCategory }> = {
  0: { description: 'Clear', category: 'clear' },
  1: { description: 'Mainly clear', category: 'clear' },
  2: { description: 'Partly cloudy', category: 'partly-cloudy' },
  3: { description: 'Overcast', category: 'overcast' },
  45: { description: 'Fog', category: 'fog' },
  48: { description: 'Fog', category: 'fog' },
  51: { description: 'Drizzle', category: 'drizzle' },
  53: { description: 'Drizzle', category: 'drizzle' },
  55: { description: 'Drizzle', category: 'drizzle' },
  61: { description: 'Rain', category: 'rain' },
  63: { description: 'Rain', category: 'rain' },
  65: { description: 'Heavy rain', category: 'heavy-rain' },
  71: { description: 'Snow', category: 'snow' },
  73: { description: 'Snow', category: 'snow' },
  75: { description: 'Heavy snow', category: 'heavy-snow' },
  80: { description: 'Rain showers', category: 'rain' },
  81: { description: 'Rain showers', category: 'rain' },
  82: { description: 'Heavy rain', category: 'heavy-rain' },
  85: { description: 'Snow showers', category: 'snow' },
  86: { description: 'Heavy snow', category: 'heavy-snow' },
  95: { description: 'Thunderstorm', category: 'thunder' },
  96: { description: 'Thunderstorm', category: 'thunder' },
  99: { description: 'Thunderstorm', category: 'thunder' },
};
async function fetchWeather(lat: number, lon: number): Promise<LiveWeather> {
  const u = new URL('https://api.open-meteo.com/v1/forecast');
  u.searchParams.set('latitude', String(lat));
  u.searchParams.set('longitude', String(lon));
  u.searchParams.set('current', 'temperature_2m,weather_code');
  u.searchParams.set('forecast_days', '1');
  const d = (await fetch(u.toString()).then((r) => r.json())) as {
    current: { temperature_2m: number; weather_code: number };
  };
  const info = WMO_MAP[d.current.weather_code] ?? {
    description: 'Clear',
    category: 'clear' as WeatherCategory,
  };
  return { temperatureC: Math.round(d.current.temperature_2m), ...info };
}
function useWeatherData(lat: number | null, lon: number | null): LiveWeather | null {
  const [w, setW] = useState<LiveWeather | null>(null);
  useEffect(() => {
    if (!lat || !lon) return;
    let dead = false;
    fetchWeather(lat, lon)
      .then((x) => {
        if (!dead) setW(x);
      })
      .catch(() => {});
    const id = setInterval(
      () =>
        fetchWeather(lat as number, lon as number)
          .then((x) => {
            if (!dead) setW(x);
          })
          .catch(() => {}),
      30 * 60 * 1000,
    );
    return () => {
      dead = true;
      clearInterval(id);
    };
  }, [lat, lon]);
  return w;
}

const SPRING_EXPAND = {
  type: 'spring' as const,
  stiffness: 520,
  damping: 38,
  mass: 0.8,
};
const SPRING_CONTENT = { type: 'spring' as const, stiffness: 550, damping: 42 };

// ─── TideExtras ───────────────────────────────────────────────────────────────

export interface TideExtras {
  temperatureOverride?: number | null;
  temperatureUnit?: 'C' | 'F';
  forceExpanded?: boolean;
  className?: string;
}

// ─── TideWidget ───────────────────────────────────────────────────────────────

export function TideWidget({
  phase,
  blend,
  expandDirection = 'top-right',
  size = 'lg',
  showFlag = false,
  showWeather = false,
  hoverEffect = true,
  weather: weatherOverride = null,
  latitude,
  longitude,
  timezone,
  simulatedDate,
  temperatureOverride,
  temperatureUnit = 'C',
  forceExpanded,
  className = '',
  liveWeatherCategory,
  liveTemperatureC,
  palette: passedPalette,
}: WidgetSkinProps & TideExtras) {
  const { coordsReady } = useSolarTheme();
  const [stored, setStored] = useState(() => {
    if (typeof window === 'undefined') return true;
    try {
      const raw = localStorage.getItem('tide-widget-expanded');
      if (raw != null) return JSON.parse(raw);
    } catch {}
    return true;
  });
  const updateExpanded = useCallback((next: boolean) => {
    setStored(next);
    try {
      localStorage.setItem('tide-widget-expanded', JSON.stringify(next));
    } catch {}
  }, []);
  const isExpanded = forceExpanded !== undefined ? forceExpanded : stored;
  const setIsExpanded = forceExpanded !== undefined ? () => {} : updateExpanded;
  const origin = TRANSFORM_ORIGINS[expandDirection];
  const yNudge = getYNudge(expandDirection);

  const solar = useSolarPosition({
    latitude,
    longitude,
    timezone,
    updateIntervalMs: 5_000,
    simulatedDate,
  });
  const isDaytime = PHASE_IS_DAYTIME[phase] ?? solar.isDaytime;
  const progress = solar.isDaytime ? solar.dayProgress : solar.nightProgress;
  const internalPalette = lerpTideWidgetPalette(
    TIDE_WIDGET_PALETTES[blend.phase],
    TIDE_WIDGET_PALETTES[blend.nextPhase],
    blend.t,
  );
  const palette = { ...internalPalette, bg: passedPalette.bg };
  const bgOverridden =
    passedPalette.bg[0] !== internalPalette.bg[0] ||
    passedPalette.bg[1] !== internalPalette.bg[1] ||
    passedPalette.bg[2] !== internalPalette.bg[2];
  const effectivePillBg = bgOverridden ? `${passedPalette.bg[1]}f7` : palette.pillBg;
  const effectivePillBorder = bgOverridden ? `${passedPalette.bg[0]}59` : palette.pillBorder;
  const phaseColors = derivePhaseColors(blend, 'tide');

  const liveWeather = useWeatherData(latitude ?? null, longitude ?? null);
  const hasTempData =
    temperatureOverride != null || liveTemperatureC != null || liveWeather != null;
  const tempC =
    temperatureOverride ?? liveTemperatureC ?? liveWeather?.temperatureC ?? PHASE_TEMP[phase];
  const dispTempStr = hasTempData
    ? temperatureUnit === 'F'
      ? `${toF(tempC)}°F`
      : `${tempC}°C`
    : '';
  const pillTempStr = hasTempData ? (temperatureUnit === 'F' ? `${toF(tempC)}°` : `${tempC}°`) : '';

  const effectiveCat: WeatherCategory | null =
    liveWeatherCategory !== undefined
      ? liveWeatherCategory
      : showWeather
        ? (weatherOverride ?? liveWeather?.category ?? null)
        : null;
  const weatherDesc = effectiveCat
    ? weatherOverride
      ? (WMO_MAP[0]?.description ?? '')
      : (liveWeather?.description ?? effectiveCat)
    : null;
  const expandedSublabel =
    showWeather && effectiveCat
      ? `${weatherDesc} · ${temperatureUnit === 'F' ? `${toF(tempC)}°F` : `${tempC}°C`}`
      : palette.sublabel;

  const weatherMul = effectiveCat ? (WEATHER_WAVE_MUL[effectiveCat] ?? 1.0) : 1.0;
  const waveAmp = MAX_AMP * palette.waveAmp * weatherMul;
  const waveAmpRef = useRef(waveAmp);
  useEffect(() => {
    waveAmpRef.current = waveAmp;
  });

  const [ltFlash, setLtFlash] = useState(false);
  const ltRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (effectiveCat !== 'thunder') {
      setLtFlash(false);
      return;
    }
    const go = () => {
      ltRef.current = setTimeout(
        () => {
          setLtFlash(true);
          setTimeout(() => setLtFlash(false), 180);
          go();
        },
        3500 + Math.random() * 7000,
      );
    };
    go();
    return () => {
      if (ltRef.current) clearTimeout(ltRef.current);
    };
  }, [effectiveCat]);

  const glowRef = useRef<SVGCircleElement>(null);
  const coreRef = useRef<SVGCircleElement>(null);
  const specRef = useRef<SVGCircleElement>(null);
  const { setTarget, resetFirst } = useTideOrbRaf(
    { glow: glowRef, core: coreRef, spec: specRef },
    waveAmpRef,
  );
  const prevCoords = useRef(false);
  useEffect(() => {
    if (coordsReady && !prevCoords.current) {
      prevCoords.current = true;
      resetFirst();
    }
  }, [coordsReady, resetFirst]);
  useEffect(() => {
    if (glowRef.current) glowRef.current.style.fill = palette.orbGlow;
    if (coreRef.current) coreRef.current.style.fill = palette.orbFill;
    setTarget(progress);
  });

  const [expandScale, setExpandScale] = useState(SIZE_SCALE[size] ?? 0.92);
  useEffect(() => {
    if (size) {
      setExpandScale(SIZE_SCALE[size] ?? 0.92);
      return;
    }
    const upd = () => {
      const vw = window.innerWidth;
      setExpandScale(vw < 640 ? Math.min((vw - 24) / W, 1) : 0.9);
    };
    upd();
    window.addEventListener('resize', upd);
    return () => window.removeEventListener('resize', upd);
  }, [size]);

  // ── Country info ────────────────────────────────────────────────────────
  // FC intentionally not fetched — the expanded card uses country name as
  // MONO uppercase text (nautical data aesthetic; flag in card = visual noise).
  // The pill uses PillFlagBadge skin="tide" for the aqueous SVG treatment.
  const countryInfo = useMemo(() => {
    if (!timezone) return null;
    const tz = ct.getTimezone(timezone);
    const code = tz?.countries?.[0] ?? null;
    if (!code) return null;
    const country = ct.getCountry(code);
    return { code, name: country?.name ?? code };
  }, [timezone]);
  const flagActive = showFlag && countryInfo !== null;

  const pillMinWidth = useMemo(() => {
    let w = 82;
    if (showWeather) w += 36;
    if (showFlag) w += 28;
    return w;
  }, [showWeather, showFlag]);

  const pillShowWeather = showWeather && effectiveCat !== null && effectiveCat !== 'clear';
  const pillPhaseIcon: 'sun' | 'moon' | 'dawn' | 'dusk' =
    phase === 'midnight' || phase === 'night'
      ? 'moon'
      : phase === 'dawn' || phase === 'sunrise'
        ? 'dawn'
        : phase === 'sunset' || phase === 'dusk'
          ? 'dusk'
          : 'sun';
  const orbDimOpacity = effectiveCat ? WEATHER_ORB_DIM[effectiveCat] : 1;

  const initPos = waveOrbPos(progress, waveAmp);
  const wavePath = useMemo(() => buildWavePath(waveAmp), [waveAmp]);
  const waterFill = useMemo(() => buildWaterFill(waveAmp), [waveAmp]);

  const fmtMin = (m: number) =>
    `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(Math.round(m % 60)).padStart(
      2,
      '0',
    )}`;
  const sunriseFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunrise) : '--:--';
  const sunsetFmt = coordsReady && solar.isReady ? fmtMin(solar.times.sunset) : '--:--';

  const SANS = "'SF Pro Display','Helvetica Neue',sans-serif";
  const MONO = "'SF Mono','Menlo',monospace";

  return (
    <div className={`relative ${className}`} style={{ isolation: 'isolate' }}>
      <AnimatePresence mode="wait" initial={false}>
        {isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.86, y: yNudge }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.86, y: yNudge * 0.8 }}
            transition={SPRING_EXPAND}
            style={{
              width: W * expandScale,
              height: H * expandScale,
              transformOrigin: origin,
              position: 'relative',
            }}
            className="select-none"
          >
            {/* Outer glow */}
            <motion.div
              className="absolute inset-0 pointer-events-none"
              style={{ borderRadius: '1.6rem' }}
              animate={{
                boxShadow: `0 0 50px 14px ${palette.outerGlow}`,
              }}
              transition={{ duration: 1.2 }}
            />

            {/* Scale wrapper */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: W,
                height: H,
                transform: `scale(${expandScale})`,
                transformOrigin: 'top left',
              }}
            >
              <motion.div
                className="relative w-full h-full overflow-hidden"
                style={{
                  borderRadius: '1.6rem',
                  border: '2px solid rgba(255,255,255,0.14)',
                  boxShadow: 'inset 0 1.5px 1px rgba(255,255,255,0.12)',
                }}
              >
                {/* z=0 Sky-to-horizon background */}
                <motion.div
                  className="absolute inset-0"
                  style={{ zIndex: 0 }}
                  animate={{
                    background: `linear-gradient(175deg,${palette.bg[0]} 0%,${palette.bg[1]} 58%,${
                      palette.bg[2]
                    } 100%)`,
                  }}
                  transition={{
                    duration: 1.2,
                    ease: 'easeInOut',
                  }}
                />

                {/* z=1 Bioluminescent sparkles */}
                {palette.showBioLume && (
                  <div className="absolute inset-0 overflow-hidden" style={{ zIndex: 1 }}>
                    {Array.from({ length: 20 }, (_, i) => (
                      <motion.div
                        // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length decorative array, order is stable
                        key={i}
                        className="absolute rounded-full"
                        style={{
                          width: sr(i * 3) * 2 + 0.6,
                          height: sr(i * 3) * 2 + 0.6,
                          left: `${sr(i * 7 + 1) * 88}%`,
                          top: `${63 + sr(i * 11 + 2) * 32}%`,
                          background: palette.bioLumColor,
                          boxShadow: `0 0 ${sr(i * 3) * 5 + 2}px ${palette.bioLumColor}`,
                        }}
                        animate={{
                          opacity: [0.08, sr(i * 2) * 0.65 + 0.25, 0.08],
                          scale: [0.8, 1.3, 0.8],
                        }}
                        transition={{
                          duration: 1.5 + sr(i * 5) * 3,
                          repeat: Number.POSITIVE_INFINITY,
                          delay: sr(i * 13) * 5,
                          ease: 'easeInOut',
                        }}
                      />
                    ))}
                  </div>
                )}

                {/* z=1 Surface shimmer */}
                {palette.showShimmer && (
                  <motion.div
                    className="absolute overflow-hidden"
                    style={{
                      zIndex: 1,
                      left: 0,
                      right: 0,
                      top: `${(WAVE_Y / H) * 100 - 3}%`,
                      height: '5%',
                      opacity: 0.7,
                    }}
                  >
                    <motion.div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: `linear-gradient(to right, transparent 0%, ${palette.shimmerColor} 25%, transparent 50%, ${palette.shimmerColor} 75%, transparent 100%)`,
                      }}
                      animate={{
                        x: ['0%', '40%', '0%'],
                      }}
                      transition={{
                        duration: 3.5,
                        repeat: Number.POSITIVE_INFINITY,
                        ease: 'linear',
                      }}
                    />
                  </motion.div>
                )}

                {/* z=2 Weather backdrop */}
                <motion.div
                  style={{ position: 'absolute', inset: 0, zIndex: 2 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveCat ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveCat && (
                    <WeatherBackdrop
                      category={effectiveCat}
                      skin="tide"
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

                {/* z=3 Wave SVG + orb */}
                <svg
                  aria-hidden="true"
                  className="absolute inset-0"
                  style={{
                    zIndex: 3,
                    overflow: 'hidden',
                    opacity: coordsReady ? 1 : 0,
                    transition: 'opacity 0.9s ease-in-out',
                  }}
                  width={W}
                  height={H}
                  viewBox={`0 0 ${W} ${H}`}
                >
                  <defs>
                    <linearGradient id="tide-sea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={palette.sea[0]} />
                      <stop offset="100%" stopColor={palette.sea[1]} />
                    </linearGradient>
                    <filter id="tide-orb-blur" x="-150%" y="-150%" width="400%" height="400%">
                      <feGaussianBlur stdDeviation="10" />
                    </filter>
                    <filter id="tide-orb-core" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="b" />
                      <feMerge>
                        <feMergeNode in="b" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <path d={waterFill} fill="url(#tide-sea)" opacity={0.55} />
                  <path
                    d={wavePath}
                    fill="none"
                    stroke={palette.waveStroke}
                    strokeWidth={1.8}
                    opacity={0.68}
                  />
                  {ltFlash && (
                    <line
                      x1={initPos.x}
                      y1={initPos.y}
                      x2={initPos.x - 3}
                      y2={H}
                      stroke="rgba(255,255,255,0.65)"
                      strokeWidth={0.9}
                      style={{ filter: 'blur(1px)' }}
                    />
                  )}
                  <circle
                    ref={glowRef}
                    cx={initPos.x}
                    cy={initPos.y}
                    r={22}
                    style={{
                      fill: palette.orbGlow,
                      transition: 'fill 1.2s ease-in-out,opacity 0.15s ease-in-out',
                      opacity: orbDimOpacity,
                    }}
                    filter="url(#tide-orb-blur)"
                  />
                  <circle
                    ref={coreRef}
                    cx={initPos.x}
                    cy={initPos.y}
                    r={9}
                    style={{
                      fill: palette.orbFill,
                      transition: 'fill 1.2s ease-in-out,opacity 0.15s ease-in-out',
                      opacity: orbDimOpacity,
                    }}
                    filter="url(#tide-orb-core)"
                  />
                  <circle
                    ref={specRef}
                    cx={initPos.x - 3}
                    cy={initPos.y - 3}
                    r={2.5}
                    fill="rgba(255,255,255,0.48)"
                    style={{
                      transition: 'opacity 0.15s ease-in-out',
                      opacity: orbDimOpacity,
                    }}
                  />
                </svg>

                {/* z=4 Weather layer */}
                <motion.div
                  style={{ position: 'absolute', inset: 0, zIndex: 4 }}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: showWeather && effectiveCat ? 1 : 0 }}
                  transition={CONTENT_FADE}
                >
                  {showWeather && effectiveCat && (
                    <WeatherLayer
                      category={effectiveCat}
                      skin="tide"
                      opacity={isDaytime ? 0.72 : 0.9}
                      phaseColors={phaseColors}
                    />
                  )}
                </motion.div>

                {/* z=5 Header */}
                <div className="absolute top-0 left-0 right-0 px-5 pt-5" style={{ zIndex: 5 }}>
                  <div className="flex justify-between items-start">
                    <div>
                      <motion.p
                        style={{
                          fontFamily: MONO,
                          fontSize: 15,
                          fontWeight: 600,
                          letterSpacing: '0.20em',
                          textTransform: 'uppercase',
                          lineHeight: 1,
                        }}
                        animate={{
                          color: palette.textPrimary,
                        }}
                        transition={{
                          duration: 1.2,
                        }}
                      >
                        {palette.label}
                      </motion.p>
                      <motion.p
                        style={{
                          fontFamily: SANS,
                          fontSize: 10,
                          marginTop: 3,
                          letterSpacing: '0.10em',
                          textTransform: 'uppercase',
                        }}
                        animate={{
                          color: palette.textSecondary,
                        }}
                        transition={{
                          duration: 1.2,
                        }}
                      >
                        {expandedSublabel}
                      </motion.p>
                    </div>
                    <motion.div
                      style={{
                        fontFamily: SANS,
                        fontSize: 19,
                        fontWeight: 300,
                        letterSpacing: '-0.01em',
                        opacity: hasTempData ? 1 : 0,
                        transition: 'opacity 0.8s ease-in-out',
                      }}
                      animate={{
                        color: palette.textPrimary,
                      }}
                      transition={{ duration: 1.2 }}
                    >
                      {dispTempStr}
                    </motion.div>
                  </div>
                </div>

                {/* z=5 Bottom row — country as MONO text, no flag badge in expanded card */}
                <motion.div
                  className="absolute bottom-0 left-0 right-0 px-5 pb-[14px] flex items-center justify-between"
                  style={{ zIndex: 5 }}
                  animate={{
                    color: palette.textSecondary,
                  }}
                  transition={{ duration: 1.2 }}
                >
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↑ HW {sunriseFmt}
                  </span>
                  {flagActive && (
                    <motion.span
                      initial={{ opacity: 0, y: 3 }}
                      animate={{ opacity: 0.7, y: 0 }}
                      transition={{ duration: 0.5 }}
                      style={{
                        fontFamily: MONO,
                        fontSize: 8,
                        letterSpacing: '0.22em',
                        textTransform: 'uppercase',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        color: palette.textSecondary,
                      }}
                    >
                      <span
                        style={{
                          width: 14,
                          height: 1,
                          background: 'currentColor',
                          display: 'block',
                          opacity: 0.4,
                        }}
                      />
                      {countryInfo?.name}
                      <span
                        style={{
                          width: 14,
                          height: 1,
                          background: 'currentColor',
                          display: 'block',
                          opacity: 0.4,
                        }}
                      />
                    </motion.span>
                  )}
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: 9,
                      letterSpacing: '0.14em',
                      opacity: coordsReady && solar.isReady ? 1 : 0,
                      transition: 'opacity 0.8s ease-in-out',
                    }}
                  >
                    ↓ LW {sunsetFmt}
                  </span>
                </motion.div>

                {/* z=6 Horizon sheen */}
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    zIndex: 6,
                    borderRadius: '1.6rem',
                    background:
                      'linear-gradient(to bottom, rgba(255,255,255,0.10) 0%, transparent 38%, rgba(0,0,0,0.08) 65%, transparent 100%)',
                  }}
                />

                {/* z=7 Collapse */}
                {!forceExpanded &&
                  (() => {
                    const side = collapseButtonSide(expandDirection);
                    const isRight = side === 'right';
                    return (
                      <motion.button
                        onClick={() => setIsExpanded(false)}
                        initial={{
                          opacity: 0,
                          scale: 0.6,
                        }}
                        animate={{
                          opacity: 1,
                          scale: 1,
                        }}
                        exit={{
                          opacity: 0,
                          scale: 0.6,
                        }}
                        transition={{
                          ...SPRING_CONTENT,
                          delay: 0.18,
                        }}
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        aria-label="Collapse tide widget"
                        style={{
                          position: 'absolute',
                          zIndex: 7,
                          top: 0,
                          ...(isRight ? { right: 0 } : { left: 0 }),
                          width: 34,
                          height: 34,
                          borderRadius: isRight ? '0 1.6rem 0 10px' : '1.6rem 0 10px 0',
                          background: 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          cursor: 'pointer',
                        }}
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="none" aria-hidden="true">
                          <path
                            d="M2 2 L6 6 M6 2 L2 6"
                            stroke={palette.pillText}
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            opacity="0.70"
                          />
                        </svg>
                      </motion.button>
                    );
                  })()}
              </motion.div>
            </div>
            {/* end scale wrapper */}
          </motion.div>
        ) : (
          /* ── PILL ── */
          <motion.button
            key="collapsed"
            onClick={() => setIsExpanded(true)}
            initial={{ opacity: 0, scale: 0.75, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.75, y: -8 }}
            transition={SPRING_EXPAND}
            className="flex items-center gap-2 cursor-pointer select-none"
            style={{
              height: 36,
              minWidth: pillMinWidth,
              paddingLeft: 10,
              paddingRight: 14,
              borderRadius: 18,
              background: effectivePillBg,
              border: `1.5px solid ${effectivePillBorder}`,
              boxShadow: `0 4px 20px rgba(0,0,0,0.28),0 0 18px 3px ${palette.outerGlow}`,
              backdropFilter: 'blur(12px)',
              transformOrigin: origin,
              scale: expandScale,
            }}
            whileHover={hoverEffect ? { scale: expandScale * 1.05 } : undefined}
            whileTap={hoverEffect ? { scale: expandScale * 0.95 } : { scale: expandScale * 0.98 }}
            aria-label={`Tide widget — ${palette.label}. Click to expand.`}
          >
            <span
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 22,
                height: 22,
                flexShrink: 0,
              }}
            >
              <AnimatePresence mode="wait" initial={false}>
                {pillShowWeather && effectiveCat ? (
                  <motion.span
                    key={`glyph-${effectiveCat}`}
                    initial={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    transition={{
                      duration: 0.18,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <PillWeatherGlyph
                      skin="tide"
                      category={effectiveCat}
                      color={palette.pillText}
                      accentColor={palette.accentColor}
                      phaseIcon={pillPhaseIcon}
                      size={20}
                    />
                  </motion.span>
                ) : (
                  <motion.span
                    key="phase-icon"
                    initial={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                    }}
                    exit={{
                      opacity: 0,
                      scale: 0.6,
                    }}
                    transition={{
                      duration: 0.18,
                      ease: 'easeOut',
                    }}
                    style={{
                      position: 'absolute',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <WaveIcon color={palette.pillText} size={16} />
                  </motion.span>
                )}
              </AnimatePresence>
            </span>

            {/*
             * Flag badge — aqueous screen-wash treatment.
             * accent=accentColor: the phase accent feeds the low-opacity screen wash
             *   (cyan at night, orange at sunrise, teal at morning, etc.)
             * shadow=sea[0]: deepest sea background for any duotone anchor
             * highlight=textPrimary: bright anchor for the flag's light regions
             * glow=outerGlow: feeds the diffuse bioluminescent halo in PillFlagBadge
             */}
            {showFlag && (
              <motion.span
                animate={{ opacity: flagActive ? 1 : 0 }}
                transition={CONTENT_FADE}
                style={{ display: 'flex', alignItems: 'center', width: 20, flexShrink: 0 }}
              >
                {flagActive && (
                  <PillFlagBadge
                    code={countryInfo?.code}
                    skin="tide"
                    mode={palette.mode}
                    accent={palette.accentColor}
                    shadow={palette.sea[0]}
                    highlight={palette.textPrimary}
                    glow={palette.outerGlow}
                  />
                )}
              </motion.span>
            )}

            <motion.span
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 300,
                letterSpacing: '-0.01em',
                minWidth: 28,
              }}
              animate={{ color: palette.pillText, opacity: pillTempStr ? 1 : 0 }}
              transition={{ duration: 2 }}
            >
              {pillTempStr || '\u00A0'}
            </motion.span>

            <span
              style={{
                width: 3,
                height: 3,
                borderRadius: '50%',
                background: palette.pillBorder,
                flexShrink: 0,
              }}
            />

            <motion.span
              style={{
                fontFamily: MONO,
                fontSize: 10,
                fontWeight: 500,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                whiteSpace: 'nowrap',
              }}
              animate={{ color: palette.textSecondary }}
              transition={{ duration: 2 }}
            >
              {palette.label}
            </motion.span>

            <svg
              aria-hidden="true"
              width="8"
              height="8"
              viewBox="0 0 8 8"
              fill="none"
              style={{ marginLeft: 2, opacity: 0.55 }}
            >
              <path
                d={pillArrowPath(expandDirection)}
                stroke={palette.pillText}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
