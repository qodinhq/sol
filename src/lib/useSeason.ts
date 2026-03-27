// ════════════════════════════════════════════════════════════════════════════
// FILE: src/lib/useSeason.ts
// ════════════════════════════════════════════════════════════════════════════
//
// Astronomical season computation from date + hemisphere.
// Produces a SeasonalBlend that smoothly crossfades between adjacent seasons
// within a ±14-day window around each solstice/equinox.
//
// Northern hemisphere season boundaries (approximate day-of-year):
//   Spring  → Mar 20  (day  79)
//   Summer  → Jun 21  (day 172)
//   Autumn  → Sep 22  (day 265)
//   Winter  → Dec 21  (day 355)
//
// Southern hemisphere: all seasons flip by 6 months (~182 days).

import { useEffect, useState } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface SeasonalBlend {
  /** The current dominant season. */
  season: Season;
  /** The season being crossfaded toward (equals season outside transition windows). */
  nextSeason: Season;
  /**
   * 0–1 interpolation between season → nextSeason.
   * 0.0 = fully current season, 1.0 = fully next season.
   * Non-zero only within the final CROSSFADE_DAYS before a solstice/equinox.
   */
  t: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Day-of-year for each northern hemisphere season start (approximate). */
const SEASON_STARTS_NORTH: Record<Season, number> = {
  spring: 79, // ~Mar 20
  summer: 172, // ~Jun 21
  autumn: 265, // ~Sep 22
  winter: 355, // ~Dec 21
};

/** Days either side of a transition within which to apply crossfade. */
const CROSSFADE_DAYS = 14;

const SEASON_ORDER: Season[] = ['spring', 'summer', 'autumn', 'winter'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function dayOfYear(date: Date): number {
  const start = new Date(date.getFullYear(), 0, 0);
  const diff = date.getTime() - start.getTime();
  return Math.floor(diff / 86_400_000);
}

function daysInYear(year: number): number {
  // Leap year if divisible by 4, except centuries unless also by 400
  return new Date(year, 1, 29).getMonth() === 1 ? 366 : 365;
}

function computeSeasonalBlend(doy: number, isNorthern: boolean, totalDays: number): SeasonalBlend {
  // Southern hemisphere: offset by ~6 months and wrap
  const adjustedDoy = isNorthern ? doy : (doy + 182) % totalDays || totalDays;

  // Determine current season (last season whose start day ≤ adjustedDoy)
  let currentSeason: Season = 'winter'; // default — before spring
  let currentIdx = 0;

  for (let i = SEASON_ORDER.length - 1; i >= 0; i--) {
    if (adjustedDoy >= SEASON_STARTS_NORTH[SEASON_ORDER[i]]) {
      currentSeason = SEASON_ORDER[i];
      currentIdx = i;
      break;
    }
  }

  const nextIdx = (currentIdx + 1) % SEASON_ORDER.length;
  const nextSeason = SEASON_ORDER[nextIdx];
  const nextStart = SEASON_STARTS_NORTH[nextSeason];

  // Days until the next season transition (handles year wrap for winter→spring)
  let daysToNext = nextStart - adjustedDoy;
  if (daysToNext < 0) daysToNext += totalDays;

  // Linear t within the crossfade window, then smooth-stepped
  let t = 0;
  if (daysToNext <= CROSSFADE_DAYS) {
    const raw = (CROSSFADE_DAYS - daysToNext) / CROSSFADE_DAYS;
    const clamped = Math.max(0, Math.min(1, raw));
    // Smooth step: t² (3 - 2t)
    t = clamped * clamped * (3 - 2 * clamped);
  }

  return { season: currentSeason, nextSeason, t };
}

// ─── Core API ────────────────────────────────────────────────────────────────

/**
 * Pure function — compute the SeasonalBlend for a given date and latitude.
 *
 * @param date       The date to evaluate (default: now)
 * @param latitudeN  Decimal degrees, positive = north (default: 0)
 * @param override   Force a fixed season, bypassing computation
 */
export function getSeasonalBlend(
  date: Date = new Date(),
  latitudeN = 0,
  override?: Season,
): SeasonalBlend {
  if (override) {
    const idx = SEASON_ORDER.indexOf(override);
    const nextSeason = SEASON_ORDER[(idx + 1) % SEASON_ORDER.length];
    return { season: override, nextSeason, t: 0 };
  }

  const isNorthern = latitudeN >= 0;
  const doy = dayOfYear(date);
  const total = daysInYear(date.getFullYear());
  return computeSeasonalBlend(doy, isNorthern, total);
}

// ─── React hook ──────────────────────────────────────────────────────────────

/**
 * Hook — returns the current SeasonalBlend, re-evaluated once per hour.
 *
 * @param latitudeN     Decimal degrees, positive = north.
 *                      Pass null while coordinates are still loading.
 * @param override      Force a specific season (for dev previews / user settings).
 * @param simulatedDate Use a specific date instead of now (for SolarDevTools).
 */
export function useSeason(
  latitudeN: number | null,
  override?: Season,
  simulatedDate?: Date,
): SeasonalBlend {
  const [blend, setBlend] = useState<SeasonalBlend>(() =>
    getSeasonalBlend(simulatedDate ?? new Date(), latitudeN ?? 0, override),
  );

  useEffect(() => {
    const recompute = () => {
      setBlend(getSeasonalBlend(simulatedDate ?? new Date(), latitudeN ?? 0, override));
    };

    recompute();

    // Seasons change in days, re-evaluate hourly is more than sufficient
    const id = setInterval(recompute, 60 * 60 * 1_000);
    return () => clearInterval(id);
  }, [latitudeN, override, simulatedDate]);

  return blend;
}
