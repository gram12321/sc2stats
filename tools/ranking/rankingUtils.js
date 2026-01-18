/**
 * Utility and control functions for ranking calculations
 * These functions handle data validation, initialization, and formatting
 * Separate from core ranking algorithm calculations
 */

/**
 * Determine match outcome from scores
 * @param {number} team1Score - Score of team 1
 * @param {number} team2Score - Score of team 2
 * @returns {Object} Object with team1Won and team2Won boolean flags
 */
export function determineMatchOutcome(team1Score, team2Score) {
  return {
    team1Won: team1Score > team2Score,
    team2Won: team2Score > team1Score
  };
}

/**
 * Check if match has valid scores
 * @param {Object} match - Match object
 * @returns {boolean} True if match has valid scores
 */
export function hasValidScores(match) {
  return match.team1_score !== null && 
         match.team1_score !== undefined &&
         match.team2_score !== null && 
         match.team2_score !== undefined;
}

/**
 * Initialize stats object for a new entity
 * @param {string} name - Name/identifier of the entity
 * @param {Object} additionalFields - Additional fields to include in stats object
 * @param {number} populationMean - Population mean rating (default: 0). New players start at population mean instead of 0
 * @returns {Object} Initialized stats object
 */
export function initializeStats(name, additionalFields = {}, populationMean = 0) {
  return {
    name,
    matches: 0,
    wins: 0,
    losses: 0,
    points: populationMean, // Start at population mean instead of 0
    confidence: 0, // Confidence starts at 0% for new entities
    ...additionalFields
  };
}

/**
 * Sort rankings by points (descending), then wins (descending), then name (ascending)
 * @param {Array} rankings - Array of stats objects
 * @param {Function} getNameFn - Function to get name for comparison (default: uses .name property)
 * @returns {Array} Sorted array
 */
export function sortRankings(rankings, getNameFn = (item) => item.name) {
  return [...rankings].sort((a, b) => {
    // Primary sort: points (descending)
    if (b.points !== a.points) {
      return b.points - a.points;
    }
    // Secondary sort: wins (descending)
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    // Tertiary sort: name (ascending)
    return getNameFn(a).localeCompare(getNameFn(b));
  });
}
