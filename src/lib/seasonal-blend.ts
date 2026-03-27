// ════════════════════════════════════════════════════════════════════════════
// FILE: src/lib/seasonal-blend.ts
// ════════════════════════════════════════════════════════════════════════════
//
// SeasonalModifier — a small delta object that describes how a season shifts
// a skin's phase palette. Skins define 4 of these (one per season) rather
// than 36 full palettes (9 phases × 4 seasons).
//
// The blending pipeline:
//
//   rawPalette  = lerpPalette(skin.shaderPalettes[phase], skin.shaderPalettes[nextPhase], phaseT)
//   mod         = lerpModifier(skin.seasonalModifiers[season], skin.seasonalModifiers[nextSeason], seasonT)
//   finalPalette = applySeasonalModifier(rawPalette, mod)
//
// If a skin doesn't define seasonalModifiers, UNIVERSAL_SEASON_MODIFIERS is used.

import type { ShaderPalette } from '../skins/types/widget-skin.types';
import type { Season, SeasonalBlend } from './useSeason';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Describes how a season shifts the phase palette.
 * All fields are deltas/scales applied on top of the base palette.
 * Using HSL math under the hood — no full palette replacement needed.
 */
export interface SeasonalModifier {
  /** Multiply saturation. 1.0 = unchanged, 1.2 = +20%, 0.8 = −20%. */
  saturationScale: number;
  /** Add to lightness (−1.0 to +1.0). −0.05 = slightly darker. */
  lightnessShift: number;
  /** Rotate hue by degrees. 0 = unchanged, +15 = warmer, −15 = cooler. */
  hueRotateDeg: number;
  /**
   * Optional hex color to tint toward. Applied at tintStrength opacity
   * over the entire palette. Useful for strong seasonal washes
   * (e.g., amber-gold for autumn) that go beyond simple HSL shifts.
   */
  tintColor?: string;
  /** 0–1. How strongly to apply tintColor. 0 = no tint. */
  tintStrength: number;
}

// ─── Identity modifier (no-op) ────────────────────────────────────────────────

export const IDENTITY_MODIFIER: SeasonalModifier = {
  saturationScale: 1.0,
  lightnessShift: 0.0,
  hueRotateDeg: 0.0,
  tintStrength: 0.0,
};

// ─── Universal defaults ───────────────────────────────────────────────────────
// Used by any skin that doesn't define its own seasonalModifiers.
// Conservative values — visible but never harsh.

export const UNIVERSAL_SEASON_MODIFIERS: Record<Season, SeasonalModifier> = {
  spring: {
    saturationScale: 1.1, // slightly more vivid
    lightnessShift: 0.02, // barely brighter
    hueRotateDeg: 8, // shift toward green-yellow
    tintColor: '#a8d8a0', // soft spring green wash
    tintStrength: 0.06,
  },
  summer: {
    saturationScale: 1.18, // warm, vibrant saturation
    lightnessShift: 0.03,
    hueRotateDeg: 10, // warm golden push
    tintColor: '#ffe066', // golden summer wash
    tintStrength: 0.07,
  },
  autumn: {
    saturationScale: 0.9, // slightly muted
    lightnessShift: -0.03, // subtly darker
    hueRotateDeg: -18, // shift toward amber-red
    tintColor: '#c8692a', // amber-ochre wash
    tintStrength: 0.1,
  },
  winter: {
    saturationScale: 0.82, // desaturated
    lightnessShift: -0.04, // cooler, slightly darker
    hueRotateDeg: -25, // shift toward blue
    tintColor: '#8ab4d4', // icy blue wash
    tintStrength: 0.08,
  },
};

// ─── Color math utilities ─────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const r = Number.parseInt(clean.slice(0, 2), 16) / 255;
  const g = Number.parseInt(clean.slice(2, 4), 16) / 255;
  const b = Number.parseInt(clean.slice(4, 6), 16) / 255;
  return [r, g, b];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      case b:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return [h, s, l];
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) return [l, l, l];

  const hue2rgb = (p: number, q: number, _t: number) => {
    let t = _t;
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [hue2rgb(p, q, h + 1 / 3), hue2rgb(p, q, h), hue2rgb(p, q, h - 1 / 3)];
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (x: number) =>
    Math.round(Math.max(0, Math.min(1, x)) * 255)
      .toString(16)
      .padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Apply a SeasonalModifier to a single hex color.
 * Works in HSL space for hue rotation + saturation + lightness,
 * then blends toward tintColor if provided.
 */
function shiftColor(hex: string, mod: SeasonalModifier): string {
  if (!hex || hex.length < 7) return hex;

  const [r, g, b] = hexToRgb(hex);
  let [h, s, l] = rgbToHsl(r, g, b);

  // Hue rotation (convert degrees to 0–1 fraction)
  h = (((h + mod.hueRotateDeg / 360) % 1) + 1) % 1;

  // Saturation scale
  s = Math.max(0, Math.min(1, s * mod.saturationScale));

  // Lightness shift
  l = Math.max(0, Math.min(1, l + mod.lightnessShift));

  const [sr, sg, sb] = hslToRgb(h, s, l);
  let result = rgbToHex(sr, sg, sb);

  // Tint overlay
  if (mod.tintColor && mod.tintStrength > 0) {
    const [tr, tg, tb] = hexToRgb(mod.tintColor);
    const [fr, fg, fb] = hexToRgb(result);
    result = rgbToHex(
      lerpNum(fr, tr, mod.tintStrength),
      lerpNum(fg, tg, mod.tintStrength),
      lerpNum(fb, tb, mod.tintStrength),
    );
  }

  return result;
}

// ─── Modifier interpolation ───────────────────────────────────────────────────

/**
 * Linearly interpolate between two SeasonalModifiers.
 * Used for smooth crossfades at solstice/equinox boundaries.
 */
export function lerpModifier(
  a: SeasonalModifier,
  b: SeasonalModifier,
  t: number,
): SeasonalModifier {
  return {
    saturationScale: lerpNum(a.saturationScale, b.saturationScale, t),
    lightnessShift: lerpNum(a.lightnessShift, b.lightnessShift, t),
    hueRotateDeg: lerpNum(a.hueRotateDeg, b.hueRotateDeg, t),
    tintStrength: lerpNum(a.tintStrength, b.tintStrength, t),
    // Tint color: interpolate toward b's tint if b has one; keep a's otherwise
    tintColor: t < 0.5 ? a.tintColor : b.tintColor,
  };
}

// ─── Palette application ──────────────────────────────────────────────────────

/**
 * Apply a SeasonalModifier to every color in a ShaderPalette.
 * Returns a new palette — the original is not mutated.
 *
 * The modifier shifts hue, saturation, and lightness then applies a tint wash.
 * The result is blended back toward the original at `strength` 0→1:
 *   0 = identity, 1 = fully modified.
 */
export function applySeasonalModifier(
  palette: ShaderPalette,
  mod: SeasonalModifier,
  strength = 1.0,
): ShaderPalette {
  if (strength <= 0) return palette;

  // If strength < 1, blend the modifier toward identity
  const effective = strength < 1 ? lerpModifier(IDENTITY_MODIFIER, mod, strength) : mod;

  return {
    ...palette,
    colors: palette.colors.map((c) => shiftColor(c, effective)) as [string, string, string, string],
    colorBack: shiftColor(palette.colorBack, effective),
    vignette: shiftColor(palette.vignette, effective),
    // cssFallback and image are intentionally left as-is — they're skin-defined
    // and don't need seasonal tinting (fallback is rarely visible)
  };
}

// ─── Convenience: resolve modifier for a SeasonalBlend ───────────────────────

/**
 * Given a SeasonalBlend and a modifier map, return the interpolated modifier
 * ready to pass to applySeasonalModifier.
 *
 * @param blend      The SeasonalBlend from useSeason()
 * @param modifiers  Per-season modifier map (skin's or universal default)
 */
export function resolveSeasonalModifier(
  blend: SeasonalBlend,
  modifiers: Record<Season, SeasonalModifier> = UNIVERSAL_SEASON_MODIFIERS,
): SeasonalModifier {
  const mod0 = modifiers[blend.season] ?? IDENTITY_MODIFIER;
  const mod1 = modifiers[blend.nextSeason] ?? IDENTITY_MODIFIER;
  return lerpModifier(mod0, mod1, blend.t);
}
