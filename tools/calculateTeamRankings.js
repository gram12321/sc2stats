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
 * Normalize team key - sort player names alphabetically to ensure consistent team identification
 */
function normalizeTeamKey(player1, player2) {
  const players = [player1, player2].filter(Boolean).sort();
  return players.join('+');
}

/**
 * Calculate team rankings from all tournament JSON files
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * Predictions are based on previous ranking points vs opponent's previous ranking points
 * Teams are identified by the same two players (normalized alphabetically)
 * 
 * @returns {Promise<Object>} Object with rankings and matchHistory
 */
export async function calculateTeamRankings() {
  const teamStats = new Map();
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
      // Get player names for each team
      const team1Player1 = match.team1?.player1?.name;
      const team1Player2 = match.team1?.player2?.name;
      const team2Player1 = match.team2?.player1?.name;
      const team2Player2 = match.team2?.player2?.name;

      // Skip if teams don't have both players
      if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
        continue;
      }

      // Normalize team keys (alphabetically sorted)
      const team1Key = normalizeTeamKey(team1Player1, team1Player2);
      const team2Key = normalizeTeamKey(team2Player1, team2Player2);

      // Get normalized player names (sorted alphabetically)
      const team1PlayersSorted = [team1Player1, team1Player2].sort();
      const team2PlayersSorted = [team2Player1, team2Player2].sort();

      // Initialize teams if they don't exist yet
      if (!teamStats.has(team1Key)) {
        teamStats.set(team1Key, initializeStats(team1Key, {
          player1: team1PlayersSorted[0],
          player2: team1PlayersSorted[1]
        }));
      }

      if (!teamStats.has(team2Key)) {
        teamStats.set(team2Key, initializeStats(team2Key, {
          player1: team2PlayersSorted[0],
          player2: team2PlayersSorted[1]
        }));
      }

      // Get current team ratings BEFORE updating (to use previous ratings for prediction)
      const team1Stats = teamStats.get(team1Key);
      const team2Stats = teamStats.get(team2Key);
      
      // Store opponent ratings before any updates
      const team1Rating = team1Stats.points;
      const team2Rating = team2Stats.points;

      // Determine winner
      const { team1Won, team2Won } = determineMatchOutcome(
        match.team1_score,
        match.team2_score
      );

      // Update stats using prediction-based scoring
      // Compare team1 rating vs team2 rating (using previous ratings)
      const team1RatingChange = updateStatsForMatch(team1Stats, team1Won, team2Won, team2Rating);
      
      // Compare team2 rating vs team1 rating (using previous ratings)
      const team2RatingChange = updateStatsForMatch(team2Stats, team2Won, team1Won, team1Rating);

      // Store match history entry
      matchHistory.push({
        match_id: match.match_id,
        tournament_slug: match.tournamentSlug,
        tournament_date: match.tournamentDate,
        match_date: match.date,
        round: match.round,
        team1: {
          player1: team1Player1,
          player2: team1Player2
        },
        team2: {
          player1: team2Player1,
          player2: team2Player2
        },
        team1_score: match.team1_score,
        team2_score: match.team2_score,
        team_impacts: {
          [team1Key]: {
            ratingBefore: team1Rating,
            ratingChange: team1RatingChange,
            won: team1Won,
            opponentRating: team2Rating
          },
          [team2Key]: {
            ratingBefore: team2Rating,
            ratingChange: team2RatingChange,
            won: team2Won,
            opponentRating: team1Rating
          }
        }
      });
    }

    // Convert to array and sort using shared sorting function
    // For teams, we need a custom getNameFn since teams have player1+player2 format
    const rankings = sortRankings(
      Array.from(teamStats.values()),
      (team) => `${team.player1}+${team.player2}`
    );

    return { rankings, matchHistory };
  } catch (error) {
    console.error('Error calculating team rankings:', error);
    throw error;
  }
}

// If run directly, output rankings
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('calculateTeamRankings.js')) {
  calculateTeamRankings()
    .then(({ rankings }) => {
      console.log('\nTeam Rankings:');
      console.log('==============\n');
      rankings.forEach((team, index) => {
        console.log(
          `${(index + 1).toString().padStart(3)}. ${team.player1.padEnd(20)} + ${team.player2.padEnd(20)} ` +
          `Matches: ${team.matches.toString().padStart(3)} ` +
          `Wins: ${team.wins.toString().padStart(3)} ` +
          `Losses: ${team.losses.toString().padStart(3)} ` +
          `Points: ${team.points >= 0 ? '+' : ''}${team.points.toString().padStart(3)}`
        );
      });
    })
    .catch(err => {
      console.error('Failed to calculate team rankings:', err);
      process.exit(1);
    });
}
