/**
 * Core ranking calculation functions
 * These are pure functions that handle the ranking logic separately from
 * data loading, stats updating, and display formatting.
 */

// ============================================================================
// CORE RANKING CALCULATIONS
// ============================================================================
// These functions implement the prediction-based ranking algorithm

/**
 * Get K-factor based on match count (provisional rating system)
 * - Matches 1-5: K = 80 (provisional - learning rapidly)
 * - Matches 6-10: K = 48 (transition period)
 * - Matches 11-20: K = 40 (stabilizing)
 * - Matches 21+: Adaptive K = 32 * (1 + 3/matches), capped at 40
 * 
 * @param {number} matchCount - Number of matches played
 * @returns {number} K-factor for rating calculations
 */
export function getProvisionalKFactor(matchCount) {
  if (matchCount <= 5) return 64;
  if (matchCount <= 10) return 40;
  if (matchCount <= 20) return 32;

  // Adaptive K-factor after provisional period
  const adaptiveK = 24 * (1 + 3 / matchCount);
  return Math.min(32, adaptiveK);
}

/**
 * Update confidence based on prediction accuracy
 * Confidence starts at 0% and increases when predictions are correct,
 * decreases when predictions are wrong. Uses adaptive change rate:
 * - Low confidence: changes faster (easier to build confidence)
 * - High confidence: changes slower (harder to lose confidence)
 * 
 * @param {Object} stats - Stats object with confidence field (will be mutated)
 * @param {number} expectedWin - Expected win probability (0 to 1)
 * @param {boolean} actualWin - Whether the entity actually won
 */
export function updateConfidence(stats, expectedWin, actualWin) {
  // Ensure confidence is initialized and is a valid number
  if (typeof stats.confidence !== 'number' || isNaN(stats.confidence)) {
    stats.confidence = 0;
  }

  // Determine if prediction was correct based on expected outcome
  // If expected win probability > 0.5, we predicted a win
  // If expected win probability < 0.5, we predicted a loss
  const predictedWin = expectedWin > 0.5;
  const isCorrect = predictedWin === actualWin;

  const baseChange = 5; // 5% base change
  let change;

  if (isCorrect) {
    // Increase confidence: faster when low, slower when high
    change = baseChange * (1 - stats.confidence / 100);
  } else {
    // Decrease confidence: slower when low, faster when high
    change = -baseChange * (stats.confidence / 100);
  }

  // Ensure change is a valid number
  if (isNaN(change) || !isFinite(change)) {
    change = 0;
  }

  stats.confidence = Math.max(0, Math.min(100, stats.confidence + change));

  // Final safety check
  if (isNaN(stats.confidence) || !isFinite(stats.confidence)) {
    stats.confidence = 0;
  }
}

/**
 * Apply confidence-based adjustment to K-factor
 * Lower confidence = higher K-factor (still learning)
 * Higher confidence = lower K-factor (more stable)
 * 
 * @param {number} baseK - Base K-factor from provisional system
 * @param {number} confidence - Confidence percentage (0-100)
 * @returns {number} Adjusted K-factor
 */
export function applyConfidenceAdjustment(baseK, confidence) {
  // Lower confidence = higher K-factor adjustment
  // Confidence 0%: K multiplied by 1.5 (50% increase)
  // Confidence 50%: K multiplied by 1.25 (25% increase)
  // Confidence 100%: K unchanged
  const confidenceMultiplier = 1 + ((100 - confidence) / 100) * 0.5;
  return baseK * confidenceMultiplier;
}

/**
 * Calculate population statistics (mean and standard deviation) from player ratings
 * Used to determine the distribution of skill in the player base
 * 
 * @param {Map|Array} playerStats - Map or Array of player stats objects with 'points' property
 * @returns {Object} Object with mean and stdDev properties
 */
export function calculatePopulationStats(playerStats) {
  // Convert Map to Array if needed
  const ratings = playerStats instanceof Map
    ? Array.from(playerStats.values()).map(s => s.points)
    : playerStats.map(s => s.points);

  if (ratings.length === 0) {
    // Default fallback if no players
    return { mean: 0, stdDev: 350 };
  }

  // Calculate mean
  const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;

  // Calculate variance
  const variance = ratings.reduce((sum, rating) => {
    const diff = rating - mean;
    return sum + (diff * diff);
  }, 0) / ratings.length;

  // Calculate standard deviation
  const stdDev = Math.sqrt(variance);

  // Ensure minimum std dev to avoid division by zero
  // Use 350 as minimum (fallback to old system if population is too uniform)
  const minStdDev = 50; // Minimum reasonable std dev
  const finalStdDev = Math.max(stdDev, minStdDev);

  return { mean, stdDev: finalStdDev };
}

/**
 * Predict win probability for team1 based on rating difference
 * Uses population-based logistic function: P(team1 wins) = 1 / (1 + 10^((rating2 - rating1) / stdDev))
 * This adapts to the actual distribution of player skill (Blizzard-style)
 * 
 * How it works:
 * - The formula uses a logistic (S-curve) function that maps rating differences to win probabilities
 * - The populationStdDev acts as a "scale factor" - it determines how many rating points = 1 standard deviation
 * - When ratingDiff = 0 (equal ratings): P(win) = 1/(1+10^0) = 1/2 = 50%
 * - When ratingDiff = -stdDev (team1 is 1 std dev higher): P(win) = 1/(1+10^-1) = 1/1.1 ≈ 90.9%
 * - When ratingDiff = -2*stdDev (team1 is 2 std dev higher): P(win) = 1/(1+10^-2) = 1/1.01 ≈ 99.0%
 * - When ratingDiff = +stdDev (team1 is 1 std dev lower): P(win) = 1/(1+10^1) = 1/11 ≈ 9.1%
 * 
 * The function is symmetric: if team1 has X% chance, team2 has (100-X)% chance
 * 
 * @param {number} rating1 - Current rating/points of team1
 * @param {number} rating2 - Current rating/points of team2
 * @param {number} populationStdDev - Standard deviation of the player population (acts as scale factor)
 * @returns {number} Expected win probability for team1 (0 to 1)
 */
export function predictWinProbability(rating1, rating2, populationStdDev = 350) {
  const ratingDiff = rating2 - rating1;
  // Using population std dev as the scale factor
  // This adapts to the actual skill distribution:
  // - 0 std dev apart (equal ratings) = 50% win chance
  // - 1 std dev apart (higher player) = ~91% win chance
  // - 2 std dev apart (higher player) = ~99% win chance
  // - The function approaches but never reaches 0% or 100%
  return 1 / (1 + Math.pow(10, ratingDiff / populationStdDev));
}

/**
 * Calculate rating change based on prediction accuracy
 * Formula: change = K * (actual - expected)
 * - If actual > expected (outperformed): gain points
 * - If actual < expected (underperformed): lose points
 * 
 * @param {number} expectedWin - Expected win probability (0 to 1)
 * @param {boolean} actualWin - Whether the team actually won
 * @param {number} kFactor - K-factor controlling rating volatility (default: 32)
 * @returns {number} Rating change (positive for gain, negative for loss)
 */
export function calculateRatingChange(expectedWin, actualWin, kFactor = 32) {
  const actualResult = actualWin ? 1 : 0;
  return kFactor * (actualResult - expectedWin);
}

/**
 * Initialize stats with a seed rating (for seeding system)
 * This is a helper for the seeding process that starts entities with a pre-calculated rating
 * instead of starting at 0 or population mean
 * 
 * @param {string} name - Name/identifier of the entity
 * @param {number} seedRating - Initial seed rating to start with
 * @param {Object} additionalFields - Additional fields to include in stats object
 * @returns {Object} Initialized stats object with seed rating
 */
export function initializeStatsWithSeed(name, seedRating, additionalFields = {}) {
  return {
    name,
    matches: 0,
    wins: 0,
    losses: 0,
    points: seedRating,
    confidence: 0, // Confidence starts at 0% even with seed
    isSeeded: true,
    ...additionalFields
  };
}

/**
 * Update stats for a single entity (player or team) based on match outcome
 * Uses enhanced prediction-based scoring with:
 * - Provisional K-factor (higher for new players/teams)
 * - Confidence tracking (builds with correct predictions)
 * - Confidence-based K-factor adjustment (individual per entity)
 * - Population-based rating scale (adapts to actual skill distribution)
 * 
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {boolean} won - Whether this entity won the match
 * @param {boolean} lost - Whether this entity lost the match
 * @param {number} opponentRating - Current rating/points of the opponent
 * @param {number} populationStdDev - Standard deviation of the player population
 * @param {number} opponentConfidence - Opponent's confidence (0-100, optional for future use)
 * @param {number} currentRating - Optional: explicit current rating to use (for zero-sum calculations)
 * @returns {Object} Object with ratingChange and calculation details
 */
export function updateStatsForMatch(stats, won, lost, opponentRating, populationStdDev = 350, opponentConfidence = 0, currentRating = null, populationMean = null) {
  // Check if this is the first match (before incrementing)
  const isFirstMatch = stats.matches === 0;

  // Increment match count BEFORE calculating K-factor (uses current match count)
  stats.matches++;

  // Initialize confidence if not present or invalid
  if (typeof stats.confidence !== 'number' || isNaN(stats.confidence)) {
    stats.confidence = 0;
  }

  // Get base K-factor from provisional system
  const baseK = getProvisionalKFactor(stats.matches);

  // Apply confidence adjustment individually
  const adjustedK = applyConfidenceAdjustment(baseK, stats.confidence);

  // Calculate expected win probability using population-based scale
  // For first match: use population mean instead of current rating (which might be 0 or mean)
  // This ensures reasonable expected win probabilities for new players
  // Use explicit currentRating if provided (for zero-sum calculations)
  // CRITICAL: If player has a seed (isSeeded), use their seed rating (stats.points) instead of populationMean
  let ratingToUse;
  if (currentRating !== null) {
    ratingToUse = currentRating;
  } else if (isFirstMatch && !stats.isSeeded) {
    // First match AND NOT SEEDED: use 0 (fixed anchor)
    // This prevents first-time players from inheriting negative population means
    ratingToUse = 0;
  } else {
    ratingToUse = stats.points;
  }

  const expectedWin = predictWinProbability(ratingToUse, opponentRating, populationStdDev);

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

  // Update points based on prediction performance
  stats.points += ratingChange;

  // Return the rating change and calculation details for tracking purposes
  return {
    ratingChange,
    calculationDetails: {
      expectedWin,
      baseK,
      adjustedK,
      confidence: stats.confidence,
      matchCount: stats.matches,
      populationStdDev
    }
  };
}
