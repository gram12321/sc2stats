"""
Real MCP database client that uses the actual MCP functions available in the environment.
This integrates with the Supabase MCP tools you set up earlier.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional, Any
from datetime import datetime
from uuid import uuid4

from scraper_config import ScraperConfig

logger = logging.getLogger(__name__)


class DatabaseError(Exception):
    """Base exception for database operations."""
    pass


class RealMCPDatabaseClient:
    """Database client using actual MCP Supabase functions."""
    
    def __init__(self, config: ScraperConfig):
        self.config = config
        self.enabled = config.enable_database and config.supabase_url
        
        if not self.enabled:
            logger.warning("Database integration disabled - missing configuration")
        else:
            logger.info("Real MCP Database client initialized")
    
    def _execute_sql(self, query: str) -> Dict[str, Any]:
        """Execute SQL using the actual MCP Supabase execute_sql function."""
        if not self.enabled:
            logger.warning("Database disabled - skipping SQL execution")
            return {"data": [], "count": 0}
        
        try:
            logger.debug(f"Executing SQL: {query[:100]}...")
            
            # Call the actual MCP Supabase execute_sql function
            # This function should be available in the MCP environment
            # We need to call the MCP function directly, not import it
            # The MCP function is available as a global function
            result = mcp_supabase_execute_sql(query=query)  # type: ignore # MCP function
            
            logger.info("✅ SQL executed via MCP Supabase function")
            return result
            
        except ImportError:
            logger.error("MCP Supabase function not available")
            raise DatabaseError("MCP Supabase integration not available")
        except Exception as e:
            logger.error(f"Database error: {e}")
            raise DatabaseError(f"Failed to execute SQL via MCP: {e}")
    
    def insert_player(self, name: str, liquipedia_slug: str, 
                     nationality: Optional[str] = None, 
                     preferred_race: Optional[str] = None) -> str:
        """Insert or update a player and return the player ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        # Escape single quotes in SQL
        name = name.replace("'", "''")
        liquipedia_slug = liquipedia_slug.replace("'", "''")
        nationality = nationality.replace("'", "''") if nationality else None
        preferred_race = preferred_race.replace("'", "''") if preferred_race else None
        
        query = f"""
        INSERT INTO players (liquipedia_slug, name, nationality, preferred_race)
        VALUES ('{liquipedia_slug}', '{name}', 
                {f"'{nationality}'" if nationality else 'NULL'}, 
                {f"'{preferred_race}'" if preferred_race else 'NULL'})
        ON CONFLICT (liquipedia_slug) 
        DO UPDATE SET 
            name = EXCLUDED.name,
            nationality = COALESCE(EXCLUDED.nationality, players.nationality),
            preferred_race = COALESCE(EXCLUDED.preferred_race, players.preferred_race)
        RETURNING id;
        """
        
        result = self._execute_sql(query)
        
        if result.get("data") and len(result["data"]) > 0:
            player_id = result["data"][0]["id"]
            logger.info(f"Player '{name}' saved with ID: {player_id}")
            return player_id
        else:
            raise DatabaseError(f"Failed to insert/retrieve player: {liquipedia_slug}")
    
    def insert_team(self, name: str, player1_id: str, player2_id: str) -> str:
        """Insert or update a team and return the team ID.""" 
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        # Escape single quotes
        name = name.replace("'", "''")
        
        query = f"""
        INSERT INTO teams (name, player1_id, player2_id)
        VALUES ('{name}', '{player1_id}', '{player2_id}')
        ON CONFLICT (player1_id, player2_id) 
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """
        
        result = self._execute_sql(query)
        
        if result.get("data") and len(result["data"]) > 0:
            team_id = result["data"][0]["id"]
            logger.info(f"Team '{name}' saved with ID: {team_id}")
            return team_id
        else:
            raise DatabaseError(f"Failed to insert/retrieve team: {name}")
    
    def insert_tournament(self, name: str, liquipedia_slug: str, **kwargs) -> str:
        """Insert or update a tournament and return the tournament ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        # Escape single quotes
        name = name.replace("'", "''")
        liquipedia_slug = liquipedia_slug.replace("'", "''")
        
        # Build values
        values = [f"'{liquipedia_slug}'", f"'{name}'"]
        columns = ["liquipedia_slug", "name"]
        
        # Add optional fields
        for field, value in kwargs.items():
            if value is not None:
                columns.append(field)
                if isinstance(value, str):
                    escaped_value = value.replace("'", "''")
                    values.append(f"'{escaped_value}'")
                else:
                    values.append(str(value))
            
        query = f"""
        INSERT INTO tournaments ({', '.join(columns)})
        VALUES ({', '.join(values)})
        ON CONFLICT (liquipedia_slug) 
        DO UPDATE SET name = EXCLUDED.name
        RETURNING id;
        """
        
        result = self._execute_sql(query)
        
        if result.get("data") and len(result["data"]) > 0:
            tournament_id = result["data"][0]["id"]
            logger.info(f"Tournament '{name}' saved with ID: {tournament_id}")
            return tournament_id
        else:
            raise DatabaseError(f"Failed to insert/retrieve tournament: {liquipedia_slug}")
    
    def insert_match(self, tournament_id: str, match_id: str, team1_id: str, 
                    team2_id: str, **kwargs) -> str:
        """Insert or update a match and return the match database ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        # Escape single quotes
        match_id = match_id.replace("'", "''")
        
        # Base values
        columns = ["tournament_id", "match_id", "team1_id", "team2_id"]
        values = [f"'{tournament_id}'", f"'{match_id}'", f"'{team1_id}'", f"'{team2_id}'"]
        
        # Add optional fields
        for field, value in kwargs.items():
            if value is not None:
                columns.append(field)
                if isinstance(value, str):
                    escaped_value = value.replace("'", "''")
                    values.append(f"'{escaped_value}'")
                elif isinstance(value, datetime):
                    values.append(f"'{value.isoformat()}'")
                else:
                    values.append(str(value))
        
        query = f"""
        INSERT INTO matches ({', '.join(columns)})
        VALUES ({', '.join(values)})
        ON CONFLICT (match_id) 
        DO UPDATE SET 
            winner_id = EXCLUDED.winner_id,
            status = EXCLUDED.status
        RETURNING id;
        """
        
        result = self._execute_sql(query)
        
        if result.get("data") and len(result["data"]) > 0:
            match_db_id = result["data"][0]["id"]
            logger.info(f"Match '{match_id}' saved with ID: {match_db_id}")
            return match_db_id
        else:
            raise DatabaseError(f"Failed to insert/retrieve match: {match_id}")
    
    def insert_game(self, match_db_id: str, game_number: int, map_name: str, **kwargs) -> str:
        """Insert or update a game and return the game ID."""
        if not self.enabled:
            raise DatabaseError("Database integration disabled")
        
        # Escape single quotes
        map_name = map_name.replace("'", "''")
        
        # Base values
        columns = ["match_id", "game_number", "map_name"]
        values = [f"'{match_db_id}'", str(game_number), f"'{map_name}'"]
        
        # Add optional fields
        for field, value in kwargs.items():
            if value is not None:
                columns.append(field)
                if isinstance(value, str):
                    escaped_value = value.replace("'", "''")
                    values.append(f"'{escaped_value}'")
                else:
                    values.append(str(value))
        
        query = f"""
        INSERT INTO games ({', '.join(columns)})
        VALUES ({', '.join(values)})
        ON CONFLICT (match_id, game_number) 
        DO UPDATE SET 
            map_name = EXCLUDED.map_name,
            winner_id = EXCLUDED.winner_id
        RETURNING id;
        """
        
        result = self._execute_sql(query)
        
        if result.get("data") and len(result["data"]) > 0:
            game_id = result["data"][0]["id"]
            logger.info(f"Game {game_number} on '{map_name}' saved with ID: {game_id}")
            return game_id
        else:
            raise DatabaseError(f"Failed to insert game: {map_name}")
    
    def test_connection(self) -> bool:
        """Test database connection."""
        if not self.enabled:
            return False
        
        try:
            result = self._execute_sql("SELECT 1 as test;")
            return result is not None
        except Exception as e:
            logger.error(f"Database connection test failed: {e}")
            return False
