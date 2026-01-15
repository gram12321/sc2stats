# SC2 2v2 Stats Database Schema

## Current Data Volume
- **Tournaments**: 12 | **Players**: 110 | **Teams**: 117 | **Matches**: 199 | **Games**: 5,222

## Table Structure

### `tournaments`
- `id` (UUID, PK), `liquipedia_slug` (VARCHAR, unique), `name`, `start_date`, `end_date`, `status`, `prize_pool`, `location`

### `players` 
- `id` (UUID, PK), `liquipedia_slug` (VARCHAR, unique), `name`, `nationality`, `preferred_race`

### `teams`
- `id` (UUID, PK), `name`, `player1_id` (FK), `player2_id` (FK)
- Unique constraint: `(player1_id, player2_id)`

### `matches`
- `id` (UUID, PK), `tournament_id` (FK), `match_id` (VARCHAR, unique), `team1_id` (FK), `team2_id` (FK), `winner_id` (FK), `best_of`, `status`, `match_date`

### `games`
- `id` (UUID, PK), `match_id` (FK), `game_number`, `map_name`, `winner_id` (FK), `duration_seconds`

## Key Relationships
```
tournaments 1:n matches
players 2:1 teams  
teams 1:n matches (as team1, team2, winner)
matches 1:n games
teams 1:n games (as winner)
```

## Available Functions
- `get_player_statistics()` - Returns player stats with wins/losses/teammates

## Data Quality Notes
- `nationality`, `preferred_race` often NULL
- `duration_seconds` inconsistently available
- Tournament `status` may need updates

## Access Pattern
- Frontend: React + Supabase client with real-time subscriptions
- Backend: Supabase PostgreSQL with RPC functions
