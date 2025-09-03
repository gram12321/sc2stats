For now the task is to create a scraper from liquidpedia. The goal is to scrape data about 2v2 Starcraft results, based on players, race, maps, and tournaments. We will be starting with the uterman 2v2 circut. https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/Main_Event 

see @docs/initial_promt.md for basic idea

**Data Storage**: The scraper exports data to JSON files, which are then inserted into **Supabase PostgreSQL database** via direct PostgreSQL connection, enabling efficient bulk data insertion and advanced analytics.

# Enhanced SC2 Stats Scraper

This enhanced scraper system provides robust web scraping for Liquipedia tournament data with advanced features like caching, error handling, and batch processing. **Data is exported to JSON and then inserted into Supabase via direct PostgreSQL connection for efficient data ingestion.**

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
- **JSON export** for data persistence and transfer
- **Direct PostgreSQL connection** for efficient bulk data insertion
- **Structured data persistence** in PostgreSQL tables
- **Data validation** and integrity checks

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
│   ├── Direct PostgreSQL connection
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
Liquipedia API → Enhanced Scraper → JSON Export → Direct PostgreSQL → Supabase Database
     ↓                    ↓              ↓              ↓              ↓
  Raw Data          Cached Data    Structured    Bulk Insertion    Data Storage
  Extraction        Management      Data         via psycopg2     for Web Apps
```

## Configuration Options

| Environment Variable | Default | Description |
|---------------------|---------|-------------|
| `LIQUIPEDIA_USER_AGENT` | `sc2stats/1.0` | User agent for API requests |
| `RATE_LIMIT_DELAY` | `1.0` | Delay between requests (seconds) |
| `MAX_RETRIES` | `5` | Maximum retry attempts |
| `CACHE_TTL` | `3600` | Cache time-to-live (seconds) |
| `SUPABASE_URL` | - | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | - | Supabase service role key (for direct PostgreSQL access) |
| `DATABASE_URL` | - | Direct PostgreSQL connection string |
| `CACHE_DIR` | `cache` | Cache storage directory |

## Database Schema

The scraper will populate the following Supabase tables:

- **`tournaments`**: Tournament metadata, dates, locations
- **`players`**: Player information, race preferences, statistics
- **`matches`**: Match results, brackets, scores
- **`games`**: Individual map results, map types, game details
- **`teams`**: 2v2 team compositions and partnerships

> 📋 **Detailed Schema**: See `docs/database_schema.py` for complete SQL DDL statements and table definitions.

## Architecture Decision

**Why Direct PostgreSQL Connection?**

The scraper uses a direct PostgreSQL connection instead of MCP tools or Supabase client for the following reasons:

- **Performance**: Direct connection provides optimal performance for bulk data insertion
- **Reliability**: Eliminates dependency on external MCP tool availability
- **Control**: Full control over SQL queries and transaction management
- **Simplicity**: Single Python environment handles both scraping and database operations

**Frontend Integration**

The React frontend will use the Supabase client for:
- Data fetching (one-time, no real-time subscriptions needed)
- User authentication and RLS policies
- Client-side data manipulation (filtering, sorting, graph redrawing)

This architecture provides the best of both worlds: efficient bulk insertion from the scraper and rich data access capabilities in the frontend.

## File Structure

```
tools/scraper/
├── __init__.py              # Package initialization
├── scraper_config.py        # Configuration management
├── liquipedia_client.py     # MediaWiki API client with caching
├── data_models.py           # Data structures and models
├── data_parser.py           # Unified parser for wikitext and LPDB data
├── scraper.py               # Main scraper script (exports to JSON)
├── database_schema.py       # Database schema definitions (in docs/)
├── cache/                   # Cached API responses
└── README.md                # This file
```
