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

logger = logging.getLogger(__name__)


class SC2Scraper:
    """Enhanced scraper for SC2 tournament data from Liquipedia with subevent detection."""
    
    def __init__(self, scraper_config: ScraperConfig = None):
        """Initialize the scraper with configuration."""
        self.config = scraper_config or config
        self.client = LiquipediaClient(self.config)
        self.parser = DataParser()
        
        logger.info("SC2 Scraper initialized")

    def find_subevents(self, tournament_series: str) -> List[str]:
        """
        Generic subevent detector using MediaWiki API to find all pages in the tournament series.
        
        Args:
            tournament_series: Base tournament series (e.g., "UThermal_2v2_Circuit")
            
        Returns:
            List of subevent slugs relative to the series
        """
        logger.info(f"🔍 Finding subevents for {tournament_series} using MediaWiki API")
        
        # Use MediaWiki API to find all pages with the tournament series prefix
        api_subevents = self._find_subevents_via_api(tournament_series)
        
        # Filter out non-tournament pages
        tournament_subevents = self._filter_tournament_pages(tournament_series, set(api_subevents))
        
        logger.info(f"✅ Found {len(tournament_subevents)} tournament subevents: {sorted(tournament_subevents)}")
        return sorted(tournament_subevents)
    
    def _find_subevents_via_api(self, tournament_series: str) -> List[str]:
        """Find subevents using MediaWiki API to query all pages with the series prefix."""
        logger.info(f"🌐 Querying MediaWiki API for series: {tournament_series}")
        
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
            
            logger.info(f"🎯 API found {len(subevents)} pages: {sorted(subevents)}")
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
        
        logger.info(f"🔍 Filtering {len(subevents)} potential subevents...")
        
        for subevent in subevents:
            # Skip if it matches non-tournament patterns
            subevent_lower = subevent.lower()
            if any(pattern in subevent_lower for pattern in non_tournament_patterns):
                logger.info(f"  📄 Skipping info page: {subevent}")
                continue
            
            # Quick content check to verify it's a tournament
            try:
                url = f"{tournament_series}/{subevent}"
                content = self.client.get_page_content(url)
                
                if content and len(content) > 1000 and self._is_likely_tournament_page(content):
                    tournament_subevents.append(subevent)
                    logger.info(f"  🏆 Confirmed tournament: {subevent}")
                else:
                    logger.info(f"  📄 Not a tournament: {subevent}")
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
    
    def scrape_tournament(self, tournament_slug: str) -> Dict:
        """
        Scrape a single tournament and return structured data.
        
        Args:
            tournament_slug: Full tournament slug (e.g., "UThermal_2v2_Circuit/1")
            
        Returns:
            Dictionary with tournament data ready for database insertion
        """
        logger.info(f"Scraping tournament: {tournament_slug}")
        
        # Get tournament page content
        page_content = self.client.get_page_content(tournament_slug)
        if not page_content:
            logger.error(f"Failed to fetch page content for {tournament_slug}")
            return None
        
        logger.info(f"Successfully fetched page content: {len(page_content)} characters")
        
        # Parse tournament metadata
        tournament = self.parser.parse_tournament_from_wikitext(tournament_slug, page_content)
        
        logger.info(f"Parsed tournament: {tournament.name}")
        
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
        logger.info(f"Scraping {len(tournament_slugs)} tournaments")
        
        all_tournaments = []
        all_players = {}
        all_teams = {}
        all_matches = []
        
        for slug in tournament_slugs:
            # Clear parser caches to avoid conflicts between tournaments
            self.parser.players_cache.clear()
            self.parser.teams_cache.clear()
            logger.info(f"🧹 Cleared parser caches for {slug}")
            
            tournament_data = self.scrape_tournament(slug)
            if tournament_data:
                all_tournaments.append(tournament_data["tournament"])
                
                # Merge players (avoid duplicates by name)
                for player in tournament_data["players"]:
                    all_players[player["name"]] = player
                
                # Merge teams (avoid duplicates by normalized player combination)
                for team in tournament_data["teams"]:
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
                
                # Add matches with tournament reference and normalize team names
                for match in tournament_data["matches"]:
                    match["tournament_slug"] = slug
                    
                    # Make match IDs unique across tournaments by prefixing with tournament
                    tournament_prefix = slug.split('/')[-1]  # Get last part (e.g., "Main_Event" or "1")
                    original_match_id = match.get("match_id", "")
                    match["match_id"] = f"{tournament_prefix}_{original_match_id}"
                    
                    # Normalize team names to match the normalized teams list
                    match["team1_name"] = self._normalize_team_name(match.get("team1_name", ""))
                    match["team2_name"] = self._normalize_team_name(match.get("team2_name", ""))
                    if "winner_name" in match:
                        match["winner_name"] = self._normalize_team_name(match["winner_name"])
                    
                    all_matches.append(match)
        
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
    
    # Initialize scraper
    scraper = SC2Scraper()
    
    try:
        # Tournament series to scrape
        tournament_series = "UThermal_2v2_Circuit"
        
        # Step 1: Find subevents automatically
        print(f"🔍 Finding subevents for {tournament_series}...")
        subevents = scraper.find_subevents(tournament_series)
        
        # Step 2: Add all discovered subevents (including Main Event from API)
        target_tournaments = []
        
        # Add all discovered subevents - no hardcoding, use what API finds
        print(f"🔍 Adding all discovered subevents (including Main Event)...")
        for subevent in subevents:
            subevent_slug = f"{tournament_series}/{subevent}"
            target_tournaments.append(subevent_slug)
            print(f"✅ Added: {subevent_slug}")
        
        print(f"\n🎯 Scraping {len(target_tournaments)} tournaments:")
        for slug in target_tournaments:
            print(f"   - {slug}")
        
        # Step 3: Scrape all tournaments
        print(f"\n📊 Scraping tournament data...")
        combined_data = scraper.scrape_multiple_tournaments(target_tournaments)
        
        if not combined_data:
            print("❌ Failed to scrape tournament data")
            return
        
        # Step 4: Show summary
        print(f"\n📈 Scraping Summary:")
        print(f"   Tournaments: {len(combined_data['tournaments'])}")
        print(f"   Players: {len(combined_data['players'])}")
        print(f"   Teams: {len(combined_data['teams'])}")
        print(f"   Matches: {len(combined_data['matches'])}")
        
        # Show tournament details
        for i, tournament in enumerate(combined_data['tournaments']):
            print(f"\n   Tournament {i+1}: {tournament['name']}")
            print(f"     Slug: {tournament['liquipedia_slug']}")
            print(f"     Status: {tournament['status']}")
            if tournament['start_date']:
                print(f"     Date: {tournament['start_date']}")
        
        # Show match distribution
        match_by_tournament = {}
        for match in combined_data['matches']:
            slug = match.get('tournament_slug', 'unknown')
            match_by_tournament[slug] = match_by_tournament.get(slug, 0) + 1
        
        print(f"\n   Match Distribution:")
        for slug, count in match_by_tournament.items():
            print(f"     {slug}: {count} matches")
        
        # Step 5: Prepare final data structure for database insertion
        # Use the first tournament as primary, but include all match data
        final_data = {
            "tournaments": combined_data['tournaments'],
            "players": combined_data['players'],
            "teams": combined_data['teams'],
            "matches": combined_data['matches']
        }
        
        # Step 6: Save to file
        json_file_path = "../../output/tournament_data.json"
        with open(json_file_path, "w", encoding="utf-8") as f:
            json.dump(final_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"\n💾 Data saved to {json_file_path}")
        
        # Step 7: Attempt database insertion
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
        
    except Exception as e:
        print(f"❌ Scraping failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
