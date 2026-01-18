/**
 * Seeding Runner for Initial Rankings
 * 
 * This script runs a three-pass seeding process to better initialize player/team ratings
 * for cold start scenarios with limited data:
 * 
 * Pass 1 (Forward): Process matches chronologically to get initial rating estimates
 * Pass 2 (Backward): Process matches in reverse to get alternative rating estimates
 * Pass 3 (Seeded Forward): Process matches chronologically again, but start players
 *                         with their ratings from Pass 1 as seeds
 * 
 * The final ratings from Pass 3 are kept, with Pass 1 and Pass 2 ratings discarded.
 * This helps reduce cold start bias and produces more accurate initial ratings.
 * 
 * This is a standalone script that doesn't affect the main ranking calculations.
 */

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  updateStatsForMatch,
  calculatePopulationStats,
  initializeStatsWithSeed
} from '../ranking/rankingCalculations.js';
import {
  determineMatchOutcome,
  hasValidScores,
  initializeStats,
  sortRankings
} from '../ranking/rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', '..', 'output');

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
 * Sort all matches chronologically
 */
function sortAllMatches(matches, reverse = false) {
  const sorted = [...matches].sort((a, b) => {
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
  
  return reverse ? sorted.reverse() : sorted;
}

/**
 * Calculate average rating of opponent players
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
 * Calculate player rankings from matches with optional seed ratings
 * 
 * @param {Array} sortedMatches - Matches to process (chronologically sorted)
 * @param {Map} seedRatings - Optional map of player name -> seed rating
 * @param {string} passName - Name of the pass for logging
 * @returns {Object} Object with final player ratings
 */
function calculateRankingsFromMatches(sortedMatches, seedRatings = null, passName = '') {
  const playerStats = new Map();
  
  console.log(`\n${passName}: Processing ${sortedMatches.length} matches`);
  
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
    const existingPopulationStats = calculatePopulationStats(playerStats);
    const populationMean = existingPopulationStats.mean;
    const populationStdDev = existingPopulationStats.stdDev;

    // Initialize players if they don't exist yet
    for (const playerName of [...team1Players, ...team2Players]) {
      if (!playerStats.has(playerName)) {
        // If we have seed ratings, use them; otherwise start at population mean
        if (seedRatings && seedRatings.has(playerName)) {
          const seedRating = seedRatings.get(playerName);
          playerStats.set(playerName, initializeStatsWithSeed(playerName, seedRating));
        } else {
          playerStats.set(playerName, initializeStats(playerName, {}, populationMean));
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

    // Update stats for team1 players
    for (const playerName of team1Players) {
      const stats = playerStats.get(playerName);
      updateStatsForMatch(stats, team1Won, team2Won, team1AvgOpponentRating, finalPopulationStdDev, 0, null, finalPopulationMean);
    }

    // Update stats for team2 players
    for (const playerName of team2Players) {
      const stats = playerStats.get(playerName);
      updateStatsForMatch(stats, team2Won, team1Won, team2AvgOpponentRating, finalPopulationStdDev, 0, null, finalPopulationMean);
    }
  }

  console.log(`${passName}: Completed. ${playerStats.size} players processed.`);
  
  return playerStats;
}

/**
 * Normalize team key - sort player names alphabetically
 */
function normalizeTeamKey(player1, player2) {
  const players = [player1, player2].filter(Boolean).sort();
  return players.join('+');
}

/**
 * Calculate team rankings from matches with optional seed ratings
 * 
 * @param {Array} sortedMatches - Matches to process (chronologically sorted)
 * @param {Map} seedRatings - Optional map of team key -> seed rating
 * @param {string} passName - Name of the pass for logging
 * @returns {Map} Map of team stats
 */
function calculateTeamRankingsFromMatches(sortedMatches, seedRatings = null, passName = '') {
  const teamStats = new Map();
  
  console.log(`\n${passName}: Processing ${sortedMatches.length} matches`);
  
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

    // Normalize team keys
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
      // If we have seed ratings, use them; otherwise start at population mean
      if (seedRatings && seedRatings.has(team1Key)) {
        const seedRating = seedRatings.get(team1Key);
        teamStats.set(team1Key, initializeStatsWithSeed(team1Key, seedRating, {
          player1: team1PlayersSorted[0],
          player2: team1PlayersSorted[1]
        }));
      } else {
        teamStats.set(team1Key, initializeStats(team1Key, {
          player1: team1PlayersSorted[0],
          player2: team1PlayersSorted[1]
        }, populationMean));
      }
    }

    if (!teamStats.has(team2Key)) {
      // If we have seed ratings, use them; otherwise start at population mean
      if (seedRatings && seedRatings.has(team2Key)) {
        const seedRating = seedRatings.get(team2Key);
        teamStats.set(team2Key, initializeStatsWithSeed(team2Key, seedRating, {
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

    // Get current team ratings
    const team1Stats = teamStats.get(team1Key);
    const team2Stats = teamStats.get(team2Key);
    
    const team1Rating = team1Stats.points;
    const team2Rating = team2Stats.points;

    // Recalculate population statistics
    const finalPopulationStats = calculatePopulationStats(teamStats);
    const finalPopulationMean = finalPopulationStats.mean;
    const finalPopulationStdDev = finalPopulationStats.stdDev;

    // Determine winner
    const { team1Won, team2Won } = determineMatchOutcome(
      match.team1_score,
      match.team2_score
    );

    // Update stats
    updateStatsForMatch(team1Stats, team1Won, team2Won, team2Rating, finalPopulationStdDev, 0, null, finalPopulationMean);
    updateStatsForMatch(team2Stats, team2Won, team1Won, team1Rating, finalPopulationStdDev, 0, null, finalPopulationMean);
  }

  console.log(`${passName}: Completed. ${teamStats.size} teams processed.`);
  
  return teamStats;
}

/**
 * Extract ratings from stats map
 */
function extractRatings(statsMap) {
  const ratings = new Map();
  for (const [key, stats] of statsMap.entries()) {
    ratings.set(key, stats.points);
  }
  return ratings;
}

/**
 * Average ratings from Pass 1 and Pass 2
 * Returns a new Map with averaged ratings for use as seeds in Pass 3
 */
function averageRatings(pass1Ratings, pass2Ratings) {
  const averaged = new Map();
  
  // Get all unique keys from both passes
  const allKeys = new Set([...pass1Ratings.keys(), ...pass2Ratings.keys()]);
  
  for (const key of allKeys) {
    const pass1Rating = pass1Ratings.get(key) || 0;
    const pass2Rating = pass2Ratings.get(key) || 0;
    const average = (pass1Rating + pass2Rating) / 2;
    averaged.set(key, average);
  }
  
  return averaged;
}

/**
 * Run three-pass seeding process for player rankings
 */
async function runSeededPlayerRankings(matches) {
  console.log('\n' + '='.repeat(80));
  console.log('PLAYER RANKINGS - THREE-PASS SEEDING');
  console.log('='.repeat(80));
  
  // Sort matches chronologically
  const sortedMatches = sortAllMatches(matches, false);
  const reverseSortedMatches = sortAllMatches(matches, true);
  
  // Pass 1: Forward chronological (all start at 0)
  // This pass helps identify initial skill levels, but early matches have outsized impact
  // because all players start equal. Results will be discarded after Pass 3.
  console.log('\n>>> PASS 1: Forward Chronological <<<');
  const pass1Stats = calculateRankingsFromMatches(sortedMatches, null, 'Pass 1');
  const pass1Ratings = extractRatings(pass1Stats);
  
  // Pass 2: Reverse chronological (all start at 0)
  // This pass adjusts for recency bias and order dependency from Pass 1.
  // By processing backwards, we get alternative skill estimates that account for
  // the fact that early matches in Pass 1 gave too many points to skilled players
  // beating weaker players (who all started equal). Results will be discarded after Pass 3.
  console.log('\n>>> PASS 2: Reverse Chronological <<<');
  const pass2Stats = calculateRankingsFromMatches(reverseSortedMatches, null, 'Pass 2');
  const pass2Ratings = extractRatings(pass2Stats);
  
  // Pass 3: Forward chronological with averaged seeds from Pass 1 and Pass 2
  // This is the final pass. Players start with the average of Pass 1 and Pass 2 ratings as seeds
  // (not cold start at 0), which means Season 1 matches are processed with better initial estimates.
  // Only Pass 3 ratings count - Pass 1 and Pass 2 ratings are discarded.
  console.log('\n>>> PASS 3: Forward Chronological with Averaged Seeding <<<');
  const averagedSeeds = averageRatings(pass1Ratings, pass2Ratings);
  const pass3Stats = calculateRankingsFromMatches(sortedMatches, averagedSeeds, 'Pass 3');
  
  // Sort and display results
  const finalRankings = sortRankings(Array.from(pass3Stats.values()));
  
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SEEDED PLAYER RANKINGS');
  console.log('='.repeat(80) + '\n');
  
  finalRankings.forEach((player, index) => {
    const pass1Rating = pass1Ratings.get(player.name) || 0;
    const pass2Rating = pass2Ratings.get(player.name) || 0;
    console.log(
      `${(index + 1).toString().padStart(3)}. ${player.name.padEnd(20)} ` +
      `Matches: ${player.matches.toString().padStart(3)} ` +
      `Final: ${player.points.toFixed(1).padStart(7)} ` +
      `(Pass1: ${pass1Rating.toFixed(1).padStart(7)}, ` +
      `Pass2: ${pass2Rating.toFixed(1).padStart(7)})`
    );
  });
  
  return { rankings: finalRankings, pass1Ratings, pass2Ratings };
}

/**
 * Run three-pass seeding process for team rankings
 */
async function runSeededTeamRankings(matches) {
  console.log('\n' + '='.repeat(80));
  console.log('TEAM RANKINGS - THREE-PASS SEEDING');
  console.log('='.repeat(80));
  
  // Sort matches chronologically
  const sortedMatches = sortAllMatches(matches, false);
  const reverseSortedMatches = sortAllMatches(matches, true);
  
  // Pass 1: Forward chronological (all start at 0)
  // This pass helps identify initial skill levels, but early matches have outsized impact
  // because all teams start equal. Results will be discarded after Pass 3.
  console.log('\n>>> PASS 1: Forward Chronological <<<');
  const pass1Stats = calculateTeamRankingsFromMatches(sortedMatches, null, 'Pass 1');
  const pass1Ratings = extractRatings(pass1Stats);
  
  // Pass 2: Reverse chronological (all start at 0)
  // This pass adjusts for recency bias and order dependency from Pass 1.
  // By processing backwards, we get alternative skill estimates that account for
  // the fact that early matches in Pass 1 gave too many points to skilled teams
  // beating weaker teams (who all started equal). Results will be discarded after Pass 3.
  console.log('\n>>> PASS 2: Reverse Chronological <<<');
  const pass2Stats = calculateTeamRankingsFromMatches(reverseSortedMatches, null, 'Pass 2');
  const pass2Ratings = extractRatings(pass2Stats);
  
  // Pass 3: Forward chronological with averaged seeds from Pass 1 and Pass 2
  // This is the final pass. Teams start with the average of Pass 1 and Pass 2 ratings as seeds
  // (not cold start at 0), which means Season 1 matches are processed with better initial estimates.
  // Only Pass 3 ratings count - Pass 1 and Pass 2 ratings are discarded.
  console.log('\n>>> PASS 3: Forward Chronological with Averaged Seeding <<<');
  const averagedSeeds = averageRatings(pass1Ratings, pass2Ratings);
  const pass3Stats = calculateTeamRankingsFromMatches(sortedMatches, averagedSeeds, 'Pass 3');
  
  // Sort and display results
  const finalRankings = sortRankings(
    Array.from(pass3Stats.values()),
    (team) => `${team.player1}+${team.player2}`
  );
  
  console.log('\n' + '='.repeat(80));
  console.log('FINAL SEEDED TEAM RANKINGS');
  console.log('='.repeat(80) + '\n');
  
  finalRankings.forEach((team, index) => {
    const teamKey = `${team.player1}+${team.player2}`;
    const pass1Rating = pass1Ratings.get(teamKey) || 0;
    const pass2Rating = pass2Ratings.get(teamKey) || 0;
    console.log(
      `${(index + 1).toString().padStart(3)}. ${team.player1.padEnd(18)} + ${team.player2.padEnd(18)} ` +
      `Matches: ${team.matches.toString().padStart(3)} ` +
      `Final: ${team.points.toFixed(1).padStart(7)} ` +
      `(Pass1: ${pass1Rating.toFixed(1).padStart(7)}, ` +
      `Pass2: ${pass2Rating.toFixed(1).padStart(7)})`
    );
  });
  
  return { rankings: finalRankings, pass1Ratings, pass2Ratings };
}

/**
 * Main function - run seeding process
 */
async function main() {
  try {
    console.log('Loading tournament data...');
    const tournaments = await loadTournamentFiles();
    console.log(`Loaded ${tournaments.length} tournament files`);
    
    const allMatches = collectMatchesFromTournaments(tournaments);
    console.log(`Collected ${allMatches.length} valid matches`);
    
    if (allMatches.length === 0) {
      console.error('No matches found to process');
      return;
    }
    
    // Run seeding for player rankings
    const playerResults = await runSeededPlayerRankings(allMatches);
    
    // Run seeding for team rankings
    const teamResults = await runSeededTeamRankings(allMatches);
    
    // Save results to JSON files for API consumption
    const seededPlayerRankingsFile = join(outputDir, 'seeded_player_rankings.json');
    const seededTeamRankingsFile = join(outputDir, 'seeded_team_rankings.json');
    
    // Format player rankings for API (match the structure expected by UI)
    const playerRankingsData = playerResults.rankings.map(player => ({
      name: player.name,
      matches: player.matches,
      wins: player.wins,
      losses: player.losses,
      points: player.points,
      confidence: player.confidence || 0
    }));
    
    // Format team rankings for API (match the structure expected by UI)
    const teamRankingsData = teamResults.rankings.map(team => ({
      player1: team.player1,
      player2: team.player2,
      matches: team.matches,
      wins: team.wins,
      losses: team.losses,
      points: team.points,
      confidence: team.confidence || 0
    }));
    
    // Save to files
    await writeFile(seededPlayerRankingsFile, JSON.stringify(playerRankingsData, null, 2), 'utf-8');
    await writeFile(seededTeamRankingsFile, JSON.stringify(teamRankingsData, null, 2), 'utf-8');
    
    console.log('\n' + '='.repeat(80));
    console.log('Seeding process complete!');
    console.log('='.repeat(80));
    console.log(`\nSaved seeded rankings to:`);
    console.log(`  - ${seededPlayerRankingsFile}`);
    console.log(`  - ${seededTeamRankingsFile}`);
    console.log('\nThese rankings are now available via API endpoints:');
    console.log('  - GET /api/seeded-player-rankings');
    console.log('  - GET /api/seeded-team-rankings');
    
  } catch (error) {
    console.error('Error running seeded rankings:', error);
    throw error;
  }
}

// Run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('runSeededRankings.js')) {
  main().catch(err => {
    console.error('Failed to run seeded rankings:', err);
    process.exit(1);
  });
}

// Export for use in other modules
export {
  runSeededPlayerRankings,
  runSeededTeamRankings
};
