# SC2 2v2 Stats - Data Specification

## Overview

This document describes the data structure and extraction approach for the SC2 2v2 tournament scraper. The scraper extracts match data from Liquipedia using the **MediaWiki API** and outputs structured JSON. Player races are managed separately through the UI and stored in `player_defaults.json`.

## Data Source: MediaWiki API

- **Endpoint**: `https://liquipedia.net/starcraft2/api.php`
- **Method**: `action=query` with `prop=revisions` to fetch raw wikitext
- **Rate Limit**: 1 request per 2 seconds

## Core Data: Match Results

### Required Match Data

Each match includes:

1. **Team 1 & Team 2**:
   - Player 1 name and race (if available)
   - Player 2 name and race (if available)

2. **Round/Stage**: Round name (e.g., "Round of 16", "Quarterfinals", "Semifinals", "Grand Final", "Group A", "Group B")

3. **Results**: Team scores and winner (derived from scores)

4. **Match Metadata** (if available):
   - Best of format (Bo3, Bo5, etc.)
   - Date and time
   - Individual map results (for later rounds)

## Critical: Dynamic Teams

**Important**: Teams are NOT fixed entities. Each player combination is a unique team.

- `MaxPax + Spirit` is a **different team** than `MaxPax + Clem`
- Players can swap partners during a tournament
- Teams are normalized: players stored alphabetically for consistency

## Data Structure

### Match Object
```json
{
  "match_id": "R1M1",
  "tournament_slug": "UThermal_2v2_Circuit/1",
  "round": "Round of 16",
  "team1": {
    "player1": {
      "name": "trigger",
      "race": "Protoss"
    },
    "player2": {
      "name": "Clem",
      "race": "Terran"
    }
  },
  "team2": {
    "player1": {
      "name": "Viper",
      "race": "Zerg"
    },
    "player2": {
      "name": "CaptainSam",
      "race": "Zerg"
    }
  },
  "team1_score": 2,
  "team2_score": 0,
  "best_of": 3,
  "date": null,
  "games": []
}
```

### Tournament Object
```json
{
  "tournament": {
    "name": "uThermal 2v2 Circuit: January 2025",
    "liquipedia_slug": "UThermal_2v2_Circuit/1",
    "date": "2025-01-07",
    "prize_pool": 1300,
    "format": "2v2 Playoffs",
    "maps": ["Arctic Flowers", "Breakwater", ...]
  },
  "matches": [...]
}
```

## Data Availability

### ✅ Always Available:
- Player names (from `{{2Opponent}}` template)
- Match scores
- Round information
- Best of format

### ⚠️ Sometimes Available:
- Match dates/times (usually only for later rounds)
- Individual map results (usually only semifinals and finals)

### ❌ Not Extracted (Manual Entry):
- **Player races**: Not extracted automatically. Races are added manually through the UI or set as player defaults.

### ❌ Not Available:
- Game duration
- Detailed player statistics per match

## Wikitext Templates

### Tournament Infobox
```
{{Infobox league
||name=...
||date=...
||prizepool=...
||format=...
||map1=...|map2=...
}}
```

### Match Template (Bracket Matches)
```
{{Match|bestof=3
|opponent1={{2Opponent|p1=Player1|p2=Player2|score=2}}
|opponent2={{2Opponent|p1=Player1|p2=Player2|score=0}}
|map1={{Map|map=MapName|winner=1}}
|date=2025-01-07 20:00 CET
}}
```

### Matchlist Template (Group Stage Matches)
```
{{Matchlist
|id=UNIQUE_ID
|title=Group A Matches
|M1={{Match|bestof=3|opponent1={{2Opponent|p1=Player1|p2=Player2|score=2}}|opponent2={{2Opponent|p1=Player1|p2=Player2|score=0}}}}
|M2={{Match|...}}
}}
```

### Team Template (2Opponent)
```
{{2Opponent|p1=Player1|p2=Player2|score=X}}
```

**Note**: Race parameters (`p1race`, `p2race`) may exist in wikitext but are not extracted by the scraper.

## Race Data Management

**Note**: Player races are **not** extracted automatically by the scraper. This is by design for reliability and speed.

Race information is managed through:
1. **Player Defaults**: Set default races for players in the Player Manager UI
2. **Manual Entry**: Edit races directly in match data through the tournament bracket view
3. **Storage**: Player defaults are stored in `output/player_defaults.json`

The UI automatically applies player defaults when editing matches if no race is set in the match data.

## Team Normalization

1. **Player Order**: Always store players alphabetically by name
   - `["Clem", "trigger"]` → `["trigger", "Clem"]`

2. **Race Mapping**: When sorting players, races are correctly mapped to the sorted order

3. **Case Sensitivity**: Preserve original case from Liquipedia

## Score Calculation

Scores are extracted using two methods:

1. **Direct extraction**: From `|score=` parameter in `{{2Opponent}}` template (early rounds)
2. **Calculated from games**: Count wins from `{{Map}}` templates when direct scores are missing (later rounds)

Scores can be manually edited through the Match Editor UI if the scraper missed or incorrectly extracted them.

## Tournament Formats Supported

### Single-Elimination
- Standard bracket format with rounds: Round of 16, Quarterfinals, Semifinals, Grand Final
- Matches extracted from `{{Bracket}}` template

### Double-Elimination
- Upper bracket and lower bracket separated
- Lower bracket rounds identified by "Lower Bracket" in round name
- Grand Final displayed separately

### Group Stage / Round Robin
- Matches extracted from `{{Matchlist}}` templates
- Group names detected from context (Group A, Group B, etc.)
- Match IDs prefixed with `GS_` (Group Stage) to avoid conflicts
- Can be combined with playoff brackets in same tournament

## Export Format

JSON structure as shown above. Data is saved to `output/<tournament_slug>.json`.

## Ranking System Data

Enhanced Elo-based ranking system calculates ratings for players, teams, races, and team-race combinations. Rankings include points (Elo-based rating), matches, wins/losses, and confidence (prediction accuracy 0-100%).

**Ranking Types:**
- **Player Rankings**: Individual player performance
- **Team Rankings**: 2v2 team performance (normalized: players stored alphabetically)
- **Race Rankings**: Race matchup ratings (PvT, TvZ, etc.) with zero-sum system
- **Team Race Rankings**: Team race combination ratings (PPvTT, etc.)

**Features:**
- Provisional K-factors (higher for new players/teams: 80 → 48 → 40 → adaptive)
- Dynamic confidence tracking with adaptive K-factor adjustments
- Population-based rating scale (adapts to skill distribution)
- Seeded rankings for Season 1 (three-pass process via `node tools/runSeededRankings.js`)

Rankings are calculated on-demand via API endpoints. Seeded rankings saved to `output/seeded_player_rankings.json` and `output/seeded_team_rankings.json`.