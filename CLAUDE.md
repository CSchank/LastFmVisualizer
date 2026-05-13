# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Vite dev server (do NOT auto-start when iterating — the user runs it)
npm run build     # tsc && vite build
npm run preview   # serve the production build
npx tsc --noEmit  # type-check only; run this after every non-trivial change to verify
```

There is no test runner and no linter configured. Type-checking (`npx tsc --noEmit`) is the only automated quality gate — it must exit cleanly before reporting a task as done.

## Architecture overview

A purely client-side React SPA that pulls the user's Last.fm play history into IndexedDB (via Dexie) and renders a growing set of visualizations on top of it. No backend.

### Per-account IndexedDB namespacing
Each Last.fm account gets its own Dexie database, `LastFmVisualizer_${username}`. `getDb(username)` (in `src/db/index.ts`) returns a memoized handle. The global API key lives in `localStorage` under `lastfm_api_key`; the accounts list lives under `lastfm_accounts` with the active one under `lastfm_active_account`. Switching accounts triggers a re-mount via the `useScrobbles(username, refreshKey)` hook. **Never share a database between accounts.**

The Dexie schema is **versioned** — when you change the schema, add a new `this.version(N).stores(...)` block. Don't mutate existing version blocks.

### Sync pipeline (`src/sync/sync.ts`)
Two-phase, resumable:
1. **Forward sync** — fetches scrobbles newer than the latest stored timestamp.
2. **Historical backfill** — if `historicalSyncComplete` flag is not set in `syncState`, walks backwards from the earliest stored timestamp. Resumes from `earliestTimestamp` after interruption.

Both phases respect Last.fm's rate limits via a small delay between pages. Progress is reported through a `SyncProgress` callback so the Header can render a progress bar.

### Artist-image backfill (`src/api/artistImages.ts`)
Separate, opt-in pipeline: scans every unique artist in `scrobbles`, fetches a hero image via Last.fm's `artist.getInfo`, caches in the `artistImages` table. Uses an in-memory `memCache` + `inflight` map to deduplicate concurrent requests for the same artist within a session. Cancellable via `AbortController` — store the controller in a ref so the Header's "Stop" button can abort.

### Visualization registry (`src/visualizations/registry.ts`)
Every viz is a React component that conforms to `VizProps`:
```ts
{ scrobbles, splitCollabs, onNavigate?, pinned?, onTogglePin? }
```
To add a new viz: write the component, import it in `registry.ts`, push a `{ id, label, description, component }` into the `VISUALIZATIONS` array, and add a matching SVG icon to the `ICONS` map in `src/visualizations/AllViews.tsx`. The "All Views" entry (id `'all'`) is always present in the sidebar regardless of pin state.

The **All Views** page is the landing view — it's a grid of cards, one per viz, with pin/unpin bookmark icons. Pinned views show in the sidebar (persisted in `localStorage` under `lastfm_pinned_views`).

### The split-collabs convention
`src/utils/artists.ts` exposes `splitArtists(artist, raw)` and `buildRawArtistSet(scrobbles)`. The `splitCollabs` boolean is a **global toggle** owned by `App.tsx` and threaded into every viz via `VizProps`. When true, viz logic should expand `"X feat. Y & Z"` into `[X, Y, Z]` for counting. The split function uses the raw artist set to protect band names like `"Iron & Wine"` from being split — never split without passing `raw`.

### EntityTimeline pattern
`src/visualizations/EntityTimeline.tsx` is a shared component powering Artist/Album/Track Timeline. It exports a 30-color `PALETTE` constant that other viz files reuse. The Artist/Album/Track Timeline wrappers are thin — they just pass `dimension` and `title` into `EntityTimeline`.

### Identifiers with disambiguating context
For albums and tracks, `entityKey` joins the title and artist with `\x00` as a separator: `"Album\x00Artist"`. This disambiguates same-titled tracks across artists. `displayName` splits it back into `"Album — Artist"`. Use this pattern consistently when keying maps for albums/tracks.

### Date handling gotcha
`new Date('2026-05-01')` parses as **UTC midnight**, which displays as the *previous day* in negative-UTC timezones. Always append a time when parsing dates from `'yyyy-MM-dd'` strings: `new Date(key + 'T12:00:00')`. Several viz files have learned this the hard way.

### Smooth animations (Artist Race)
`src/visualizations/ArtistRace.tsx` is the bar-race animation. It works because **Phase 1 uses `useLayoutEffect`** (not `useEffect`) to set positions before paint, **Phase 2 uses a single rAF** to slide entrants in after paint, and **the bars array preserves insertion order** — only `rank` (which drives `top` via CSS transition) changes, never the array index. Don't sort the bars array by rank; that re-orders DOM nodes and resets transitions, causing visible jumps.

### Setup flow
`src/components/SetupFlow.tsx` is shown when no API key is saved, no active account is selected, or the user explicitly clicks "Add account" in the Header dropdown. It's gated in `App.tsx` before the main UI renders.

## Conventions

- **Tailwind only** — no CSS modules, no styled-components. The visual language uses red-500 for primary actions, gray-100/200/600/800 for neutrals, and rounded-lg/xl shapes.
- **No comments unless the *why* is non-obvious.** The codebase deliberately keeps comments sparse; well-named identifiers carry the load.
- **Dependencies are heavy by design** — Chart.js, d3-shape, d3-force, Dexie, date-fns. New visualizations should reuse what's already installed before pulling in a new chart library.
- **VizProps must stay backwards-compatible.** Adding a new optional field is fine. Renaming or removing one breaks every viz.
