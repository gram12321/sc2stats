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
  sortRankings,
  getRoundSortOrder
} from './rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');

const DEFAULT_TEAM_RATING_OPTIONS = {
  useIntermediateTeamRating: false,
  intermediateFadeMatches: 20,
  playerSeeds: null
};

/**
 * Normalize team key - sort player names alphabetically to ensure consistent team identification
 */
function normalizeTeamKey(player1, player2) {
  const players = [player1, player2].filter(Boolean).sort();
  return players.join('+');
}

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

function getIntermediateTeamRating(playerNames, playerStats) {
  const knownPlayerRatings = playerNames
    .map(name => playerStats.get(name))
    .filter(stats => stats && (stats.matches > 0 || stats.isSeeded))
    .map(stats => stats.points)
    .filter(points => Number.isFinite(points));

  if (knownPlayerRatings.length === 0) {
    return null;
  }

  return knownPlayerRatings.reduce((sum, value) => sum + value, 0) / knownPlayerRatings.length;
}

function getIntermediateBlendWeight(teamMatchCount, fadeMatches) {
  if (!Number.isFinite(fadeMatches) || fadeMatches <= 0) {
    return 0;
  }

  const raw = (fadeMatches - teamMatchCount) / fadeMatches;
  return Math.max(0, Math.min(1, raw));
}

/**
 * Calculate team rankings from matches with optional initial seeds
 */
export function calculateTeamRankingsFromMatches(sortedMatches, seeds = null, options = {}) {
  const {
    useIntermediateTeamRating,
    intermediateFadeMatches,
    playerSeeds
  } = { ...DEFAULT_TEAM_RATING_OPTIONS, ...options };

  const teamStats = new Map();
  const playerStats = new Map();
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

      // Initialize players if they don't exist yet (used for optional intermediate team rating)
      for (const playerName of [...team1PlayersSorted, ...team2PlayersSorted]) {
        if (!playerStats.has(playerName)) {
          if (playerSeeds && playerSeeds[playerName] !== undefined) {
            playerStats.set(playerName, initializeStatsWithSeed(playerName, playerSeeds[playerName]));
          } else {
            playerStats.set(playerName, initializeStats(playerName));
          }
        }
      }

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
          }));
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
          }));
        }
      }

      // Get current team ratings BEFORE updating (to use previous ratings for prediction)
      const team1Stats = teamStats.get(team1Key);
      const team2Stats = teamStats.get(team2Key);

      // Store opponent ratings before any updates
      const team1Rating = team1Stats.points;
      const team2Rating = team2Stats.points;
      const team1Confidence = team1Stats.confidence || 0;
      const team2Confidence = team2Stats.confidence || 0;

      const team1IntermediateRating = useIntermediateTeamRating
        ? getIntermediateTeamRating(team1PlayersSorted, playerStats)
        : null;
      const team2IntermediateRating = useIntermediateTeamRating
        ? getIntermediateTeamRating(team2PlayersSorted, playerStats)
        : null;

      const team1BlendWeight = (
        useIntermediateTeamRating && team1IntermediateRating !== null
      )
        ? getIntermediateBlendWeight(team1Stats.matches, intermediateFadeMatches)
        : 0;
      const team2BlendWeight = (
        useIntermediateTeamRating && team2IntermediateRating !== null
      )
        ? getIntermediateBlendWeight(team2Stats.matches, intermediateFadeMatches)
        : 0;

      const team1EffectiveRating = team1BlendWeight > 0
        ? (team1IntermediateRating * team1BlendWeight) + (team1Rating * (1 - team1BlendWeight))
        : team1Rating;
      const team2EffectiveRating = team2BlendWeight > 0
        ? (team2IntermediateRating * team2BlendWeight) + (team2Rating * (1 - team2BlendWeight))
        : team2Rating;

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

      const playerPopulationStats = calculatePopulationStats(playerStats);
      const playerPopulationMean = playerPopulationStats.mean;
      const playerPopulationStdDev = playerPopulationStats.stdDev;

      // Pre-match player-opponent aggregates used for player stat updates
      const team1AvgOpponentRating = getAverageOpponentRating(team2PlayersSorted, playerStats);
      const team2AvgOpponentRating = getAverageOpponentRating(team1PlayersSorted, playerStats);
      const team1AvgOpponentConfidence = getAverageOpponentConfidence(team2PlayersSorted, playerStats);
      const team2AvgOpponentConfidence = getAverageOpponentConfidence(team1PlayersSorted, playerStats);
      const team1AvgOpponentMatches = getAverageOpponentMatches(team2PlayersSorted, playerStats);
      const team2AvgOpponentMatches = getAverageOpponentMatches(team1PlayersSorted, playerStats);

      // Determine winner
      const { team1Won, team2Won, isDraw } = determineMatchOutcome(
        match.team1_score,
        match.team2_score
      );

      // Update stats using prediction-based scoring
      const team1Result = updateStatsForMatch(
        team1Stats,
        team1Won,
        team2Won,
        team2EffectiveRating,
        finalPopulationStdDev,
        team2Confidence,
        team1EffectiveRating,
        finalPopulationMean,
        team2Stats.matches,
        {
          teamScore: match.team1_score,
          opponentScore: match.team2_score,
          bestOf: match.best_of
        }
      );
      const team2Result = updateStatsForMatch(
        team2Stats,
        team2Won,
        team1Won,
        team1EffectiveRating,
        finalPopulationStdDev,
        team1Confidence,
        team2EffectiveRating,
        finalPopulationMean,
        team1Stats.matches,
        {
          teamScore: match.team2_score,
          opponentScore: match.team1_score,
          bestOf: match.best_of
        }
      );

      // Update player stats in parallel model, used only for intermediate team rating calculation
      for (const playerName of team1PlayersSorted) {
        const stats = playerStats.get(playerName);
        updateStatsForMatch(
          stats,
          team1Won,
          team2Won,
          team1AvgOpponentRating,
          playerPopulationStdDev,
          team1AvgOpponentConfidence,
          null,
          playerPopulationMean,
          team1AvgOpponentMatches,
          {
            teamScore: match.team1_score,
            opponentScore: match.team2_score,
            bestOf: match.best_of
          }
        );
      }

      for (const playerName of team2PlayersSorted) {
        const stats = playerStats.get(playerName);
        updateStatsForMatch(
          stats,
          team2Won,
          team1Won,
          team2AvgOpponentRating,
          playerPopulationStdDev,
          team2AvgOpponentConfidence,
          null,
          playerPopulationMean,
          team2AvgOpponentMatches,
          {
            teamScore: match.team2_score,
            opponentScore: match.team1_score,
            bestOf: match.best_of
          }
        );
      }

      // Calculate rankings after processing this match
      const updatedRankings = sortRankings(
        Array.from(teamStats.values()),
        (team) => `${team.player1}+${team.player2}`
      );
      const updatedRankMap = new Map();
      updatedRankings.forEach((t, index) => updatedRankMap.set(`${t.player1}+${t.player2}`, index + 1));
      const team1RankAfter = updatedRankMap.get(team1Key) || '-';
      const team2RankAfter = updatedRankMap.get(team2Key) || '-';
      const team1RankAfterConfidence = team1Stats.confidence || 0;
      const team2RankAfterConfidence = team2Stats.confidence || 0;

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
            rankAfter: team1RankAfter,
            rankAfterConfidence: team1RankAfterConfidence,
            ratingChange: team1Result.ratingChange,
            won: team1Won,
            isDraw: isDraw,
            opponentRating: team2Rating,
            opponentEffectiveRating: team2EffectiveRating,
            intermediateTeamRating: team1IntermediateRating,
            intermediateBlendWeight: team1BlendWeight,
            effectiveRatingUsed: team1EffectiveRating,
            ...team1Result.calculationDetails
          },
          [team2Key]: {
            ratingBefore: team2Rating,
            rankBefore: team2RankBefore,
            rankBeforeConfidence: team2RankBeforeConfidence,
            rankAfter: team2RankAfter,
            rankAfterConfidence: team2RankAfterConfidence,
            ratingChange: team2Result.ratingChange,
            won: team2Won,
            isDraw: isDraw,
            opponentRating: team1Rating,
            opponentEffectiveRating: team1EffectiveRating,
            intermediateTeamRating: team2IntermediateRating,
            intermediateBlendWeight: team2BlendWeight,
            effectiveRatingUsed: team2EffectiveRating,
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
export async function calculateTeamRankings(seeds = null, mainCircuitOnly = false, seasons = null, options = {}) {
  const allMatches = [];

  try {
    // Read all JSON files from output directory
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json' && f !== 'player_countries.json' && !f.startsWith('seeded_'));

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
      const roundA = getRoundSortOrder(a.round);
      const roundB = getRoundSortOrder(b.round);
      if (roundA !== roundB) {
        return roundA - roundB;
      }

      // Finally by match_id
      return (a.match_id || '').localeCompare(b.match_id || '');
    });

    return calculateTeamRankingsFromMatches(allMatches, seeds, options);

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
