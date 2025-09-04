#!/usr/bin/env python3
"""
Working scraper that extracts tournament data and outputs it in a format
that can be used to populate the database via MCP tools.
"""

import logging
import json
import re
from typing import List, Dict, Set
from database_inserter import insert_tournament_data
from scraper_config import load_scraper_config, ScraperConfig, config
from liquipedia_client import LiquipediaClient
from data_parser import DataParser

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

# Disable verbose httpx logging
logging.getLogger("httpx").setLevel(logging.WARNING)

logger = logging.getLogger(__name__)


class SC2Scraper:
    """Enhanced scraper for SC2 tournament data from Liquipedia with subevent detection."""
    
    def __init__(self, scraper_config: ScraperConfig = None):
        """Initialize the scraper with configuration."""
        self.config = scraper_config or config
        self.client = LiquipediaClient(self.config)
        self.parser = DataParser()
        
        logger.debug("SC2 Scraper initialized")

    def find_subevents(self, tournament_series: str) -> List[str]:
        """
        Generic subevent detector using MediaWiki API to find all pages in the tournament series.
        
        Args:
            tournament_series: Base tournament series (e.g., "UThermal_2v2_Circuit")
            
        Returns:
            List of subevent slugs relative to the series
        """
        logger.debug(f"🔍 Finding subevents for {tournament_series} using MediaWiki API")
        
        # Use MediaWiki API to find all pages with the tournament series prefix
        api_subevents = self._find_subevents_via_api(tournament_series)
        
        # Filter out non-tournament pages
        tournament_subevents = self._filter_tournament_pages(tournament_series, set(api_subevents))
        
        logger.debug(f"✅ Found {len(tournament_subevents)} tournament subevents: {sorted(tournament_subevents)}")
        return sorted(tournament_subevents)
    
    def _find_subevents_via_api(self, tournament_series: str) -> List[str]:
        """Find subevents using MediaWiki API to query all pages with the series prefix."""
        logger.debug(f"🌐 Querying MediaWiki API for series: {tournament_series}")
        
        try:
            # Check if we can access the session from our client
            if not hasattr(self.client, 'session'):
                logger.warning("Cannot access session object from LiquipediaClient")
                return []
            
            base_url = 'https://liquipedia.net/starcraft2/api.php'
            # Convert underscores to spaces for the API query (MediaWiki page titles use spaces)
            series_with_spaces = tournament_series.replace('_', ' ')
            params = {
                'action': 'query',
                'list': 'allpages',
                'apprefix': f'{series_with_spaces}/',
                'aplimit': 100,  # Increase limit to catch more subevents
                'format': 'json'
            }
            
            response = self.client.session.get(base_url, params=params)
            if response.status_code != 200:
                logger.error(f"MediaWiki API request failed: {response.status_code}")
                return []
            
            data = response.json()
            pages = data.get('query', {}).get('allpages', [])
            
            # Extract subevent names (remove the series prefix)
            subevents = []
            for page in pages:
                title = page.get('title', '')
                # Use the space version for matching since that's what the API returns
                if title.startswith(f'{series_with_spaces}/'):
                    subevent = title.replace(f'{series_with_spaces}/', '', 1)
                    subevents.append(subevent)
            
            logger.debug(f"🎯 API found {len(subevents)} pages: {sorted(subevents)}")
            return subevents
            
        except Exception as e:
            logger.error(f"Error querying MediaWiki API: {e}")
            return []
    
    def _is_likely_tournament_page(self, content: str) -> bool:
        """Quick check to determine if a page is likely a tournament page."""
        # Check for tournament indicators
        tournament_indicators = [
            '{{Infobox',  # Tournament infobox
            'bracket', 'match', 'result', 'score',  # Match-related content
            'prize', 'pool', 'format',  # Tournament info
            'participant', 'player', 'team',  # Competitors
        ]
        
        content_lower = content.lower()
        indicator_count = sum(1 for indicator in tournament_indicators if indicator in content_lower)
        
        # If we find multiple indicators, it's likely a tournament page
        return indicator_count >= 2
    
    def _filter_tournament_pages(self, tournament_series: str, subevents: Set[str]) -> List[str]:
        """Filter out non-tournament pages from the subevent list."""
        # Known non-tournament page patterns (case-insensitive)
        non_tournament_patterns = [
            'standings', 'statistics', 'results', 'participants', 'format',
            'maps', 'schedule', 'broadcast', 'vods', 'replays', 'links',
            'gallery', 'media', 'news', 'coverage'
        ]
        
        tournament_subevents = []
        
        logger.debug(f"🔍 Filtering {len(subevents)} potential subevents...")
        
        for subevent in subevents:
            # Skip if it matches non-tournament patterns
            subevent_lower = subevent.lower()
            if any(pattern in subevent_lower for pattern in non_tournament_patterns):
                logger.debug(f"  📄 Skipping info page: {subevent}")
                continue
            
            # Quick content check to verify it's a tournament
            try:
                url = f"{tournament_series}/{subevent}"
                content = self.client.get_page_content(url)
                
                if content and len(content) > 1000 and self._is_likely_tournament_page(content):
                    tournament_subevents.append(subevent)
                    logger.debug(f"  🏆 Confirmed tournament: {subevent}")
                else:
                    logger.debug(f"  📄 Not a tournament: {subevent}")
            except Exception as e:
                logger.warning(f"  ❌ Error checking {subevent}: {e}")
        
        return tournament_subevents
    
    def _normalize_team_name(self, team_name: str) -> str:
        """Normalize a team name to ensure consistent alphabetical ordering."""
        if not team_name or ' + ' not in team_name:
            return team_name
        players = [name.strip() for name in team_name.split(' + ')]
        if len(players) == 2:
            normalized_players = sorted(players)
            return f"{normalized_players[0]} + {normalized_players[1]}"
        return team_name
    
    def _merge_teams(self, teams_data: list, all_teams: dict) -> None:
        """Merge teams data avoiding duplicates by normalized player combination."""
        for team in teams_data:
            player1 = team['player1_name']
            player2 = team['player2_name']
            
            # Create normalized team key and data
            normalized_players = sorted([player1, player2])
            team_key = f"{normalized_players[0]}+{normalized_players[1]}"
            
            if team_key not in all_teams:
                all_teams[team_key] = {
                    'name': f"{normalized_players[0]} + {normalized_players[1]}",
                    'player1_name': normalized_players[0],
                    'player2_name': normalized_players[1]
                }
    
    def _merge_matches(self, matches_data: list, tournament_slug: str, all_matches: list) -> None:
        """Merge matches data with tournament reference and normalized team names."""
        tournament_prefix = tournament_slug.split('/')[-1]  # Get last part (e.g., "Main_Event" or "1")
        
        for match in matches_data:
            match["tournament_slug"] = tournament_slug
            
            # Make match IDs unique across tournaments by prefixing with tournament
            original_match_id = match.get("match_id", "")
            match["match_id"] = f"{tournament_prefix}_{original_match_id}"
            
            # Normalize team names to match the normalized teams list
            match["team1_name"] = self._normalize_team_name(match.get("team1_name", ""))
            match["team2_name"] = self._normalize_team_name(match.get("team2_name", ""))
            if "winner_name" in match:
                match["winner_name"] = self._normalize_team_name(match["winner_name"])
            
            all_matches.append(match)
    
    def scrape_tournament(self, tournament_slug: str) -> Dict:
        """
        Scrape a single tournament and return structured data.
        
        Args:
            tournament_slug: Full tournament slug (e.g., "UThermal_2v2_Circuit/1")
            
        Returns:
            Dictionary with tournament data ready for database insertion
        """
        logger.debug(f"Scraping tournament: {tournament_slug}")
        
        # Get tournament page content
        page_content = self.client.get_page_content(tournament_slug)
        if not page_content:
            logger.error(f"Failed to fetch page content for {tournament_slug}")
            return None
        
        logger.debug(f"Successfully fetched page content: {len(page_content)} characters")
        
        # Parse tournament metadata
        tournament = self.parser.parse_tournament_from_wikitext(tournament_slug, page_content)
        
        logger.debug(f"Parsed tournament: {tournament.name}")
        
        # Parse matches from wikitext
        self.parser.parse_matches_from_wikitext(tournament, page_content)
        
        # Convert to database format
        return self._convert_tournament_to_db_format(tournament)
    
    def scrape_multiple_tournaments(self, tournament_slugs: List[str]) -> Dict:
        """
        Scrape multiple tournaments and merge their data.
        
        Args:
            tournament_slugs: List of tournament slugs to scrape
            
        Returns:
            Combined tournament data ready for database insertion
        """
        logger.debug(f"Scraping {len(tournament_slugs)} tournaments")
        
        all_tournaments = []
        all_players = {}
        all_teams = {}
        all_matches = []
        
        for slug in tournament_slugs:
            # Clear parser caches to avoid conflicts between tournaments
            self.parser.players_cache.clear()
            self.parser.teams_cache.clear()
            logger.debug(f"🧹 Cleared parser caches for {slug}")
            
            tournament_data = self.scrape_tournament(slug)
            if tournament_data:
                all_tournaments.append(tournament_data["tournament"])
                
                # Merge players (avoid duplicates by name)
                for player in tournament_data["players"]:
                    all_players[player["name"]] = player
                
                # Merge teams and matches
                self._merge_teams(tournament_data["teams"], all_teams)
                self._merge_matches(tournament_data["matches"], slug, all_matches)
        
        return {
            "tournaments": all_tournaments,
            "players": list(all_players.values()),
            "teams": list(all_teams.values()),
            "matches": all_matches
        }
    
    def _convert_tournament_to_db_format(self, tournament) -> Dict:
        """Convert a Tournament object to database format."""
        # Convert tournament to database format
        tournament_data = {
            "name": tournament.name,
            "liquipedia_slug": tournament.liquipedia_slug,
            "start_date": str(tournament.start_date) if tournament.start_date else None,
            "end_date": str(tournament.end_date) if tournament.end_date else None,
            "prize_pool": tournament.prize_pool,
            "location": tournament.location,
            "status": tournament.status.value
        }
        
        # Convert players to database format
        players_data = []
        for player in tournament.players:
            players_data.append({
                "liquipedia_slug": player.liquipedia_slug,
                "name": player.name,
                "nationality": player.nationality,
                "preferred_race": player.race
            })
        
        # Convert teams to database format
        teams_data = []
        for team in tournament.teams:
            teams_data.append({
                "name": team.name,
                "player1_name": team.player1.name,
                "player2_name": team.player2.name
            })
        
        # Convert matches to database format
        matches_data = []
        for match in tournament.matches:
            match_data = {
                "match_id": match.match_id,
                "team1_name": match.team1.name,
                "team2_name": match.team2.name,
                "best_of": match.best_of,
                "status": match.status.value,
                "stage": match.stage
            }
            
            # Add winner info if available
            if match.winner:
                match_data["winner_name"] = match.winner.name
            
            # Add games
            games_data = []
            for game in match.games:
                game_data = {
                    "game_number": game.game_number,
                    "map_name": game.map_name
                }
                if game.winner:
                    game_data["winner_name"] = game.winner.name
                if game.duration_seconds:
                    game_data["duration_seconds"] = game.duration_seconds
                games_data.append(game_data)
            
            match_data["games"] = games_data
            matches_data.append(match_data)
        
        return {
            "tournament": tournament_data,
            "players": players_data,
            "teams": teams_data,
            "matches": matches_data
        }
        

def main():
    """Scrape UThermal tournament with automatic subevent detection - ALL subevents."""
    print("Enhanced SC2 Tournament Scraper with Subevent Detection")
    print("=" * 60)
    
    scraper = SC2Scraper()
    tournament_series = "UThermal_2v2_Circuit"
    
    try:
        # Scrape all tournaments
        combined_data = _scrape_all_tournaments(scraper, tournament_series)
        if not combined_data:
            print("❌ Failed to scrape tournament data")
            return
        
        # Show summary and save data
        _show_scraping_summary(combined_data)
        json_file_path = _save_tournament_data(combined_data)
        
        # Attempt database insertion
        _attempt_database_insertion(json_file_path)
        
    except Exception as e:
        print(f"❌ Scraping failed: {e}")
        import traceback
        traceback.print_exc()


def _scrape_all_tournaments(scraper: SC2Scraper, tournament_series: str) -> dict:
    """Find and scrape all tournaments in the series."""
    subevents = scraper.find_subevents(tournament_series)
    
    target_tournaments = [f"{tournament_series}/{subevent}" for subevent in subevents]
    print(f"🎯 Scraping {len(target_tournaments)} tournaments...")
    
    return scraper.scrape_multiple_tournaments(target_tournaments)


def _show_scraping_summary(combined_data: dict) -> None:
    """Display scraping summary and match distribution."""
    print(f"\n📈 Scraping Summary:")
    print(f"   Tournaments: {len(combined_data['tournaments'])}")
    print(f"   Players: {len(combined_data['players'])}")
    print(f"   Teams: {len(combined_data['teams'])}")
    print(f"   Matches: {len(combined_data['matches'])}")
    
    # Show match distribution
    match_by_tournament = {}
    for match in combined_data['matches']:
        slug = match.get('tournament_slug', 'unknown')
        match_by_tournament[slug] = match_by_tournament.get(slug, 0) + 1
    
    print(f"\n   Match Distribution:")
    for slug, count in match_by_tournament.items():
        print(f"     {slug}: {count} matches")


def _save_tournament_data(combined_data: dict) -> str:
    """Save tournament data to JSON file."""
    json_file_path = "../../output/tournament_data.json"
    with open(json_file_path, "w", encoding="utf-8") as f:
        json.dump(combined_data, f, indent=2, ensure_ascii=False, default=str)
    
    print(f"\n💾 Data saved to {json_file_path}")
    return json_file_path


def _attempt_database_insertion(json_file_path: str) -> None:
    """Attempt to insert data into database."""
    print(f"\n🗄️  Attempting database insertion...")
    try:
        config = load_scraper_config()
        success = insert_tournament_data(json_file_path, config)
        
        if success:
            print(f"✅ Database insertion completed successfully!")
            print(f"   All tournaments and their data have been inserted")
        else:
            print(f"⚠️  Database insertion skipped or failed.")
            print(f"   Data is ready in {json_file_path} for MCP-based insertion")
            
    except Exception as e:
        print(f"❌ Direct database connection failed: {str(e)[:100]}...")
        print(f"   This is expected if Supabase doesn't allow direct PostgreSQL connections")
        print(f"   Data is ready in {json_file_path} for MCP-based insertion")
        logging.debug(f"Database insertion failed: {e}", exc_info=True)

if __name__ == "__main__":
    main()
