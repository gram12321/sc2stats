from __future__ import annotations

import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List

from mediawiki_client import MediaWikiClient
from config import load_liquipedia_config, LiquipediaConfig
from parse_tournament import parse_tournament_content, write_parsed_data

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

EVENT_SLUG = "UThermal_2v2_Circuit/Main_Event"
OUTPUT_DIR = Path("output/raw/")


def ensure_output_dir() -> None:
    """Ensure output directory exists."""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)


def fetch_tournament_data(event_slug: str = EVENT_SLUG) -> Dict[str, Any]:
    """Fetch tournament data using MediaWiki API."""
    cfg = load_liquipedia_config()
    client = MediaWikiClient(user_agent=cfg.user_agent)
    
    logger.info(f"Fetching tournament page: {event_slug}")
    
    try:
        # Get the main tournament page content
        content = client.get_page_content(event_slug)
        if not content:
            raise ValueError(f"Could not fetch content for {event_slug}")
        
        logger.info(f"Retrieved {len(content)} characters of content")
        
        # Parse the tournament content
        tournament_data = parse_tournament_content(content)
        
        # Also try to get related pages
        related_pages = client.search_pages(f"UThermal 2v2 Circuit", limit=20)
        
        # Get cache statistics
        cache_stats = client.get_cache_stats()
        
        return {
            "event_slug": event_slug,
            "page_content": content,
            "tournament_data": tournament_data,
            "related_pages": related_pages,
            "fetch_timestamp": datetime.now().isoformat(),
            "cache_stats": cache_stats,
            "config": {
                "user_agent": cfg.user_agent,
                "rate_limit_delay": cfg.rate_limit_delay,
                "max_retries": cfg.max_retries,
            }
        }
        
    except Exception as e:
        logger.error(f"Error fetching tournament data: {e}")
        raise


def write_raw(data: Dict[str, Any]) -> None:
    """Write raw data to output files."""
    ensure_output_dir()
    
    # Convert TournamentData to dict for JSON serialization
    json_data = data.copy()
    if "tournament_data" in json_data:
        # Convert TournamentData to dict
        tournament_dict = {
            "name": json_data["tournament_data"].name,
            "start_date": json_data["tournament_data"].start_date,
            "end_date": json_data["tournament_data"].end_date,
            "prize_pool": json_data["tournament_data"].prize_pool,
            "maps": json_data["tournament_data"].maps,
            "matches_count": len(json_data["tournament_data"].matches),
            "players_count": len(json_data["tournament_data"].players),
            "race_counts": json_data["tournament_data"].race_counts,
        }
        json_data["tournament_data"] = tournament_dict
    
    # Write the full response
    with (OUTPUT_DIR / "tournament_data.json").open("w", encoding="utf-8") as f:
        json.dump(json_data, f, ensure_ascii=False, indent=2)
    
    # Write just the page content for inspection
    with (OUTPUT_DIR / "page_content.txt").open("w", encoding="utf-8") as f:
        f.write(data["page_content"])
    
    logger.info(f"Raw data written to {OUTPUT_DIR}")


def main() -> None:
    """Main function to fetch tournament data."""
    try:
        data = fetch_tournament_data(EVENT_SLUG)
        write_raw(data)
        
        # Parse and write structured data
        tournament_data = data["tournament_data"]
        write_parsed_data(tournament_data)
        
        logger.info("Tournament data fetched and parsed successfully!")
        
        # Print summary
        logger.info(f"Tournament: {tournament_data.name}")
        logger.info(f"Dates: {tournament_data.start_date} - {tournament_data.end_date}")
        logger.info(f"Prize Pool: ${tournament_data.prize_pool:,}")
        logger.info(f"Maps: {len(tournament_data.maps)}")
        logger.info(f"Matches: {len(tournament_data.matches)}")
        logger.info(f"Players: {len(tournament_data.players)}")
        logger.info(f"Race counts: {tournament_data.race_counts}")
        
        # Print cache stats
        cache_stats = data.get("cache_stats", {})
        logger.info(f"Cache stats: {cache_stats}")
              
    except Exception as e:
        logger.error(f"Failed to fetch tournament data: {e}")
        raise


if __name__ == "__main__":
    main()
