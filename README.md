# SC2 2v2 Stats - StarCraft 2 2v2 Ranking System

A tournament analysis platform for StarCraft 2 2v2 tournaments that scrapes data from Liquipedia and provides real-time data visualization through a modern React web interface.

## Overview

This project scrapes tournament data from Liquipedia using the **MediaWiki API**, extracts match results, and stores them in JSON format for analysis and visualization. The scraper focuses on reliable data extraction (matches, rounds, scores, players), with player races added manually through the UI.

## Key Design Decisions

- ✅ **Manual URL input**: Users provide Liquipedia tournament URLs
- ✅ **MediaWiki API**: Direct API access (not using npm packages)
- ✅ **Simplified scraper**: Extracts matches, rounds, scores, and players reliably
- ✅ **Manual race entry**: Player races are added/edited manually in the UI (more reliable than automated extraction)
- ✅ **JSON export**: Data exported for review and import

## Technology Stack

### Frontend
- React 18 + TypeScript + Vite
- Tailwind CSS
- Express.js API server for serving tournament data

### Backend
- **API Server** - Express.js server to serve tournament JSON files
- **MediaWiki API** - Direct API calls to Liquipedia
- Wikitext parsing for data extraction
- Extracts: matches, rounds, scores, players (no races - added manually in UI)
- JSON export

## Data Flow

```
Liquipedia URL → MediaWiki API → Wikitext Parser → JSON Export → Express API → React Frontend
```

## Getting Started

### Installation
```bash
npm install
```

### Running the Application

You need to run two servers:

1. **API Server** (in one terminal):
```bash
npm run api
```
This starts the API server on `http://localhost:3001` that serves tournament JSON files.

2. **Frontend Dev Server** (in another terminal):
```bash
npm run dev
```
This starts the Vite dev server (usually on `http://localhost:5173`).

### Scraper
```bash
# Run scraper with a Liquipedia tournament URL
node tools/scraper.js <liquipedia-url>

# Example:
node tools/scraper.js https://liquipedia.net/starcraft2/UThermal_2v2_Circuit/1

# Output: JSON file saved to output/ directory
```

### Using the UI

1. Run the scraper to generate tournament JSON files in the `output/` directory
2. Start both the API server (`npm run api`) and frontend dev server (`npm run dev`)
3. Open the frontend URL (usually `http://localhost:5173`)
4. Select a tournament from the list
5. **Viewing Tournaments**:
   - For tournaments with group stages, use tabs to switch between "Group Stage" and "Playoffs"
   - Group stage matches are displayed in a grid layout grouped by group name
   - Bracket matches show single or double-elimination format
6. **Editing Matches**:
   - Click on any match to open the match editor
   - Edit player races using the dropdown menus
   - Edit match scores using the number inputs (useful for correcting scraper errors)
   - Changes save automatically when you click "Save" in the tournament view
7. Download the edited JSON when done

## Current Status

- ✅ Frontend: React app with compact bracket view (Liquipedia-inspired)
- ✅ API Server: Express server to serve tournament JSON files and player defaults
- ✅ Scraper: Extracts matches, rounds, scores, and players reliably
  - Supports single-elimination brackets
  - Supports double-elimination brackets (upper/lower bracket separation)
  - Supports group stage/round robin matches from Matchlist templates
- ✅ Player Management: UI for setting default player races
- ✅ Tournament Editor: 
  - Compact bracket display with race editing
  - Tab navigation for Group Stage vs Playoffs
  - Score editing for correcting scraper errors
- ✅ Data Export: JSON format for tournaments and player defaults

## Scraper Data Output

The scraper extracts the following data reliably:
- **Tournament metadata**: Name, date, prize pool, format, maps
- **Bracket matches**: Round, match ID, teams (player pairs), scores, best-of format, date, individual games/maps
- **Group stage matches**: Extracted from Matchlist templates, grouped by group name (Group A, Group B, etc.)

**Note**: 
- Player races are not extracted automatically. They can be added and edited manually through the React UI interface.
- Match scores can be manually corrected in the Match Editor if the scraper missed or incorrectly extracted them.

## Documentation

- [Data Specification](docs/data-specification.md) - Data structure and requirements
