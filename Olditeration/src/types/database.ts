export interface Tournament {
  id: string
  liquipedia_slug: string
  name: string
  start_date?: string
  end_date?: string
  prize_pool?: number
  location?: string
  status: 'upcoming' | 'ongoing' | 'completed' | 'cancelled'
  created_at: string
  updated_at: string
}

export interface Player {
  id: string
  liquipedia_slug: string
  name: string
  nationality?: string
  preferred_race?: string
  created_at: string
  updated_at: string
}

export interface Team {
  id: string
  name: string
  player1_id: string
  player2_id: string
  created_at: string
  updated_at: string
  // Joined data
  player1?: Player
  player2?: Player
}

export interface Match {
  id: string
  tournament_id: string
  match_id: string
  team1_id: string
  team2_id: string
  winner_id?: string
  best_of: number
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled'
  match_date?: string
  created_at: string
  updated_at: string
  // Score fields from database
  team1_score?: number
  team2_score?: number
  // Calculated fields
  score?: string
  // Joined data
  tournament?: Tournament
  team1?: Team
  team2?: Team
  winner?: Team
  games?: Game[]
}

export interface Game {
  id: string
  match_id: string
  game_number: number
  map_name: string
  winner_id?: string
  duration_seconds?: number
  created_at: string
  // Joined data
  match?: Match
  winner?: Team
}

// Statistics and aggregated data types
export interface TournamentStats {
  tournament: Tournament
  total_matches: number
  total_games: number
  unique_players: number
  unique_teams: number
  avg_games_per_match: number
}

export interface PlayerStats {
  player_name: string
  nationality?: string
  preferred_race?: string
  total_matches: number
  wins: number
  losses: number
  win_percentage: number
  teammates: string
}

export interface TeamStats {
  team: Team
  tournaments_played: number
  total_matches: number
  matches_won: number
  total_games: number
  games_won: number
  win_rate: number
  favorite_maps: string[]
}

// API Response types
export interface ApiResponse<T> {
  data: T
  error?: string
}

export interface PaginatedResponse<T> {
  data: T[]
  count: number
  page: number
  per_page: number
  total_pages: number
}
