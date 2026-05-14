# SC2 2v2 Stats - StarCraft 2 2v2 Ranking System

A tournament analysis platform for StarCraft 2 2v2 tournaments that scrapes data from Liquipedia and provides Elo-style ratings with a modern React web interface.

## Overview

This project scrapes tournament data from Liquipedia using the **MediaWiki API**, extracts match results, and computes player/team ratings from the full match history. The scraper focuses on reliable data extraction (matches, rounds, scores, players), with player races added manually through the UI.

## Key Design Decisions

- ✅ **Manual URL input**: Users provide Liquipedia tournament URLs
- ✅ **MediaWiki API**: Direct API access (not using npm packages)
- ✅ **Simplified scraper**: Extracts matches, rounds, scores, and players reliably
- ✅ **Manual race entry**: Player races are added/edited manually in the UI (more reliable than automated extraction)
- ✅ **JSON storage**: All tournament data stored as JSON files in `output/`
- ✅ **Stateless API**: Rankings computed on-demand from JSON files — no database required

## Technology Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS + Radix UI components
- Recharts for rating progression charts

### Backend
- **API Server** — Express.js server computing and serving rankings from JSON files
- **MediaWiki API** — Direct API calls to Liquipedia for scraping
- Deployed on Vercel (API as serverless function, output/ files bundled)

## Data Flow

```
Liquipedia URL → MediaWiki API → Wikitext Parser → JSON Export → Express API → React Frontend
```

## Getting Started

### Installation
```bash
npm install
```

### Running the Application

You need to run two servers:

1. **API Server** (in one terminal):
```bash
npm run api
```
This starts the API server on `http://localhost:3002` and serves tournament JSON files.

2. **Frontend Dev Server** (in another terminal):
```bash
npm run dev
```
This starts the Vite dev server (usually on `http://localhost:5173`).

By default, Vite proxies `/api` requests to `http://localhost:3002`. If you run the API on a different `PORT`, update the proxy target in `vite.config.ts` to match.

### Scraper
```bash
# Run scraper with a Liquipedia tournament URL
node tools/scraper.js <liquipedia-url>

# Example:
node tools/scraper.js https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/1

# Output: JSON file saved to output/ directory
```

### Using the UI

1. Run the scraper to generate tournament JSON files in the `output/` directory
2. Start both the API server (`npm run api`) and frontend dev server (`npm run dev`)
3. Open the frontend URL (usually `http://localhost:5173`)
4. **Rankings** — Browse player, team, race, and team race combo rankings with filters for season, circuit, confidence, and race
5. **Tournament Editor** — Select a tournament, view brackets/group stages, click matches to edit races and scores, then download the updated JSON
6. **Player / Team Details** — View rating progression charts, match history, and race-specific matchup stats
7. **Match Predictor** — Enter two teams for real-time series win probability breakdown
8. **Player Manager** (localhost only) — Assign races, country flags, merge duplicate names

## Features

### Rankings & Ratings
- **Player Rankings** — Individual Elo-style ratings with rank changes, confidence, and season/circuit filters
- **Team Rankings** — 2v2 team ratings with intermediate blend weight (smooth transition from player-average to standalone team rating)
- **Race Rankings** — Per-matchup win rates and rating changes (PvZ, TvT, etc.)
- **Team Race Rankings** — Race combo rankings for 2v2 (PP vs TZ, etc.)
- **Seeded Rankings** — 3-pass initialization (forward → backward → seeded forward) for better cold-start accuracy

### Analysis
- **Player / Team Detail Pages** — Rating over time chart, full match history with per-match rating impact, race matchup breakdown
- **Match Predictor** — Live win probability with series outcome distribution (e.g. 3-0, 2-1, 1-2, 0-3)
- **Highlights** — Top upsets, biggest rating gainers, peak ratings, filtered by race/combo
- **Prediction Quality** — Calibration metrics: Brier score, log loss, ECE, confidence buckets, upset tracking
- **Map Coverage** — Recording statistics per tournament showing % of matches with map data

### Tournament Management
- **Scraper** — Extracts brackets (single/double elimination) and group stages from Liquipedia
- **Tournament Editor** — Compact bracket display with inline race/score editing, auto-saves to JSON
- **Player Manager** — Levenshtein-distance similar name detection, batch race/flag assignment, name merging

## Scraper Data Output

The scraper extracts the following data reliably:
- **Tournament metadata**: Name, date, prize pool, format, maps
- **Bracket matches**: Round, match ID, teams (player pairs), scores, best-of format, date, individual games/maps
- **Group stage matches**: Extracted from Matchlist templates, grouped by group name (Group A, Group B, etc.)

**Note**: Player races are not extracted automatically — they can be set and edited in the UI.

## Rating System

Elo-style ratings with a three-layer K-factor:

1. **Base Newness K** — Higher early on for fast initial calibration, decreases with match count.
2. **Confidence Multiplier** — Low combined confidence dampens updates; high confidence amplifies them.
3. **New Opponent Protection** — Moderates large swings when facing very new opponents (moderated further when both sides are new so early movement still occurs).

**Intermediate Team Rating**: New teams start from a blend of individual player ratings that fades toward a standalone team rating as the team accumulates matches (`weight = max(0, (fadeMatches - teamMatches) / fadeMatches)`).

**Seeded Rankings**: A 3-pass process (forward → backward → seeded forward) produces better initial ratings for players/teams with few early matches.

## Documentation

- [Data Specification](docs/data-specification.md) - Data structure and requirements

## Future Ideas

- Show player/team rating at time of match in match histories (requires per-match rating snapshots)
