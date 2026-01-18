# Technical Specification

## Architecture

**Unified Database System:**
- All Rankings: Supabase database (~50-200ms)
  - Player Rankings
  - Team Rankings
  - Race Rankings (PvZ, TvT, etc.)
  - Team Race Rankings (PT vs ZZ, etc.)

**Data Flow:**
- Normal: API reads all rankings from Supabase
- New Tournament: Scraper → JSON → `POST /api/admin/import-tournament` → Incremental processing
- Import: `node tools/import/importFromJSON.js` → Loads JSON → Seeds Season 1 → Imports to DB
- Recalculation: `POST /api/admin/recalculate` → Clears DB → Re-imports from JSON

## Database Schema

**Tables:**
- `tournaments` - Metadata (name, date, season, prize_pool, format)
- `players` - Stats (name, current_rating, current_confidence, matches, wins, losses)
- `teams` - Stats (player1_id, player2_id, team_key, current_rating, current_confidence, matches, wins, losses)
- `race_rankings` - Race matchup stats (race_matchup, current_rating, current_confidence, matches, wins, losses)
- `team_race_rankings` - Team race composition stats (team_race_matchup, current_rating, current_confidence, matches, wins, losses)
- `matches` - Results (tournament_id, match_id, round, date, team1_id, team2_id, scores, best_of)
- `rating_history` - Snapshots (entity_type, entity_id, match_id, rating_before, rating_after, rating_change, confidence)

**Key Points:**
- Season = YEAR(date)
- Player stats aggregated from teams
- Teams normalized (alphabetical player order)
- Complete rating history per match

## Ranking System

**Enhanced Elo:**
- Provisional K-factors: 80 → 48 → 40 → adaptive
- Dynamic confidence: 0-100%, adjusts K-factor
- Population-based adaptive rating scale

**Season 1 Seeding (Three-Pass):**
1. Pass 1: Forward chronological (all start at 0)
2. Pass 2: Backward chronological (all start at 0)
3. Pass 3: Forward with averaged Pass 1+2 ratings as seeds

Only Pass 3 ratings used. Season 2+ uses incremental updates.

## API Endpoints

**Rankings:**
- `GET /api/player-rankings` - From database
- `GET /api/team-rankings` - From database
- `GET /api/race-rankings` - From database
- `GET /api/team-race-rankings` - From database

**Admin:**
- `POST /api/admin/import-tournament` - Body: `{"filename": "tournament.json"}`
- `POST /api/admin/recalculate` - Clears DB, re-runs recalculation

## Scraper Data

**Source:** MediaWiki API (`https://liquipedia.net/starcraft2/api.php`), 1 req/2s

**Match Structure:**
```json
{
  "match_id": "R1M1",
  "tournament_slug": "UThermal_2v2_Circuit/1",
  "round": "Round of 16",
  "team1": {"player1": {"name": "trigger", "race": "Protoss"}, "player2": {"name": "Clem", "race": "Terran"}},
  "team2": {"player1": {"name": "Viper", "race": "Zerg"}, "player2": {"name": "CaptainSam", "race": "Zerg"}},
  "team1_score": 2, "team2_score": 0, "best_of": 3
}
```

**Key Points:**
- Teams are dynamic (each player combo is unique team)
- Players stored alphabetically
- Races not extracted (manual entry via UI)
- Supports: Single/Double elimination, Group stages

## File Structure

**Core:**
- `lib/supabase.js` - DB client
- `api/server.js` - Express API
- `tools/ranking/` - Core ranking logic (rankingCalculations.js, rankingUtils.js)
- `tools/database/` - Database operations (databaseRankingEngine.js, databaseSeeding.js, importMatchesOnly.js)
- `tools/import/` - JSON → Database import (importFromJSON.js, runSeededRankings.js)
- `tools/recalculation/` - Full recalculation (recalculateAllRankings.js)
- `tools/scraping/` - Tournament scraper (scraper.js)
