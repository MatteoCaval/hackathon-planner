# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
npm install          # Install dependencies
npm run dev          # Vite dev server (localhost:5173)
npm run build        # TypeScript check + Vite production build (output: ./dist)
npm run preview      # Preview production build locally

# Docker
docker-compose up --build   # Serves on localhost:8080
```

There is no test framework or linter configured. TypeScript strict mode (`tsconfig.json`) is the primary code quality gate — `npm run build` will catch type errors.

## Architecture

**Client-side React 18 + TypeScript app** built with Vite. No backend — all data persists in browser localStorage with optional Firebase Realtime Database sync for trip sharing.

### Core Data Flow

- `App.tsx` (~900 lines) is the central orchestrator: manages all destination/settings state, localStorage persistence via custom `useLocalStorage` hook, and Firebase sync logic.
- State flows down from App → Sidebar + DestinationView. Child components call back to App to mutate state.
- `types.ts` defines the core data model: `Destination` contains `Flight[]`, `Accommodation[]`, `BudgetEstimatorState`, and coordinates.

### Key Architectural Patterns

- **useLocalStorage hook** (`src/useLocalStorage.ts`): Replaces external state management. Keys prefixed with `hackathon-`.
- **Firebase sync is optional**: App works fully offline. When a trip code is entered, data syncs to `trips/{tripCode}/` in Firebase RTDB with 15-second polling for remote changes. Conflict resolution is last-write-wins.
- **Data normalization**: App.tsx contains extensive validation/migration functions that handle legacy data formats and ensure type safety at runtime.
- **Hash-based tab routing**: DestinationView uses URL hash (`#overview`, `#flights`, `#stay`, `#budget`) for workspace tabs.
- **Nominatim geocoding**: AddDestinationModal queries OpenStreetMap's Nominatim API for lat/lng autocomplete.
- **URL autofill** (`src/utils/urlAutofill.ts`): Parses booking URLs (Skyscanner, Booking.com, etc.) to extract dates/prices.

### Component Structure

```
App (state owner, sync logic)
├── Navbar (settings, trip code, sync controls)
├── Sidebar (destination list, search, add/remove)
└── DestinationView (tabbed workspace for active destination)
    ├── MapComponent (Leaflet map: Dublin → destination route)
    ├── FlightManager (CRUD flights)
    ├── AccommodationManager (CRUD accommodations)
    ├── BudgetCalculator (budget math, attempt history)
    └── DataPersistence + PersistentBudgetStatus
```

### Budget Calculation

`src/utils/budget.ts` contains `calculateBudgetSnapshot()` — the core calculation engine that computes total cost, per-person cost, and remaining budget from selected flights/accommodations/extra costs. `formatCurrency()` uses EUR (en-IE locale, no decimals).

### Environment Variables

Firebase config vars (all optional, prefixed `VITE_`): see `.env.example`. App degrades gracefully without them — trip sharing is simply disabled.

### Feature Tracking

See [`FEATURES.md`](./FEATURES.md) for planned, in-progress, and completed feature ideas.

### Deployment

GitHub Actions (`.github/workflows/deploy.yml`) deploys to GitHub Pages on push to `main`. Firebase env vars come from GitHub Actions secrets/vars. The hardcoded origin point for all maps is Dublin (`DUBLIN_COORDS` in `types.ts`).
