export type Race = 'Terran' | 'Zerg' | 'Protoss' | 'Random' | null;

export interface Player {
  name: string;
  race?: Race;
}

export interface Team {
  player1: Player;
  player2: Player;
}

export interface Game {
  map: string;
  winner: number;
}

export interface Match {
  match_id: string;
  round: string;
  team1: Team;
  team2: Team;
  team1_score: number | null;
  team2_score: number | null;
  best_of: number;
  date: string | null;
  games: Game[];
  tournament_slug?: string;
}

export interface Tournament {
  name: string;
  liquipedia_slug: string;
  date: string | null;
  prize_pool: number | null;
  format: string | null;
  maps: string[];
  is_main_circuit?: boolean;
  season?: number;
}

export interface TournamentData {
  tournament: Tournament;
  matches: Match[];
}
