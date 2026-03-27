// ════════════════════════════════════════════════════════════════════════════
// FILE: src/lib/seasonal-integration.ts
// ════════════════════════════════════════════════════════════════════════════
//
// This file documents the exact changes needed to wire the seasonal system
// into SolarThemeProvider and the public API. It is a reference/guide —
// not a runtime file. Copy the relevant snippets into their target files.

// ─────────────────────────────────────────────────────────────────────────────
// 1. src/components/skins/types/widget-skin.types.ts
//    ADD these fields to SkinDefinition:
// ─────────────────────────────────────────────────────────────────────────────

/*
import type { Season } from '../../../lib/useSeason';
import type { SeasonalModifier } from '../../../lib/seasonal-blend';

export interface SkinDefinition {
  // ... existing fields ...

  /**
   * Optional per-season palette modifiers.
   * If omitted, UNIVERSAL_SEASON_MODIFIERS is used automatically.
   * Define only the seasons you want to customise — the rest fall back.
   * /
  seasonalModifiers?: Partial<Record<Season, SeasonalModifier>>;
}
*/

// ─────────────────────────────────────────────────────────────────────────────
// 2. src/components/solar-theme-provider.tsx (or .client.tsx in Blade/Remix)
//    ADD seasonal computation + context value:
// ─────────────────────────────────────────────────────────────────────────────

/*
// At top of file, add imports:
import { useSeason, type Season, type SeasonalBlend } from '../lib/useSeason';
import {
  resolveSeasonalModifier,
  applySeasonalModifier,
  UNIVERSAL_SEASON_MODIFIERS,
} from '../lib/seasonal-blend';

// Add to SolarThemeProviderProps:
interface SolarThemeProviderProps {
  // ... existing props ...

  /**
   * Force a specific season, bypassing astronomical computation.
   * Useful for testing, user preferences, or themed marketing pages.
   * /
  seasonOverride?: Season;

  /**
   * Opt out of seasonal palette blending entirely.
   * When true, palettes are exactly as defined in the skin. Default: false.
   * /
  disableSeasonalBlend?: boolean;
}

// Add to SolarThemeContext shape:
interface SolarThemeContext {
  // ... existing fields ...
  season: Season;
  seasonalBlend: SeasonalBlend;
  setSeasonOverride: (season: Season | null) => void;
}

// Inside SolarThemeProvider component body, add:
const [seasonOverride, setSeasonOverride] = useState<Season | undefined>(
  props.seasonOverride,
);

// latitude is already in context — pass it through:
const seasonalBlend = useSeason(latitude, seasonOverride, simulatedDate);

// When building the final palette (wherever lerpPalette is called):
const rawPalette = lerpPalette(
  activeSkin.shaderPalettes[blend.phase],
  activeSkin.shaderPalettes[blend.nextPhase],
  blend.t,
);

const finalPalette = props.disableSeasonalBlend
  ? rawPalette
  : applySeasonalModifier(
      rawPalette,
      resolveSeasonalModifier(
        seasonalBlend,
        // Merge skin-specific modifiers over universal defaults
        { ...UNIVERSAL_SEASON_MODIFIERS, ...activeSkin.seasonalModifiers },
      ),
    );

// Add season + setSeasonOverride to context value:
const contextValue = {
  // ... existing values ...
  season: seasonalBlend.season,
  seasonalBlend,
  setSeasonOverride,
};
*/

// ─────────────────────────────────────────────────────────────────────────────
// 3. src/components/solar-dev-tools.tsx
//    ADD season selector alongside the existing phase scrubber:
// ─────────────────────────────────────────────────────────────────────────────

/*
// In devtools, expose setSeasonOverride from context:
const { season, setSeasonOverride } = useSolarTheme();

const SEASONS: Season[] = ['spring', 'summer', 'autumn', 'winter'];

// Add a season selector row in the devtools UI:
<div style={{ display: 'flex', gap: 4 }}>
  {SEASONS.map(s => (
    <button
      key={s}
      onClick={() => setSeasonOverride(s === season ? null : s)}
      style={{
        fontWeight: s === season ? 'bold' : 'normal',
        opacity:    s === season ? 1 : 0.5,
      }}
    >
      {s}
    </button>
  ))}
</div>
*/

// ─────────────────────────────────────────────────────────────────────────────
// 4. src/index.ts — add to public exports:
// ─────────────────────────────────────────────────────────────────────────────

/*
export type { Season, SeasonalBlend } from './lib/useSeason';
export { useSeason, getSeasonalBlend } from './lib/useSeason';
export type { SeasonalModifier } from './lib/seasonal-blend';
export {
  IDENTITY_MODIFIER,
  UNIVERSAL_SEASON_MODIFIERS,
  lerpModifier,
  applySeasonalModifier,
  resolveSeasonalModifier,
} from './lib/seasonal-blend';
*/

// ─────────────────────────────────────────────────────────────────────────────
// 5. Aura bridge — pass season uniform to botanical-veil (and any shader
//    that declares u_season). In background-engine.ts or the Aura bridge:
// ─────────────────────────────────────────────────────────────────────────────

/*
// When calling solarMapping.map(), pass extras from the SeasonalBlend:
const SEASON_TO_FLOAT: Record<Season, number> = {
  spring: 0.0,
  summer: 1.0,
  autumn: 2.0,
  winter: 3.0,
};

// Compute a continuous season float that crossfades between seasons:
function seasonalFloat(blend: SeasonalBlend): number {
  const base = SEASON_TO_FLOAT[blend.season];
  const next = SEASON_TO_FLOAT[blend.nextSeason];
  // Handle wrap (winter → spring: 3 → 4, not 3 → 0)
  const adjustedNext = next < base ? next + 4 : next;
  return base + (adjustedNext - base) * blend.t;
}

// In the uniform-update loop:
const extras = { season: seasonalFloat(seasonalBlend) };
const uniforms = background.solarMapping.map(tokens, extras);
// Set u_season uniform if it exists in the shader
*/

// ─────────────────────────────────────────────────────────────────────────────
// 6. Package consumer API — final usage shape after integration:
// ─────────────────────────────────────────────────────────────────────────────

/*
// Auto-detected from date + geolocation (zero config):
<SolarThemeProvider initialDesign="foundry">
  <SolarWidget showWeather showFlag />
</SolarThemeProvider>

// Force a season override (marketing page, user preference):
<SolarThemeProvider initialDesign="foundry" seasonOverride="autumn">
  <SolarWidget />
</SolarThemeProvider>

// Opt out of seasonal blending entirely:
<SolarThemeProvider initialDesign="foundry" disableSeasonalBlend>
  <SolarWidget />
</SolarThemeProvider>

// Read season in your own component:
import { useSolarTheme } from '@circadian/sol';

function SeasonBadge() {
  const { season } = useSolarTheme();
  return <span>{season}</span>; // 'spring' | 'summer' | 'autumn' | 'winter'
}

// Custom skin with per-season modifiers:
const MY_SKIN: SkinDefinition = {
  // ... existing skin definition ...
  seasonalModifiers: {
    autumn: {
      saturationScale: 0.85,
      lightnessShift:  -0.05,
      hueRotateDeg:    -22,
      tintColor:       '#b85c1a',
      tintStrength:    0.12,
    },
    winter: {
      saturationScale: 0.78,
      lightnessShift:  -0.06,
      hueRotateDeg:    -30,
      tintColor:       '#6a9fc0',
      tintStrength:    0.09,
    },
    // spring and summer fall back to UNIVERSAL_SEASON_MODIFIERS
  },
};
*/

export {};
