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
  if (matchCount <= 5) return 80;
  if (matchCount <= 10) return 48;
  if (matchCount <= 20) return 40;
  
  // Adaptive K-factor after provisional period
  const adaptiveK = 32 * (1 + 3 / matchCount);
  return Math.min(40, adaptiveK);
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
 * Predict win probability for team1 based on rating difference
 * Uses logistic function: P(team1 wins) = 1 / (1 + 10^((rating2 - rating1) / 350))
 * This is similar to Elo rating system with tighter scale (350 instead of 400)
 * 
 * @param {number} rating1 - Current rating/points of team1
 * @param {number} rating2 - Current rating/points of team2
 * @returns {number} Expected win probability for team1 (0 to 1)
 */
export function predictWinProbability(rating1, rating2) {
  const ratingDiff = rating2 - rating1;
  // Using 350 as the rating difference (tighter than standard 400)
  // This increases rating spread and makes differences more impactful
  return 1 / (1 + Math.pow(10, ratingDiff / 350));
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
 * Update stats for a single entity (player or team) based on match outcome
 * Uses enhanced prediction-based scoring with:
 * - Provisional K-factor (higher for new players/teams)
 * - Confidence tracking (builds with correct predictions)
 * - Confidence-based K-factor adjustment (individual per entity)
 * - Tighter rating scale (350 instead of 400)
 * 
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {boolean} won - Whether this entity won the match
 * @param {boolean} lost - Whether this entity lost the match
 * @param {number} opponentRating - Current rating/points of the opponent
 * @param {number} opponentConfidence - Opponent's confidence (0-100, optional for future use)
 * @param {number} currentRating - Optional: explicit current rating to use (for zero-sum calculations)
 * @returns {number} The rating change that was applied
 */
export function updateStatsForMatch(stats, won, lost, opponentRating, opponentConfidence = 0, currentRating = null) {
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
  
  // Calculate expected win probability (with tighter scale: 350)
  // Use explicit currentRating if provided (for zero-sum calculations), otherwise use stats.points
  const ratingToUse = currentRating !== null ? currentRating : stats.points;
  const expectedWin = predictWinProbability(ratingToUse, opponentRating);
  
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
  
  // Return the rating change for tracking purposes
  return ratingChange;
}
