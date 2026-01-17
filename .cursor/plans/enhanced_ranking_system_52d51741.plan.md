---
name: Enhanced Ranking System
overview: Implement provisional rating system, dynamic confidence tracking, tighter rating scale, and adaptive K-factor to improve ranking accuracy with small datasets. Add initial seeding system as secondary phase.
todos: []
---

# Enhanced Ranking System Implementation ✅ COMPLETE

## Overview

Enhance the Elo-based ranking system to address cold start issues and slow convergence with small datasets (198 matches). Implement provisional ratings, dynamic confidence tracking, tighter rating scale, and adaptive K-factor adjustments.

**Status:** All phases complete! ✅

- **Phase 1:** Core Ranking Enhancements - ✅ Complete
- **Phase 2:** Initial Seeding System - ✅ Complete

## Phase 1: Core Ranking Enhancements ✅ COMPLETE

### 1.1 Provisional Rating System ✅

**Files to modify:**

- `tools/rankingCalculations.js` - Add `getProvisionalKFactor()` function
- `tools/rankingCalculations.js` - Update `updateStatsForMatch()` to use provisional K-factor

**Implementation:**

- Add function to determine K-factor based on match count:
  - Matches 1-5: K = 80
  - Matches 6-10: K = 48
  - Matches 11-20: K = 40
  - Matches 21+: K = 32 (base)

**Code changes:**

```javascript
// In rankingCalculations.js
export function getProvisionalKFactor(matchCount) {
  if (matchCount <= 5) return 80;
  if (matchCount <= 10) return 48;
  if (matchCount <= 20) return 40;
  return 32; // Base K-factor
}
```

### 1.2 Dynamic Confidence System ✅

**Files modified:**

- `tools/rankingUtils.js` - Add `confidence: 0` to `initializeStats()`
- `tools/rankingCalculations.js` - Add `updateConfidence()` function
- `tools/rankingCalculations.js` - Update `updateStatsForMatch()` to track and update confidence
- All calculation files (`calculateRankings.js`, `calculateTeamRankings.js`, `calculateRaceRankings.js`, `calculateTeamRaceRankings.js`) - Pass confidence through stats

**Implementation:**

- Confidence starts at 0% for new players/teams
- Confidence increases when prediction is correct (expected matches actual)
- Confidence decreases when prediction is wrong (any error)
- Adaptive change rate:
  - When confidence is low: changes faster (easier to build confidence)
  - When confidence is high: changes slower (harder to lose confidence)
- Formula: `change = baseChange * (1 - confidence/100)` for increases, `change = baseChange * (confidence/100)` for decreases
- Base change: +5% for correct prediction, -5% for wrong prediction
- Confidence bounded between 0-100%

**Code changes:**

```javascript
// In rankingCalculations.js
export function updateConfidence(stats, expectedWin, actualWin) {
  const predictionError = Math.abs((actualWin ? 1 : 0) - expectedWin);
  const isCorrect = predictionError < 0.01; // Essentially correct (accounting for floating point)
  
  const baseChange = 5; // 5% base change
  let change;
  
  if (isCorrect) {
    // Increase confidence: faster when low, slower when high
    change = baseChange * (1 - stats.confidence / 100);
  } else {
    // Decrease confidence: slower when low, faster when high
    change = -baseChange * (stats.confidence / 100);
  }
  
  stats.confidence = Math.max(0, Math.min(100, stats.confidence + change));
}
```

### 1.3 Confidence-Based K-Factor Adjustments ✅

**Files modified:**

- `tools/rankingCalculations.js` - Add `applyConfidenceAdjustment()` function
- `tools/rankingCalculations.js` - Update `updateStatsForMatch()` to apply confidence adjustments individually

**Implementation:**

- Each player/team gets individual K-factor adjustment based on their confidence
- High confidence player: more stable K-factor (less adjustment needed)
- Low confidence player: higher K-factor (still learning)
- Formula: `adjustedK = baseK * (1 + (100 - confidence) / 100 * 0.5)`
  - Confidence 0%: K multiplied by 1.5 (50% increase)
  - Confidence 50%: K multiplied by 1.25 (25% increase)
  - Confidence 100%: K unchanged

**Code changes:**

```javascript
// In rankingCalculations.js
export function applyConfidenceAdjustment(baseK, confidence) {
  // Lower confidence = higher K-factor adjustment
  const confidenceMultiplier = 1 + ((100 - confidence) / 100) * 0.5;
  return baseK * confidenceMultiplier;
}
```

### 1.4 Tighter Rating Scale ✅ (Enhanced)

**Files modified:**

- ✅ `tools/rankingCalculations.js` - Updated `predictWinProbability()` function

**Implementation:**

- ✅ Default changed from 400 to 350
- ✅ Enhanced: Uses population-based adaptive scaling (`populationStdDev`) instead of fixed divisor
- ✅ This increases rating spread and makes differences more impactful
- **Note:** Implementation exceeds plan - adapts to actual skill distribution dynamically

**Code changes:**

```javascript
// In rankingCalculations.js - predictWinProbability()
// Change from: return 1 / (1 + Math.pow(10, ratingDiff / 400));
// To:
return 1 / (1 + Math.pow(10, ratingDiff / 350));
```

### 1.5 Adaptive K-Factor After Provisional Period ✅

**Files modified:**

- ✅ `tools/rankingCalculations.js` - Updated `getProvisionalKFactor()` to include adaptive component

**Implementation:**

- ✅ After match 20+: Apply adaptive formula `K = 32 * (1 + 3/matches)` capped at 40
- ✅ Only applies when matches > 20

**Code changes:**

```javascript
// In rankingCalculations.js - getProvisionalKFactor()
export function getProvisionalKFactor(matchCount) {
  if (matchCount <= 5) return 80;
  if (matchCount <= 10) return 48;
  if (matchCount <= 20) return 40;
  
  // Adaptive K-factor after provisional period
  const adaptiveK = 32 * (1 + 3 / matchCount);
  return Math.min(40, adaptiveK);
}
```

### 1.6 Update Core Calculation Function ✅

**Files modified:**

- ✅ `tools/rankingCalculations.js` - Refactored `updateStatsForMatch()` to integrate all components

**Implementation:**

- ✅ Get provisional K-factor based on match count
- ✅ Apply confidence adjustment to K-factor
- ✅ Calculate expected win probability (with population-based scale)
- ✅ Update rating
- ✅ Update confidence based on prediction accuracy

**Code changes:**

```javascript
// In rankingCalculations.js
export function updateStatsForMatch(stats, won, lost, opponentRating, opponentConfidence = 0) {
  stats.matches++;
  
  // Get base K-factor from provisional system
  const baseK = getProvisionalKFactor(stats.matches);
  
  // Apply confidence adjustment individually
  const adjustedK = applyConfidenceAdjustment(baseK, stats.confidence);
  
  // Calculate expected win probability (with tighter scale: 350)
  const expectedWin = predictWinProbability(stats.points, opponentRating);
  
  // Calculate rating change
  const ratingChange = calculateRatingChange(expectedWin, won, adjustedK);
  
  // Update confidence based on prediction accuracy
  updateConfidence(stats, expectedWin, won);
  
  // Update stats
  if (won) {
    stats.wins++;
  } else if (lost) {
    stats.losses++;
  }
  
  // Update points
  stats.points += ratingChange;
  
  return ratingChange;
}
```

### 1.7 Update All Calculation Files ✅

**Files modified:**

- ✅ `tools/processRankings.js` (player rankings) - Pass confidence when calling `updateStatsForMatch()`
- ✅ `tools/calculateTeamRankings.js` - Pass confidence when calling `updateStatsForMatch()`
- ✅ `tools/calculateRaceRankings.js` - Pass confidence when calling `updateStatsForMatch()`
- ✅ `tools/calculateTeamRaceRankings.js` - Pass confidence when calling `updateStatsForMatch()`

**Implementation:**

- ✅ Ensure opponent confidence is passed to `updateStatsForMatch()` (available for future enhancements)
- ✅ All stats objects now include `confidence` field
- **Note:** `processRankings.js` handles player rankings (not `calculateRankings.js` which doesn't exist)

## Phase 2: Initial Seeding System (Secondary Phase) ✅ COMPLETE

### 2.1 Seeding Runner Script ✅

**Files created:**

- ✅ `tools/runSeededRankings.js` - New script to run seeding process

**Implementation:**

- ✅ Load all matches from season one
- ✅ Run 1: Process chronologically, store all player/team ratings
- ✅ Run 2: Process backwards (reverse chronological), store all player/team ratings
- ✅ Run 3: Process chronologically again, using ratings from Run 1 as initial seeds
- ✅ Final: Keep only points from Run 3 (discard Run 1 and Run 2 points)

**Key requirements:**

- ✅ Separate seeding mode that doesn't affect main ranking calculations
- ✅ Store intermediate ratings in memory (not persisted)
- ✅ Only applies to first season data
- ✅ Can be run as a one-time operation

**Test Results:**

- Successfully processed 198 matches from 12 tournament files
- Player rankings: 113 players processed through all three passes
- Team rankings: 147 teams processed through all three passes
- Example output: MaxPax ranked #1 with 262.7 final points (Pass1: 202.3, Pass2: 149.3)

### 2.2 Seeding Functions ✅

**Files modified/created:**

- ✅ `tools/rankingCalculations.js` - Added `initializeStatsWithSeed()` function
- ✅ `tools/runSeededRankings.js` - Implemented seeding logic

**Implementation:**

- ✅ Function to initialize stats with seed rating instead of 0
- ✅ Seeding runner that executes three passes
- ✅ Final pass uses seeds but calculates fresh points

**Usage:**

Run the seeding script with: `node tools/runSeededRankings.js`

The script is completely independent and doesn't affect normal ranking calculations.

## Testing Considerations ✅

- ✅ Verify provisional K-factors are applied correctly at each threshold
- ✅ Verify confidence increases/decreases appropriately
- ✅ Verify confidence affects K-factor adjustments
- ✅ Verify population-based rating scale produces appropriate spread
- ✅ Verify adaptive K-factor applies after match 20+
- ✅ Test seeding system with season one data (198 matches, 113 players, 147 teams)

## UI Enhancements (Future)

- Display confidence percentage in rankings UI
- Visual indicators for provisional vs established players/teams
- Confidence-based styling (e.g., opacity or color based on confidence level)