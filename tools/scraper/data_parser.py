"""
Unified data parser for Liquipedia tournament data.
Handles both wikitext parsing and LPDB data processing.
"""
from __future__ import annotations

import re
import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Set

from data_models import (
    Player, Team, Game, Match, Tournament, 
    MatchStatus, TournamentStatus
)

logger = logging.getLogger(__name__)


class DataParser:
    """Unified parser for Liquipedia tournament data."""
    
    def __init__(self):
        self.players_cache: Dict[str, Player] = {}
        self.teams_cache: Dict[tuple, Team] = {}
        self.players_cache_by_name: Dict[str, Player] = {}  # For enhanced wikitext parsing
        self.teams_cache_by_key: Dict[str, Team] = {}  # For enhanced wikitext parsing
    
    def parse_tournament_from_wikitext(self, tournament_slug: str, wikitext: str) -> Tournament:
        """Parse tournament data from MediaWiki wikitext."""
        logger.info(f"Parsing tournament from wikitext: {tournament_slug}")
        
        # Parse infobox for tournament metadata
        infobox = self._parse_infobox(wikitext)
        
        # Create tournament with basic info
        tournament = Tournament(
            name=infobox.get('name', tournament_slug.replace('_', ' ')),
            liquipedia_slug=tournament_slug,
            start_date=infobox.get('sdate', ''),
            end_date=infobox.get('edate', ''),
            prize_pool=self._parse_prize_pool(infobox.get('prizepool', '0')),
            location=infobox.get('location', ''),
            status=self._parse_tournament_status(infobox.get('status', '')),
            maps=self._parse_maps(wikitext)
        )
        
        logger.info(f"Parsed tournament: {tournament.name}")
        return tournament
    
    def parse_matches_from_lpdb(self, tournament: Tournament, 
                              match_data: List[Dict[str, Any]],
                              opponent_data: List[Dict[str, Any]],
                              game_data: List[Dict[str, Any]]) -> None:
        """Parse and add match data from LPDB to tournament."""
        logger.info(f"Parsing {len(match_data)} matches from LPDB")
        
        # Group opponent data by match ID
        opponents_by_match: Dict[str, List[Dict[str, Any]]] = {}
        for opponent in opponent_data:
            match_id = opponent.get('matchid', '')
            if match_id:
                if match_id not in opponents_by_match:
                    opponents_by_match[match_id] = []
                opponents_by_match[match_id].append(opponent)
        
        # Group game data by match ID
        games_by_match: Dict[str, List[Dict[str, Any]]] = {}
        for game in game_data:
            match_id = game.get('matchid', '')
            if match_id:
                if match_id not in games_by_match:
                    games_by_match[match_id] = []
                games_by_match[match_id].append(game)
        
        # Process each match
        for match_raw in match_data:
            try:
                match = self._parse_match_from_lpdb(
                    match_raw, 
                    opponents_by_match.get(match_raw.get('matchid', ''), []),
                    games_by_match.get(match_raw.get('matchid', ''), [])
                )
                if match:
                    tournament.add_match(match)
            except Exception as e:
                logger.warning(f"Failed to parse match {match_raw.get('matchid', 'unknown')}: {e}")
        
        logger.info(f"Parsed {len(tournament.matches)} matches successfully")
    
    def parse_matches_from_wikitext(self, tournament: Tournament, wikitext: str) -> None:
        """Parse matches from wikitext content using enhanced parsing."""
        logger.info("🔍 Parsing matches from wikitext...")
        
        # Find all match blocks first
        match_block_pattern = r'(\w+)=\{\{Match'
        match_ids = re.findall(match_block_pattern, wikitext)
        
        logger.info(f"Found {len(match_ids)} match blocks")
        
        # Track processed matches to handle duplicates between groups
        processed_matches = {}  # unique_key -> match_object
        
        for i, match_id in enumerate(match_ids):
            try:
                # Extract match content
                match_content = self._extract_match_content(wikitext, match_id)
                if not match_content:
                    continue
                
                # Extract opponents
                opponents = self._extract_opponents(match_content)
                if not opponents:
                    logger.warning(f"⚠️ Failed to extract opponents for match {match_id}")
                    continue
                
                p1_1, p1_2, p2_1, p2_2 = opponents
                
                # Create players
                player1_1 = self._get_or_create_player_by_name(p1_1.strip())
                player1_2 = self._get_or_create_player_by_name(p1_2.strip())
                player2_1 = self._get_or_create_player_by_name(p2_1.strip())
                player2_2 = self._get_or_create_player_by_name(p2_2.strip())
                
                # Create teams
                team1 = self._get_or_create_team_by_players(f"{player1_1.name} + {player1_2.name}", player1_1, player1_2)
                team2 = self._get_or_create_team_by_players(f"{player2_1.name} + {player2_2.name}", player2_1, player2_2)
                
                # For duplicate match IDs, add group suffix to distinguish Group A from Group B
                final_match_id = match_id
                if match_id in [m.match_id for m in tournament.matches]:
                    # This is a duplicate ID - likely Group A vs Group B
                    if match_id.startswith('M') and match_id[1:].isdigit():
                        # Determine if this is Group A or Group B based on position in the list
                        # First 18 M matches are Group A, second 18 are Group B
                        group_suffix = 'A' if i < 18 else 'B'  # More precise group detection
                        final_match_id = f"{group_suffix}_{match_id}"
                        logger.debug(f"🔄 Renamed duplicate {match_id} to {final_match_id} (position {i})")
                
                # Create unique key AFTER determining final match ID
                unique_key = f"{team1.name}_vs_{team2.name}_{final_match_id}"
                
                # Skip only if we've seen this exact match before (same teams, same final ID)
                if unique_key in processed_matches:
                    logger.warning(f"⚠️ True duplicate match detected: {final_match_id} with teams {team1.name} vs {team2.name}")
                    continue
                
                # Create match
                match = self._create_match_from_wikitext(tournament, final_match_id, team1, team2, match_content)
                
                if match:
                    processed_matches[unique_key] = match
                    tournament.matches.append(match)
                    logger.debug(f"✅ Parsed match {final_match_id}: {team1.name} vs {team2.name}")
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to parse match {match_id}: {e}")
        
        # Add players and teams to tournament
        tournament.players.update(self.players_cache_by_name.values())
        tournament.teams.update(self.teams_cache_by_key.values())
        
        logger.info(f"📊 Parsed {len(tournament.matches)} matches, {len(tournament.players)} players, {len(tournament.teams)} teams")
    
    def _parse_infobox(self, wikitext: str) -> Dict[str, str]:
        """Parse the tournament infobox from wikitext."""
        # Look for infobox pattern
        infobox_pattern = r'\{\{Infobox\s+league\n([^}]+(?:\n[^}]+)*)\n\}\}'
        match = re.search(infobox_pattern, wikitext, re.MULTILINE | re.DOTALL | re.IGNORECASE)
        
        if not match:
            logger.warning("No infobox found in wikitext")
            return {}
        
        infobox_content = match.group(1)
        params = {}
        
        # Parse infobox parameters
        for line in infobox_content.split('\n'):
            if '|' in line and '=' in line:
                key, value = line.split('=', 1)
                clean_key = key.strip().lstrip('|')
                clean_value = value.strip()
                if clean_key and clean_value:
                    params[clean_key] = clean_value
        
        logger.debug(f"Parsed {len(params)} infobox parameters")
        return params
    
    def _parse_maps(self, wikitext: str) -> List[str]:
        """Extract map pool from wikitext."""
        maps = []
        
        # Look for map entries in the infobox
        map_pattern = r'\|map\d+=([^|\n]+)'
        map_matches = re.findall(map_pattern, wikitext)
        
        for map_name in map_matches:
            clean_map = map_name.strip()
            # Filter out templates and empty entries
            if clean_map and not clean_map.startswith('{{') and clean_map not in maps:
                maps.append(clean_map)
        
        logger.debug(f"Found {len(maps)} maps: {maps}")
        return maps
    
    def _parse_prize_pool(self, value: str) -> int:
        """Parse prize pool value from string."""
        if not value:
            return 0
        
        # Remove currency symbols and commas
        clean_value = re.sub(r'[^\d]', '', value)
        try:
            return int(clean_value) if clean_value else 0
        except ValueError:
            return 0
    
    def _parse_tournament_status(self, status: str) -> TournamentStatus:
        """Parse tournament status from string."""
        status_lower = status.lower()
        
        if status_lower in ['completed', 'finished', 'ended']:
            return TournamentStatus.COMPLETED
        elif status_lower in ['ongoing', 'live', 'active']:
            return TournamentStatus.ONGOING
        elif status_lower in ['cancelled', 'canceled']:
            return TournamentStatus.CANCELLED
        else:
            return TournamentStatus.UPCOMING
    
    def _parse_match_from_lpdb(self, match_raw: Dict[str, Any], 
                             opponents: List[Dict[str, Any]],
                             games: List[Dict[str, Any]]) -> Optional[Match]:
        """Parse a single match from LPDB data."""
        match_id = match_raw.get('matchid', '')
        if not match_id:
            return None
        
        # Parse teams from opponents
        if len(opponents) < 2:
            logger.warning(f"Match {match_id} has insufficient opponents: {len(opponents)}")
            return None
        
        try:
            team1 = self._parse_team_from_opponent(opponents[0])
            team2 = self._parse_team_from_opponent(opponents[1])
            
            if not team1 or not team2:
                logger.warning(f"Failed to parse teams for match {match_id}")
                return None
            
            # Create match
            match = Match(
                match_id=match_id,
                team1=team1,
                team2=team2,
                best_of=int(match_raw.get('bestof', 1)),
                status=self._parse_match_status(match_raw.get('status', '')),
                match_date=self._parse_datetime(match_raw.get('date', '')),
                stage=match_raw.get('stage', '')
            )
            
            # Parse games
            for i, game_raw in enumerate(sorted(games, key=lambda g: int(g.get('game', 0)))):
                game = self._parse_game_from_lpdb(game_raw, i + 1, team1, team2)
                if game:
                    match.add_game(game)
            
            # Determine winner based on games
            if match.games:
                team1_wins = sum(1 for game in match.games if game.winner == team1)
                team2_wins = sum(1 for game in match.games if game.winner == team2)
                
                if team1_wins > team2_wins:
                    match.winner = team1
                elif team2_wins > team1_wins:
                    match.winner = team2
                
                # Update status if match is completed
                if team1_wins + team2_wins == len(match.games) and match.winner:
                    match.status = MatchStatus.COMPLETED
            
            return match
            
        except Exception as e:
            logger.warning(f"Error parsing match {match_id}: {e}")
            return None
    
    def _parse_team_from_opponent(self, opponent: Dict[str, Any]) -> Optional[Team]:
        """Parse a team from LPDB opponent data."""
        # Get player names
        player1_name = opponent.get('p1', '').strip()
        player2_name = opponent.get('p2', '').strip()
        
        if not player1_name or not player2_name:
            return None
        
        # Create or get players from cache
        player1 = self._get_or_create_player(player1_name)
        player2 = self._get_or_create_player(player2_name)
        
        # Create or get team from cache
        team_key = tuple(sorted([player1.liquipedia_slug, player2.liquipedia_slug]))
        if team_key in self.teams_cache:
            return self.teams_cache[team_key]
        
        # Create new team
        team_name = opponent.get('team', f"{player1.name} + {player2.name}")
        team = Team(
            name=team_name,
            player1=player1,
            player2=player2
        )
        
        self.teams_cache[team_key] = team
        return team
    
    def _get_or_create_player(self, name: str) -> Player:
        """Get existing player or create new one."""
        # Use name as slug for now (could be improved with proper slug mapping)
        slug = name.replace(' ', '_')
        
        if slug in self.players_cache:
            return self.players_cache[slug]
        
        player = Player(
            name=name,
            liquipedia_slug=slug
        )
        
        self.players_cache[slug] = player
        return player
    
    def _parse_game_from_lpdb(self, game_raw: Dict[str, Any], game_number: int,
                            team1: Team, team2: Team) -> Optional[Game]:
        """Parse a single game from LPDB data."""
        map_name = game_raw.get('map', '').strip()
        if not map_name:
            return None
        
        # Determine winner
        winner = None
        winner_num = game_raw.get('winner', '')
        if winner_num == '1':
            winner = team1
        elif winner_num == '2':
            winner = team2
        
        # Parse duration
        duration = None
        duration_str = game_raw.get('length', '')
        if duration_str:
            try:
                # Assume duration is in format "MM:SS" or just seconds
                if ':' in duration_str:
                    parts = duration_str.split(':')
                    duration = int(parts[0]) * 60 + int(parts[1])
                else:
                    duration = int(duration_str)
            except ValueError:
                pass
        
        return Game(
            game_number=game_number,
            map_name=map_name,
            winner=winner,
            duration_seconds=duration
        )
    
    def _parse_match_status(self, status: str) -> MatchStatus:
        """Parse match status from string."""
        status_lower = status.lower()
        
        if status_lower in ['completed', 'finished']:
            return MatchStatus.COMPLETED
        elif status_lower in ['ongoing', 'live']:
            return MatchStatus.IN_PROGRESS
        elif status_lower in ['cancelled', 'canceled']:
            return MatchStatus.CANCELLED
        else:
            return MatchStatus.SCHEDULED
    
    def _parse_datetime(self, date_str: str) -> Optional[datetime]:
        """Parse datetime from various string formats."""
        if not date_str:
            return None
        
        # Try common datetime formats
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y-%m-%d',
            '%Y/%m/%d',
            '%d/%m/%Y',
            '%m/%d/%Y'
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        
        logger.warning(f"Could not parse datetime: {date_str}")
        return None
    
    # Enhanced wikitext parsing helper methods
    def _extract_match_content(self, wikitext: str, match_id: str) -> str:
        """Extract the content of a specific match block."""
        start_marker = f"{match_id}={{{{Match"
        start_pos = wikitext.find(start_marker)
        if start_pos == -1:
            return None
        
        # Find the end of the match block by counting braces
        brace_count = 0
        end_pos = start_pos
        for i, char in enumerate(wikitext[start_pos:], start_pos):
            if char == '{':
                brace_count += 1
            elif char == '}':
                brace_count -= 1
                if brace_count == 0:
                    end_pos = i + 1
                    break
        
        return wikitext[start_pos:end_pos]
    
    def _extract_opponents(self, match_content: str) -> tuple:
        """Extract opponent information from match content."""
        # Look for opponent1 and opponent2 patterns - handle race info between p1 and p2
        opponent1_pattern = r'opponent1=\{\{2Opponent\|p1=([^|]+)(?:\|p1race=[^|]+)?\|p2=([^|}]+)'
        opponent2_pattern = r'opponent2=\{\{2Opponent\|p1=([^|]+)(?:\|p1race=[^|]+)?\|p2=([^|}]+)'
        
        opponent1_match = re.search(opponent1_pattern, match_content)
        opponent2_match = re.search(opponent2_pattern, match_content)
        
        if not opponent1_match or not opponent2_match:
            return None
        
        p1_1 = opponent1_match.group(1)
        p1_2 = opponent1_match.group(2)
        p2_1 = opponent2_match.group(1)
        p2_2 = opponent2_match.group(2)
        
        return (p1_1, p1_2, p2_1, p2_2)
    
    def _get_or_create_player_by_name(self, name: str) -> Player:
        """Get or create a player by name (for enhanced wikitext parsing)."""
        if name in self.players_cache_by_name:
            return self.players_cache_by_name[name]
        
        # Clean up the name (remove any extra formatting)
        clean_name = re.sub(r'[{}]', '', name).strip()
        
        player = Player(
            name=clean_name,
            liquipedia_slug=clean_name.lower().replace(' ', '_'),
            nationality=None,
            race=None
        )
        
        self.players_cache_by_name[name] = player
        return player
    
    def _get_or_create_team_by_players(self, name: str, player1: Player, player2: Player) -> Team:
        """Get or create a team by players (for enhanced wikitext parsing)."""
        team_key = f"{player1.name}+{player2.name}"
        if team_key in self.teams_cache_by_key:
            return self.teams_cache_by_key[team_key]
        
        team = Team(
            name=name,
            player1=player1,
            player2=player2
        )
        
        self.teams_cache_by_key[team_key] = team
        return team
    
    def _create_match_from_wikitext(self, tournament: Tournament, match_id: str, team1: Team, team2: Team, match_content: str) -> Match:
        """Create a match from wikitext data."""
        # Extract match details
        best_of = self._extract_best_of(match_content)
        date_str = self._extract_date_from_content(match_content)
        stage = self._extract_stage(match_id)
        
        # Create match
        match = Match(
            match_id=match_id,
            team1=team1,
            team2=team2,
            best_of=best_of or 3,
            status=MatchStatus.COMPLETED,  # Assume completed for now
            stage=stage,
            match_date=date_str
        )
        
        # Extract games
        games = self._extract_games_from_content(match_content, team1, team2)
        match.games = games
        
        # Determine winner based on games
        if games:
            team1_wins = sum(1 for game in games if game.winner == team1)
            team2_wins = sum(1 for game in games if game.winner == team2)
            
            if team1_wins > team2_wins:
                match.winner = team1
            elif team2_wins > team1_wins:
                match.winner = team2
        
        return match
    
    def _extract_best_of(self, match_content: str) -> int:
        """Extract best of value from match content."""
        best_of_match = re.search(r'bestof=(\d+)', match_content)
        if best_of_match:
            return int(best_of_match.group(1))
        return 3  # Default to best of 3
    
    def _extract_date_from_content(self, match_content: str) -> str:
        """Extract date from match content."""
        date_match = re.search(r'date=([^|}]+)', match_content)
        if date_match:
            date_str = date_match.group(1)
            # Clean up the date string
            date_str = re.sub(r'\{\{abbr/[^}]*\}\}', '', date_str).strip()
            return date_str
        return None
    
    def _extract_stage(self, match_id: str) -> str:
        """Extract stage from match ID."""
        if match_id.startswith('R'):
            return "Playoffs"
        elif match_id.startswith('M'):
            return "Group Stage"
        return "Unknown"
    
    def _extract_games_from_content(self, match_content: str, team1: Team, team2: Team) -> List[Game]:
        """Extract games from match content."""
        games = []
        
        # Find all map entries - Updated regex to handle parameters between {{Map| and map=
        # and handle winner=skip cases
        map_pattern = r'map(\d+)=\{\{Map\|[^}]*?map=([^|}]+)[^}]*?\|winner=([^|}]+)[^}]*\}\}'
        map_matches = re.findall(map_pattern, match_content)
        
        for game_num_str, map_name, winner_str in map_matches:
            try:
                game_number = int(game_num_str)
                
                # Handle different winner formats
                winner = None
                if winner_str == "skip":
                    continue  # Skip this game - it wasn't played
                elif winner_str == "0":
                    continue  # Skip this game - no winner
                else:
                    try:
                        winner_num = int(winner_str)
                        if winner_num == 1:
                            winner = team1
                        elif winner_num == 2:
                            winner = team2
                        else:
                            continue  # Invalid winner number
                    except ValueError:
                        continue  # Invalid winner format
                
                game = Game(
                    game_number=game_number,
                    map_name=map_name,
                    winner=winner,
                    duration_seconds=None
                )
                
                games.append(game)
                
            except (ValueError, IndexError):
                continue
        
        return games
