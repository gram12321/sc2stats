#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple script to run the SC2 tournament scraper.
This can be called from the web interface or run manually.
"""

import sys
import os

# Set UTF-8 encoding for stdout
import codecs
if sys.stdout.encoding != 'utf-8':
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
if sys.stderr.encoding != 'utf-8':
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

# Add the scraper directory to the path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from scraper import SC2Scraper
from scraper_config import config

def main():
    """Main function to run the scraper."""
    print("Starting SC2 Tournament Scraper...")
    
    try:
        scraper = SC2Scraper(config)
        
        # Default tournament to scrape
        tournament_series = "UThermal_2v2_Circuit"
        
        print(f"Scraping tournament series: {tournament_series}")
        
        # Find subevents and scrape them
        subevents = scraper.find_subevents(tournament_series)
        target_tournaments = [f"{tournament_series}/{subevent}" for subevent in subevents]
        
        print(f"Found {len(target_tournaments)} tournaments to scrape")
        
        # Run the scraper
        combined_data = scraper.scrape_multiple_tournaments(target_tournaments)
        
        if not combined_data:
            print("Failed to scrape tournament data")
            return False
        
        print(f"Scraping completed successfully!")
        print(f"Tournaments: {len(combined_data.get('tournaments', []))}")
        print(f"Matches: {len(combined_data.get('matches', []))}")
        print(f"Players: {len(combined_data.get('players', []))}")
        
        # Try to insert into database
        from database_inserter import insert_tournament_data
        import json
        import os
        
        # Save to temp file first
        temp_file = os.path.join(os.path.dirname(__file__), 'temp_data.json')
        with open(temp_file, 'w', encoding='utf-8') as f:
            json.dump(combined_data, f, indent=2, ensure_ascii=False, default=str)
        
        # Insert into database
        success = insert_tournament_data(temp_file, config)
        
        # Clean up temp file
        if os.path.exists(temp_file):
            os.remove(temp_file)
        
        if success:
            print("Database insertion completed successfully!")
        else:
            print("Database insertion failed - check logs for details")
            
        return True
        
    except Exception as e:
        print(f"Scraper failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
