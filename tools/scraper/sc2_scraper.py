"""
Unified SC2 Tournament Scraper.
Main scraper class that orchestrates data extraction from Liquipedia.
"""
from __future__ import annotations

import logging
from datetime import datetime
from typing import List, Optional, Dict, Any

from scraper_config import ScraperConfig, config
from liquipedia_client import LiquipediaClient
from data_parser import DataParser
from data_models import Tournament, ScrapingTask, ScrapingResult
from real_mcp_client import RealMCPDatabaseClient

logger = logging.getLogger(__name__)


class SC2Scraper:
    """Unified scraper for SC2 tournament data from Liquipedia."""
    
    def __init__(self, scraper_config: Optional[ScraperConfig] = None):
        """Initialize the scraper with configuration."""
        self.config = scraper_config or config
        self.client = LiquipediaClient(self.config)
        self.parser = DataParser()
        self.database = RealMCPDatabaseClient(self.config)
        self.tasks: List[ScrapingTask] = []
        self.results: List[ScrapingResult] = []
        
        logger.info("SC2 Scraper initialized")
        
        # Test database connection if enabled
        if self.database.enabled:
            if self.database.test_connection():
                logger.info("✅ Database connection successful")
            else:
                logger.warning("⚠️ Database connection failed")
    
    def add_tournament(self, tournament_slug: str, priority: int = 1) -> None:
        """Add a tournament to the scraping queue."""
        task = ScrapingTask(
            tournament_slug=tournament_slug,
            priority=priority,
            max_retries=self.config.max_retries
        )
        self.tasks.append(task)
        logger.info(f"Added tournament task: {tournament_slug} (priority: {priority})")
    
    def add_tournament_series(self, base_slug: str, count: int = 5) -> None:
        """Add multiple tournaments from a series (e.g., qualifiers)."""
        for i in range(1, count + 1):
            slug = f"{base_slug}_{i}" if i > 1 else base_slug
            priority = count - i + 1  # Higher priority for newer tournaments
            self.add_tournament(slug, priority)
    
    def scrape_all(self) -> List[ScrapingResult]:
        """Scrape all tournaments in the queue."""
        if not self.tasks:
            logger.info("No tournaments to scrape")
            return []
        
        # Sort tasks by priority (higher first)
        self.tasks.sort(key=lambda t: t.priority, reverse=True)
        
        logger.info(f"Starting to scrape {len(self.tasks)} tournaments")
        results = []
        
        for task in self.tasks:
            result = self._scrape_tournament(task)
            results.append(result)
            self.results.append(result)
            
            if result.success:
                logger.info(f"✅ Successfully scraped {task.tournament_slug}: "
                          f"{result.matches_count} matches, {result.players_count} players")
            else:
                logger.error(f"❌ Failed to scrape {task.tournament_slug}: {result.error}")
        
        # Clear tasks after processing
        self.tasks.clear()
        
        logger.info(f"Scraping completed: {len([r for r in results if r.success])}/{len(results)} successful")
        return results
    
    def scrape_tournament(self, tournament_slug: str) -> ScrapingResult:
        """Scrape a single tournament."""
        task = ScrapingTask(
            tournament_slug=tournament_slug,
            max_retries=self.config.max_retries
        )
        result = self._scrape_tournament(task)
        self.results.append(result)
        return result
    
    def _scrape_tournament(self, task: ScrapingTask) -> ScrapingResult:
        """Internal method to scrape a single tournament."""
        start_time = datetime.now()
        tournament_slug = task.tournament_slug
        
        try:
            logger.info(f"🔍 Scraping tournament: {tournament_slug}")
            
            # Step 1: Get tournament page content
            logger.debug("Fetching tournament page content...")
            page_content = self.client.get_page_content(tournament_slug)
            if not page_content:
                raise ValueError(f"Could not fetch page content for {tournament_slug}")
            
            # Step 2: Parse basic tournament info from wikitext
            logger.debug("Parsing tournament metadata...")
            tournament = self.parser.parse_tournament_from_wikitext(tournament_slug, page_content)
            
            # Step 3: Get structured match data from LPDB
            logger.debug("Fetching match data from LPDB...")
            match_data = self.client.get_match_data(tournament_slug)
            opponent_data = self.client.get_match_opponents(tournament_slug)
            game_data = self.client.get_match_games(tournament_slug)
            
            logger.debug(f"Retrieved: {len(match_data)} matches, "
                        f"{len(opponent_data)} opponents, {len(game_data)} games")
            
            # Step 4: Parse and add match data to tournament
            if match_data and opponent_data:
                logger.debug("Parsing match data...")
                self.parser.parse_matches_from_lpdb(tournament, match_data, opponent_data, game_data)
            else:
                logger.warning(f"No match data found for {tournament_slug}")
            
            # Step 5: Save to database if enabled
            if self.database.enabled:
                logger.debug("Saving tournament data to database...")
                self._save_tournament_to_database(tournament)
            
            # Calculate processing time
            processing_time = (datetime.now() - start_time).total_seconds()
            
            # Create successful result
            result = ScrapingResult(
                tournament_slug=tournament_slug,
                success=True,
                tournament=tournament,
                processing_time=processing_time
            )
            
            logger.info(f"Successfully scraped {tournament_slug} in {processing_time:.2f}s")
            return result
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            error_msg = str(e)
            
            logger.error(f"Failed to scrape {tournament_slug}: {error_msg}")
            
            # Handle retries
            if task.should_retry():
                task.increment_retry()
                logger.info(f"Will retry {tournament_slug} (attempt {task.retry_count}/{task.max_retries})")
                # Re-add task to queue with lower priority
                retry_task = ScrapingTask(
                    tournament_slug=tournament_slug,
                    priority=max(1, task.priority - 1),
                    retry_count=task.retry_count,
                    max_retries=task.max_retries
                )
                self.tasks.append(retry_task)
            else:
                logger.warning(f"Max retries exceeded for {tournament_slug}")
            
            return ScrapingResult(
                tournament_slug=tournament_slug,
                success=False,
                error=error_msg,
                processing_time=processing_time
            )
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get scraping session statistics."""
        successful = [r for r in self.results if r.success]
        failed = [r for r in self.results if not r.success]
        
        total_processing_time = sum(r.processing_time for r in self.results)
        avg_processing_time = total_processing_time / len(self.results) if self.results else 0
        
        total_matches = sum(r.matches_count for r in successful)
        total_players = len(set().union(*[
            r.tournament.players for r in successful if r.tournament
        ])) if successful else 0
        
        stats = {
            'total_tournaments': len(self.results),
            'successful_tournaments': len(successful),
            'failed_tournaments': len(failed),
            'success_rate': len(successful) / len(self.results) if self.results else 0,
            'total_processing_time': total_processing_time,
            'avg_processing_time': avg_processing_time,
            'total_matches': total_matches,
            'total_unique_players': total_players,
            'cache_stats': self.client.get_cache_stats(),
            'database_enabled': self.database.enabled
        }
        
        # Add database statistics if enabled
        if self.database.enabled:
            stats['database_stats'] = self.get_database_statistics()
        
        return stats
    
    def clear_cache(self):
        """Clear all caches."""
        self.client.clear_cache()
        self.parser.players_cache.clear()
        self.parser.teams_cache.clear()
        logger.info("Cleared all caches")
    
    def get_tournament_by_slug(self, slug: str) -> Optional[Tournament]:
        """Get a scraped tournament by slug."""
        for result in self.results:
            if result.success and result.tournament and result.tournament.liquipedia_slug == slug:
                return result.tournament
        return None
    
    def get_all_tournaments(self) -> List[Tournament]:
        """Get all successfully scraped tournaments."""
        return [r.tournament for r in self.results if r.success and r.tournament]
    
    def _save_tournament_to_database(self, tournament: Tournament) -> None:
        """Save tournament data to the database."""
        try:
            logger.info(f"💾 Saving tournament to database: {tournament.name}")
            
            # Step 1: Insert tournament
            tournament.db_id = self.database.insert_tournament(
                name=tournament.name,
                liquipedia_slug=tournament.liquipedia_slug,
                start_date=tournament.start_date,
                end_date=tournament.end_date,
                prize_pool=tournament.prize_pool,
                location=tournament.location,
                status=tournament.status.value
            )
            
            # Step 2: Insert players and get their IDs
            for player in tournament.players:
                player.db_id = self.database.insert_player(
                    name=player.name,
                    liquipedia_slug=player.liquipedia_slug,
                    nationality=player.nationality,
                    preferred_race=player.race
                )
            
            # Step 3: Insert teams and get their IDs
            for team in tournament.teams:
                team.db_id = self.database.insert_team(
                    name=team.name,
                    player1_id=team.player1.db_id,
                    player2_id=team.player2.db_id
                )
            
            # Step 4: Insert matches and games
            for match in tournament.matches:
                # Insert match
                match_db_id = self.database.insert_match(
                    tournament_id=tournament.db_id,
                    match_id=match.match_id,
                    team1_id=match.team1.db_id,
                    team2_id=match.team2.db_id,
                    winner_id=match.winner.db_id if match.winner else None,
                    best_of=match.best_of,
                    status=match.status.value,
                    match_date=match.match_date,
                    stage=match.stage
                )
                
                # Insert games for this match
                for game in match.games:
                    self.database.insert_game(
                        match_db_id=match_db_id,
                        game_number=game.game_number,
                        map_name=game.map_name,
                        winner_id=game.winner.db_id if game.winner else None,
                        duration_seconds=game.duration_seconds
                    )
            
            logger.info(f"✅ Successfully saved tournament: {tournament.name}")
            logger.info(f"   📊 Saved: {len(tournament.players)} players, "
                       f"{len(tournament.teams)} teams, {len(tournament.matches)} matches")
            
        except Exception as e:
            logger.error(f"❌ Failed to save tournament to database: {e}")
            raise
    
    def get_database_statistics(self) -> Dict[str, Any]:
        """Get database statistics for all tournaments."""
        if not self.database.enabled:
            return {"database_enabled": False}
        
        all_tournaments = self.database.get_all_tournaments()
        total_stats = {"database_enabled": True, "tournaments": all_tournaments}
        
        for tournament in all_tournaments:
            slug = tournament.get("liquipedia_slug", "")
            if slug:
                stats = self.database.get_tournament_stats(slug)
                total_stats[slug] = stats
        
        return total_stats


# Main function removed - this is now a library module
# Use the scraper classes directly in your scripts
