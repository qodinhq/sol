/**
 * widget-skin.types.ts
 *
 * The shared contract every skin must satisfy.
 * Import these types in skin implementations and in the widget shell.
 */

import type { SolarBlend, SolarPhase } from '../../hooks/useSolarPosition';
import type { SeasonalModifier } from '../../lib/seasonal-blend';
import type { Season } from '../../lib/useSeason';
import type { CompactSkinProps } from '../../widgets/compact-widget.shell';
import type {
  ExpandDirection,
  WeatherCategory,
  WidgetSize,
} from '../../widgets/solar-widget.shell';

// ─── Shader image (optional faded background image layer) ─────────────────────

export interface ShaderImage {
  /** Path to the image, relative to /public — e.g. '/images/solar-rays.png' */
  src: string;
  /**
   * Opacity of the image layer. 0–1.
   * Defaults to 0.18 if omitted — subtle enough to not compete with the shader.
   */
  opacity?: number;
  /** CSS mask-position for the image mask. Defaults to 'center center'.
   * e.g. 'center 30%' to push the rays slightly upward. */
  objectPosition?: string;
}

// ─── Shader palette (fed to SolarShaderBg) ───────────────────────────────────

export interface ShaderPalette {
  colors: [string, string, string, string];
  colorBack: string;
  opacity: number;
  vignette: string;
  cssFallback: string;
  /**
   * Optional per-phase image overlay.
   * When set, SolarShaderBg renders this image between the WebGL shader
   * and the vignette, blended and faded per the ShaderImage config.
   * Takes precedence over SkinDefinition.defaultImage.
   */
  image?: ShaderImage;
}

// ─── Shader motion — per-phase animation personality ─────────────────────────
/**
 * Controls the MOVEMENT CHARACTER of the background shader for each phase.
 * This is intentionally separate from ShaderPalette (color) so that skins can
 * express distinct motion personalities without touching color tokens.
 *
 * Each skin provides a full Record<SolarPhase, ShaderMotion> via the optional
 * `shaderMotion` field on SkinDefinition. If omitted, SolarShaderBg falls back
 * to the universal PHASE_MOTION defaults in solar-shader-bg.tsx.
 *
 * Design intent:
 *   Void        → barely alive. All values near-zero.
 *   Parchment   → completely still. speed=0, distortion=0.
 *   Signal      → mechanical twitch. speed low, distortion low, grainOverlay high.
 *   Meridian    → airy drift. half the universal values.
 *   Sundial     → slow, ancient. low speed, low swirl.
 *   Paper       → gentle organic breath. medium everything.
 *   Foundry     → rich, heavy. full universal values.
 *   Mineral     → crystalline facets. high swirl, lower distortion.
 *   Tide        → wave rhythm. high distortion, moderate swirl.
 *   Aurora      → dramatic at night, calm at day. speed peaks at midnight.
 */
export interface ShaderMotion {
  /** Organic mesh noise 0–1. High = flowing, liquid. Low = crystalline, solid. */
  distortion: number;
  /** Vortex intensity 0–1. High = dramatic spiral. Low = gentle drift. */
  swirl: number;
  /** Animation speed multiplier. 0 = frozen. >1 = fast. */
  speed: number;
  /** Photographic film grain 0–1. Higher in dark, still skins. */
  grainOverlay: number;
}

// ─── CSS variable token set (fed to SolarThemeProvider) ──────────────────────

export interface PhaseVars {
  textPrimary: string;
  textSecondary: string;
  accent: string;
  surface: string;
  bgBase: string;
  bgDeep: string;
}

// ─── Widget palette (used internally by each skin's pill/card rendering) ──────

export interface WidgetPalette {
  /** Three gradient stops for the widget background */
  bg: [string, string, string];
  /** Text/icon color for this phase */
  textColor: string;
  /** Accent/highlight color */
  accentColor: string;
  /** Orb fill color */
  orb: string;
  /** Outer glow color (rgba string) */
  outerGlow: string;
  /** 'light' | 'dim' | 'dark' — controls icon rendering mode */
  mode: 'light' | 'dim' | 'dark';
}

// ─── Complete skin definition ─────────────────────────────────────────────────

export interface SkinDefinition {
  /** Unique identifier — used as the key in SKINS map and stored in context */
  id: DesignMode;
  /** Human-readable name shown in the dropdown */
  label: string;
  /** Short description shown in the dropdown */
  description: string;

  /**
   * Per-phase CSS variable tokens.
   * SolarThemeProvider reads these instead of its own hardcoded PHASE_VARS.
   */
  phaseVars: Record<SolarPhase, PhaseVars>;

  /**
   * Per-phase widget palette tokens.
   * Used by the skin's pill/card component.
   */
  widgetPalettes: Record<SolarPhase, WidgetPalette>;

  /**
   * Per-phase shader palettes.
   * SolarShaderBg reads colors, opacity, vignette, and cssFallback from here.
   */
  shaderPalettes: Record<SolarPhase, ShaderPalette>;

  /**
   * Optional per-phase shader motion personality.
   *
   * Defines HOW the background moves for this skin — distortion, swirl, speed,
   * and grain — independently of color. Each skin has a distinct motion
   * character that reinforces its aesthetic identity:
   *   - Void barely moves (near-zero everything)
   *   - Parchment is completely still (speed=0)
   *   - Aurora pulses hard at night, sleeps during the day
   *   - Mineral uses crystalline low-distortion/high-swirl
   *   - Tide uses wave-like rolling distortion
   *
   * If omitted, SolarShaderBg falls back to universal PHASE_MOTION defaults.
   */
  shaderMotion?: Record<SolarPhase, ShaderMotion>;

  /**
   * Optional global fallback image for the shader background layer.
   *
   * Applied to ALL phases unless a phase-specific `image` is set inside
   * that phase's ShaderPalette entry (per-phase takes precedence).
   *
   * Use this for skins that should always show the same atmospheric image
   * regardless of phase — e.g. the solar-rays PNG faded at 18% opacity.
   *
   * Example:
   *   defaultImage: {
   *     src: '/images/solar-rays.png',
   *     opacity: 0.18,
   *   }
   */
  defaultImage?: ShaderImage;

  /**
   * Optional per-season palette modifiers.
   * If omitted, UNIVERSAL_SEASON_MODIFIERS is used automatically.
   * Define only the seasons you want to customise — the rest fall back.
   */
  seasonalModifiers?: Partial<Record<Season, SeasonalModifier>>;

  /**
   * The React component that renders the actual widget pill + expanded card.
   * Receives WidgetSkinProps and is fully responsible for its own visual output.
   */
  Component: React.ComponentType<WidgetSkinProps>;

  /**
   * Optional compact variant of the widget.
   * Receives CompactSkinProps and renders a slim pill/bar format.
   */
  CompactComponent?: React.ComponentType<CompactSkinProps>;
}

// ─── Props every skin component receives ─────────────────────────────────────

export interface WidgetSkinProps {
  // ── Solar data ──────────────────────────────────────────────────────────────
  phase: SolarPhase;
  blend: SolarBlend;

  // ── Widget state ────────────────────────────────────────────────────────────
  expanded: boolean;
  onToggle: () => void;
  expandDirection: ExpandDirection;
  size: WidgetSize;

  // ── Display data ─────────────────────────────────────────────────────────────
  time: string;
  location: string;
  flag?: string;
  weather?: WeatherCategory | null;
  liveWeatherCategory?: WeatherCategory | null;
  liveTemperatureC?: number | null;
  temperature?: string;
  sunriseTime?: string;
  sunsetTime?: string;

  // ── Geo / time data ────────────────────────────────────────────────────────
  latitude?: number | null;
  longitude?: number | null;
  timezone?: string | null;
  simulatedDate?: Date;

  // ── Visual options ──────────────────────────────────────────────────────────
  showFlag: boolean;
  showWeather: boolean;
  hoverEffect: boolean;
  forceExpanded?: boolean;

  // ── Resolved palette for this phase ────────────────────────────────────────
  palette: WidgetPalette;
}

// ─── Available design modes ───────────────────────────────────────────────────

export type DesignMode =
  | 'foundry'
  | 'paper'
  | 'signal'
  | 'meridian'
  | 'mineral'
  | 'aurora'
  | 'tide'
  | 'sundial'
  | 'void'
  | 'parchment';
