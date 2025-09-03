# Version Log - SC2 2v2 Stats Scraper

## AI INFO FOR VERSIONLOG UPDATE
Version numbers should follow the Git commit names. 
IE Gitcommit 9db1324f69a9358fab5fd59128806e4299cf5e1f : name is 0.0023a This is the version number. Followed by commit titel [Fix missing M3 games ...]

Use yor git MCP tools to check git commit. 
- Create a entry for each in the version log. 
- 5-10 lines depending on extend of updates. 
- Focus on changed files, added/removed functions/functionality. 
- Do not focus on bug fixed, and stuff that was not used in the end anyway. 

## Version 0.00031a - 2025-09-04 (3428b58)

### 🧹 **Major Code Cleanup and Optimization**

#### ✅ **Code Quality Improvements**
- **Eliminated duplicate code** across all three core modules
- **Consolidated team normalization** logic into single helper functions
- **Removed unused LPDB parsing methods** from data_parser.py
- **Simplified player/team caching** with unified approach

#### 🔧 **Technical Refactoring**
- **scraper.py**: Removed unused parameters, consolidated team merging logic
- **database_inserter.py**: Eliminated duplicate team creation code, improved player handling
- **data_parser.py**: Removed 6 unused LPDB methods, consolidated caching systems
- **Maintained 100% functionality** while reducing code complexity

#### 📊 **Performance Impact**
- **Cleaner architecture** with better separation of concerns
- **Improved maintainability** through code consolidation
- **Reduced memory footprint** by removing duplicate caching systems
- **Enhanced readability** for future development

---

## Version 0.00031 - 2025-09-04 (4a8ba98)

### 🔍 **Automatic Subevent Detection Implementation**

#### ✅ **New Features**
- **MediaWiki API Integration**: Implemented generic subevent detection using `allpages` endpoint
- **Automatic Discovery**: System now finds all tournament pages without hardcoded names
- **Intelligent Filtering**: Distinguishes between tournament pages and info pages
- **Multi-Tournament Support**: Enhanced scraper to handle multiple tournaments simultaneously

#### 🔧 **Technical Implementation**
- **scraper.py**: Added `_find_subevents_via_api()` method for robust page discovery
- **Tournament Filtering**: Implemented `_filter_tournament_pages()` for intelligent page classification
- **Data Merging**: Enhanced `scrape_multiple_tournaments()` for efficient data consolidation
- **Match ID Uniqueness**: Added tournament prefixes to prevent match ID conflicts


---

## Version 0.0003 - 2025-09-04 (eec7d06)

### 🏆 **Subevent Detection Foundation**

#### ✅ **Initial Implementation**
- **Basic Subevent Logic**: Started development of subevent detection system
- **Tournament Series Support**: Framework for handling multiple tournaments
- **Data Structure Preparation**: Enhanced data models for multi-tournament support

#### 🔧 **Technical Foundation**
- **scraper.py**: Added `find_subevents()` method structure
- **Data Merging**: Prepared infrastructure for combining tournament data
- **Configuration Updates**: Enhanced scraper configuration for subevent handling

---

## Version 0.00023a - 2025-09-03 (9db1324f69a9358fab5fd59128806e4299cf5e1f)

### 🎯 **Critical Bug Fix: M3 Match Game Parsing**

#### ✅ **Fixed Issues**
- **Regex Pattern Update**: Fixed `_extract_games_from_content()` regex to handle additional parameters between `{{Map|` and `map=`
- **Winner Handling**: Added support for non-numeric winners like "skip" (unplayed games)
- **Duplicate Match Resolution**: Improved Group A vs Group B match ID handling with proper suffixes

#### 🔧 **Technical Changes**
- Updated regex from `map(\d+)=\{\{Map\|map=([^|}]+)\|winner=(\d+)[^}]*\}\}` to `map(\d+)=\{\{Map\|[^}]*?map=([^|}]+)[^}]*?\|winner=([^|}]+)[^}]*\}\}`
- Enhanced duplicate match detection with position-based group assignment
- Fixed file path in scraper.py for proper JSON output location

---

## Version 0.00023 - 2025-09-03 (824c7e7b5cbf2c3fe93574251daf20899261ba1d)

### 🗄️ **Database Integration Enhancement**

#### ✅ **New Features**
- **Conflict Resolution**: Added proper upsert conflict handling for all database tables
- **Table-Specific Logic**: Implemented custom conflict resolution for matches, players, teams, and tournaments
- **Data Integrity**: Enhanced database insertion with proper constraint handling

#### 🔧 **Technical Improvements**
- Updated `database_inserter.py` with table-specific conflict resolution strategies
- Added `on_conflict` parameters for proper upsert operations
- Improved error handling and logging for database operations

---

## Version 0.00022 - 2025-09-03 (a98d318e92ef9a58ff1df35f7856ae5e80a86400)

### 🚀 **Major Architecture Overhaul**

#### ✅ **New Implementation**
- **Supabase Python Client**: Replaced MCP tools with direct Supabase Python client integration
- **Database Inserter**: Added comprehensive `database_inserter.py` for data persistence
- **Simplified Scraper**: Streamlined main scraper to focus on JSON export and database insertion

#### 🔧 **Technical Changes**
- Removed complex MCP-based database client (`real_mcp_client.py`)
- Eliminated unused scraper classes (`sc2_scraper.py`)
- Updated configuration to support both Supabase client and direct database connections
- Enhanced error handling and logging throughout the system

#### 📁 **File Changes**
- Added: `database_inserter.py` (404 lines)
- Removed: `real_mcp_client.py` (254 lines), `sc2_scraper.py` (312 lines)
- Updated: `scraper.py`, `scraper_config.py`, `liquipedia_client.py`

---

## Version 0.00021 - 2025-09-03 (4f63757f5a323618c603aa1b0c64ecdb92ddb8cb)

### 🔄 **Scraper Refactoring and Cleanup**

#### ✅ **Improvements**
- **Code Cleanup**: Removed unused tournament data JSON file
- **Configuration Updates**: Enhanced scraper configuration with additional database options
- **Dependency Management**: Updated import statements and removed unused modules

#### 🔧 **Technical Changes**
- Removed large tournament data JSON file (1,251 lines)
- Updated configuration to support multiple database connection methods
- Cleaned up unused imports and dependencies

---

## Version 0.0002 - 2025-09-02 (4a51d4e641f337332e7003075a45a21fe097ade1)

### 🏗️ **Foundation Implementation**

#### ✅ **Core Components**
- **Base Scraper**: Established fundamental scraping architecture
- **Data Models**: Implemented core data structures for tournaments, matches, and players
- **Liquipedia Integration**: Basic MediaWiki API client with caching support

#### 🔧 **Technical Foundation**
- Created initial scraper framework with configuration management
- Implemented basic data parsing and extraction capabilities
- Established project structure and file organization

---

## Version 0.0001 - 2025-09-02 (8a1e7953efae6c1fc8e9a6b8adb20ff6f367bfbc)

### 🌱 **Project Initialization**

#### ✅ **Initial Setup**
- **Repository Creation**: Established project structure and basic documentation
- **Requirements**: Defined project dependencies and environment setup
- **Documentation**: Created initial README and project description

#### 🔧 **Foundation**
- Set up basic project structure with tools/scraper directory
- Defined project goals and architecture overview
- Established development environment and configuration

---

## 📋 **Current Status Summary**

- **Scraper**: ✅ Fully implemented and tested with regex fixes
- **Database**: ✅ Fully integrated with Supabase Python client
- **Data Parsing**: ✅ Comprehensive wikitext parsing for all match types
- **Frontend**: 🚧 Not yet implemented
- **Analytics**: 🚧 Basic data available, advanced features planned

### 🔮 **Next Steps**
- React frontend development
- Real-time data subscriptions
- Advanced analytics dashboard
- Additional tournament support
- Player and team statistics aggregation
