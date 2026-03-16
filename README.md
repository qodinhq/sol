<div align="center">

<img src=".github/banner.png" alt="@qodin-co/sol — solar-aware React widgets" width="100%" />

<br />
<br />

<a href="https://www.npmjs.com/package/@qodin-co/sol">
  <img src="https://img.shields.io/npm/v/@qodin-co/sol?style=flat-square&color=111&labelColor=111&logo=npm" alt="npm version" />
</a>
<a href="https://www.npmjs.com/package/@qodin-co/sol">
  <img src="https://img.shields.io/npm/dm/@qodin-co/sol?style=flat-square&color=111&labelColor=111" alt="npm downloads" />
</a>
<a href="https://github.com/qodin-co/sol/blob/main/LICENSE">
  <img src="https://img.shields.io/npm/l/@qodin-co/sol?style=flat-square&color=111&labelColor=111" alt="license" />
</a>
<a href="https://github.com/qodin-co/sol/actions/workflows/validate.yml">
  <img src="https://img.shields.io/github/actions/workflow/status/qodin-co/sol/validate.yml?style=flat-square&color=111&labelColor=111&label=ci" alt="CI" />
</a>

<br />
<br />

**Solar-aware React widgets that follow the real position of the sun.**

[npm](https://www.npmjs.com/package/@qodin-co/sol) · [GitHub](https://github.com/qodin-co/sol)

</div>

---

> **Dark mode reacts to a preference. Sol reacts to place and time.**

Most apps treat theming as a binary choice — light or dark, on or off, a toggle buried in settings.

Sol replaces that with something alive. It computes the sun's real position from the user's location, timezone, and current time, then smoothly transitions the interface through **9 solar phases** — dawn, sunrise, morning, solar noon, afternoon, sunset, dusk, night, and midnight — with animated blends, optional weather layers, and 10 richly designed skins.

No API key. No manual toggle. Your UI just follows the sun.

---

```bash
bun add @qodin-co/sol
# or
npm install @qodin-co/sol
```

`@qodin-co/sol` gives you a full `SolarWidget`, a `CompactWidget`, 10 skins, 9 solar phases, optional live weather, optional flag display, and a dev-only timeline scrubber via `SolarDevTools`. Solar position is computed locally from latitude, longitude, timezone, and current time — no solar API required.

---

## Features

- **2 widget variants** — `SolarWidget` (full card) and `CompactWidget` (slim pill/bar)
- **10 skins** — `foundry`, `paper`, `signal`, `meridian`, `mineral`, `aurora`, `tide`, `void`, `sundial`, `parchment`
- **9 solar phases** — `midnight`, `night`, `dawn`, `sunrise`, `morning`, `solar-noon`, `afternoon`, `sunset`, `dusk`
- **Built-in fallback strategy** — geolocation → browser timezone → timezone centroid
- **Optional live weather** — powered by Open-Meteo (no API key required)
- **Dev preview tooling** — `SolarDevTools` lets you scrub through the day and preview phase colors
- **SSR-safe** — works in Next.js, Remix, TanStack Start, Blade, and Vite

---

## Quick Start

Sol uses browser APIs for geolocation and solar computation. The exact setup depends on your framework — pick yours below.

---

### Vite

No special setup needed. Wrap your app with the provider and use widgets directly.

```tsx
// main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { SolarThemeProvider } from '@qodin-co/sol';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <SolarThemeProvider initialDesign="foundry">
      <App />
    </SolarThemeProvider>
  </StrictMode>,
);
```

```tsx
// App.tsx
import { SolarWidget } from '@qodin-co/sol';

export default function App() {
  return <SolarWidget showWeather showFlag />;
}
```

---

### Next.js (App Router)

Add `'use client'` at the top of any file that uses Sol. This marks it as a client component and prevents it from running during server rendering.

```tsx
// components/providers.tsx
'use client';
import { SolarThemeProvider } from '@qodin-co/sol';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolarThemeProvider initialDesign="foundry">
      {children}
    </SolarThemeProvider>
  );
}
```

```tsx
// components/solar-widget.tsx
'use client';
import { SolarWidget } from '@qodin-co/sol';

export default function Solar() {
  return <SolarWidget showWeather showFlag />;
}
```

```tsx
// app/layout.tsx
import Providers from '../components/providers';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/page.tsx
import Solar from '../components/solar-widget';

export default function Page() {
  return <Solar />;
}
```

---

### Remix

Name any file that uses Sol with a `.client.tsx` extension. Remix excludes `.client` files from the server bundle automatically.

```tsx
// app/components/providers.client.tsx
import { SolarThemeProvider } from '@qodin-co/sol';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolarThemeProvider initialDesign="foundry">
      {children}
    </SolarThemeProvider>
  );
}
```

```tsx
// app/components/solar-widget.client.tsx
import { SolarWidget } from '@qodin-co/sol';

export default function Solar() {
  return <SolarWidget showWeather showFlag />;
}
```

```tsx
// app/root.tsx
import Providers from './components/providers.client';

export default function App() {
  return (
    <html lang="en">
      <body>
        <Providers>
          <Outlet />
        </Providers>
      </body>
    </html>
  );
}
```

```tsx
// app/routes/_index.tsx
import Solar from '../components/solar-widget.client';

export default function Index() {
  return <Solar />;
}
```

---

### TanStack Start

Use the `ClientOnly` component from `@tanstack/react-router` to prevent Sol from rendering during SSR.

```tsx
// app/components/solar-widget.tsx
import { ClientOnly } from '@tanstack/react-router';
import { SolarThemeProvider, SolarWidget } from '@qodin-co/sol';

export default function Solar() {
  return (
    <ClientOnly fallback={null}>
      <SolarThemeProvider initialDesign="foundry">
        <SolarWidget showWeather showFlag />
      </SolarThemeProvider>
    </ClientOnly>
  );
}
```

```tsx
// app/routes/index.tsx
import Solar from '../components/solar-widget';

export const Route = createFileRoute('/')({
  component: () => <Solar />,
});
```

---

### Blade

Name any file that uses Sol with a `.client.tsx` extension. Blade runs pages server-side; component files run client-side.

```tsx
// components/providers.client.tsx
import { SolarThemeProvider } from '@qodin-co/sol';

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SolarThemeProvider initialDesign="foundry">
      {children}
    </SolarThemeProvider>
  );
}
```

```tsx
// components/solar-widget.client.tsx
import { SolarWidget } from '@qodin-co/sol';

export default function Solar() {
  return <SolarWidget showWeather showFlag />;
}
```

```tsx
// pages/layout.tsx
import Providers from '../components/providers.client';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <Providers>{children}</Providers>;
}
```

```tsx
// pages/index.tsx
import Solar from '../components/solar-widget.client';

export default function Page() {
  return <Solar />;
}
```

---

## Provider Props

`SolarThemeProvider` is the shared runtime for solar phase computation, timezone, coordinates, and skin selection.

| Prop | Type | Default | Description |
|---|---|---|---|
| `children` | `ReactNode` | — | Required |
| `initialDesign` | `DesignMode` | `'foundry'` | Starting skin |
| `isolated` | `boolean` | `false` | Scope CSS vars to wrapper div instead of `:root`. Useful when mounting multiple providers on a single page. |

### Location is automatic

`SolarThemeProvider` resolves the user's location using a 3-step fallback:

1. **Browser Geolocation API** — most accurate, requires user permission
2. **Browser timezone** (`Intl.DateTimeFormat`) — instant, no permission needed
3. **Timezone centroid lookup** — maps the IANA timezone to approximate coordinates

Solar phases are accurate to ~15–30 minutes from timezone alone, and refine to exact values when geolocation is granted.

---

## SolarWidget

The full card widget. Reads its design from the nearest `SolarThemeProvider`.

```tsx
<SolarWidget
  expandDirection="top-left"
  size="lg"
  showWeather
  showFlag
  hoverEffect
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `expandDirection` | `ExpandDirection` | `'bottom-right'` | Direction the card expands |
| `size` | `WidgetSize` | `'lg'` | Widget size |
| `showWeather` | `boolean` | `false` | Enable live weather display |
| `showFlag` | `boolean` | `false` | Show country flag |
| `hoverEffect` | `boolean` | `false` | Enable hover animation |
| `phaseOverride` | `SolarPhase` | — | Force a discrete phase |
| `simulatedDate` | `Date` | — | Simulate a specific time |
| `weatherCategoryOverride` | `WeatherCategory \| null` | — | Force weather condition |
| `customPalettes` | `CustomPalettes` | — | Override phase colors per phase |
| `forceExpanded` | `boolean` | — | Lock expanded or collapsed state |

---

## CompactWidget

<div align="center">
 <img src=".github/compact-banner.png" alt="CompactWidget skins - Tide at Drift, Paper at Morning, Meridian at Dawn" width="100%"/>
 </div>

The slim pill/bar variant. Accepts an optional `design` prop to override the provider's active skin.

```tsx
<CompactWidget
  design="signal"
  size="md"
  showWeather
  showFlag
  showTemperature
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `design` | `DesignMode` | provider design | Design/skin override for this widget |
| `size` | `CompactSize` | `'md'` | Compact size |
| `showWeather` | `boolean` | `false` | Show weather icon |
| `showFlag` | `boolean` | `false` | Show country flag |
| `showTemperature` | `boolean` | `true` | Show live temperature |
| `overridePhase` | `SolarPhase \| null` | — | Force a discrete phase |
| `simulatedDate` | `Date` | — | Simulate a time |
| `className` | `string` | — | Wrapper CSS class |

---

## Skins

10 designs, each with a full widget and compact variant. If `design` is omitted on `CompactWidget`, it uses the provider's active design. `SolarWidget` always uses the provider's active design.

```ts
type DesignMode =
  | 'aurora'      // luminous ethereal
  | 'foundry'     // warm volumetric industrial
  | 'tide'        // fluid organic wave
  | 'void'        // minimal negative space
  | 'mineral'     // faceted crystal gem
  | 'meridian'    // hairline geometric
  | 'signal'      // pixel/blocky lo-fi
  | 'paper'       // flat ink editorial
  | 'sundial'     // roman/classical carved
  | 'parchment';  // document strokes
```

---

## Positioning

```tsx
<SolarWidget />                                                          // inline (default)
<SolarWidget position="bottom-right" />                                  // fixed to viewport
<SolarWidget position="bottom-right" expandDirection="top-left" />       // with expand direction
```

Supported positions: `top-left` `top-center` `top-right` `center-left` `center` `center-right` `bottom-left` `bottom-center` `bottom-right` `inline`

---

## Weather

```tsx
<SolarWidget showWeather />

// Force a category for preview
<SolarWidget showWeather weatherCategoryOverride="thunder" />
```

Powered by [Open-Meteo](https://open-meteo.com/) — free, no API key. Available categories: `clear` `partly-cloudy` `overcast` `fog` `drizzle` `rain` `heavy-rain` `snow` `heavy-snow` `thunder`

---

## Phase & Time Overrides

```tsx
// Force a discrete phase
<SolarWidget phaseOverride="sunset" />

// Simulate a specific time (with blend)
const preview = new Date();
preview.setHours(6, 45, 0, 0);
<SolarWidget simulatedDate={preview} />
```

Use `simulatedDate` for realistic continuous previews. Use `phaseOverride` for simple hard overrides.

---

## Custom Palettes

```tsx
<SolarWidget
  customPalettes={{
    dawn:   { bg: ['#20122a', '#7f3b5d', '#f5a66e'] },
    sunset: { bg: ['#2e0f18', '#b84a3d', '#ffbe7a'] },
  }}
/>
```

---

## SolarDevTools

When your interface depends on live solar time, manual testing breaks down fast — you can't wait until sunset to test sunset. `SolarDevTools` lets you scrub through the full day in seconds, preview every one of the **9 phases**, test every skin against every time of day, and catch phase-specific visual bugs before your users do.

Imported from a dedicated subpath — never included in production bundles unless explicitly imported.

```tsx
import { SolarDevTools } from '@qodin-co/sol/devtools';

// Vite
{import.meta.env.DEV && <SolarDevTools />}

// Next.js / Remix / TanStack Start / Blade
{process.env.NODE_ENV === 'development' && <SolarDevTools />}
```

### Full example

```tsx
import { SolarThemeProvider, SolarWidget } from '@qodin-co/sol';
import { SolarDevTools } from '@qodin-co/sol/devtools';

export default function Demo() {
  return (
    <SolarThemeProvider initialDesign="foundry">
      <SolarWidget showWeather showFlag />
      {process.env.NODE_ENV === 'development' && (
        <SolarDevTools position="bottom-center" />
      )}
    </SolarThemeProvider>
  );
}
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `defaultOpen` | `boolean` | `false` | Start expanded |
| `position` | `'bottom-left' \| 'bottom-center' \| 'bottom-right'` | `'bottom-center'` | Pill position |
| `enabled` | `boolean` | `true` | Programmatic enable/disable |

---

## useSolarTheme

```tsx
import { useSolarTheme } from '@qodin-co/sol';

function DebugPanel() {
  const { phase, timezone, latitude, longitude, design } = useSolarTheme();
  return (
    <pre>{JSON.stringify({ phase, timezone, latitude, longitude, design }, null, 2)}</pre>
  );
}
```

### Return shape

| Property | Type | Description |
|---|---|---|
| `phase` | `SolarPhase` | Current active phase |
| `blend` | `SolarBlend` | Phase blend state (phase, nextPhase, t) |
| `isDaytime` | `boolean` | Whether the sun is above the horizon |
| `brightness` | `number` | 0–1 brightness value |
| `mode` | `'light' \| 'dim' \| 'dark'` | Current light mode |
| `accentColor` | `string` | Active accent hex |
| `timezone` | `string \| null` | Resolved timezone |
| `latitude` | `number \| null` | Resolved latitude |
| `longitude` | `number \| null` | Resolved longitude |
| `coordsReady` | `boolean` | Whether coordinates have resolved |
| `design` | `DesignMode` | Active skin name |
| `activeSkin` | `SkinDefinition` | Full skin definition object |
| `setOverridePhase` | `(phase \| null) => void` | Set/clear phase override |
| `setDesign` | `(skin: DesignMode) => void` | Change active skin |

---

## Multiple Widgets

```tsx
<SolarThemeProvider initialDesign="foundry">
  <SolarWidget showWeather />
  <CompactWidget design="signal" />
  <SolarWidget />
</SolarThemeProvider>
```

`CompactWidget` accepts a `design` prop to override per-instance. `SolarWidget` always follows the provider. The provider manages shared solar state — location, phase, and weather are computed once and shared across all children.

---

## TypeScript

```ts
import type {
  DesignMode,
  SolarPhase,
  SolarBlend,
  WeatherCategory,
  ExpandDirection,
  WidgetSize,
  CompactSize,
  SkinDefinition,
  WidgetPalette,
  SolarTheme,
} from '@qodin-co/sol';
```

---

## What's Included

| | |
|---|---|
| ✅ | Full widget + compact widget |
| ✅ | 10 skins with full + compact variants |
| ✅ | Solar math (NOAA equations, no external API) |
| ✅ | Timezone fallback logic |
| ✅ | Optional live weather (Open-Meteo) |
| ✅ | Skin-aware country flags |
| ✅ | Dev timeline scrubber |
| ✅ | Self-contained CSS (no Tailwind required in host app) |
| ✅ | SSR-safe (Next.js, Remix, TanStack Start, Blade, Vite) |
| ❌ | No solar API key needed |
| ❌ | No weather API key needed |
| ❌ | No Tailwind needed in your app |
| ❌ | No geolocation permission required |

---

## Coming Soon

Sol is actively being developed. Things in progress:

- **Seasonal theme system** — 4 seasons (Summer, Autumn, Winter, Spring) that blend automatically with the existing 9-phase system, computed from date and location with no configuration required
- More skins
- Vue and Svelte adapters
- Deep token override system

---

<div align="center">

MIT © [qodin](https://github.com/qodin-co)

</div>