// Provider
export { SolarThemeProvider } from './provider/solar-theme-provider';
export { useSolarTheme } from './provider/solar-theme-provider';

// Widgets
export { SolarWidget } from './widgets/solar-widget.shell';
export { CompactWidget } from './widgets/compact-widget.shell';

// Shader background
export { SolarShaderBg, SolarShaderBgFull } from './shared/solar-shader-bg';

// Types — from skin type definitions
export type {
  DesignMode,
  SkinDefinition,
  WidgetPalette,
} from './skins/types/widget-skin.types';

// Types — from hooks
export type { SolarPhase, SolarBlend } from './hooks/useSolarPosition';

// Types — from widgets
export type { WeatherCategory, ExpandDirection, WidgetSize } from './widgets/solar-widget.shell';
export type { CompactSize } from './widgets/compact-widget.shell';

// Types — from provider
export type { SolarTheme } from './provider/solar-theme-provider';

// Seasonal system
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
