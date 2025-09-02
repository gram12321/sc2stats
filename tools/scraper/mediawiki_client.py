from __future__ import annotations

import json
import time
from typing import Any, Dict, List, Optional
from urllib.parse import urlencode

import requests
from tenacity import retry, stop_after_attempt, wait_exponential, retry_if_exception_type
from cachetools import TTLCache


class MediaWikiApiError(Exception):
    """Custom exception for MediaWiki API errors."""
    pass


class RateLimitError(Exception):
    """Exception raised when rate limited."""
    pass


class MediaWikiClient:
    def __init__(self, user_agent: str = "sc2stats/1.0 (contact: sc2stats@example.com)"):
        self.user_agent = user_agent
        self.api_url = "https://liquipedia.net/starcraft2/api.php"
        self.rate_limit_delay = 1.0
        self.max_retries = 5
        
        # Initialize cache
        self.cache = TTLCache(maxsize=100, ttl=3600)  # 1 hour TTL
        
        # Session for requests
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": user_agent,
            "Accept-Encoding": "gzip",
        })

    def _get_cache_key(self, method: str, params: Dict[str, Any]) -> str:
        """Generate cache key for request parameters."""
        # Sort params for consistent cache keys
        sorted_params = sorted(params.items())
        return f"{method}:{json.dumps(sorted_params)}"

    @retry(
        reraise=True,
        stop=stop_after_attempt(5),
        wait=wait_exponential(multiplier=1, min=1, max=10),
        retry=retry_if_exception_type((requests.RequestException, MediaWikiApiError)),
    )
    def query(self, params: Dict[str, Any]) -> Dict[str, Any]:
        """Synchronous query to MediaWiki API."""
        cache_key = self._get_cache_key("query", params)
        
        # Check cache first
        if cache_key in self.cache:
            return self.cache[cache_key]
        
        # Ensure gzip encoding is requested
        params.setdefault("format", "json")
        
        response = self.session.get(self.api_url, params=params, timeout=30)
        
        if response.status_code == 429:
            time.sleep(self.rate_limit_delay)
            raise RateLimitError("Rate limited by Liquipedia (429)")

        response.raise_for_status()
        data = response.json()
        
        if "error" in data:
            raise MediaWikiApiError(str(data["error"]))
        
        # Cache the successful response
        self.cache[cache_key] = data
        return data

    def get_page_content(self, title: str) -> str | None:
        """Get the raw content of a page."""
        params = {
            "action": "query",
            "prop": "revisions",
            "rvprop": "content",
            "titles": title,
        }
        
        data = self.query(params)
        pages = data.get("query", {}).get("pages", {})
        
        for page_id, page_data in pages.items():
            if page_id != "-1":  # Page exists
                revisions = page_data.get("revisions", [])
                if revisions:
                    return revisions[0].get("*", "")
        return None

    def search_pages(self, query: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Search for pages matching a query."""
        params = {
            "action": "query",
            "list": "search",
            "srsearch": query,
            "srlimit": limit,
        }
        
        data = self.query(params)
        return data.get("query", {}).get("search", [])

    def get_category_members(self, category: str, limit: int = 500) -> List[Dict[str, Any]]:
        """Get all pages in a category."""
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": f"Category:{category}",
            "cmlimit": limit,
        }
        
        data = self.query(params)
        return data.get("query", {}).get("categorymembers", [])

    def clear_cache(self):
        """Clear the request cache."""
        self.cache.clear()

    def get_cache_stats(self) -> Dict[str, Any]:
        """Get cache statistics."""
        return {
            "cache_size": len(self.cache),
            "cache_maxsize": self.cache.maxsize,
            "cache_ttl": self.cache.ttl,
        }

