'use client';
// ════════════════════════════════════════════════════════════════════════════
// FILE: components/solar-shader-bg.client.tsx
// ════════════════════════════════════════════════════════════════════════════

import {
  createContext,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { SolarBlend, SolarPhase } from '../hooks/useSolarPosition';
import {
  UNIVERSAL_SEASON_MODIFIERS,
  applySeasonalModifier,
  resolveSeasonalModifier,
} from '../lib/seasonal-blend';
import { lerpColor } from '../lib/solar-lerp';
import type { SeasonalBlend } from '../lib/useSeason';
import { useSolarTheme } from '../provider/solar-theme-provider';
import type {
  ShaderImage,
  ShaderMotion,
  ShaderPalette,
  SkinDefinition,
} from '../skins/types/widget-skin.types';
import { SKIN_MOTION_PROFILES, UNIVERSAL_PHASE_MOTION } from './shader-motion-profiles';

// ─── Variant context ──────────────────────────────────────────────────────────

export type ShaderVariant = 'showcase' | 'dashboard' | 'editorial';

const ShaderVariantCtx = createContext<ShaderVariant>('showcase');

export function ShaderVariantProvider({
  variant,
  children,
}: {
  variant: ShaderVariant;
  children: React.ReactNode;
}) {
  return <ShaderVariantCtx.Provider value={variant}>{children}</ShaderVariantCtx.Provider>;
}

export function useShaderVariant(): ShaderVariant {
  return useContext(ShaderVariantCtx);
}

// ─── Dashboard motion modifier ────────────────────────────────────────────────

const DASHBOARD_MOTION_SCALE = {
  speed: 0.45,
  distortion: 0.5,
  swirl: 0.4,
  grainOverlay: 1.3,
} as const;

const DASHBOARD_OPACITY_SCALE = 0.65;

function applyDashboardMotion(m: ShaderMotion): ShaderMotion {
  return {
    speed: m.speed * DASHBOARD_MOTION_SCALE.speed,
    distortion: m.distortion * DASHBOARD_MOTION_SCALE.distortion,
    swirl: m.swirl * DASHBOARD_MOTION_SCALE.swirl,
    grainOverlay: Math.min(1, m.grainOverlay * DASHBOARD_MOTION_SCALE.grainOverlay),
  };
}

// ─── Editorial motion modifier ────────────────────────────────────────────────

const EDITORIAL_MOTION_SCALE = {
  speed: 0.3,
  distortion: 0.35,
  swirl: 0.25,
  grainOverlay: 1.4,
} as const;

const EDITORIAL_OPACITY_SCALE = 0.35;

function applyEditorialMotion(m: ShaderMotion): ShaderMotion {
  return {
    speed: m.speed * EDITORIAL_MOTION_SCALE.speed,
    distortion: m.distortion * EDITORIAL_MOTION_SCALE.distortion,
    swirl: m.swirl * EDITORIAL_MOTION_SCALE.swirl,
    grainOverlay: Math.min(1, m.grainOverlay * EDITORIAL_MOTION_SCALE.grainOverlay),
  };
}

function mixToward(hex: string, target: string, mix: number): string {
  return lerpColor(hex, target, mix);
}

function applyEditorialPalette(p: ShaderPalette): ShaderPalette {
  const darkBase = '#08080c';
  const darkVignette = '#030306';
  return {
    ...p,
    colors: p.colors.map((c) => mixToward(c, darkBase, 0.92)) as [string, string, string, string],
    colorBack: mixToward(p.colorBack, darkBase, 0.95),
    vignette: mixToward(p.vignette, darkVignette, 0.9),
    cssFallback: `linear-gradient(135deg, ${darkBase} 0%, #0c0c14 100%)`,
  };
}

// ─── Interpolation helpers ────────────────────────────────────────────────────

function lerpNum(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function lerpMotion(a: ShaderMotion, b: ShaderMotion, t: number): ShaderMotion {
  return {
    distortion: lerpNum(a.distortion, b.distortion, t),
    swirl: lerpNum(a.swirl, b.swirl, t),
    speed: lerpNum(a.speed, b.speed, t),
    grainOverlay: lerpNum(a.grainOverlay, b.grainOverlay, t),
  };
}

function lerpPalette(a: ShaderPalette, b: ShaderPalette, t: number): ShaderPalette {
  return {
    colors: a.colors.map((ca, i) => lerpColor(ca, b.colors[i] ?? ca, t)) as [
      string,
      string,
      string,
      string,
    ],
    colorBack: lerpColor(a.colorBack, b.colorBack, t),
    opacity: lerpNum(a.opacity, b.opacity, t),
    vignette: lerpColor(a.vignette, b.vignette, t),
    cssFallback: a.cssFallback,
    image: a.image,
  };
}

// ─── Motion profile resolution ────────────────────────────────────────────────

function resolveMotionProfile(skin: SkinDefinition): Record<SolarPhase, ShaderMotion> {
  if (skin.shaderMotion) return skin.shaderMotion;
  return SKIN_MOTION_PROFILES[skin.id] ?? UNIVERSAL_PHASE_MOTION;
}

// ─── Image config resolution ──────────────────────────────────────────────────

function resolveImage(skin: SkinDefinition, palette: ShaderPalette): ShaderImage | undefined {
  return palette.image ?? skin.defaultImage;
}

// ─── Core config computation ──────────────────────────────────────────────────

function computeConfig(
  skin: SkinDefinition,
  blend: SolarBlend,
  seasonal?: { blend: SeasonalBlend; disabled: boolean },
) {
  const motionProfile = resolveMotionProfile(skin);
  const { phase, nextPhase, t } = blend;
  let palette = lerpPalette(skin.shaderPalettes[phase], skin.shaderPalettes[nextPhase], t);

  if (seasonal && !seasonal.disabled) {
    const mod = resolveSeasonalModifier(seasonal.blend, {
      ...UNIVERSAL_SEASON_MODIFIERS,
      ...skin.seasonalModifiers,
    });
    palette = applySeasonalModifier(palette, mod);
  }

  return {
    palette,
    motion: lerpMotion(motionProfile[phase], motionProfile[nextPhase], t),
  };
}

// ─── Hex → RGB helper ─────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        Number.parseInt(result[1], 16) / 255,
        Number.parseInt(result[2], 16) / 255,
        Number.parseInt(result[3], 16) / 255,
      ]
    : [0, 0, 0];
}

// ─── WebGL SolarFlare shader ──────────────────────────────────────────────────
// Inspired by a radiant solar flare effect. Uses the skin's 4 shader palette
// colors as a blended flare color against the colorBack background.
// Motion profile drives speed, intensity, spread and pulse.

const VS_SOURCE = `#version 300 es
  in vec2 a_position;
  void main() {
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

const FS_SOURCE = `#version 300 es
  precision highp float;

  uniform vec2 r;          // resolution
  uniform float t;         // time
  uniform vec3 u_bg;       // background color (colorBack)
  uniform vec3 u_c0;       // palette color 0
  uniform vec3 u_c1;       // palette color 1
  uniform vec3 u_c2;       // palette color 2
  uniform vec3 u_c3;       // palette color 3
  uniform float u_intensity;
  uniform float u_spread;
  uniform float u_pulseRate;
  uniform float u_speed;
  uniform float u_grain;

  out vec4 o;

  // Hash for grain
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
  }

  void main() {
    vec4 FC = gl_FragCoord;
    vec2 p = (FC.xy * 2. - r) / r.y;

    // Average all 4 palette colors
    vec3 avgColor = (u_c0 + u_c1 + u_c2 + u_c3) * 0.25;

    // Normalize to a fixed luminance so the flare shape is identical
    // across all skins regardless of how bright/dark the palette is.
    // Dark palettes (Void midnight ≈ 0.01) and bright palettes
    // (Paper morning ≈ 0.95) both produce the same-sized sun.
    float lum = dot(avgColor, vec3(0.299, 0.587, 0.114));
    vec3 flareColor = lum > 0.001
      ? avgColor * (0.30 / lum)   // rescale to target luminance 0.30
      : vec3(0.30);               // neutral grey fallback

    // Solar flare radiance — matches the reference SolarFlare shader.
    // length(p) creates a circular distance field from center.
    // The exp(mod(dot(...))) creates alive, pulsing texture inside the sun.
    float l = u_intensity - length(p);

    o = tanh(
      vec4(flareColor, 0.0)
      / max(l, -l * u_spread)
      / exp(
        mod(dot(FC, sin(FC.yxyx)) + t * u_speed, 2.0)
        + sin(t * u_speed + sin(t * u_speed / u_pulseRate + p.y))
      )
    );

    // Film grain
    float grain = (hash(FC.xy + fract(t)) - 0.5) * u_grain;

    // Composite: background + flare glow + grain
    o = vec4(u_bg + o.rgb + grain, 1.0);
  }
`;

interface SolarFlareCanvasProps {
  backgroundColor: string;
  colors: [string, string, string, string];
  speed: number;
  intensity: number;
  spread: number;
  pulseRate: number;
  grain: number;
}

function SolarFlareCanvas({
  backgroundColor,
  colors,
  speed,
  intensity,
  spread,
  pulseRate,
  grain,
}: SolarFlareCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number | null>(null);

  const configRef = useRef({
    backgroundColor,
    colors,
    speed,
    intensity,
    spread,
    pulseRate,
    grain,
  });

  useEffect(() => {
    configRef.current = {
      backgroundColor,
      colors,
      speed,
      intensity,
      spread,
      pulseRate,
      grain,
    };
  }, [backgroundColor, colors, speed, intensity, spread, pulseRate, grain]);

  // useLayoutEffect ensures WebGL context is created and the first frame is
  // drawn *before* the browser paints, preventing a blank-canvas flash on
  // client-side navigation remounts.
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2');
    if (!gl) return;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = createShader(gl.VERTEX_SHADER, VS_SOURCE);
    const fs = createShader(gl.FRAGMENT_SHADER, FS_SOURCE);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;

    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const posLoc = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(posLoc);
    gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

    const loc = {
      r: gl.getUniformLocation(program, 'r'),
      t: gl.getUniformLocation(program, 't'),
      bg: gl.getUniformLocation(program, 'u_bg'),
      c0: gl.getUniformLocation(program, 'u_c0'),
      c1: gl.getUniformLocation(program, 'u_c1'),
      c2: gl.getUniformLocation(program, 'u_c2'),
      c3: gl.getUniformLocation(program, 'u_c3'),
      intensity: gl.getUniformLocation(program, 'u_intensity'),
      spread: gl.getUniformLocation(program, 'u_spread'),
      pulseRate: gl.getUniformLocation(program, 'u_pulseRate'),
      speed: gl.getUniformLocation(program, 'u_speed'),
      grain: gl.getUniformLocation(program, 'u_grain'),
    };

    const resizeCanvas = () => {
      const dpr = window.devicePixelRatio || 1;
      canvas.width = Math.round(canvas.offsetWidth * dpr);
      canvas.height = Math.round(canvas.offsetHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    window.addEventListener('resize', resizeCanvas);
    resizeCanvas();

    const startTime = performance.now();

    const render = () => {
      const cfg = configRef.current;
      gl.useProgram(program);

      gl.uniform2f(loc.r, canvas.width, canvas.height);
      gl.uniform1f(loc.t, (performance.now() - startTime) / 1000);

      const bg = hexToRgb(cfg.backgroundColor);
      gl.uniform3f(loc.bg, bg[0], bg[1], bg[2]);

      const c0 = hexToRgb(cfg.colors[0]);
      const c1 = hexToRgb(cfg.colors[1]);
      const c2 = hexToRgb(cfg.colors[2]);
      const c3 = hexToRgb(cfg.colors[3]);
      gl.uniform3f(loc.c0, c0[0], c0[1], c0[2]);
      gl.uniform3f(loc.c1, c1[0], c1[1], c1[2]);
      gl.uniform3f(loc.c2, c2[0], c2[1], c2[2]);
      gl.uniform3f(loc.c3, c3[0], c3[1], c3[2]);

      gl.uniform1f(loc.intensity, cfg.intensity);
      gl.uniform1f(loc.spread, cfg.spread);
      gl.uniform1f(loc.pulseRate, cfg.pulseRate);
      gl.uniform1f(loc.speed, cfg.speed);
      gl.uniform1f(loc.grain, cfg.grain);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
      animationRef.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      gl.deleteBuffer(positionBuffer);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
      }}
    />
  );
}

// ─── Client-side mount tracking ───────────────────────────────────────────────
// After the very first hydration, any subsequent mount is a client-side navigation
// remount — no SSR/hydration mismatch is possible, so the canvas can render
// immediately without the `mounted` gate (which would cause a one-frame blink).
let _hasHydrated = false;

// ─── Props ────────────────────────────────────────────────────────────────────

export interface SolarShaderBgProps {
  skinOverride?: SkinDefinition;
  blendOverride?: SolarBlend;
  opacityOverride?: number;
  variant?: ShaderVariant;
  className?: string;
  style?: React.CSSProperties;
}

// ─── SolarShaderBg ────────────────────────────────────────────────────────────

export function SolarShaderBg({
  skinOverride,
  blendOverride,
  opacityOverride,
  variant: variantProp,
  className,
  style,
}: SolarShaderBgProps = {}) {
  const theme = useSolarTheme();
  const { activeSkin, blend: contextBlend, seasonalBlend } = theme;
  const contextVariant = useShaderVariant();

  const skin = skinOverride ?? activeSkin;
  const blend = blendOverride ?? contextBlend;
  const variant = variantProp ?? contextVariant;
  const seasonal = { blend: seasonalBlend, disabled: false };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional fine-grained deps — blend object reference changes every render; subscribing to specific fields avoids thrashing computeConfig
  const { palette, motion: rawMotion } = useMemo(
    () => computeConfig(skin, blend, seasonal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blend.phase, blend.nextPhase, blend.t, skin, seasonalBlend.season, seasonalBlend.t],
  );

  const variantPalette = variant === 'editorial' ? applyEditorialPalette(palette) : palette;

  const shaderMotion =
    variant === 'dashboard'
      ? applyDashboardMotion(rawMotion)
      : variant === 'editorial'
        ? applyEditorialMotion(rawMotion)
        : rawMotion;

  const resolvedOpacity =
    opacityOverride ??
    (variant === 'dashboard'
      ? variantPalette.opacity * DASHBOARD_OPACITY_SCALE
      : variant === 'editorial'
        ? variantPalette.opacity * EDITORIAL_OPACITY_SCALE
        : variantPalette.opacity);

  const imageConfig = resolveImage(skin, variantPalette);

  // Gate dynamic layers behind a client-only flag to avoid hydration mismatches.
  // On the very first mount (SSR hydration), start as false and flip via effect.
  // On subsequent mounts (client-side navigation), start as true immediately
  // so the WebGL canvas renders without a one-frame blink.
  const [mounted, setMounted] = useState(_hasHydrated);
  useLayoutEffect(() => {
    _hasHydrated = true;
    setMounted(true);
  }, []);

  useEffect(() => {
    document.documentElement.style.setProperty('--solar-shader-bg', variantPalette.colorBack);
    return () => {
      document.documentElement.style.removeProperty('--solar-shader-bg');
    };
  }, [variantPalette.colorBack]);

  // Map shader motion → SolarFlare parameters
  // intensity ≥ 3.5 ensures the radial edge is always off-screen (max corner
  // distance in normalised coords is ~1.15), so the glow fills the entire
  // viewport as an atmospheric wash — no visible "sun" circle.
  const flareSpeed = 0.6 + shaderMotion.speed * 0.8;
  const flareIntensity = 3.5 + shaderMotion.distortion * 0.5;
  const flareSpread = 8.0 + shaderMotion.swirl * 8.0;
  const flarePulseRate = 0.4 + (1.0 - shaderMotion.swirl) * 0.5;
  const flareGrain = shaderMotion.grainOverlay * 0.12;

  return (
    <div
      className={className}
      suppressHydrationWarning
      style={{
        position: 'absolute',
        inset: 0,
        overflow: 'hidden',
        background: variantPalette.cssFallback || variantPalette.colorBack,
        ...style,
      }}
    >
      {mounted && (
        <>
          {/* ── Layer 1: WebGL SolarFlare (renders instantly — no flash) ── */}
          <div className="absolute inset-0" style={{ opacity: resolvedOpacity }}>
            <SolarFlareCanvas
              backgroundColor={variantPalette.colorBack}
              colors={variantPalette.colors}
              speed={flareSpeed}
              intensity={flareIntensity}
              spread={flareSpread}
              pulseRate={flarePulseRate}
              grain={flareGrain}
            />
          </div>

          {/* ── Layer 2: Atmospheric image ──────────────────────────────── */}
          {imageConfig && (
            <div
              className="absolute inset-0"
              aria-hidden
              style={{
                opacity: imageConfig.opacity ?? 0.18,
                pointerEvents: 'none',
                background: 'var(--solar-accent)',
                WebkitMaskImage: `url(${imageConfig.src})`,
                maskImage: `url(${imageConfig.src})`,
                WebkitMaskSize: 'cover',
                maskSize: 'cover',
                WebkitMaskPosition: imageConfig.objectPosition ?? 'center center',
                maskPosition: imageConfig.objectPosition ?? 'center center',
                WebkitMaskRepeat: 'no-repeat',
                maskRepeat: 'no-repeat',
              }}
            />
          )}

          {/* ── Layer 3: Vignette ───────────────────────────────────────── */}
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              pointerEvents: 'none',
              background: `radial-gradient(ellipse 85% 70% at 50% 50%, transparent 0%, ${variantPalette.vignette} 100%)`,
            }}
          />
        </>
      )}
    </div>
  );
}

// ─── SolarShaderBgFull ────────────────────────────────────────────────────────

export function SolarShaderBgFull(props: SolarShaderBgProps = {}) {
  return <SolarShaderBg {...props} style={{ zIndex: 0, ...props.style }} />;
}

// ─── useSolarShaderConfig ─────────────────────────────────────────────────────

export function useSolarShaderConfig(
  opts: {
    skinOverride?: SkinDefinition;
    blendOverride?: SolarBlend;
  } = {},
) {
  const { activeSkin, blend: contextBlend, seasonalBlend } = useSolarTheme();
  const skin = opts.skinOverride ?? activeSkin;
  const blend = opts.blendOverride ?? contextBlend;
  const seasonal = { blend: seasonalBlend, disabled: false };

  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional fine-grained deps — blend object reference changes every render; subscribing to specific fields avoids thrashing computeConfig
  return useMemo(
    () => computeConfig(skin, blend, seasonal),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [blend.phase, blend.nextPhase, blend.t, skin, seasonalBlend.season, seasonalBlend.t],
  );
}
