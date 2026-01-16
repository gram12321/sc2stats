import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  updateStatsForMatch
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
 * Sort matches chronologically for proper ranking calculation
 * Matches are processed in order, so rankings update based on previous results
 * 
 * @param {Array} matches - Array of match objects
 * @param {string} tournamentDate - Tournament date string (YYYY-MM-DD)
 * @returns {Array} Sorted matches array
 */
function sortMatchesChronologically(matches, tournamentDate) {
  // Round order mapping (earlier rounds come first)
  const roundOrder = {
    'Round of 16': 1,
    'Round of 8': 2,
    'Quarterfinals': 3,
    'Semifinals': 4,
    'Grand Final': 5,
    'Final': 5
  };

  return [...matches].sort((a, b) => {
    // First sort by date if available
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

    // Then sort by round order
    const roundA = roundOrder[a.round] || 999;
    const roundB = roundOrder[b.round] || 999;
    if (roundA !== roundB) {
      return roundA - roundB;
    }

    // Finally sort by match_id (e.g., R1M1, R1M2, etc.)
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
 * Calculate player rankings from all tournament JSON files
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * Predictions are based on previous ranking points vs opponent's previous ranking points
 * 
 * @returns {Promise<Object>} Object with rankings and matchHistory
 */
export async function calculateRankings() {
  const playerStats = new Map();
  const allMatches = [];

  try {
    // Read all JSON files from output directory
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json');

    // Collect all matches with tournament metadata
    for (const file of jsonFiles) {
      try {
        const filePath = join(outputDir, file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (!data.matches || !Array.isArray(data.matches)) {
          continue;
        }

        const tournamentDate = data.tournament?.date || null;
        
        // Add tournament date and slug to each match for sorting
        for (const match of data.matches) {
          if (hasValidScores(match)) {
            allMatches.push({
              ...match,
              tournamentDate,
              tournamentSlug: data.tournament?.liquipedia_slug || file
            });
          }
        }
      } catch (err) {
        console.error(`Error processing ${file}:`, err);
      }
    }

    // Sort matches chronologically (by tournament date, then round, then match order)
    allMatches.sort((a, b) => {
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
      const roundOrder = {
        'Round of 16': 1, 'Round of 8': 2, 'Quarterfinals': 3,
        'Semifinals': 4, 'Grand Final': 5, 'Final': 5
      };
      const roundA = roundOrder[a.round] || 999;
      const roundB = roundOrder[b.round] || 999;
      if (roundA !== roundB) {
        return roundA - roundB;
      }
      
      // Finally by match_id
      return (a.match_id || '').localeCompare(b.match_id || '');
    });

    // Process matches in chronological order
    const matchHistory = [];
    
    for (const match of allMatches) {
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

      // Initialize players if they don't exist yet
      for (const playerName of [...team1Players, ...team2Players]) {
        if (!playerStats.has(playerName)) {
          playerStats.set(playerName, initializeStats(playerName));
        }
      }

      // Calculate average opponent ratings for each team
      const team1AvgOpponentRating = getAverageOpponentRating(team2Players, playerStats);
      const team2AvgOpponentRating = getAverageOpponentRating(team1Players, playerStats);

      // Track rating changes for each player
      const playerImpacts = new Map();

      // Update stats for team1 players (compare vs team2 average rating)
      for (const playerName of team1Players) {
        const stats = playerStats.get(playerName);
        const ratingBefore = stats.points;
        const result = updateStatsForMatch(stats, team1Won, team2Won, team1AvgOpponentRating);
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
        const result = updateStatsForMatch(stats, team2Won, team1Won, team2AvgOpponentRating);
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
  } catch (error) {
    console.error('Error calculating rankings:', error);
    throw error;
  }
}

// If run directly, output rankings
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('calculateRankings.js')) {
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
