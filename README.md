# Last.fm Visualizer

A browser-based visualizer for your Last.fm listening history. Scrobble data is fetched from the Last.fm API, stored locally in IndexedDB, and rendered as a growing set of interactive visualizations — no server required.

## Features

25+ visualizations including:

- **Scrobble Calendar** — GitHub-style year heatmap with click-to-drill daily track lists
- **Artist Race** — animated bar chart race of your top artists over time
- **Streamgraph** — top artists as flowing ribbons over time
- **Listening DNA** — every day of your history as a barcode of taste
- **Artist / Album / Track Timeline** — plays per entity over time, line or stacked ribbon
- **Artist Network** — force-directed graph of co-listening relationships
- **Play Diversity** — Shannon entropy and uniqueness metrics per week/month/year
- **Scrobbles Timeline** — daily/weekly/monthly play counts with configurable moving average
- **Listening Heatmap** — when you listen, by hour of day and day of week
- **Top Charts** — top artists, albums, and tracks for any time range
- **Artist Discovery** — when you first heard each artist
- **Forgotten Favorites** — artists you used to love but stopped playing
- **Listening Sessions** — clusters of consecutive plays
- **Newest Releases** — latest albums from artists in your library
- **Seasonal Favorites**, **Year in Review**, **Era Explorer**, **Hidden Gems**, **Streaks & Milestones**, **Playlist Builder**, and more

All views are pinnable to the sidebar. A global "Split collabs" toggle expands featured-artist credits across all charts.

## Setup

1. Get a free Last.fm API key at [last.fm/api](https://www.last.fm/api/account/create)
2. Open the app and enter your API key + Last.fm username
3. Click **Sync All** to pull your full scrobble history into the browser
4. Explore your data — everything runs locally, nothing is sent to a server

## Development

```bash
npm install
npm run dev        # Vite dev server at http://localhost:5173
npm run build      # Type-check + production build
npm run preview    # Serve the production build locally
npx tsc --noEmit   # Type-check only
```

## Tech Stack

- [Vite](https://vitejs.dev/) + [React 18](https://react.dev/) + TypeScript
- [Dexie](https://dexie.org/) (IndexedDB wrapper) — per-account namespaced databases
- [Chart.js](https://www.chartjs.org/) + [react-chartjs-2](https://react-chartjs-2.js.org/)
- [d3-shape](https://d3js.org/d3-shape) + [d3-force](https://d3js.org/d3-force)
- [date-fns](https://date-fns.org/)
- [Tailwind CSS v3](https://tailwindcss.com/)
