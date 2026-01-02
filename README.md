# activity-clock

A productivity timer to track every second of the day to see how time is being used. The UI has both a dark 
and light mode.

## Stack
- React 18 + TypeScript, React Router 6
- Netlify Functions (TypeScript) + MongoDB via mongoose

## App structure
- `src/index.tsx` — entry point with global styling.
- `src/App.tsx` — router and navigation shell.
- `src/components/ActivityClock.tsx` — orchestrates activity logging, trends, and daily analytics.
- `src/components/activity/*` — Activity Clock sections (logger, summaries, charts, sessions).
- `src/components/HabitTracker.tsx` — assembles habit tracking UI and computed stats.
- `src/components/habitTracker/*` — Habit Tracker sections, constants, and hooks.
- `src/dateUtils.ts` — Location aware date helpers shared across features.
- `netlify/functions/*` — API endpoints for habits, activity names/logs, and auth.

## Scripts
- `npm start` — run the CRA dev server.
- `npm test` — run the CRA test runner (if added).
- `npm run build` — production build.

## Deployment
Netlify-ready via `netlify.toml`. Functions are bundled from `netlify/functions` with `esbuild` and proxied under `/api/*`.
