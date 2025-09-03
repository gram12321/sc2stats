# SC2 2v2 Stats Scraper

A robust web scraper for Liquipedia tournament data that extracts StarCraft 2 2v2 tournament information and stores it in a Supabase PostgreSQL database.

## Overview

This scraper system provides comprehensive data extraction for SC2 2v2 tournaments from Liquipedia, with features like caching, error handling, and batch processing. **Data is exported to JSON and then inserted into Supabase via the Supabase Python client for efficient data ingestion.**

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
- **Supabase Python client** for efficient data insertion
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
│   ├── Supabase Python client
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
Liquipedia API → Enhanced Scraper → JSON Export → Supabase Client → Supabase Database
     ↓                    ↓              ↓              ↓              ↓
  Raw Data          Cached Data    Structured    Bulk Insertion    Data Storage
  Extraction        Management      Data         via Supabase      for Web Apps
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
| `CACHE_DIR` | `cache` | Cache storage directory |

## Database Schema

The scraper populates the following Supabase tables:

- **`tournaments`**: Tournament metadata, dates, locations
- **`players`**: Player information, race preferences, statistics
- **`matches`**: Match results, brackets, scores
- **`games`**: Individual map results, map types, game details
- **`teams`**: 2v2 team compositions and partnerships

> 📋 **Detailed Schema**: See `docs/database_schema.py` for complete SQL DDL statements and table definitions.

## Architecture Decision

**Why Supabase Python Client?**

The scraper uses the Supabase Python client instead of direct PostgreSQL connections for the following reasons:

- **Simplicity**: Leverages Supabase's built-in authentication and security
- **Reliability**: Handles connection pooling and retries automatically
- **Security**: Uses Supabase's RLS policies and authentication
- **Maintenance**: Easier to maintain and update

**Frontend Integration**

The React frontend will use the Supabase client for:
- Data fetching and real-time subscriptions
- User authentication and RLS policies
- Client-side data manipulation (filtering, sorting, graph redrawing)

## File Structure

```
tools/scraper/
├── __init__.py              # Package initialization
├── scraper_config.py        # Configuration management
├── liquipedia_client.py     # MediaWiki API client with caching
├── data_models.py           # Data structures and models
├── data_parser.py           # Unified parser for wikitext and LPDB data
├── scraper.py               # Main scraper script (exports to JSON)
├── database_inserter.py     # Supabase database integration
├── database_schema.py       # Database schema definitions (in docs/)
├── cache/                   # Cached API responses
└── README.md                # This file
```