import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  updateStatsForMatch,
  calculatePopulationStats
} from './rankingCalculations.js';
import {
  determineMatchOutcome,
  hasValidScores,
  initializeStats,
  sortRankings
} from './rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');

/**
 * Round order mapping for sorting matches chronologically
 */
const ROUND_ORDER = {
  'Round of 16': 1,
  'Round of 8': 2,
  'Quarterfinals': 3,
  'Semifinals': 4,
  'Grand Final': 5,
  'Final': 5
};

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
 * @returns {Array} Array of enriched match objects
 */
function collectMatchesFromTournaments(tournaments) {
  const allMatches = [];
  
  for (const tournament of tournaments) {
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
    } else if (a.date && !b.date) {
      return -1;
    } else if (!a.date && b.date) {
      return 1;
    }
    
    // Then by round order
    const roundA = ROUND_ORDER[a.round] || 999;
    const roundB = ROUND_ORDER[b.round] || 999;
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
 * Calculate player rankings from sorted matches
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * Predictions are based on previous ranking points vs opponent's previous ranking points
 * 
 * @param {Array} sortedMatches - Array of match objects sorted chronologically
 * @returns {Object} Object with rankings and matchHistory
 */
function calculateRankingsFromMatches(sortedMatches) {
  const playerStats = new Map();
  const matchHistory = [];
    
  for (const match of sortedMatches) {
    // Determine winner
    const { team1Won, team2Won } = determineMatchOutcome(
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

    // Calculate population statistics BEFORE initializing new players
    // This allows us to start new players at the population mean
    const existingPopulationStats = calculatePopulationStats(playerStats);
    const populationMean = existingPopulationStats.mean;
    const populationStdDev = existingPopulationStats.stdDev;

    // Initialize players if they don't exist yet, starting them at population mean
    for (const playerName of [...team1Players, ...team2Players]) {
      if (!playerStats.has(playerName)) {
        playerStats.set(playerName, initializeStats(playerName, {}, populationMean));
      }
    }

    // Recalculate population statistics after adding new players
    // (new players start at mean, so this shouldn't change much, but ensures accuracy)
    const populationStats = calculatePopulationStats(playerStats);
    const finalPopulationMean = populationStats.mean;
    const finalPopulationStdDev = populationStats.stdDev;

    // Calculate average opponent ratings for each team
    const team1AvgOpponentRating = getAverageOpponentRating(team2Players, playerStats);
    const team2AvgOpponentRating = getAverageOpponentRating(team1Players, playerStats);

    // Track rating changes for each player
    const playerImpacts = new Map();

    // Update stats for team1 players (compare vs team2 average rating)
    for (const playerName of team1Players) {
      const stats = playerStats.get(playerName);
      const ratingBefore = stats.points;
      const result = updateStatsForMatch(stats, team1Won, team2Won, team1AvgOpponentRating, finalPopulationStdDev, 0, null, finalPopulationMean);
      playerImpacts.set(playerName, {
        ratingBefore,
        ratingChange: result.ratingChange,
        won: team1Won,
        opponentRating: team1AvgOpponentRating,
        ...result.calculationDetails
      });
    }

    // Update stats for team2 players (compare vs team1 average rating)
    for (const playerName of team2Players) {
      const stats = playerStats.get(playerName);
      const ratingBefore = stats.points;
      const result = updateStatsForMatch(stats, team2Won, team1Won, team2AvgOpponentRating, finalPopulationStdDev, 0, null, finalPopulationMean);
      playerImpacts.set(playerName, {
        ratingBefore,
        ratingChange: result.ratingChange,
        won: team2Won,
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
        player2: match.team1?.player2?.name
      },
      team2: {
        player1: match.team2?.player1?.name,
        player2: match.team2?.player2?.name
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
export async function calculateRankings() {
  try {
    // Load tournament files
    const tournaments = await loadTournamentFiles();
    
    // Collect matches from tournaments
    const allMatches = collectMatchesFromTournaments(tournaments);
    
    // Sort matches chronologically
    const sortedMatches = sortAllMatches(allMatches);
    
    // Calculate rankings from sorted matches
    return calculateRankingsFromMatches(sortedMatches);
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
