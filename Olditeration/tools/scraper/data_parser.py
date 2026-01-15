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
    """Wikitext parser for Liquipedia tournament data."""
    
    def __init__(self):
        self.players_cache: Dict[str, Player] = {}
        self.teams_cache: Dict[str, Team] = {}
    
    def parse_tournament_from_wikitext(self, tournament_slug: str, wikitext: str) -> Tournament:
        """Parse tournament data from MediaWiki wikitext."""
        logger.debug(f"Parsing tournament from wikitext: {tournament_slug}")
        
        # Parse infobox for tournament metadata
        infobox = self._parse_infobox(wikitext)
        
        # Handle single date events (use 'date' field for both start and end)
        start_date = infobox.get('sdate', '')
        end_date = infobox.get('edate', '')
        single_date = infobox.get('date', '')
        
        # If no start/end dates but single date exists, use it for both
        if not start_date and not end_date and single_date:
            start_date = single_date
            end_date = single_date
        
        # Create tournament with basic info
        tournament = Tournament(
            name=infobox.get('name', tournament_slug.replace('_', ' ')),
            liquipedia_slug=tournament_slug,
            start_date=start_date,
            end_date=end_date,
            prize_pool=self._parse_prize_pool(infobox.get('prizepool', '0')),
            location=infobox.get('location', infobox.get('country', '')),  # Fallback to country if no location
            status=self._parse_tournament_status(infobox.get('status', '')),
            maps=self._parse_maps(wikitext)
        )
        
        logger.debug(f"Parsed tournament: {tournament.name}")
        return tournament
    

    
    def parse_matches_from_wikitext(self, tournament: Tournament, wikitext: str) -> None:
        """Parse matches from wikitext content using enhanced parsing."""
        logger.debug("Parsing matches from wikitext...")
        
        # Find all match blocks with their positions to handle duplicates
        match_block_pattern = r'(\w+)=\{\{Match'
        match_positions = []
        
        # Find all matches with their positions in the text
        for match in re.finditer(match_block_pattern, wikitext):
            match_id = match.group(1)
            position = match.start()
            match_positions.append((match_id, position))
        
        logger.debug(f"Found {len(match_positions)} match blocks")
        
        # Track processed matches to handle duplicates between groups
        processed_matches = {}  # unique_key -> match_object
        existing_match_ids = set()  # For efficient lookups
        
        for i, (match_id, position) in enumerate(match_positions):
            try:
                match_content = self._extract_match_content_at_position(wikitext, match_id, position)
                if not match_content:
                    continue
                
                opponents = self._extract_opponents(match_content)
                if not opponents:
                    logger.warning(f"⚠️ Failed to extract opponents for match {match_id}")
                    continue
                
                # Create players and teams
                team1, team2 = self._create_teams_from_opponents(opponents)
                
                # Handle duplicate match IDs and create final match ID
                final_match_id = self._generate_final_match_id(tournament, match_id, existing_match_ids, i, team1, team2)
                
                # Create unique key to detect true duplicates (same teams, same match)
                unique_key = f"{team1.name}_vs_{team2.name}_{final_match_id}"
                if unique_key in processed_matches:
                    logger.warning(f"⚠️ True duplicate match detected: {final_match_id}")
                    continue
                
                # Create and store match
                match = self._create_match_from_wikitext(tournament, final_match_id, team1, team2, match_content)
                if match:
                    processed_matches[unique_key] = match
                    tournament.matches.append(match)
                    # Add the base match_id to existing_match_ids for Group A/B detection
                    # This ensures second occurrence of M1, M2, etc. will be detected as Group B
                    existing_match_ids.add(match_id)
                    logger.debug(f"Parsed match {final_match_id}: {team1.name} vs {team2.name}")
                
            except Exception as e:
                logger.warning(f"⚠️ Failed to parse match {match_id}: {e}")
        
        # Add players and teams to tournament
        tournament.players.update(self.players_cache.values())
        tournament.teams.update(self.teams_cache.values())
        
        logger.debug(f"Parsed {len(tournament.matches)} matches, {len(tournament.players)} players, {len(tournament.teams)} teams")
    
    def _parse_infobox(self, wikitext: str) -> Dict[str, str]:
        """Parse the tournament infobox from wikitext."""
        # Look for infobox pattern - more flexible to handle various formats
        infobox_pattern = r'\{\{Infobox\s+league\s*\n(.*?)\n\}\}'
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
        if not value or value == '0':
            return 0
        
        # Remove currency symbols, commas, and other non-digit characters
        clean_value = re.sub(r'[^\d]', '', value)
        try:
            return int(clean_value) if clean_value else 0
        except ValueError:
            logger.warning(f"Could not parse prize pool: {value}")
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
    

    

    
    def _get_or_create_player(self, name: str) -> Player:
        """Get existing player or create new one."""
        # Clean up the name (remove any extra formatting)
        clean_name = re.sub(r'[{}]', '', name).strip()
        slug = clean_name.lower().replace(' ', '_')
        
        if slug in self.players_cache:
            return self.players_cache[slug]
        
        player = Player(
            name=clean_name,
            liquipedia_slug=slug,
            nationality=None,
            race=None
        )
        
        self.players_cache[slug] = player
        return player
    

    
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
    
    # Enhanced wikitext parsing helper methods
    def _extract_match_content_at_position(self, wikitext: str, match_id: str, position: int) -> str:
        """Extract the content of a specific match block at a given position."""
        # Start from the specific position where this match_id was found
        start_marker = f"{match_id}={{{{Match"
        start_pos = wikitext.find(start_marker, position)
        
        # Also try with pipe prefix
        if start_pos == -1:
            start_marker = f"|{match_id}={{{{Match"
            start_pos = wikitext.find(start_marker, position)
        
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
        # Extract each opponent section separately to handle complex parameter structures
        opponent1_section = re.search(r'opponent1=\{\{2Opponent\|([^}]+)\}\}', match_content)
        opponent2_section = re.search(r'opponent2=\{\{2Opponent\|([^}]+)\}\}', match_content)
        
        if not opponent1_section or not opponent2_section:
            return None
        
        # Extract p1 and p2 from each section
        opp1_content = opponent1_section.group(1)
        opp2_content = opponent2_section.group(1)
        
        p1_1_match = re.search(r'p1=([^|]+)', opp1_content)
        p1_2_match = re.search(r'p2=([^|]+)', opp1_content)
        p2_1_match = re.search(r'p1=([^|]+)', opp2_content)
        p2_2_match = re.search(r'p2=([^|]+)', opp2_content)
        
        if not all([p1_1_match, p1_2_match, p2_1_match, p2_2_match]):
            return None
        
        p1_1 = p1_1_match.group(1)
        p1_2 = p1_2_match.group(1)
        p2_1 = p2_1_match.group(1)
        p2_2 = p2_2_match.group(1)
        
        return (p1_1, p1_2, p2_1, p2_2)
    
    def _create_teams_from_opponents(self, opponents: tuple) -> tuple:
        """Create team objects from opponent data."""
        p1_1, p1_2, p2_1, p2_2 = opponents
        
        # Create players
        player1_1 = self._get_or_create_player(p1_1.strip())
        player1_2 = self._get_or_create_player(p1_2.strip())
        player2_1 = self._get_or_create_player(p2_1.strip())
        player2_2 = self._get_or_create_player(p2_2.strip())
        
        # Create teams
        team1 = self._get_or_create_team(f"{player1_1.name} + {player1_2.name}", player1_1, player1_2)
        team2 = self._get_or_create_team(f"{player2_1.name} + {player2_2.name}", player2_1, player2_2)
        
        return team1, team2
    
    def _generate_final_match_id(self, tournament: Tournament, match_id: str, existing_match_ids: set, position: int, team1=None, team2=None) -> str:
        """Generate final match ID handling duplicates and prefixes."""
        base_slug = tournament.liquipedia_slug.replace('/', '_')
        
        # Handle Group A/B matches (M1, M2, etc.)
        if match_id.startswith('M') and match_id[1:].isdigit():
            if match_id in existing_match_ids:
                # Second occurrence = Group B
                final_id = f"{base_slug}_B_{match_id}"
                logger.debug(f"Group B match: {match_id} -> {final_id}")
                return final_id
            else:
                # First occurrence = Group A
                final_id = f"{base_slug}_A_{match_id}"
                logger.debug(f"Group A match: {match_id} -> {final_id}")
                return final_id
        
        # For bracket matches (R1M1, R2M1, etc.), use standard format
        return f"{base_slug}_{match_id}"

    def _get_or_create_team(self, name: str, player1: Player, player2: Player) -> Team:
        """Get or create a team by players."""
        # Create team key using normalized player order
        team_key = tuple(sorted([player1.liquipedia_slug, player2.liquipedia_slug]))
        if team_key in self.teams_cache:
            return self.teams_cache[team_key]
        
        team = Team(
            name=name,
            player1=player1,
            player2=player2
        )
        
        self.teams_cache[team_key] = team
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
        
        # Determine winner based on games or summary scores
        if games:
            team1_wins = sum(1 for game in games if game.winner == team1)
            team2_wins = sum(1 for game in games if game.winner == team2)
            
            if team1_wins > team2_wins:
                match.winner = team1
            elif team2_wins > team1_wins:
                match.winner = team2
            elif team1_wins == 0 and team2_wins == 0:
                # No individual game winners determined (summary scores only)
                # Extract winner from summary scores
                score1_pattern = r'opponent1=\{\{2Opponent\|[^}]*?\|score=(\d+)\}\}'
                score2_pattern = r'opponent2=\{\{2Opponent\|[^}]*?\|score=(\d+)\}\}'
                
                score1_match = re.search(score1_pattern, match_content)
                score2_match = re.search(score2_pattern, match_content)
                
                if score1_match and score2_match:
                    try:
                        score1 = int(score1_match.group(1))
                        score2 = int(score2_match.group(1))
                        
                        # Store the scores in the match
                        match.team1_score = score1
                        match.team2_score = score2
                        
                        if score1 > score2:
                            match.winner = team1
                        elif score2 > score1:
                            match.winner = team2
                    except (ValueError, IndexError):
                        pass
        
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
        
        # First try to find detailed map entries with individual game results
        map_pattern = r'map(\d+)=\{\{Map\|[^}]*?map=([^|}]+)[^}]*?\|winner=([^|}]+)[^}]*\}\}'
        map_matches = re.findall(map_pattern, match_content)
        
        # If we found detailed maps, process them
        if map_matches:
            
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
        
        else:
            # Fallback: If no detailed maps found, try to create games based on summary scores
            
            # Extract scores from opponent entries
            score1_pattern = r'opponent1=\{\{2Opponent\|[^}]*?\|score=(\d+)\}\}'
            score2_pattern = r'opponent2=\{\{2Opponent\|[^}]*?\|score=(\d+)\}\}'
            
            score1_match = re.search(score1_pattern, match_content)
            score2_match = re.search(score2_pattern, match_content)
            
            if score1_match and score2_match:
                try:
                    score1 = int(score1_match.group(1))
                    score2 = int(score2_match.group(1))
                    total_games = score1 + score2
                    
                    # Create games based on the scores - but don't assume order
                    # We'll create placeholder games with the correct final score
                    if total_games > 0:
                        # Create games with unknown individual results but correct final score
                        for game_num in range(1, total_games + 1):
                            # We can't determine individual game winners from summary scores
                            # So we'll create games with null winners but correct total count
                            game = Game(
                                game_number=game_num,
                                map_name="Unknown Map",  # No map info available
                                winner=None,  # Can't determine individual game winners
                                duration_seconds=None
                            )
                            games.append(game)
                            
                except (ValueError, IndexError):
                    pass
            else:
                logger.warning(f"No detailed maps or summary scores found for match")
        
        return games
