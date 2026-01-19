# Version Log - SC2 2v2 Stats Scraper

## Version 1.00008 - 2026-01-16 (946ec85)

### 🎯 **Enhanced Ranking System - Population-Based Scaling**

#### ✅ **Ranking Calculation Improvements**
- **tools/rankingCalculations.js**: Added `calculatePopulationStats()` function for adaptive rating scale
- Enhanced `predictWinProbability()` to use population-based standard deviation instead of fixed 350 divisor
- Updated `updateStatsForMatch()` to accept population statistics for adaptive scaling
- New players/teams now start at population mean instead of 0 for better initial ratings
- Refactored `tools/processRankings.js` from `tools/calculateRankings.js` with improved structure

#### ✅ **Calculation File Updates**
- **tools/processRankings.js**: Added population statistics calculation before initializing new players
- **tools/calculateTeamRankings.js**: Integrated population-based scaling for team rankings
- **tools/calculateRaceRankings.js**: Added population statistics for race matchup calculations
- **tools/calculateTeamRaceRankings.js**: Integrated population-based scaling for team race rankings
- **tools/rankingUtils.js**: Updated `initializeStats()` to accept population mean parameter

#### ✅ **API Server Updates**
- **api/server.js**: Updated import to use `processRankings.js` instead of removed `calculateRankings.js`

---

## Version 1.00006 - 2026-01-16 (b8a41d4)

### 🎯 **Enhanced Ranking System - Core Features**

#### ✅ **Provisional Rating System**
- **tools/rankingCalculations.js**: Added `getProvisionalKFactor()` function
  - Matches 1-5: K = 80 (rapid learning)
  - Matches 6-10: K = 48 (transition)
  - Matches 11-20: K = 40 (stabilizing)
  - Matches 21+: Adaptive K = 32 * (1 + 3/matches), capped at 40
- Higher K-factors for new players/teams accelerate convergence with small datasets

#### ✅ **Dynamic Confidence System**
- **tools/rankingCalculations.js**: Added `updateConfidence()` function
- **tools/rankingUtils.js**: Added `confidence: 0` field to initial stats
- Confidence starts at 0% and adjusts based on prediction accuracy
- Adaptive change rate: faster when low confidence, slower when high confidence
- Base change: +5% for correct predictions, -5% for incorrect predictions

#### ✅ **Confidence-Based K-Factor Adjustments**
- **tools/rankingCalculations.js**: Added `applyConfidenceAdjustment()` function
- Individual K-factor adjustment per player/team based on confidence level
- Low confidence (0%): K multiplied by 1.5 (50% increase)
- High confidence (100%): K unchanged
- Formula: `adjustedK = baseK * (1 + (100 - confidence) / 100 * 0.5)`

#### ✅ **Tighter Rating Scale**
- **tools/rankingCalculations.js**: Updated `predictWinProbability()` divisor from 400 to 350
- Increases rating spread and makes differences more impactful
- Better differentiation between skill levels in small datasets

#### ✅ **Core Calculation Integration**
- **tools/rankingCalculations.js**: Refactored `updateStatsForMatch()` to integrate all enhancements
- Combines provisional K-factor, confidence tracking, and confidence-based adjustments
- All calculation files updated to pass confidence through stats

#### ✅ **UI Enhancements**
- **src/pages/PlayerRankings.tsx**: Added confidence column with sorting and filtering
- **src/pages/TeamRankings.tsx**: Added confidence display and low confidence filter
- **src/pages/PlayerDetails.tsx**: Added confidence stat display with color coding
- **src/pages/TeamDetails.tsx**: Added confidence stat display
- **src/components/BracketView.tsx**: Added team ranking display in match boxes
- **src/components/MatchBox.tsx**: Display team rankings next to team names
- Dynamic confidence threshold filter (2/3 of average confidence)

---

## Version 1.0005a - 2026-01-16 (f8451990)

### 🎯 **Group Stage/Round Robin Support**

#### ✅ **Scraper Enhancements**
- **tools/scraper.js**: Added `parseGroupStage()` function to extract matches from `{{Matchlist}}` templates
- Enhanced group name detection with multiple pattern matching (Group A/B headers, GroupTableLeague titles)
- Extracts matches from Matchlist templates (M1, M2, M3, etc.) with unique IDs (`GS_M1_1`, `GS_M2_1`)
- Combines bracket matches and group stage matches in final output

#### ✅ **UI Enhancements**
- **src/components/BracketView.tsx**: Added tab navigation for "Playoffs" vs "Group Stage"
- Separated group stage matches from bracket matches with automatic detection
- Group stage matches displayed in responsive grid layout grouped by group name
- Each group shown in dedicated card with match count

#### ✅ **Match Editor Enhancements**
- **src/components/MatchEditor.tsx**: Added score editing functionality
- Centered score input section with Team 1 and Team 2 score fields
- Real-time score updates with proper null handling for missing scores
- Visual score separator (":") and "Best of X" display

---

## Version 1.0005 - 2026-01-16 (3acf0414)

### 🎯 **Double-Elimination Bracket Support**

#### ✅ **Bracket View Enhancements**
- **src/components/BracketView.tsx**: Enhanced bracket rendering for double-elimination tournaments
- Separated upper bracket and lower bracket rounds with visual distinction
- Lower bracket detection based on round name patterns ("Lower Bracket" keyword)
- Grand Final displayed separately after lower bracket
- Dynamic round ordering for both single and double-elimination formats

#### ✅ **Round Detection Logic**
- Implemented `useMemo` hooks for efficient round categorization
- Upper bracket rounds exclude "Lower Bracket" matches
- Proper sorting for both bracket types with fallback alphabetical ordering

---

## Version 1.00004 - 2026-01-16 (35539c8b)

### 📊 **Additional Tournament Data**

#### ✅ **Data Collection**
- Enhanced tournament data collection and processing
- Improved match data extraction and storage

---

## Version 1.00003a - 2026-01-16 (ef2da9e1)

### 🔧 **Git Output Fixes**

#### ✅ **Output Improvements**
- Fixed git output formatting and display issues
- Improved commit message handling

---

## Version 1.00003 - 2026-01-15 (2cb5ed30)

### 📊 **Statistics Enhancements**

#### ✅ **Additional Statistics**
- Added more statistical calculations and displays
- Enhanced data analysis capabilities

---

## Version 1.00003 - 2026-01-15 (9a38ca19)

### 🏆 **Ranking System Alpha**

#### ✅ **Ranking Implementation**
- Initial implementation of ranking system
- Player and team ranking calculations
- Ranking display components

---

## Version 1.00002a - 2026-01-15 (5329d8ec)

### 🔧 **Setup Improvements**

#### ✅ **Configuration Updates**
- Refined project setup and configuration
- Improved development environment setup

---

## Version 1.00002 - 2026-01-15 (83c4e5ea)

### ✅ **Working Setup**

#### ✅ **Initial Setup**
- Established working project setup
- Basic functionality implemented

---

## Version 1.00001 - 2026-01-15 (0e29bc0d)

### 🚀 **New Iteration Initial Commit**

#### ✅ **Project Restart**
- New iteration of SC2 2v2 Stats project
- Initial commit with basic structure
- React + TypeScript + Vite setup
- Express.js API server for tournament data
