#!/usr/bin/env python3
"""
Working scraper that extracts tournament data and outputs it in a format
that can be used to populate the database via MCP tools.
"""

import logging
import json
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
    """Minimal scraper for SC2 tournament data from Liquipedia."""
    
    def __init__(self, scraper_config: ScraperConfig = None):
        """Initialize the scraper with configuration."""
        self.config = scraper_config or config
        self.client = LiquipediaClient(self.config)
        self.parser = DataParser()
        
        logger.info("SC2 Scraper initialized")


def main():
    """Scrape the UThermal tournament and output data for database insertion."""
    print("🚀 Working SC2 Tournament Scraper")
    print("=" * 60)
    
    # Initialize scraper (without database)
    scraper = SC2Scraper()
    
    print("📋 Scraping UThermal 2v2 Circuit Main Event...")
    
    try:
        # Get tournament page content
        page_content = scraper.client.get_page_content("UThermal_2v2_Circuit/Main_Event")
        if not page_content:
            print("❌ Failed to fetch page content")
            return
        
        print(f"✅ Successfully fetched page content: {len(page_content)} characters")
        
        # Parse tournament metadata
        tournament = scraper.parser.parse_tournament_from_wikitext(
            "UThermal_2v2_Circuit/Main_Event", 
            page_content
        )
        
        print(f"✅ Successfully parsed tournament:")
        print(f"   Name: {tournament.name}")
        print(f"   Slug: {tournament.liquipedia_slug}")
        print(f"   Start Date: {tournament.start_date}")
        print(f"   End Date: {tournament.end_date}")
        print(f"   Prize Pool: ${tournament.prize_pool:,}" if tournament.prize_pool else "   Prize Pool: Not specified")
        print(f"   Location: {tournament.location}")
        print(f"   Status: {tournament.status.value}")
        print(f"   Maps: {len(tournament.maps)} maps")
        if tournament.maps:
            print(f"     • {', '.join(tournament.maps[:3])}{'...' if len(tournament.maps) > 3 else ''}")
        
        # Skip LPDB and go directly to wikitext parsing since LPDB API is not working
        print(f"\n📋 Skipping LPDB (known to be unavailable) and parsing matches from wikitext...")
        
        # Use enhanced wikitext parsing (now integrated into the main parser)
        scraper.parser.parse_matches_from_wikitext(tournament, page_content)
        
        # Show match details
        if tournament.matches:
            print(f"\n🏆 Match Results:")
            for i, match in enumerate(tournament.matches[:5]):  # Show first 5
                team1_names = f"{match.team1.player1.name} + {match.team1.player2.name}"
                team2_names = f"{match.team2.player1.name} + {match.team2.player2.name}"
                winner = "Team 1" if match.winner == match.team1 else "Team 2" if match.winner == match.team2 else "TBD"
                print(f"   Match {i+1}: {team1_names} vs {team2_names}")
                print(f"     Result: {match.score} (Winner: {winner})")
                print(f"     Maps: {len(match.games)} games")
                if match.games:
                    map_names = [game.map_name for game in match.games[:3]]
                    print(f"     Maps: {', '.join(map_names)}{'...' if len(match.games) > 3 else ''}")
        
        print(f"\n📊 Tournament Summary:")
        print(f"   Players: {len(tournament.players)}")
        print(f"   Teams: {len(tournament.teams)}")
        print(f"   Matches: {len(tournament.matches)}")
        print(f"   Total Games: {sum(len(match.games) for match in tournament.matches)}")
        
        # Output data for database insertion
        print(f"\n💾 Preparing data for database insertion...")
        
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
        
        # Create the complete data structure
        complete_data = {
            "tournament": tournament_data,
            "players": players_data,
            "teams": teams_data,
            "matches": matches_data
        }
        
        # Save to file for inspection
        json_file_path = "../../output/tournament_data.json"
        with open(json_file_path, "w", encoding="utf-8") as f:
            json.dump(complete_data, f, indent=2, ensure_ascii=False, default=str)
        
        print(f"✅ Data saved to {json_file_path}")
        
        # Show what we have
        print(f"\n📋 Data ready for database insertion:")
        print(f"   Tournament: {tournament_data['name']}")
        print(f"   Players: {len(players_data)}")
        print(f"   Teams: {len(teams_data)}")
        print(f"   Matches: {len(matches_data)}")
        print(f"   Total Games: {sum(len(match['games']) for match in matches_data)}")
        
        # Attempt database insertion
        print(f"\n🗄️ Attempting database insertion...")
        try:
            config = load_scraper_config()
            success = insert_tournament_data(json_file_path, config)
            
            if success:
                print(f"✅ Database insertion completed successfully!")
            else:
                print(f"⚠️ Database insertion skipped or failed.")
                print(f"💡 Data is ready in {json_file_path} for MCP-based insertion")
                
        except Exception as e:
            print(f"⚠️ Direct database connection failed: {str(e)[:100]}...")
            print(f"💡 This is expected if Supabase doesn't allow direct PostgreSQL connections")
            print(f"💡 Data is ready in {json_file_path} for MCP-based insertion")
            logging.debug(f"Database insertion failed: {e}", exc_info=True)
        
    except Exception as e:
        print(f"❌ Scraping failed: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    main()
