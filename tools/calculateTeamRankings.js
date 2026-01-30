import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  updateStatsForMatch,
  calculatePopulationStats,
  initializeStatsWithSeed
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
 * Calculate team rankings from matches with optional initial seeds
 */
export function calculateTeamRankingsFromMatches(sortedMatches, seeds = null) {
  const teamStats = new Map();
  const matchHistory = [];

  try {
    // Process matches in chronological order
    for (const match of sortedMatches) {
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

      // Calculate population statistics BEFORE initializing new teams
      const existingPopulationStats = calculatePopulationStats(teamStats);
      const populationMean = existingPopulationStats.mean;
      const populationStdDev = existingPopulationStats.stdDev;

      // Initialize teams if they don't exist yet
      if (!teamStats.has(team1Key)) {
        if (seeds && seeds[team1Key] !== undefined) {
          teamStats.set(team1Key, initializeStatsWithSeed(team1Key, seeds[team1Key], {
            player1: team1PlayersSorted[0],
            player2: team1PlayersSorted[1]
          }));
          console.log(`Seeded team ${team1Key} with ${seeds[team1Key]}`);
        } else {
          teamStats.set(team1Key, initializeStats(team1Key, {
            player1: team1PlayersSorted[0],
            player2: team1PlayersSorted[1]
          }, populationMean));
        }
      }

      if (!teamStats.has(team2Key)) {
        if (seeds && seeds[team2Key] !== undefined) {
          teamStats.set(team2Key, initializeStatsWithSeed(team2Key, seeds[team2Key], {
            player1: team2PlayersSorted[0],
            player2: team2PlayersSorted[1]
          }));
        } else {
          teamStats.set(team2Key, initializeStats(team2Key, {
            player1: team2PlayersSorted[0],
            player2: team2PlayersSorted[1]
          }, populationMean));
        }
      }

      // Get current team ratings BEFORE updating (to use previous ratings for prediction)
      const team1Stats = teamStats.get(team1Key);
      const team2Stats = teamStats.get(team2Key);

      // Store opponent ratings before any updates
      const team1Rating = team1Stats.points;
      const team2Rating = team2Stats.points;

      // Calculate current rankings to determine rank before match
      const currentRankings = sortRankings(
        Array.from(teamStats.values()),
        (team) => `${team.player1}+${team.player2}`
      );
      const rankMap = new Map();
      currentRankings.forEach((t, index) => rankMap.set(`${t.player1}+${t.player2}`, index + 1));

      const team1RankBefore = rankMap.get(team1Key) || '-';
      const team2RankBefore = rankMap.get(team2Key) || '-';
      const team1RankBeforeConfidence = team1Stats.confidence || 0;
      const team2RankBeforeConfidence = team2Stats.confidence || 0;

      // Recalculate population statistics after adding new teams
      const finalPopulationStats = calculatePopulationStats(teamStats);
      const finalPopulationMean = finalPopulationStats.mean;
      const finalPopulationStdDev = finalPopulationStats.stdDev;

      // Determine winner
      const { team1Won, team2Won } = determineMatchOutcome(
        match.team1_score,
        match.team2_score
      );

      // Update stats using prediction-based scoring
      const team1Result = updateStatsForMatch(team1Stats, team1Won, team2Won, team2Rating, finalPopulationStdDev, 0, null, finalPopulationMean);
      const team2Result = updateStatsForMatch(team2Stats, team2Won, team1Won, team1Rating, finalPopulationStdDev, 0, null, finalPopulationMean);

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
            rankBefore: team1RankBefore,
            rankBeforeConfidence: team1RankBeforeConfidence,
            ratingChange: team1Result.ratingChange,
            won: team1Won,
            opponentRating: team2Rating,
            ...team1Result.calculationDetails
          },
          [team2Key]: {
            ratingBefore: team2Rating,
            rankBefore: team2RankBefore,
            rankBeforeConfidence: team2RankBeforeConfidence,
            ratingChange: team2Result.ratingChange,
            won: team2Won,
            opponentRating: team1Rating,
            ...team2Result.calculationDetails
          }
        }
      });
    }

    // Convert to array and sort
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

/**
 * Calculate team rankings (Reads files and calls logic)
 */
export async function calculateTeamRankings(seeds = null, mainCircuitOnly = false, seasons = null) {
  const allMatches = [];

  try {
    // Read all JSON files from output directory
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json' && !f.startsWith('seeded_'));

    // Collect all matches with tournament metadata
    for (const file of jsonFiles) {
      try {
        const filePath = join(outputDir, file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (!data.matches || !Array.isArray(data.matches)) {
          continue;
        }

        // Determine season (explicit or from date)
        let season = data.tournament?.season;
        if (season === undefined && data.tournament?.date) {
          const year = new Date(data.tournament.date).getFullYear();
          if (!isNaN(year)) {
            season = String(year);
          }
        }
        season = season?.toString();

        // Filter by season
        if (seasons && Array.isArray(seasons) && seasons.length > 0) {
          if (!season || !seasons.includes(season)) {
            continue;
          }
        }

        // Determine if main circuit (check flag or filename)
        const isMainCircuit = data.tournament?.is_main_circuit ||
          (file.toLowerCase().startsWith('utermal_2v2_circuit') ||
            file.toLowerCase().startsWith('uthermal_2v2_circuit'));

        // Filter by main circuit if requested
        if (mainCircuitOnly && !isMainCircuit) {
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

    // Sort matches chronologically
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

    return calculateTeamRankingsFromMatches(allMatches, seeds);

  } catch (err) {
    console.error('Error calculating team rankings:', err);
    throw err;
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
