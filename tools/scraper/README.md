For now the task is to create a scraper from liquidpedia. The goal is to scrape data about 2v2 Starcraft results, based on players, race, maps, and tournaments. We will be starting with the uterman 2v2 circut. https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

see @docs/initial_promt.md for basic idea

**Data Storage**: The scraper now saves data directly to a **Supabase PostgreSQL database** instead of JSON files, enabling real-time data access and advanced analytics.

# Enhanced SC2 Stats Scraper

This enhanced scraper system provides robust, async-capable web scraping for Liquipedia tournament data with advanced features like caching, error handling, and batch processing. **Data is stored directly in Supabase for real-time access and analysis.**

## Features

### 🚀 **Performance & Scalability**
- **Async support** with `aiohttp` for concurrent requests
- **Controlled concurrency** to avoid overwhelming servers
- **Batch processing** for multiple tournaments
- **Priority-based task scheduling**

### 💾 **Caching & Efficiency**
- **TTL-based caching** to avoid re-scraping
- **Smart cache invalidation** based on configurable timeouts
- **Cache statistics** and monitoring
- **Persistent file-based caching**

### 🛡️ **Reliability & Error Handling**
- **Automatic retries** with exponential backoff
- **Rate limiting** to respect server limits
- **Comprehensive error handling** and logging
- **Graceful degradation** on failures

### 🗄️ **Database Integration**
- **Direct Supabase integration** for real-time data storage
- **Structured data persistence** in PostgreSQL tables
- **Data validation** and integrity checks
- **Automatic schema management** and migrations

### 🔧 **Configuration & Monitoring**
- **Environment-based configuration**
- **Detailed logging** with configurable levels
- **Performance metrics** and statistics
- **Session reporting** and analysis

## Architecture

```
EnhancedScraper
├── Task Management
│   ├── Priority-based scheduling
│   ├── Retry logic with backoff
│   └── Concurrent processing control
├── Data Processing
│   ├── MediaWiki API client
│   ├── HTML parsing with BeautifulSoup
│   └── Structured data extraction
├── Caching Layer
│   ├── In-memory TTL cache
│   ├── Persistent file storage
│   └── Cache validation and cleanup
├── Database Layer
│   ├── Supabase client integration
│   ├── Data transformation & validation
│   ├── Schema management
│   └── Transaction handling
└── Output Management
    ├── Database persistence
    ├── Statistics and reporting
    └── Error tracking and analysis
```

## Data Flow

```
Liquipedia API → Enhanced Scraper → Data Processing → Supabase Database
     ↓                    ↓              ↓              ↓
  Raw Data          Cached Data    Structured    Real-time Access
  Extraction        Management      Data         for Web Apps
```

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LIQUIPEDIA_USER_AGENT` | `sc2stats/1.0` | User agent for API requests |
| `RATE_LIMIT_DELAY` | `1.0` | Delay between requests (seconds) |
| `MAX_RETRIES` | `5` | Maximum retry attempts |
| `CACHE_TTL` | `3600` | Cache time-to-live (seconds) |
| `SUPABASE_URL` | - | Supabase project URL |
| `SUPABASE_ANON_KEY` | - | Supabase anonymous key |
| `SUPABASE_SERVICE_KEY` | - | Supabase service role key (for admin operations) |
| `CACHE_DIR` | `cache` | Cache storage directory |

## Database Schema

The scraper will populate the following Supabase tables:

- **`tournaments`**: Tournament metadata, dates, locations
- **`players`**: Player information, race preferences, statistics
- **`matches`**: Match results, brackets, scores
- **`games`**: Individual map results, map types, game details
- **`teams`**: 2v2 team compositions and partnerships

## File Structure

```
tools/scraper/
├── __init__.py              # Package initialization
├── config.py                # Configuration management
├── mediawiki_client.py      # Enhanced MediaWiki API client
├── fetch_tournament.py      # Tournament data fetcher
├── enhanced_scraper.py      # Main enhanced scraper class
├── supabase_client.py       # Supabase database integration
├── database_schema.py       # Database schema definitions
├── test_enhanced.py         # Test suite
├── env_example.txt          # Environment configuration example
└── README.md                # This file
```
