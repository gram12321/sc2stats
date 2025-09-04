# SC2 2v2 Stats Scraper

A comprehensive tournament analysis platform that scrapes StarCraft 2 2v2 tournament data from Liquipedia and provides real-time data visualization through a modern React web interface.

## Overview

This scraper system provides comprehensive data extraction for SC2 2v2 tournaments from Liquipedia, with features like automatic subevent detection, intelligent caching, and efficient database integration. **The system automatically discovers and scrapes all subevents within a tournament series, ensuring complete data coverage.**

## Features

### 🌐 **Modern Web Interface**
- **React 18 + TypeScript** for type-safe frontend development
- **ShadCN UI Components** with Tailwind CSS for professional design
- **Real-time Data Updates** via Supabase subscriptions
- **Responsive Dashboard** with tournament statistics and analytics
- **Interactive Charts** and data visualization components

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
- **Real-time subscriptions** for live frontend updates
- **Structured data persistence** in PostgreSQL tables
- **Data validation** and integrity checks

## Architecture

```
SC2 Tournament Analysis Platform
├── Frontend (React/TypeScript)
│   ├── Dashboard & Analytics
│   ├── Tournament Browser
│   ├── Player/Team Statistics
│   └── Real-time Data Updates
├── Backend Scraper (Python)
│   ├── Subevent Detection
│   ├── Data Processing
│   ├── Caching Layer
│   └── Database Integration
└── Database (Supabase)
    ├── Tournament Data
    ├── Match Results
    ├── Player Statistics
    └── Real-time Subscriptions
```

## Data Flow

```
Liquipedia API → Subevent Detection → Enhanced Scraper → JSON Export → Supabase Database → React Frontend
     ↓                    ↓                    ↓              ↓              ↓              ↓
  Raw Data          Tournament Series    Cached Data    Structured     Real-time        Interactive
  Extraction        Discovery           Management      Data         Subscriptions     Visualization
```

## Recent Improvements

### 🌐 **Complete Frontend Implementation (v0.0004)**
- **Modern React Stack**: React 18, TypeScript, Vite 7.1.4 for optimal development experience
- **Professional UI**: ShadCN component library with Tailwind CSS v4 for consistent design
- **Real-time Dashboard**: Live tournament statistics with interactive data visualization
- **Type-Safe Development**: Complete TypeScript coverage for database and UI components
- **Development Server**: Fully functional at `http://localhost:5173/` with hot reload

### 🧹 **Major Code Cleanup (v0.00032c)**
- **Eliminated duplicate code** across all three core modules
- **Consolidated team normalization** logic into single helper functions
- **Removed unused methods** and redundant code patterns
- **Improved code readability** and maintainability

### 🔧 **Terminal Logging Optimization (v0.00032b)**
- **Reduced verbose terminal output** for better user experience
- **Suppressed HTTP request logs** for cleaner output
- **Fixed duplicate match detection** logic
- **Improved cache filename handling** with Windows compatibility

### 🎯 **Key Features**
- **199 matches successfully scraped** from all 12 UThermal 2v2 Circuit tournaments
- **Complete web interface** with real-time data visualization and analytics
- **Automatic subevent detection** for complete tournament series coverage
- **Dynamic team creation** with player order normalization
- **Professional UI/UX** with responsive design and interactive components

## Technology Stack

### Frontend
- **React 18** with TypeScript for type-safe development
- **Vite 7.1.4** for fast development and optimized builds
- **Tailwind CSS v4** for modern, responsive styling
- **ShadCN UI** for professional component library
- **React Router** for seamless navigation

### Backend
- **Python 3.x** with robust scraping capabilities
- **Supabase Python Client** for database operations
- **MediaWiki API** for intelligent data discovery
- **Advanced caching** with TTL and file persistence

### Database
- **Supabase PostgreSQL** with real-time subscriptions
- **Structured schema** for tournaments, matches, players, teams
- **Row Level Security** for data protection
- **Real-time updates** for live frontend synchronization

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

**Why Supabase + React Frontend?**

The platform uses Supabase with a React frontend for the following reasons:

**Backend (Python Scraper + Supabase):**
- **Simplicity**: Leverages Supabase's built-in authentication and security
- **Reliability**: Handles connection pooling and retries automatically
- **Security**: Uses Supabase's RLS policies and authentication
- **Real-time**: Built-in subscriptions for live data updates

**Frontend (React + TypeScript):**
- **Modern Development**: Type-safe development with excellent tooling
- **Real-time Updates**: Instant data synchronization via Supabase subscriptions
- **Component Architecture**: Reusable UI components with ShadCN design system
- **Performance**: Optimized builds and hot reload for development

## File Structure

```
sc2stats/
├── src/                     # React Frontend
│   ├── components/ui/       # ShadCN UI components
│   ├── pages/              # Main application pages
│   ├── hooks/              # Custom React hooks for data
│   ├── lib/                # Utilities and Supabase client
│   └── types/              # TypeScript type definitions
├── tools/scraper/          # Python Backend
│   ├── scraper.py          # Main scraper with subevent detection
│   ├── data_parser.py      # Wikitext parser for tournament data
│   ├── database_inserter.py # Supabase database integration
│   ├── liquipedia_client.py # MediaWiki API client with caching
│   ├── data_models.py      # Data structures and models
│   └── cache/              # Cached API responses
└── docs/                   # Documentation and schema
```

```

## Current Status

- **✅ Scraper**: Fully implemented with automatic subevent detection and clean code architecture
- **✅ Database**: Fully integrated with Supabase Python client and optimized insertion
- **✅ Frontend**: Complete React application with TypeScript, ShadCN UI, and real-time data
- **✅ Data Parsing**: Comprehensive wikitext parsing for all match types with enhanced error handling
- **✅ Team Management**: Dynamic team creation with normalization and duplicate prevention
- **✅ Code Quality**: Clean, maintainable codebase with proper separation of concerns
- **🚧 Analytics**: Advanced statistical analysis and visualization features planned
- **🚧 User Authentication**: Multi-user support and personalized dashboards planned

### 🔮 **Next Steps**
- Advanced analytics dashboard with statistical insights
- User authentication and personalized tournament tracking
- Additional tournament series support (GSL, ESL, etc.)
- Player performance tracking and ranking systems
- Team composition analysis and win rate statistics