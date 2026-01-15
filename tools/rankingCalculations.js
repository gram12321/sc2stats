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
 * Predict win probability for team1 based on rating difference
 * Uses logistic function: P(team1 wins) = 1 / (1 + 10^((rating2 - rating1) / 400))
 * This is similar to Elo rating system
 * 
 * @param {number} rating1 - Current rating/points of team1
 * @param {number} rating2 - Current rating/points of team2
 * @returns {number} Expected win probability for team1 (0 to 1)
 */
export function predictWinProbability(rating1, rating2) {
  const ratingDiff = rating2 - rating1;
  // Using 400 as the rating difference for 10x odds (standard Elo parameter)
  return 1 / (1 + Math.pow(10, ratingDiff / 400));
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
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * 
 * @param {Object} stats - Current stats object (will be mutated)
 * @param {boolean} won - Whether this entity won the match
 * @param {boolean} lost - Whether this entity lost the match
 * @param {number} opponentRating - Current rating/points of the opponent
 * @param {number} kFactor - K-factor for rating changes (default: 32)
 * @returns {number} The rating change that was applied
 */
export function updateStatsForMatch(stats, won, lost, opponentRating, kFactor = 32) {
  stats.matches++;
  
  // Calculate expected win probability based on current ratings
  const expectedWin = predictWinProbability(stats.points, opponentRating);
  
  // Calculate rating change based on prediction accuracy
  const ratingChange = calculateRatingChange(expectedWin, won, kFactor);
  
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
