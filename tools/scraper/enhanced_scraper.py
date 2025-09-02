from __future__ import annotations

import json
import logging
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional, Set
from dataclasses import dataclass, asdict

from mediawiki_client import MediaWikiClient
from config import load_liquipedia_config, LiquipediaConfig

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class ScrapingTask:
    """Represents a scraping task."""
    event_slug: str
    priority: int = 1
    retry_count: int = 0
    max_retries: int = 3
    created_at: datetime = None
    
    def __post_init__(self):
        if self.created_at is None:
            self.created_at = datetime.now()
    
    def should_retry(self) -> bool:
        """Check if task should be retried."""
        return self.retry_count < self.max_retries
    
    def increment_retry(self):
        """Increment retry count."""
        self.retry_count += 1


@dataclass
class ScrapingResult:
    """Represents the result of a scraping operation."""
    event_slug: str
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    timestamp: datetime = None
    processing_time: float = 0.0
    cache_hits: int = 0
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now()


class EnhancedScraper:
    """Enhanced scraper with batch processing, caching, and error handling."""
    
    def __init__(self, config: Optional[LiquipediaConfig] = None):
        self.config = config or load_liquipedia_config()
        self.tasks: List[ScrapingTask] = []
        self.results: List[ScrapingResult] = []
        self.processed_slugs: Set[str] = set()
        
        # Ensure directories exist
        self.output_dir = Path(self.config.output_dir)
        self.cache_dir = Path(self.config.cache_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
    
    def add_task(self, event_slug: str, priority: int = 1) -> None:
        """Add a scraping task to the queue."""
        if event_slug not in self.processed_slugs:
            task = ScrapingTask(event_slug=event_slug, priority=priority)
            self.tasks.append(task)
            logger.info(f"Added task: {event_slug} (priority: {priority})")
    
    def add_tournament_series(self, base_slug: str, count: int = 5) -> None:
        """Add multiple tournaments from a series."""
        for i in range(1, count + 1):
            slug = f"{base_slug}_{i}" if i > 1 else base_slug
            self.add_task(slug, priority=count - i + 1)  # Higher priority for newer tournaments
    
    def process_tasks(self, max_concurrent: int = 1) -> List[ScrapingResult]:
        """Process all tasks sequentially (max_concurrent is kept for API compatibility)."""
        if not self.tasks:
            logger.info("No tasks to process")
            return []
        
        # Sort tasks by priority (higher priority first)
        self.tasks.sort(key=lambda t: t.priority, reverse=True)
        
        logger.info(f"Processing {len(self.tasks)} tasks sequentially")
        
        results = []
        
        for task in self.tasks:
            try:
                result = self._process_task(task)
                results.append(result)
                
                if result.success:
                    self.processed_slugs.add(result.event_slug)
                
                # Add delay between requests to respect rate limits
                if self.config.rate_limit_delay > 0:
                    time.sleep(self.config.rate_limit_delay)
                    
            except Exception as e:
                logger.error(f"Task {task.event_slug} failed with exception: {e}")
                result = ScrapingResult(
                    event_slug=task.event_slug,
                    success=False,
                    error=str(e)
                )
                results.append(result)
        
        # Store results and clear tasks
        self.results.extend(results)
        self.tasks.clear()
        
        return results
    
    def _process_task(self, task: ScrapingTask) -> ScrapingResult:
        """Process a single scraping task."""
        start_time = datetime.now()
        
        try:
            logger.info(f"Processing task: {task.event_slug}")
            
            # Check cache first
            cached_data = self._get_cached_data(task.event_slug)
            if cached_data:
                logger.info(f"Using cached data for {task.event_slug}")
                return ScrapingResult(
                    event_slug=task.event_slug,
                    success=True,
                    data=cached_data,
                    cache_hits=1,
                    processing_time=(datetime.now() - start_time).total_seconds()
                )
            
            # Create client and fetch fresh data
            client = MediaWikiClient(user_agent=self.config.user_agent)
            
            # Fetch page content
            content = client.get_page_content(task.event_slug)
            if not content:
                raise ValueError(f"Could not fetch content for {task.event_slug}")
            
            # Get related pages
            related_pages = client.search_pages(f"UThermal 2v2 Circuit", limit=20)
            
            # Get cache statistics
            cache_stats = client.get_cache_stats()
            
            data = {
                "event_slug": task.event_slug,
                "page_content": content,
                "related_pages": related_pages,
                "fetch_timestamp": datetime.now().isoformat(),
                "cache_stats": cache_stats,
                "config": {
                    "user_agent": self.config.user_agent,
                    "rate_limit_delay": self.config.rate_limit_delay,
                    "max_retries": self.config.max_retries,
                }
            }
            
            # Cache the data
            self._cache_data(task.event_slug, data)
            
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"Successfully processed {task.event_slug} in {processing_time:.2f}s")
            
            return ScrapingResult(
                event_slug=task.event_slug,
                success=True,
                data=data,
                processing_time=processing_time
            )
            
        except Exception as e:
            processing_time = (datetime.now() - start_time).total_seconds()
            logger.error(f"Failed to process {task.event_slug}: {e}")
            
            # Handle retries - only retry if we haven't exceeded max retries
            if task.should_retry():
                task.increment_retry()
                logger.info(f"Will retry {task.event_slug} (attempt {task.retry_count}/{task.max_retries})")
                # Re-add task to queue with lower priority, but only if it's not already there
                if task.event_slug not in [t.event_slug for t in self.tasks]:
                    self.add_task(task.event_slug, priority=task.priority - 1)
            else:
                logger.warning(f"Max retries exceeded for {task.event_slug}, giving up")
            
            return ScrapingResult(
                event_slug=task.event_slug,
                success=False,
                error=str(e),
                processing_time=processing_time
            )
    
    def _get_cached_data(self, event_slug: str) -> Optional[Dict[str, Any]]:
        """Get cached data for an event."""
        cache_file = self.cache_dir / f"{event_slug.replace('/', '_')}.json"
        
        if cache_file.exists():
            try:
                with cache_file.open('r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check if cache is still valid
                cache_timestamp = datetime.fromisoformat(data.get('fetch_timestamp', '1970-01-01'))
                if datetime.now() - cache_timestamp < timedelta(seconds=self.config.cache_ttl):
                    return data
                else:
                    logger.info(f"Cache expired for {event_slug}")
                    cache_file.unlink()  # Remove expired cache
                    
            except Exception as e:
                logger.warning(f"Failed to read cache for {event_slug}: {e}")
                if cache_file.exists():
                    cache_file.unlink()  # Remove corrupted cache
        
        return None
    
    def _cache_data(self, event_slug: str, data: Dict[str, Any]) -> None:
        """Cache data for an event."""
        cache_file = self.cache_dir / f"{event_slug.replace('/', '_')}.json"
        
        try:
            with cache_file.open('w', encoding='utf-8') as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            logger.debug(f"Cached data for {event_slug}")
        except Exception as e:
            logger.warning(f"Failed to cache data for {event_slug}: {e}")
    
    def save_results(self, filename: str = None) -> None:
        """Save all results to a JSON file."""
        if filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"scraping_results_{timestamp}.json"
        
        output_file = self.output_dir / filename
        
        # Convert results to serializable format
        serializable_results = []
        for result in self.results:
            result_dict = asdict(result)
            # Convert datetime objects to ISO strings
            if result_dict['timestamp']:
                result_dict['timestamp'] = result_dict['timestamp'].isoformat()
            serializable_results.append(result_dict)
        
        with output_file.open('w', encoding='utf-8') as f:
            json.dump({
                'scraping_session': {
                    'timestamp': datetime.now().isoformat(),
                    'total_tasks': len(self.results),
                    'successful_tasks': len([r for r in self.results if r.success]),
                    'failed_tasks': len([r for r in self.results if not r.success]),
                    'config': {
                        'user_agent': self.config.user_agent,
                        'rate_limit_delay': self.config.rate_limit_delay,
                        'max_retries': self.config.max_retries,
                        'cache_ttl': self.config.cache_ttl,
                        'output_dir': str(self.config.output_dir),
                        'cache_dir': str(self.config.cache_dir),
                    }
                },
                'results': serializable_results
            }, f, ensure_ascii=False, indent=2)
        
        logger.info(f"Results saved to {output_file}")
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get statistics about the scraping session."""
        successful = [r for r in self.results if r.success]
        failed = [r for r in self.results if not r.success]
        
        total_processing_time = sum(r.processing_time for r in self.results)
        avg_processing_time = total_processing_time / len(self.results) if self.results else 0
        
        return {
            'total_tasks': len(self.results),
            'successful_tasks': len(successful),
            'failed_tasks': len(failed),
            'success_rate': len(successful) / len(self.results) if self.results else 0,
            'total_processing_time': total_processing_time,
            'avg_processing_time': avg_processing_time,
            'cache_hits': sum(r.cache_hits for r in self.results),
            'processed_slugs': list(self.processed_slugs)
        }


def main():
    """Example usage of the enhanced scraper."""
    scraper = EnhancedScraper()
    
    # Add some example tasks
    scraper.add_task("UThermal_2v2_Circuit/Main_Event", priority=3)
    scraper.add_task("UThermal_2v2_Circuit/Qualifier_1", priority=2)
    scraper.add_task("UThermal_2v2_Circuit/Qualifier_2", priority=2)
    
    # Process all tasks
    results = scraper.process_tasks(max_concurrent=1)
    
    # Save results
    scraper.save_results()
    
    # Print statistics
    stats = scraper.get_statistics()
    logger.info("Scraping session completed!")
    logger.info(f"Statistics: {stats}")


if __name__ == "__main__":
    main()
