"""
Database inserter for SC2 tournament data.
Reads JSON data and inserts it into Supabase using the Supabase Python client.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Dict, List, Optional, Any
from datetime import datetime

# Disable verbose httpx logging
logging.getLogger("httpx").setLevel(logging.WARNING)

try:
    from supabase import create_client  # pyright: ignore[reportMissingImports]
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

from scraper_config import ScraperConfig

logger = logging.getLogger(__name__)


def get_or_create_team_id(team_name: str, player_id_map: Dict[str, str], 
                         team_id_map: Dict[tuple, str], inserter) -> Optional[str]:
    """
    Get or create a team ID for a given team name.
    Creates missing players automatically.
    
    Args:
        team_name: Team name in format "Player1 + Player2"
        player_id_map: Mapping of player names to IDs (will be updated)
        team_id_map: Mapping of (player1, player2) tuples to team IDs
        inserter: Database inserter instance
        
    Returns:
        Team ID if successful, None otherwise
    """
    if not team_name or ' + ' not in team_name:
        logger.warning(f"Invalid team name format: {team_name}")
        return None
    
    # Parse player names from team name
    player_names = [name.strip() for name in team_name.split(' + ')]
    if len(player_names) != 2:
        logger.warning(f"Expected 2 players in team name, got {len(player_names)}: {team_name}")
        return None
    
    player1_name, player2_name = player_names
    
    # Create missing players automatically
    if player1_name not in player_id_map:
        try:
            player_id_map[player1_name] = inserter.insert_player(
                name=player1_name,
                liquipedia_slug=player1_name.lower().replace(' ', '_')
            )
            logger.debug(f"🆕 Created missing player: {player1_name}")
        except Exception as e:
            logger.error(f"Failed to create player {player1_name}: {e}")
            return None
            
    if player2_name not in player_id_map:
        try:
            player_id_map[player2_name] = inserter.insert_player(
                name=player2_name,
                liquipedia_slug=player2_name.lower().replace(' ', '_')
            )
            logger.debug(f"🆕 Created missing player: {player2_name}")
        except Exception as e:
            logger.error(f"Failed to create player {player2_name}: {e}")
            return None
    
    # Normalize team key (sort players alphabetically for consistent ordering)
    normalized_players = sorted([player1_name, player2_name])
    team_key = (normalized_players[0], normalized_players[1])
    
    # Check if team already exists
    if team_key in team_id_map:
        return team_id_map[team_key]
    
    # Create new team using normalized player order for database consistency
    try:
        team_id = inserter.insert_team(
            name=f"{normalized_players[0]} + {normalized_players[1]}",
            player1_id=player_id_map[normalized_players[0]],
            player2_id=player_id_map[normalized_players[1]]
        )
        team_id_map[team_key] = team_id
        logger.debug(f"🆕 Created new team: {normalized_players[0]} + {normalized_players[1]} with ID: {team_id}")
        return team_id
    except Exception as e:
        logger.error(f"Failed to create team {team_name}: {e}")
        return None


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class SupabaseDatabaseInserter:
    """Database inserter using Supabase Python client."""
    
    def __init__(self, config: ScraperConfig):
        self.config = config
        self.client = None
        self.enabled = self._validate_config()
        
        if not self.enabled:
            logger.warning("Database integration disabled - missing configuration")
        else:
            logger.info("Supabase Database inserter initialized")
    
    def _validate_config(self) -> bool:
        """Validate database configuration."""
        if not SUPABASE_AVAILABLE:
            logger.error("Supabase client not available - install with: pip install supabase")
            return False
        
        self.supabase_url, self.supabase_key = self._get_supabase_credentials()
        return True
    
    def _get_supabase_credentials(self) -> tuple:
        """Get Supabase credentials from environment or fallback to hardcoded values."""
        # Check environment variables first
        env_url = os.getenv('SUPABASE_URL')
        env_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
        
        if env_url and env_key:
            return env_url, env_key
        
        # Fallback to hardcoded values from MCP
        return (
            "https://ruseplseifwuonpbqakh.supabase.co",
            "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1c2VwbHNlaWZ3dW9ucGJxYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDU2MTEsImV4cCI6MjA3MjM4MTYxMX0.M8zYJcE8JwvcsCn8wXHzgwZMhPTJ1QoqEmePQMLbmLw"
        )
    
    def connect(self):
        """Establish database connection."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        try:
            self.client = create_client(self.supabase_url, self.supabase_key)
            logger.info("Connected to Supabase database")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise DatabaseError(f"Database connection failed: {e}")
    
    def disconnect(self):
        """Close database connection."""
        if self.client:
            self.client = None
            logger.info("Database connection closed")
    
    def _execute_query(self, table: str, operation: str, data: Dict[str, Any]) -> Dict[str, Any]:
        """Execute database operation using Supabase client."""
        if not self.client:
            raise DatabaseError("Not connected to database")
        
        try:
            if operation == "insert":
                response = self.client.table(table).insert(data).execute()
            elif operation == "upsert":
                # Handle different tables with appropriate conflict resolution
                if table == "matches":
                    response = self.client.table(table).upsert(data, on_conflict="match_id").execute()
                elif table == "players":
                    response = self.client.table(table).upsert(data, on_conflict="liquipedia_slug").execute()
                elif table == "teams":
                    response = self.client.table(table).upsert(data, on_conflict="player1_id,player2_id").execute()
                elif table == "tournaments":
                    response = self.client.table(table).upsert(data, on_conflict="liquipedia_slug").execute()
                else:
                    response = self.client.table(table).upsert(data).execute()
            else:
                raise ValueError(f"Unsupported operation: {operation}")
                
            if response.data and len(response.data) > 0:
                return response.data[0]
            else:
                raise DatabaseError(f"No data returned from {operation} operation")
                
        except Exception as e:
            logger.error(f"Database operation error: {e}")
            raise DatabaseError(f"Failed to execute {operation}: {e}")
    
    def insert_player(self, name: str, liquipedia_slug: str, 
                     nationality: Optional[str] = None, 
                     preferred_race: Optional[str] = None) -> str:
        """Insert or update a player and return the player ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        data = {
            "liquipedia_slug": liquipedia_slug,
            "name": name,
            "nationality": nationality,
            "preferred_race": preferred_race
        }
        
        try:
            result = self._execute_query("players", "upsert", data)
            player_id = str(result["id"])
            logger.debug(f"Player '{name}' saved with ID: {player_id}")
            return player_id
        except Exception as e:
            raise DatabaseError(f"Failed to insert/retrieve player: {liquipedia_slug} - {e}")
    
    def insert_team(self, name: str, player1_id: str, player2_id: str) -> str:
        """Insert or update a team and return the team ID.""" 
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        data = {
            "name": name,
            "player1_id": player1_id,
            "player2_id": player2_id
        }
        
        try:
            result = self._execute_query("teams", "upsert", data)
            team_id = str(result["id"])
            logger.debug(f"Team '{name}' saved with ID: {team_id}")
            return team_id
        except Exception as e:
            raise DatabaseError(f"Failed to insert/retrieve team: {name} - {e}")
    
    def insert_tournament(self, name: str, liquipedia_slug: str, **kwargs) -> str:
        """Insert or update a tournament and return the tournament ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        data = {
            "liquipedia_slug": liquipedia_slug,
            "name": name
        }
        
        # Add optional fields
        for field in ["start_date", "end_date", "prize_pool", "location", "status"]:
            if field in kwargs and kwargs[field] is not None:
                data[field] = kwargs[field]
        
        try:
            result = self._execute_query("tournaments", "upsert", data)
            tournament_id = str(result["id"])
            logger.debug(f"Tournament '{name}' saved with ID: {tournament_id}")
            return tournament_id
        except Exception as e:
            raise DatabaseError(f"Failed to insert/retrieve tournament: {liquipedia_slug} - {e}")
    
    def insert_match(self, tournament_id: str, match_id: str, team1_id: str, 
                    team2_id: str, **kwargs) -> str:
        """Insert or update a match and return the match database ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        data = {
            "tournament_id": tournament_id,
            "match_id": match_id,
            "team1_id": team1_id,
            "team2_id": team2_id
        }
        
        # Add optional fields
        for field in ["round", "best_of", "winner_id", "status", "match_date"]:
            if field in kwargs and kwargs[field] is not None:
                data[field] = kwargs[field]
        
        try:
            result = self._execute_query("matches", "upsert", data)
            match_db_id = str(result["id"])
            logger.debug(f"Match '{match_id}' saved with ID: {match_db_id}")
            return match_db_id
        except Exception as e:
            raise DatabaseError(f"Failed to insert/retrieve match: {match_id} - {e}")
    
    def insert_game(self, match_db_id: str, game_number: int, map_name: str, **kwargs) -> str:
        """Insert or update a game and return the game ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        data = {
            "match_id": match_db_id,
            "game_number": game_number,
            "map_name": map_name
        }
        
        # Add optional fields
        for field in ["winner_id", "duration_seconds", "game_date"]:
            if field in kwargs and kwargs[field] is not None:
                data[field] = kwargs[field]
        
        try:
            result = self._execute_query("games", "upsert", data)
            game_id = str(result["id"])
            logger.debug(f"Game {game_number} on '{map_name}' saved with ID: {game_id}")
            return game_id
        except Exception as e:
            raise DatabaseError(f"Failed to insert game: {map_name} - {e}")
    
    def test_connection(self) -> bool:
        """Test database connection."""
        if not self.enabled:
            return False
        
        try:
            # Test by querying tournaments table
            response = self.client.table("tournaments").select("count", count="exact").execute()
            return True
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False


def insert_tournament_data(json_file_path: str, config: ScraperConfig) -> bool:
    """
    Main function to read JSON data and insert it into the database.
    
    Args:
        json_file_path: Path to the JSON file containing tournament data
        config: Scraper configuration object
        
    Returns:
        bool: True if successful, False otherwise
    """
    logger.info(f"Starting database insertion from {json_file_path}")
    
    inserter = SupabaseDatabaseInserter(config)
    if not inserter.enabled:
        logger.warning("Database insertion skipped - not configured")
        return False
    
    try:
        inserter.connect()
        if not inserter.test_connection():
            logger.error("Database connection test failed")
            return False
        
        tournament_data = _load_tournament_data(json_file_path)
        return _process_tournament_data(inserter, tournament_data)
        
    except Exception as e:
        logger.error(f"Database insertion failed: {e}")
        return False
    finally:
        inserter.disconnect()


def _load_tournament_data(json_file_path: str) -> dict:
    """Load and return tournament data from JSON file."""
    logger.info(f"Reading tournament data from {json_file_path}")
    with open(json_file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def _process_tournament_data(inserter: SupabaseDatabaseInserter, tournament_data: dict) -> bool:
    """Process and insert all tournament data."""
    try:
        # Insert tournaments and get ID mapping
        tournament_id_map = _insert_tournaments(inserter, tournament_data)
        default_tournament_id = list(tournament_id_map.values())[0] if tournament_id_map else None
        
        # Insert players and teams
        player_id_map = _insert_players(inserter, tournament_data)
        team_id_map = _insert_teams(inserter, tournament_data, player_id_map)
        
        # Insert matches and games
        _insert_matches_and_games(inserter, tournament_data, tournament_id_map, 
                                 default_tournament_id, player_id_map, team_id_map)
        
        logger.info("Tournament data successfully inserted into database")
        return True
        
    except Exception as e:
        logger.error(f"Error processing tournament data: {e}")
        return False


def _insert_tournaments(inserter: SupabaseDatabaseInserter, tournament_data: dict) -> dict:
    """Insert tournaments and return mapping of slug -> id."""
    tournaments_list = tournament_data.get('tournaments', [])
    single_tournament = tournament_data.get('tournament', {})
    
    # Convert single tournament format to list if needed
    if single_tournament and not tournaments_list:
        tournaments_list = [single_tournament]
    
    tournament_id_map = {}
    for tournament_info in tournaments_list:
        tournament_id = inserter.insert_tournament(
            name=tournament_info.get('name', 'Unknown Tournament'),
            liquipedia_slug=tournament_info.get('liquipedia_slug', 'unknown'),
            start_date=tournament_info.get('start_date'),
            end_date=tournament_info.get('end_date'),
            prize_pool=tournament_info.get('prize_pool'),
            location=tournament_info.get('location'),
            status=tournament_info.get('status', 'completed')
        )
        tournament_id_map[tournament_info.get('liquipedia_slug', 'unknown')] = tournament_id
    
    return tournament_id_map


def _insert_players(inserter: SupabaseDatabaseInserter, tournament_data: dict) -> dict:
    """Insert players and return mapping of name -> id."""
    players_data = tournament_data.get('players', [])
    logger.info(f"Processing {len(players_data)} players")
    
    player_id_map = {}
    for player in players_data:
        player_name = player.get('name', '')
        if player_name and player_name not in player_id_map:
            player_id = inserter.insert_player(
                name=player_name,
                liquipedia_slug=player.get('liquipedia_slug', player_name.lower().replace(' ', '_')),
                nationality=player.get('nationality'),
                preferred_race=player.get('preferred_race')
            )
            player_id_map[player_name] = player_id
    
    return player_id_map


def _insert_teams(inserter: SupabaseDatabaseInserter, tournament_data: dict, player_id_map: dict) -> dict:
    """Insert teams and return mapping of (player1, player2) -> id."""
    teams_data = tournament_data.get('teams', [])
    logger.info(f"Pre-processing {len(teams_data)} teams")
    
    team_id_map = {}
    for team in teams_data:
        team_name = team.get('name', '')
        if team_name:
            get_or_create_team_id(team_name, player_id_map, team_id_map, inserter)
    
    return team_id_map


def _insert_matches_and_games(inserter: SupabaseDatabaseInserter, tournament_data: dict,
                             tournament_id_map: dict, default_tournament_id: str,
                             player_id_map: dict, team_id_map: dict) -> None:
    """Insert matches and their associated games."""
    matches_data = tournament_data.get('matches', [])
    logger.info(f"Processing {len(matches_data)} matches")
    
    for match in matches_data:
        try:
            _insert_single_match(inserter, match, tournament_id_map, default_tournament_id,
                               player_id_map, team_id_map)
        except Exception as e:
            logger.error(f"Error processing match {match.get('match_id', 'unknown')}: {e}")


def _insert_single_match(inserter: SupabaseDatabaseInserter, match: dict,
                        tournament_id_map: dict, default_tournament_id: str,
                        player_id_map: dict, team_id_map: dict) -> None:
    """Insert a single match and its games."""
    team1_name = match.get('team1_name', '')
    team2_name = match.get('team2_name', '')
    
    team1_id = get_or_create_team_id(team1_name, player_id_map, team_id_map, inserter)
    team2_id = get_or_create_team_id(team2_name, player_id_map, team_id_map, inserter)
    
    if not (team1_id and team2_id):
        logger.warning(f"Could not find team IDs for match: {team1_name} vs {team2_name}")
        return
    
    # Determine tournament and winner
    match_tournament_slug = match.get('tournament_slug', '')
    match_tournament_id = tournament_id_map.get(match_tournament_slug, default_tournament_id)
    
    if not match_tournament_id:
        logger.warning(f"No tournament found for match {match.get('match_id', 'unknown')}")
        return
    
    winner_id = _determine_winner_id(match, team1_name, team2_name, team1_id, team2_id)
    
    # Insert match
    match_db_id = inserter.insert_match(
        tournament_id=match_tournament_id,
        match_id=match.get('match_id', f"match_{hash(str(match))}"),
        team1_id=team1_id,
        team2_id=team2_id,
        best_of=match.get('best_of'),
        winner_id=winner_id,
        status=match.get('status', 'completed')
    )
    
    # Insert games
    _insert_match_games(inserter, match, match_db_id, team1_name, team2_name, team1_id, team2_id)


def _determine_winner_id(match: dict, team1_name: str, team2_name: str, team1_id: str, team2_id: str) -> Optional[str]:
    """Determine the winner ID for a match."""
    winner_name = match.get('winner_name', '')
    if winner_name == team1_name:
        return team1_id
    elif winner_name == team2_name:
        return team2_id
    return None


def _insert_match_games(inserter: SupabaseDatabaseInserter, match: dict, match_db_id: str,
                       team1_name: str, team2_name: str, team1_id: str, team2_id: str) -> None:
    """Insert all games for a match."""
    games = match.get('games', [])
    for game in games:
        game_winner_id = _determine_winner_id(game, team1_name, team2_name, team1_id, team2_id)
        
        inserter.insert_game(
            match_db_id=match_db_id,
            game_number=game.get('game_number', 1),
            map_name=game.get('map_name', 'Unknown Map'),
            winner_id=game_winner_id,
            duration_seconds=game.get('duration_seconds')
        )


if __name__ == "__main__":
    # For testing
    from scraper_config import ScraperConfig
    config = ScraperConfig()
    success = insert_tournament_data("../output/tournament_data.json", config)
    print(f"Database insertion {'successful' if success else 'failed'}")
