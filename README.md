# Activity Clock - Productivity Timer

A productivity timer to track every second of the day to see how time is being used. There is also functionality to see streaks of daily habits such as waking up early, gym etc.

## Stack
- React 18 + TypeScript, React Router 6
- Netlify Functions (TypeScript) + MongoDB via mongoose
- Auth gate backed by Netlify Functions

## App structure
- `src/index.tsx` — entry point with global styling.
- `src/App.tsx` — router and navigation shell.
- `src/components/ActivityClock.tsx` — orchestrates activity logging, trends, and daily analytics.
- `src/components/activity/*` — Activity Clock sections (logger, summaries, charts, sessions).
- `src/components/HabitTracker.tsx` — assembles habit tracking UI and computed stats.
- `src/components/habitTracker/*` — Habit Tracker sections, constants, and hooks.
- `src/dateUtils.ts` — Location aware date helpers shared across features.
- `netlify/functions/*` — API endpoints for habits, activity names/logs, and auth.

## Getting Started
```bash
npm install
npm run build:functions
netlify dev
```

## Required ENV Vars/Setup:
Require a mongodb atlas account. Can get a free account from https://account.mongodb.com/
Require a nelify account (optional) for deployment.

Create a `.env` file in the project root:
```bash
APP_PASSWORD - password to access the site (for ex 4499)
APP_SESSION_SECRET - used along side the password can use any hash value here.
MONGODB_URI - the mongodb atlas uri (for ex: mongodb+srv://your_uri)
```

## Deployment
Netlify-ready via `netlify.toml`. Functions are bundled from `netlify/functions` with `esbuild` and proxied under `/api/*`.
