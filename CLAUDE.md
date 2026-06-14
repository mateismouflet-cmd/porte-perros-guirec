# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

Web dashboard (in French) that predicts the opening/closing windows of the automatic tidal gate of the **Perros-Guirec** port in Brittany, France. All computation runs in the browser; the only server-side piece is the Vite proxy that forwards SHOM API calls (see below). UI strings, comments, and dates are in French (`date-fns/locale/fr`).

The actual application lives under `app/`. The repo root also contains research material (`info.md`, `plan.md`, `research/`) that captures the domain rules and API choices and is the authoritative source for the tide/gate math — read it before changing the engine.

## Commands

All commands run from `app/`:

```bash
npm install          # install deps
npm run dev          # vite dev server on port 3000
npm run build        # tsc -b && vite build  (typecheck + bundle to dist/)
npm run lint         # eslint .  (NOTE: has pre-existing style errors in the pages; don't aim for a clean run)
npm run preview      # serve the production build (port 4173, includes the SHOM proxy)
```

Vite 7 requires Node ≥ 20.19 for `npm run dev` (`crypto.hash`); `npm run build` works on older Node.
There is no test runner configured.

## Architecture

### Stack
React 19 + TypeScript + Vite 7, Tailwind 3.4 + shadcn/ui (style "new-york", base color slate, Lucide icons), `react-router-dom` v7 with **HashRouter** (`vite.config.ts` sets `base: './'`, so HashRouter is required for deep links to work). Charts via `recharts`, animations via `framer-motion`. Path alias `@/*` → `src/*`.

### Layout
```
app/src/
├── App.tsx                # HashRouter with two routes: "/" → Home, "/previsions" → Predictions
├── pages/Home.tsx         # "Aujourd'hui" — today's status, current height, next event, gate windows
├── pages/Predictions.tsx  # "Prévisions" — 7-day forecast view (real data via getTideDataForDates)
├── lib/tideEngine.ts      # ALL tide/gate logic — sources, parsing, windows, interpolation
├── components/            # Layout, Navbar, Footer + shadcn/ui primitives in components/ui/
└── hooks/use-mobile.ts
```

The two pages are intentionally monolithic and own their own sub-sections inline. Home fetches via `getTideDataForDate(date, pressureCorrection)`; Predictions via `getTideDataForDates(start, 7, 0)` (one batched SHOM request for the whole range).

### Tide engine (`src/lib/tideEngine.ts`)

Three data sources, tried in order; `TideData.source` ('shom' | 'openmeteo' | 'mock') tells the UI which one is live, and both pages show a warning banner when it isn't 'shom':

1. **SHOM (primary)** — official predictions for the principal port `PERROS-GUIREC_TRESTRAOU`, the same data as maree.shom.fr. Two endpoints per range: `spm/hlt` (PM/BM times, heights, **official coefficients**) and `spm/wl` (water-level curve, 288 points/day = 5-min step, referenced to the chart datum — the same reference as the gate thresholds). Times are requested with `utc=standard`, which returns **French legal time directly** (DST included — verified 2026-06-10 against maree.info and the capitainerie's published program; it is NOT UTC+1, do not add an offset). Parsed as browser-local time, which is correct for the app's French audience.
   - The API rejects calls whose `Referer` isn't `maree.shom.fr` and its WAF blocks non-browser clients (curl/python get 403 — don't conclude the API is down from a failed curl; test in the browser). Browsers can't spoof Referer, hence the **Vite proxy `/api/shom`** in `vite.config.ts` (configured for both `server` and `preview`) which injects the header. The API key in the proxy path is the public one embedded in maree.shom.fr's HTML (`hdmServiceUrl` field); if SHOM rotates it, fetch the new one from there.
   - Cached per-day in localStorage for 7 days (predictions are deterministic); a 5-min in-memory circuit breaker avoids hammering when the proxy is absent (e.g. pure static hosting).
2. **Open-Meteo Marine (fallback)** — `hourly=sea_level_height_msl` (the old `sea_surface_height` variable no longer exists). Heights are MSL-referenced and the model's phase is early at Perros, so a calibration measured against SHOM (June 2026, stable across coef 49→93) is applied: **+38 min on times, +5.9 m on heights**. PM/BM from parabolic refinement of hourly extrema; ±5 min / ±15 cm accuracy.
3. **Mock (last resort)** — one realistic hardcoded day, time-shifted.

Gate windows are computed by `calculateWindowsFromCurve()`: linear interpolation on the 5-min curve for the rising 7.33 m crossing and the rule-dependent closing. Pressure correction is a flat offset applied to events + curve before window computation. Atmospheric pressure comes from Open-Meteo Weather (`hourly=surface_pressure`, `timezone=Europe/Paris`).

Each `getTideDataForDate(date, …)` computes over [date−1, date+1] so windows spanning midnight and the UTC+1→local conversion are handled, then filters events/windows/curve to the local calendar day.

### Gate rules (Perros-Guirec port)

These are domain rules baked into `calculateWindowsFromCurve()`. Don't change them without checking `info.md`:

- **Open** when rising tide crosses **7.33 m**.
- **Close** depends on the high-water height (PM) and the tidal coefficient:
  - `PM > 7.6 m` and `coef < 70` → close at **7.60 m** on the descent.
  - `PM > 7.6 m` and `coef ≥ 70` → close at **8.00 m** on the descent (or at PM if PM < 8.0 m).
  - `PM ≤ 7.6 m` → close **at PM** (no descent threshold).
- Coefficient: the **official SHOM coefficient** (from `hlt`, attached to PM events as `TideEvent.coefficient`) is used whenever available. `calculateCoefficient()` is only the fallback approximation: semi-marnage / 4.3 × 100 (height unit calibrated on official coefficients, ±2 points).

### Important domain note

Per `info.md`: Perros-Guirec is its own SHOM principal port — the empirical "Brest × 1.05 + 0.10" correction often quoted online is **wrong**. Always work from Perros-Guirec data directly; never re-introduce a Brest-based correction.

### Theme

`tailwind.config.js` defines a custom dark "ocean" palette (`bg-primary`, `accent-teal #4ECDC4`, `status-open/closed/warning`, etc.) alongside the standard shadcn HSL tokens. New UI should reuse these named colors rather than hardcoding hex.

### Vite quirks

`vite.config.ts` registers `plugin-inspect-react-code` (`inspectAttr()`) before `@vitejs/plugin-react`. This injects element metadata in dev — keep it; don't remove unless you know what depends on it. It also holds the `/api/shom` proxy described above — deploying as pure static files (no proxy) silently degrades the app to the Open-Meteo fallback.
