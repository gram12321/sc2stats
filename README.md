# SC2 2v2 Stats - StarCraft 2 2v2 Ranking System

Tournament analysis platform that scrapes Liquipedia data and provides rankings via React UI.

## Quick Start
This project scrapes tournament data from Liquipedia using the **MediaWiki API**, extracts match results, and stores them in JSON format for analysis and visualization. The 
scraper focuses on reliable data extraction (matches, rounds, scores, players), with player races added manually through the UI.

## Key Design Decisions

- ✅ **Manual URL input**: Users provide Liquipedia tournament URLs
- ✅ **MediaWiki API**: Direct API access (not using npm packages)
- ✅ **Simplified scraper**: Extracts matches, rounds, scores, and players reliably
- ✅ **Manual race entry**: Player races are added/edited manually in the UI (more reliable than automated extraction)
- ✅ **JSON export**: Data exported for review and import
- ✅ **Database persistence**: Rankings stored in Supabase for fast access
```bash
npm install



# Apply schema: supabase/migrations/001_initial_schema.sql
# Then run:
node tools/recalculation/recalculateRankings.js

# Run servers:
npm run api    # Port 3001
npm run dev    # Port 5173
```

## Usage

**Scraper:**
```bash
node tools/scraping/scraper.js <liquipedia-url>
```

## Ranking System

Enhanced Elo-based ranking system with Supabase database persistence. Rankings are calculated incrementally as new tournaments are added, with full rating history stored for 
every match.

**Key Features:**
- Provisional K-factors for new players/teams (80 → 48 → 40 → adaptive)
- Dynamic confidence tracking (0-100%)
- Population-based adaptive rating scale
- Season 1 (2025) initialized with three-pass seeding
- Incremental updates for new tournaments
- Complete rating history for match-level analysis

**Admin:**
```bash
# Import tournament
curl -X POST http://localhost:3001/api/admin/import-tournament \
  -H "Content-Type: application/json" -d '{"filename": "tournament.json"}'
## System Architecture

### Architecture Overview

The system uses a unified database architecture:
- **All Rankings**: Stored in Supabase database (fast, persistent, ~50-200ms)
  - Player Rankings
  - Team Rankings
  - Race Rankings (e.g., PvZ, TvT)
  - Team Race Rankings (e.g., PT vs ZZ)

### Data Flow

**Normal Operation:**
- API reads all rankings from Supabase database

**Adding New Tournament:**
1. Scraper creates tournament JSON → `output/tournament.json`
2. Admin calls `POST /api/admin/import-tournament`
3. System processes matches incrementally
4. Updates all ranking types in database (player, team, race, team-race)
5. Stores rating history

**Initial Import (from JSON to Database):**
1. Run `node tools/import/importFromJSON.js`
2. Loads all tournament JSON files
3. Detects Season 1 (2025) and runs three-pass seeding
4. Imports seeded ratings
5. Processes Season 2+ matches incrementally

**Recalculation (rebuild from scratch):**
1. Admin calls `POST /api/admin/recalculate` OR run `node tools/recalculation/recalculateAllRankings.js`
2. Clears all database rankings
3. Re-runs import process from JSON files

### Database Schema

**Tables:**
- `tournaments` - Tournament metadata (name, date, season, prize_pool, format)
- `players` - Player stats (name, current_rating, current_confidence, matches, wins, losses)
- `teams` - Team stats (player1_id, player2_id, team_key, current_rating, current_confidence, matches, wins, losses)
- `race_rankings` - Race matchup stats (race_matchup, current_rating, current_confidence, matches, wins, losses)
- `team_race_rankings` - Team race composition stats (team_race_matchup, current_rating, current_confidence, matches, wins, losses)
- `matches` - Match results (tournament_id, match_id, round, date, team1_id, team2_id, scores, best_of)
- `rating_history` - Historical rating snapshots (entity_type, entity_id, match_id, rating_before, rating_after, rating_change, confidence)

**Key Points:**
- Seasons are auto-computed from tournament dates (Season = YEAR(date))
- Player stats are aggregated from team performances
- Teams are normalized (players stored alphabetically)
- Complete rating history stored for every match


### Season 1 Seeding System (Three-Pass Algorithm)

**⚠️ IMPORTANT: Pass 3 IS the actual Season 1 run, not just "seeding"!**

Season 1 (2025) uses a three-pass algorithm to solve the cold-start problem where all players start with rating 0. Without this, early matches would give too many/too few points because everyone starts equal.

**The Three Passes:**

1. **Pass 1 (Forward)**: Process ALL Season 1 matches chronologically (everyone starts at 0)
   - Purpose: Get preliminary rating estimates
   - Problem: Early matches have outsized impact (all equal at start)
   - Result: DISCARD after Pass 2

2. **Pass 2 (Backward)**: Process ALL Season 1 matches in REVERSE (everyone starts at 0)
   - Purpose: Get alternative rating estimates (reduces order bias)
   - Problem: Still has order bias, just reversed
   - Result: DISCARD after averaging with Pass 1

3. **Pass 3 (Seeded Forward)**: Process ALL Season 1 matches chronologically AGAIN
   - Starting Point: averaged(Pass1, Pass2) ratings as initial values
   - **THIS IS THE ACTUAL SEASON 1 RUN** - not a "seeding run"
   - Tracks full rating history for every match
   - Result: **KEEP as final Season 1 ratings**

**Critical Understanding:**
- Passes 1 and 2 are ONLY used to calculate better starting values for Pass 3
- Pass 3 processes ALL Season 1 matches from those starting values
- Pass 3 ratings ARE the final Season 1 ratings - no further processing
- We do NOT process matches again after Pass 3 (that would count them twice!)

**When Used:**
- Season 1 (2025): Three-pass algorithm during initial import
- Season 2+ (2026+): No seeding - incremental updates from Season 1 baseline
# Recalculate
curl -X POST http://localhost:3001/api/admin/recalculate
```

## Features

- ✅ Scraper: Extracts matches from Liquipedia (single/double elimination, group stages)
- ✅ Database: Supabase PostgreSQL for persistent rankings
- ✅ Ranking: Enhanced Elo with three-pass seeding for Season 1
- ✅ UI: React app with bracket view and match editing

## API Endpoints

- `GET /api/player-rankings` - Player rankings (database)
- `GET /api/team-rankings` - Team rankings (database)
- `GET /api/race-rankings` - Race rankings (on-demand)
- `POST /api/admin/import-tournament` - Import tournament
- `POST /api/admin/recalculate` - Full recalculation

## Documentation

See [TECHNICAL.md](TECHNICAL.md) for architecture, database schema, ranking algorithm, and API details.
