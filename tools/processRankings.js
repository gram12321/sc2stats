import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { updateStatsForMatch, calculatePopulationStats, initializeStatsWithSeed } from './rankingCalculations.js';
import {
  determineMatchOutcome,
  hasValidScores,
  initializeStats,
  sortRankings,
  getRoundSortOrder
} from './rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');
const playerDefaultsFile = join(outputDir, 'player_defaults.json');

/**
 * Load player defaults from JSON file
 * @returns {Promise<Object>} Object mapping player names to races
 */
async function loadPlayerDefaults() {
  try {
    const content = await readFile(playerDefaultsFile, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return {};
    }
    console.error('Error loading player defaults:', err);
    return {};
  }
}

/**
 * Get race from player, using defaults if race is not set in match data
 * @param {Object} player - Player object with optional race property
 * @param {Object} playerDefaults - Object mapping player names to default races
 * @returns {string|null} Race name or null
 */
function getPlayerRace(player, playerDefaults = {}) {
  // First check if race is set in match data (this takes precedence - user can override defaults)
  if (player?.race) {
    return player.race;
  }
  // Otherwise, use default race if available
  if (player?.name && playerDefaults[player.name]) {
    return playerDefaults[player.name];
  }
  return null;
}

/**
 * Load and parse all tournament JSON files from the output directory
 * 
 * @returns {Promise<Array>} Array of parsed tournament data objects
 */
async function loadTournamentFiles() {
  const files = await readdir(outputDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json');

  const tournaments = [];

  for (const file of jsonFiles) {
    try {
      const filePath = join(outputDir, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      if (data.matches && Array.isArray(data.matches)) {
        // Attach filename for fallback filtering logic
        data.filename = file;
        tournaments.push(data);
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }

  return tournaments;
}

/**
 * Collect and enrich matches from tournament data
 * Adds tournament metadata to each match and filters out invalid matches
 * 
 * @param {Array} tournaments - Array of tournament data objects
 * @param {boolean} mainCircuitOnly - Whether to include only main circuit tournaments
 * @param {Array} seasons - Array of allowed seasons (strings like "2025")
 * @returns {Array} Array of enriched match objects
 */
function collectMatchesFromTournaments(tournaments, mainCircuitOnly = false, seasons = null) {
  const allMatches = [];

  for (const tournament of tournaments) {
    // Determine season (explicit or from date)
    let season = tournament.tournament?.season;
    if (season === undefined && tournament.tournament?.date) {
      const year = new Date(tournament.tournament.date).getFullYear();
      if (!isNaN(year)) {
        season = String(year);
      }
    }
    // Ensure season is string for comparison
    season = season?.toString();

    // Filter by season if requested
    if (seasons && Array.isArray(seasons) && seasons.length > 0) {
      if (!season || !seasons.includes(season)) {
        continue;
      }
    }

    // Determine if main circuit (check flag or filename)
    const isMainCircuit = tournament.tournament?.is_main_circuit ||
      (tournament.filename && (
        tournament.filename.toLowerCase().startsWith('utermal_2v2_circuit') ||
        tournament.filename.toLowerCase().startsWith('uthermal_2v2_circuit')
      ));

    // Filter by main circuit if requested
    if (mainCircuitOnly && !isMainCircuit) {
      continue;
    }

    const tournamentDate = tournament.tournament?.date || null;

    const tournamentSlug = tournament.tournament?.liquipedia_slug || null;

    for (const match of tournament.matches) {
      if (hasValidScores(match)) {
        allMatches.push({
          ...match,
          tournamentDate,
          tournamentSlug: tournamentSlug || tournament.tournament?.name || 'unknown'
        });
      }
    }
  }

  return allMatches;
}

/**
 * Sort all matches chronologically for proper ranking calculation
 * Matches are processed in order, so rankings update based on previous results
 * 
 * @param {Array} matches - Array of match objects with tournament metadata
 * @returns {Array} Sorted matches array
 */
function sortAllMatches(matches) {
  return [...matches].sort((a, b) => {
    // First by tournament date
    if (a.tournamentDate && b.tournamentDate) {
      const dateA = new Date(a.tournamentDate);
      const dateB = new Date(b.tournamentDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
    }

    // Then by match date within tournament
    if (a.date && b.date) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
    }

    // Then by round order
    const roundA = getRoundSortOrder(a.round);
    const roundB = getRoundSortOrder(b.round);
    if (roundA !== roundB) {
      return roundA - roundB;
    }

    // Finally by match_id
    return (a.match_id || '').localeCompare(b.match_id || '');
  });
}

/**
 * Calculate average rating of opponent players
 * 
 * @param {Array} opponentNames - Array of opponent player names
 * @param {Map} playerStats - Map of player stats
 * @returns {number} Average rating of opponents
 */
function getAverageOpponentRating(opponentNames, playerStats) {
  if (opponentNames.length === 0) return 0;

  const ratings = opponentNames
    .map(name => {
      const stats = playerStats.get(name);
      return stats ? stats.points : 0;
    })
    .filter(rating => rating !== undefined);

  if (ratings.length === 0) return 0;

  return ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
}

/**
 * Calculate average confidence of opponent players
 *
 * @param {Array} opponentNames - Array of opponent player names
 * @param {Map} playerStats - Map of player stats
 * @returns {number} Average confidence of opponents
 */
function getAverageOpponentConfidence(opponentNames, playerStats) {
  if (opponentNames.length === 0) return 0;

  const confidences = opponentNames
    .map(name => {
      const stats = playerStats.get(name);
      return stats ? (stats.confidence || 0) : 0;
    })
    .filter(conf => conf !== undefined);

  if (confidences.length === 0) return 0;

  return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
}

/**
 * Calculate average match count of opponent players
 *
 * @param {Array} opponentNames - Array of opponent player names
 * @param {Map} playerStats - Map of player stats
 * @returns {number} Average match count of opponents
 */
function getAverageOpponentMatches(opponentNames, playerStats) {
  if (opponentNames.length === 0) return 0;

  const matches = opponentNames
    .map(name => {
      const stats = playerStats.get(name);
      return stats ? (stats.matches || 0) : 0;
    })
    .filter(count => count !== undefined);

  if (matches.length === 0) return 0;

  return matches.reduce((sum, count) => sum + count, 0) / matches.length;
}

/**
 * Calculate player rankings from sorted matches
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * Predictions are based on previous ranking points vs opponent's previous ranking points
 * 
 * @param {Array} sortedMatches - Array of match objects sorted chronologically
 * @returns {Object} Object with rankings
 */
// Main function to process rankings
function calculateRankingsFromMatches(sortedMatches, seeds = null, playerDefaults = {}) {
  const playerStats = new Map();
  const matchHistory = [];

  const getRaceAbbr = (race) => {
    if (!race) return null;
    const raceAbbr = {
      'Protoss': 'P',
      'Terran': 'T',
      'Zerg': 'Z',
      'Random': 'R'
    };
    return raceAbbr[race] || race[0];
  };

  for (const match of sortedMatches) {
    // Determine winner
    const { team1Won, team2Won, isDraw } = determineMatchOutcome(
      match.team1_score,
      match.team2_score
    );

    // Get player names
    const team1Players = [
      match.team1?.player1?.name,
      match.team1?.player2?.name
    ].filter(Boolean);

    const team2Players = [
      match.team2?.player1?.name,
      match.team2?.player2?.name
    ].filter(Boolean);

    // Initialize players if they don't exist yet (fixed anchor at 0 unless seeded)
    for (const playerName of [...team1Players, ...team2Players]) {
      if (!playerStats.has(playerName)) {
        if (seeds && seeds[playerName] !== undefined) {
          playerStats.set(playerName, initializeStatsWithSeed(playerName, seeds[playerName]));
        } else {
          playerStats.set(playerName, initializeStats(playerName, {}));
        }
      }
    }

    // Recalculate population statistics after adding new players
    const populationStats = calculatePopulationStats(playerStats);
    const finalPopulationMean = populationStats.mean;
    const finalPopulationStdDev = populationStats.stdDev;

    // Calculate average opponent ratings for each team
    const team1AvgOpponentRating = getAverageOpponentRating(team2Players, playerStats);
    const team2AvgOpponentRating = getAverageOpponentRating(team1Players, playerStats);
    const team1AvgOpponentConfidence = getAverageOpponentConfidence(team2Players, playerStats);
    const team2AvgOpponentConfidence = getAverageOpponentConfidence(team1Players, playerStats);
    const team1AvgOpponentMatches = getAverageOpponentMatches(team2Players, playerStats);
    const team2AvgOpponentMatches = getAverageOpponentMatches(team1Players, playerStats);

    // Calculate current rankings to determine rank before match
    // This is O(N log N) where N is number of players, done for every match
    // Optimization: only sort if needed, or maintain sorted list
    const currentRankings = sortRankings(Array.from(playerStats.values()));
    const rankMap = new Map();
    currentRankings.forEach((p, index) => rankMap.set(p.name, index + 1));

    // Track rating changes for each player
    const playerImpacts = new Map();

    // Update stats for team1 players (compare vs team2 average rating)
    for (const playerName of team1Players) {
      const stats = playerStats.get(playerName);
      const ratingBefore = stats.points;
      const rankBefore = rankMap.get(playerName) || '-';
      const rankBeforeConfidence = stats.confidence || 0;
      const result = updateStatsForMatch(
        stats,
        team1Won,
        team2Won,
        team1AvgOpponentRating,
        finalPopulationStdDev,
        team1AvgOpponentConfidence,
        null,
        finalPopulationMean,
        team1AvgOpponentMatches
      );
      playerImpacts.set(playerName, {
        ratingBefore,
        rankBefore,
        rankBeforeConfidence,
        ratingChange: result.ratingChange,
        won: team1Won,
        isDraw: isDraw,
        opponentRating: team1AvgOpponentRating,
        ...result.calculationDetails
      });
    }

    // Update stats for team2 players (compare vs team1 average rating)
    for (const playerName of team2Players) {
      const stats = playerStats.get(playerName);
      const ratingBefore = stats.points;
      const rankBefore = rankMap.get(playerName) || '-';
      const rankBeforeConfidence = stats.confidence || 0;
      const result = updateStatsForMatch(
        stats,
        team2Won,
        team1Won,
        team2AvgOpponentRating,
        finalPopulationStdDev,
        team2AvgOpponentConfidence,
        null,
        finalPopulationMean,
        team2AvgOpponentMatches
      );
      playerImpacts.set(playerName, {
        ratingBefore,
        rankBefore,
        rankBeforeConfidence,
        ratingChange: result.ratingChange,
        won: team2Won,
        isDraw: isDraw,
        opponentRating: team2AvgOpponentRating,
        ...result.calculationDetails
      });
    }

    // Store match history entry
    matchHistory.push({
      match_id: match.match_id,
      tournament_slug: match.tournamentSlug,
      tournament_date: match.tournamentDate,
      match_date: match.date,
      round: match.round,
      team1: {
        player1: match.team1?.player1?.name,
        player2: match.team1?.player2?.name,
        player1_race: getRaceAbbr(getPlayerRace(match.team1?.player1, playerDefaults)),
        player2_race: getRaceAbbr(getPlayerRace(match.team1?.player2, playerDefaults))
      },
      team2: {
        player1: match.team2?.player1?.name,
        player2: match.team2?.player2?.name,
        player1_race: getRaceAbbr(getPlayerRace(match.team2?.player1, playerDefaults)),
        player2_race: getRaceAbbr(getPlayerRace(match.team2?.player2, playerDefaults))
      },
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      player_impacts: Object.fromEntries(playerImpacts)
    });
  }

  // Convert to array and sort using shared sorting function
  const rankings = sortRankings(Array.from(playerStats.values()));

  return { rankings, matchHistory };
}

/**
 * Calculate player rankings from all tournament JSON files
 * Orchestrates the process: loads files, collects matches, sorts them, then calculates rankings
 * 
 * @returns {Promise<Object>} Object with rankings and matchHistory
 */
export async function calculateRankings(seeds = null, mainCircuitOnly = false, seasons = null) {
  try {
    // Load player defaults first
    const playerDefaults = await loadPlayerDefaults();
    
    // Load tournament files
    const tournaments = await loadTournamentFiles();

    // Collect matches from tournaments
    const allMatches = collectMatchesFromTournaments(tournaments, mainCircuitOnly, seasons);

    // Sort matches chronologically
    const sortedMatches = sortAllMatches(allMatches);

    // Calculate rankings from sorted matches
    return calculateRankingsFromMatches(sortedMatches, seeds, playerDefaults);
  } catch (error) {
    console.error('Error calculating rankings:', error);
    throw error;
  }
}

// If run directly, output rankings
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('processRankings.js')) {
  calculateRankings()
    .then(({ rankings }) => {
      console.log('\nPlayer Rankings:');
      console.log('================\n');
      rankings.forEach((player, index) => {
        console.log(
          `${(index + 1).toString().padStart(3)}. ${player.name.padEnd(20)} ` +
          `Matches: ${player.matches.toString().padStart(3)} ` +
          `Wins: ${player.wins.toString().padStart(3)} ` +
          `Losses: ${player.losses.toString().padStart(3)} ` +
          `Points: ${player.points >= 0 ? '+' : ''}${player.points.toString().padStart(3)}`
        );
      });
    })
    .catch(err => {
      console.error('Failed to calculate rankings:', err);
      process.exit(1);
    });
}
