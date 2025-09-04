"""
Unified Liquipedia API client.
Combines MediaWiki and LPDB API access with caching and error handling.
"""
from __future__ import annotations

import json
import time
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from cachetools import TTLCache  # pyright: ignore[reportMissingModuleSource]

from scraper_config import ScraperConfig

logger = logging.getLogger(__name__)


class LiquipediaApiError(Exception):
    """Base exception for Liquipedia API errors."""
    pass


class RateLimitError(LiquipediaApiError):
    """Exception raised when rate limited."""
    pass


class LiquipediaClient:
    """Unified client for Liquipedia MediaWiki and LPDB APIs."""
    
    def __init__(self, config: ScraperConfig):
        self.config = config
        self.session = requests.Session()
        
        # Set up session headers
        self.session.headers.update({
            "User-Agent": config.user_agent,
            "Accept-Encoding": "gzip",
        })
        
        # Add authentication headers if provided
        if config.username and config.api_key:
            self.session.headers.update({
                "X-Liquipedia-Username": config.username,
                "X-Liquipedia-Api-Key": config.api_key,
            })
            logger.info("Using authenticated Liquipedia access")
        
        # Initialize caches
        if config.enable_cache:
            self.memory_cache = TTLCache(maxsize=100, ttl=config.cache_ttl)
            self.file_cache_dir = config.cache_dir
        else:
            self.memory_cache = None
            self.file_cache_dir = None
            
        logger.debug(f"Initialized Liquipedia client with cache: {config.enable_cache}")
    
    def _get_cache_key(self, method: str, params: Dict[str, Any]) -> str:
        """Generate cache key for request parameters."""
        sorted_params = sorted(params.items())
        return f"{method}:{json.dumps(sorted_params)}"
    
    def _get_file_cache_path(self, cache_key: str) -> Path:
        """Get file path for cache key."""
        # Use hash-based filename to avoid invalid characters
        import hashlib
        hash_key = hashlib.md5(cache_key.encode('utf-8')).hexdigest()
        safe_filename = f"cache_{hash_key}.json"
        return self.file_cache_dir / safe_filename
    
    def _get_cached_data(self, cache_key: str) -> Optional[Dict[str, Any]]:
        """Get data from cache (memory first, then file)."""
        if not self.config.enable_cache:
            return None
        
        # Check memory cache first
        if self.memory_cache and cache_key in self.memory_cache:
            logger.debug(f"Memory cache hit: {cache_key}")
            return self.memory_cache[cache_key]
        
        # Check file cache
        cache_file = self._get_file_cache_path(cache_key)
        if cache_file.exists():
            try:
                with cache_file.open('r', encoding='utf-8') as f:
                    data = json.load(f)
                
                # Check if cache is still valid
                cached_time = datetime.fromisoformat(data.get('cached_at', '1970-01-01'))
                if datetime.now() - cached_time < timedelta(seconds=self.config.cache_ttl):
                    logger.debug(f"File cache hit: {cache_key}")
                    # Put back in memory cache
                    if self.memory_cache:
                        self.memory_cache[cache_key] = data['content']
                    return data['content']
                else:
                    logger.debug(f"Cache expired: {cache_key}")
                    cache_file.unlink()  # Remove expired cache
            except Exception as e:
                logger.warning(f"Failed to read cache {cache_key}: {e}")
                if cache_file.exists():
                    cache_file.unlink()
        
        return None
    
    def _cache_data(self, cache_key: str, data: Dict[str, Any]):
        """Cache data to both memory and file."""
        if not self.config.enable_cache:
            return
        
        # Store in memory cache
        if self.memory_cache:
            self.memory_cache[cache_key] = data
        
        # Store in file cache
        try:
            cache_file = self._get_file_cache_path(cache_key)
            cache_data = {
                'content': data,
                'cached_at': datetime.now().isoformat()
            }
            with cache_file.open('w', encoding='utf-8') as f:
                json.dump(cache_data, f, ensure_ascii=False, indent=2)
            logger.debug(f"Cached data: {cache_key}")
        except Exception as e:
            logger.warning(f"Failed to cache data {cache_key}: {e}")
    
    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((requests.RequestException, LiquipediaApiError)),
    )
    def _make_request(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Make a request to the Liquipedia API with retry logic."""
        cache_key = self._get_cache_key("api_request", params)
        
        # Check cache first
        cached_data = self._get_cached_data(cache_key)
        if cached_data:
            return cached_data
        
        # Add rate limiting
        if self.config.rate_limit_delay > 0:
            time.sleep(self.config.rate_limit_delay)
        
        # Make the request
        response = self.session.get(self.config.api_url, params=params, timeout=30)
        
        if response.status_code == 429:
            logger.warning("Rate limited by Liquipedia (429)")
            time.sleep(5)  # Additional backoff for rate limits
            raise RateLimitError("Rate limited by Liquipedia (429)")
        
        response.raise_for_status()
        data = response.json()
        
        if "error" in data:
            raise LiquipediaApiError(str(data["error"]))
        
        # Cache successful response
        self._cache_data(cache_key, data)
        return data
    
    def get_page_content(self, title: str) -> Optional[str]:
        """Get the raw wikitext content of a page."""
        params = {
            "action": "query",
            "format": "json",
            "prop": "revisions",
            "rvprop": "content",
            "titles": title,
        }
        
        data = self._make_request(params)
        pages = data.get("query", {}).get("pages", {})
        
        for page_id, page_data in pages.items():
            if page_id != "-1":  # Page exists
                revisions = page_data.get("revisions", [])
                if revisions:
                    return revisions[0].get("*", "")
        
        logger.warning(f"Page not found: {title}")
        return None
    
    def search_pages(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search for pages matching a query."""
        params = {
            "action": "query",
            "format": "json",
            "list": "search",
            "srsearch": query,
            "srlimit": limit,
        }
        
        data = self._make_request(params)
        return data.get("query", {}).get("search", [])
    
    def lpdb_query(self, table: str, conditions: str, order: Optional[str] = None, 
                   limit: int = 500, offset: int = 0) -> List[Dict[str, Any]]:
        """Query the Liquipedia database using LPDB."""
        params = {
            "action": "lpdb",
            "format": "json",
            "table": table,
            "conditions": conditions,
            "limit": limit,
            "offset": offset,
        }
        if order:
            params["order"] = order
        
        data = self._make_request(params)
        return data.get("result", [])
    
    def lpdb_query_all(self, table: str, conditions: str, order: Optional[str] = None,
                       batch_size: int = 500) -> List[Dict[str, Any]]:
        """Query LPDB with automatic pagination to get all results."""
        results = []
        offset = 0
        
        while True:
            batch = self.lpdb_query(table, conditions, order, batch_size, offset)
            if not batch:
                break
            
            results.extend(batch)
            if len(batch) < batch_size:
                break
            
            offset += batch_size
            logger.debug(f"Retrieved {len(results)} records from {table}")
        
        logger.info(f"Retrieved {len(results)} total records from {table}")
        return results
    
    def get_match_data(self, tournament_slug: str) -> List[Dict[str, Any]]:
        """Get match data for a tournament from LPDB."""
        return self.lpdb_query_all(
            table="match2",
            conditions=f"[[pagename::{tournament_slug}]]",
            order="date asc"
        )
    
    def get_match_opponents(self, tournament_slug: str) -> List[Dict[str, Any]]:
        """Get match opponent data for a tournament from LPDB."""
        return self.lpdb_query_all(
            table="match2opponent",
            conditions=f"[[pagename::{tournament_slug}]]",
            order="matchid asc"
        )
    
    def get_match_games(self, tournament_slug: str) -> List[Dict[str, Any]]:
        """Get individual game data for a tournament from LPDB."""
        return self.lpdb_query_all(
            table="match2game",
            conditions=f"[[pagename::{tournament_slug}]]",
            order="matchid, game asc"
        )
    
    def clear_cache(self):
        """Clear all caches."""
        if self.memory_cache:
            self.memory_cache.clear()
        
        if self.file_cache_dir and self.file_cache_dir.exists():
            for cache_file in self.file_cache_dir.glob("*.json"):
                try:
                    cache_file.unlink()
                except Exception as e:
                    logger.warning(f"Failed to delete cache file {cache_file}: {e}")
        
        logger.info("Cleared all caches")
    
    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        stats = {
            "cache_enabled": self.config.enable_cache,
            "memory_cache_size": len(self.memory_cache) if self.memory_cache else 0,
            "memory_cache_maxsize": self.memory_cache.maxsize if self.memory_cache else 0,
        }
        
        if self.file_cache_dir and self.file_cache_dir.exists():
            cache_files = list(self.file_cache_dir.glob("*.json"))
            stats["file_cache_count"] = len(cache_files)
            stats["file_cache_dir"] = str(self.file_cache_dir)
        else:
            stats["file_cache_count"] = 0
        
        return stats
