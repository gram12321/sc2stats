# SC2 2v2 Stats - Data Specification

## Overview

This document describes the data structure and extraction approach for the SC2 2v2 tournament scraper. The scraper extracts match data from Liquipedia using the **MediaWiki API** and outputs structured JSON.

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

2. **Round/Stage**: Round name (e.g., "Round of 16", "Quarterfinals", "Semifinals", "Grand Final")

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
- **Player races**: Extracted from "Notable Participating Teams" section (single-letter codes: `t`=Terran, `z`=Zerg, `p`=Protoss)
- Match dates/times (usually only for later rounds)
- Individual map results (usually only semifinals and finals)

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

### Match Template
```
{{Match|bestof=3
|opponent1={{2Opponent|p1=Player1|p2=Player2|score=2}}
|opponent2={{2Opponent|p1=Player1|p2=Player2|score=0}}
|map1={{Map|map=MapName|winner=1}}
|date=2025-01-07 20:00 CET
}}
```

### Team Template (2Opponent)
```
{{2Opponent|p1=Player1|p2=Player2|score=X|p1race=t|p2race=z}}
```

**Race codes**: `t` = Terran, `z` = Zerg, `p` = Protoss

## Race Data Extraction

Race information is extracted from two sources:

1. **Direct from match brackets**: If `p1race`/`p2race` parameters exist in the `{{2Opponent}}` template
2. **From Notable Participating Teams**: A lookup map is built from the "Notable Participating Teams" section, which often contains race data not present in match brackets

The scraper:
- Extracts race data from the "Notable Participating Teams" section first
- Uses this lookup when parsing matches
- Falls back to direct race parameters if available in match brackets
- Converts single-letter codes (`t`, `z`, `p`) to full names (`Terran`, `Zerg`, `Protoss`)

## Team Normalization

1. **Player Order**: Always store players alphabetically by name
   - `["Clem", "trigger"]` → `["trigger", "Clem"]`

2. **Race Mapping**: When sorting players, races are correctly mapped to the sorted order

3. **Case Sensitivity**: Preserve original case from Liquipedia

## Score Calculation

Scores are extracted using two methods:

1. **Direct extraction**: From `|score=` parameter in `{{2Opponent}}` template (early rounds)
2. **Calculated from games**: Count wins from `{{Map}}` templates when direct scores are missing (later rounds)

See [score-calculation-explanation.md](score-calculation-explanation.md) for details.

## Export Format

JSON structure as shown above. Data is saved to `output/<tournament_slug>.json`.
