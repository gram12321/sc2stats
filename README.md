# SC2 2v2 Stats Scraper

A robust web scraper for Liquipedia tournament data that extracts StarCraft 2 2v2 tournament information and stores it in a Supabase PostgreSQL database.

## Overview

This scraper system provides comprehensive data extraction for SC2 2v2 tournaments from Liquipedia, with features like automatic subevent detection, intelligent caching, and efficient database integration. **The system automatically discovers and scrapes all subevents within a tournament series, ensuring complete data coverage.**

## Features

### 🚀 **Performance & Scalability**
- **Automatic subevent detection** using MediaWiki API
- **Multi-tournament processing** with intelligent data merging
- **Controlled concurrency** to avoid overwhelming servers
- **Batch processing** for multiple tournaments

### 🔍 **Intelligent Data Discovery**
- **Generic subevent detection** - no hardcoded tournament names required
- **MediaWiki API integration** for robust page discovery
- **Automatic filtering** of tournament vs. info pages
- **Dynamic team creation** for flexible roster management

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
- **Team normalization** for consistent player ordering

### 🔧 **Configuration & Monitoring**
- **Environment-based configuration**
- **Detailed logging** with configurable levels
- **Performance metrics** and statistics
- **Session reporting** and analysis

## Architecture

```
Enhanced SC2 Scraper
├── Subevent Detection
│   ├── MediaWiki API integration
│   ├── Generic page discovery
│   └── Intelligent filtering
├── Data Processing
│   ├── Wikitext parsing
│   ├── Match extraction
│   └── Team normalization
├── Caching Layer
│   ├── In-memory TTL cache
│   ├── Persistent file storage
│   └── Cache validation and cleanup
├── Database Layer
│   ├── Supabase Python client
│   ├── Dynamic team creation
│   ├── Schema management
│   └── Transaction handling
└── Output Management
    ├── Database persistence
    ├── Statistics and reporting
    └── Error tracking and analysis
```

## Data Flow

```
Liquipedia API → Subevent Detection → Enhanced Scraper → JSON Export → Supabase Client → Supabase Database
     ↓                    ↓                    ↓              ↓              ↓              ↓
  Raw Data          Tournament Series    Cached Data    Structured    Bulk Insertion    Data Storage
  Extraction        Discovery           Management      Data         via Supabase      for Web Apps
```

## Recent Improvements

### 🧹 **Major Code Cleanup (v0.00032c)**
- **Eliminated duplicate code** across all three core modules
- **Consolidated team normalization** logic into single helper functions
- **Removed unused methods** and redundant code patterns
- **Improved code readability** and maintainability
- **Maintained 100% functionality** with cleaner architecture

### 🔧 **Terminal Logging Optimization (v0.00032b)**
- **Reduced verbose terminal output** for better user experience
- **Suppressed HTTP request logs** for cleaner output
- **Fixed duplicate match detection** logic
- **Improved cache filename handling** with Windows compatibility

### 🎯 **Key Features**
- **199 matches successfully scraped** from all 12 UThermal 2v2 Circuit tournaments
- **Automatic subevent detection** for complete tournament series coverage
- **Dynamic team creation** with player order normalization
- **Unique match ID generation** across tournaments
- **Clean terminal output** with summary-focused logging

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
├── data_parser.py           # Wikitext parser for tournament data
├── scraper.py               # Main scraper with subevent detection
├── database_inserter.py     # Supabase database integration
├── database_schema.py       # Database schema definitions (in docs/)
├── cache/                   # Cached API responses
└── README.md                # This file
```

## Current Status

- **✅ Scraper**: Fully implemented with automatic subevent detection and clean code architecture
- **✅ Database**: Fully integrated with Supabase Python client and optimized insertion
- **✅ Data Parsing**: Comprehensive wikitext parsing for all match types with enhanced error handling
- **✅ Team Management**: Dynamic team creation with normalization and duplicate prevention
- **✅ Code Quality**: Clean, maintainable codebase with proper separation of concerns
- **🚧 Frontend**: Not yet implemented
- **🚧 Analytics**: Basic data available, advanced features planned

### 🔮 **Next Steps**
- React frontend development
- Real-time data subscriptions
- Advanced analytics dashboard
- Additional tournament support
- Player and team statistics aggregation