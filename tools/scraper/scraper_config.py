"""
Unified configuration management for SC2 Stats Scraper.
Handles all environment variables and settings in one place.
"""
from __future__ import annotations

import os
import logging
from pathlib import Path
from typing import Optional
from dataclasses import dataclass
try:
    from dotenv import load_dotenv  # type: ignore
    # Load environment variables
    load_dotenv()
except ImportError:
    # python-dotenv not installed, continue without it
    pass


@dataclass
class ScraperConfig:
    """Unified configuration for the SC2 Stats scraper."""
    
    # Liquipedia API settings
    user_agent: str
    api_url: str
    rate_limit_delay: float
    max_retries: int
    
    # Caching settings
    cache_ttl: int
    cache_dir: Path
    enable_cache: bool
    
    # Logging settings
    log_level: str
    
    # Optional Liquipedia authentication
    username: Optional[str] = None
    api_key: Optional[str] = None
    
    # Database settings
    supabase_url: Optional[str] = None
    supabase_anon_key: Optional[str] = None
    supabase_service_key: Optional[str] = None
    database_url: Optional[str] = None
    enable_database: bool = True
    
    def __post_init__(self):
        """Post-initialization validation and setup."""
        # Ensure cache directory exists
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        
        # Set up logging
        logging.basicConfig(
            level=getattr(logging, self.log_level.upper()),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )


def load_scraper_config() -> ScraperConfig:
    """Load scraper configuration from environment variables."""
    return ScraperConfig(
        # Liquipedia API settings
        user_agent=os.getenv(
            "LIQUIPEDIA_USER_AGENT", 
            "sc2stats/1.0 (contact: sc2stats@example.com)"
        ),
        api_url=os.getenv(
            "LIQUIPEDIA_API_URL", 
            "https://liquipedia.net/starcraft2/api.php"
        ),
        rate_limit_delay=float(os.getenv("RATE_LIMIT_DELAY", "1.0")),
        max_retries=int(os.getenv("MAX_RETRIES", "5")),
        
        # Caching settings
        cache_ttl=int(os.getenv("CACHE_TTL", "3600")),  # 1 hour
        cache_dir=Path(os.getenv("CACHE_DIR", "cache")),
        enable_cache=os.getenv("ENABLE_CACHE", "true").lower() == "true",
        
        # Logging
        log_level=os.getenv("LOG_LEVEL", "INFO"),
        
        # Optional authentication
        username=os.getenv("LIQUIPEDIA_USERNAME"),
        api_key=os.getenv("LIQUIPEDIA_API_KEY"),
        
        # Database settings
        supabase_url=os.getenv("SUPABASE_URL"),
        supabase_anon_key=os.getenv("SUPABASE_ANON_KEY"),
        supabase_service_key=os.getenv("SUPABASE_SERVICE_KEY"),
        database_url=os.getenv("DATABASE_URL"),
        enable_database=os.getenv("ENABLE_DATABASE", "true").lower() == "true",
    )


# Global config instance
config = load_scraper_config()
