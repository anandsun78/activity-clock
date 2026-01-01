# activity-clock

TypeScript-first rebuild of the Activity Clock and Habit Tracker with Netlify serverless APIs. The UI uses a dark, gradient-forward look with a compact navigation bar that switches between the two core tools.

## Stack
- React 18 + TypeScript, React Router 6
- Create React App build tooling
- Netlify Functions (TypeScript) + MongoDB via mongoose

## App structure
- `src/index.tsx` — entry point with global styling.
- `src/App.tsx` — router and navigation shell.
- `src/components/ActivityClock.tsx` — orchestrates activity logging, trends, and daily analytics.
- `src/components/activity/*` — Activity Clock sections (logger, summaries, charts, sessions).
- `src/components/HabitTracker.tsx` — assembles habit tracking UI and computed stats.
- `src/components/habitTracker/*` — Habit Tracker sections, constants, and hooks.
- `src/dateUtils.ts` — Edmonton-aware date helpers shared across features.
- `netlify/functions/*` — API endpoints for habits, activity names/logs, and auth.

## Scripts
- `npm start` — run the CRA dev server.
- `npm test` — run the CRA test runner (if added).
- `npm run build` — production build.

## Deployment
Netlify-ready via `netlify.toml`. Functions are bundled from `netlify/functions` with `esbuild` and proxied under `/api/*`.
