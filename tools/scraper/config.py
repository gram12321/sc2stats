from __future__ import annotations

import os
from pathlib import Path
from typing import Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

class LiquipediaConfig:
    def __init__(self):
        self.user_agent = os.getenv(
            "LIQUIPEDIA_USER_AGENT", 
            "sc2stats/1.0 (contact: sc2stats@example.com)"
        )
        self.api_url = os.getenv(
            "LIQUIPEDIA_API_URL", 
            "https://liquipedia.net/starcraft2/api.php"
        )
        self.rate_limit_delay = float(os.getenv("RATE_LIMIT_DELAY", "1.0"))
        self.max_retries = int(os.getenv("MAX_RETRIES", "5"))
        self.cache_ttl = int(os.getenv("CACHE_TTL", "3600"))  # 1 hour
        self.output_dir = Path(os.getenv("OUTPUT_DIR", "output"))
        self.cache_dir = Path(os.getenv("CACHE_DIR", "cache"))

def load_liquipedia_config() -> LiquipediaConfig:
    """Load Liquipedia configuration from environment variables."""
    return LiquipediaConfig()



