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
  const isDraw = team1Score === team2Score;
  return {
    team1Won: team1Score > team2Score,
    team2Won: team2Score > team1Score,
    isDraw
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
 * @returns {Object} Initialized stats object
 */
export function initializeStats(name, additionalFields = {}) {
  return {
    name,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: 0, // Start at 0 for a fixed anchor point
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

/**
 * Get numeric round sort order (lower means earlier in tournament).
 * Supports:
 * - Early Round N (before group stage)
 * - Group stage rounds (before main bracket)
 * - Upper/main bracket rounds
 * - Lower/losers rounds (after corresponding upper round)
 * - Round of X / RoX (larger X is earlier)
 * - Quarterfinals, Semifinals, Final/Grand Final
 *
 * @param {string} round - Round label from match data
 * @returns {number} Sort order value
 */
export function getRoundSortOrder(round) {
  if (!round || typeof round !== 'string') return 9999;

  const value = round.trim();
  const normalized = value.toLowerCase();

  // Early rounds are played before group stage and main bracket.
  const earlyRoundMatch = value.match(/^Early Round\s+(\d+)$/i);
  if (earlyRoundMatch) {
    const roundNum = parseInt(earlyRoundMatch[1], 10);
    return Number.isNaN(roundNum) ? 9999 : roundNum;
  }

  // Group stage rounds come after early rounds.
  if (
    /^group stage\b/i.test(value) ||
    /^groups?\b/i.test(value)
  ) {
    // Keep all group-stage labels together while preserving deterministic ordering.
    const groupNumMatch = value.match(/(?:round|r)\s*(\d+)/i);
    const groupNum = groupNumMatch ? parseInt(groupNumMatch[1], 10) : 0;
    return 100 + (Number.isNaN(groupNum) ? 0 : groupNum);
  }

  // Upper/lower bracket rounds with explicit numbering.
  const upperRoundMatch = value.match(/^(?:upper|winners?)\s*(?:bracket\s*)?(?:round|r)\s*(\d+)$/i);
  if (upperRoundMatch) {
    const roundNum = parseInt(upperRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      return 200 + (roundNum * 10);
    }
  }

  const lowerRoundMatch = value.match(/^(?:lower|losers?)\s*(?:bracket\s*)?(?:round|r)\s*(\d+)$/i);
  if (lowerRoundMatch) {
    const roundNum = parseInt(lowerRoundMatch[1], 10);
    if (!Number.isNaN(roundNum)) {
      // After corresponding upper/winner round.
      return 205 + (roundNum * 10);
    }
  }

  // "Round of 16", "Ro16", etc. Larger bracket size happens earlier.
  const roundOfMatch = value.match(/^(?:Round of|Ro)\s*(\d+)$/i);
  if (roundOfMatch) {
    const bracketSize = parseInt(roundOfMatch[1], 10);
    if (!Number.isNaN(bracketSize) && bracketSize > 0) {
      return 1000 - bracketSize;
    }
  }

  // Lower/losers variants for canonical playoff rounds:
  // place them right after their upper/main counterpart.
  if (normalized.includes('lower') || normalized.includes('loser')) {
    if (normalized.includes('quarter')) return 993.5;
    if (normalized.includes('semi')) return 994.5;
    if (normalized.includes('final')) return 995.5;
  }

  const fixedRounds = {
    Quarterfinals: 993,
    Semifinals: 994,
    Final: 995,
    'Grand Final': 996
  };

  return fixedRounds[value] ?? 9999;
}
