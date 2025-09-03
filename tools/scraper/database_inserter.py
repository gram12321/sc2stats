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

try:
    from supabase import create_client  # pyright: ignore[reportMissingImports]
    SUPABASE_AVAILABLE = True
except ImportError:
    SUPABASE_AVAILABLE = False

from scraper_config import ScraperConfig

logger = logging.getLogger(__name__)


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
            
        # Use hardcoded values from MCP
        supabase_url = "https://ruseplseifwuonpbqakh.supabase.co"
        anon_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ1c2VwbHNlaWZ3dW9ucGJxYWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY4MDU2MTEsImV4cCI6MjA3MjM4MTYxMX0.M8zYJcE8JwvcsCn8wXHzgwZMhPTJ1QoqEmePQMLbmLw"
        
        # Check environment variables first
        env_url = os.getenv('SUPABASE_URL')
        env_key = os.getenv('SUPABASE_ANON_KEY') or os.getenv('SUPABASE_SERVICE_KEY')
        
        if env_url and env_key:
            self.supabase_url = env_url
            self.supabase_key = env_key
        else:
            # Use the hardcoded values as fallback
            self.supabase_url = supabase_url
            self.supabase_key = anon_key
            
        return True
    
    def connect(self):
        """Establish database connection."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        try:
            self.client = create_client(self.supabase_url, self.supabase_key)
            logger.info("✅ Connected to Supabase database")
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
            logger.info(f"Player '{name}' saved with ID: {player_id}")
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
            logger.info(f"Team '{name}' saved with ID: {team_id}")
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
            logger.info(f"Tournament '{name}' saved with ID: {tournament_id}")
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
            logger.info(f"Match '{match_id}' saved with ID: {match_db_id}")
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
            logger.info(f"Game {game_number} on '{map_name}' saved with ID: {game_id}")
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
    
    # Initialize database inserter
    inserter = SupabaseDatabaseInserter(config)
    
    if not inserter.enabled:
        logger.warning("Database insertion skipped - not configured")
        return False
    
    try:
        # Connect to database
        inserter.connect()
        
        # Test connection
        if not inserter.test_connection():
            logger.error("Database connection test failed")
            return False
        
        # Read JSON data
        logger.info(f"Reading tournament data from {json_file_path}")
        with open(json_file_path, 'r', encoding='utf-8') as f:
            tournament_data = json.load(f)
        
        # Supabase handles transactions automatically
        
        # Insert tournament
        tournament_info = tournament_data.get('tournament', {})
        tournament_id = inserter.insert_tournament(
            name=tournament_info.get('name', 'Unknown Tournament'),
            liquipedia_slug=tournament_info.get('liquipedia_slug', 'unknown'),
            start_date=tournament_info.get('start_date'),
            end_date=tournament_info.get('end_date'),
            location=tournament_info.get('location'),
            status=tournament_info.get('status', 'completed')
        )
        
        # Track inserted entities
        player_id_map = {}  # name -> id
        team_id_map = {}    # (player1_name, player2_name) -> id
        
        # Step 1: Insert all players
        players_data = tournament_data.get('players', [])
        logger.info(f"Processing {len(players_data)} players")
        
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
        
        # Step 2: Insert all teams
        teams_data = tournament_data.get('teams', [])
        logger.info(f"Processing {len(teams_data)} teams")
        
        for team in teams_data:
            player1_name = team.get('player1_name', '')
            player2_name = team.get('player2_name', '')
            team_name = team.get('name', f"{player1_name} & {player2_name}")
            
            if player1_name in player_id_map and player2_name in player_id_map:
                team_key = (player1_name, player2_name)
                if team_key not in team_id_map:
                    team_id = inserter.insert_team(
                        name=team_name,
                        player1_id=player_id_map[player1_name],
                        player2_id=player_id_map[player2_name]
                    )
                    team_id_map[team_key] = team_id
            else:
                logger.warning(f"Players not found for team {team_name}: {player1_name}, {player2_name}")
        
        # Step 3: Insert all matches and games
        matches_data = tournament_data.get('matches', [])
        logger.info(f"Processing {len(matches_data)} matches")
        
        for match in matches_data:
            try:
                # Get team names from the match
                team1_name = match.get('team1_name', '')
                team2_name = match.get('team2_name', '')
                
                # Find team IDs by looking up the team names
                team1_id = None
                team2_id = None
                
                for team_key, team_id in team_id_map.items():
                    team_display_name = f"{team_key[0]} + {team_key[1]}"
                    if team_display_name == team1_name:
                        team1_id = team_id
                    elif team_display_name == team2_name:
                        team2_id = team_id
                
                if team1_id and team2_id:
                    # Determine winner
                    winner_id = None
                    winner_name = match.get('winner_name', '')
                    if winner_name == team1_name:
                        winner_id = team1_id
                    elif winner_name == team2_name:
                        winner_id = team2_id
                    
                    # Insert match
                    match_db_id = inserter.insert_match(
                        tournament_id=tournament_id,
                        match_id=match.get('match_id', f"match_{hash(str(match))}"),
                        team1_id=team1_id,
                        team2_id=team2_id,
                        best_of=match.get('best_of'),
                        winner_id=winner_id,
                        status=match.get('status', 'completed')
                    )
                    
                    # Insert games for this match
                    games = match.get('games', [])
                    for game in games:
                        game_winner_id = None
                        game_winner_name = game.get('winner_name', '')
                        if game_winner_name == team1_name:
                            game_winner_id = team1_id
                        elif game_winner_name == team2_name:
                            game_winner_id = team2_id
                        
                        inserter.insert_game(
                            match_db_id=match_db_id,
                            game_number=game.get('game_number', 1),
                            map_name=game.get('map_name', 'Unknown Map'),
                            winner_id=game_winner_id,
                            duration_seconds=game.get('duration_seconds')
                        )
                else:
                    logger.warning(f"Could not find team IDs for match: {team1_name} vs {team2_name}")
                
            except Exception as e:
                logger.error(f"Error processing match {match.get('match_id', 'unknown')}: {e}")
                continue
        
        # Supabase commits automatically
        logger.info("✅ Tournament data successfully inserted into database")
        
        return True
        
    except Exception as e:
        logger.error(f"Database insertion failed: {e}")
        return False
        
    finally:
        inserter.disconnect()


if __name__ == "__main__":
    # For testing
    from scraper_config import ScraperConfig
    config = ScraperConfig()
    success = insert_tournament_data("../output/tournament_data.json", config)
    print(f"Database insertion {'successful' if success else 'failed'}")
