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
    // File doesn't exist or can't be read, return empty object
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
 * Create a race matchup key (directional: PvT is different from TvP)
 * @param {string} race1 - First race (the one "versus")
 * @param {string} race2 - Second race (the opponent)
 * @returns {string} Matchup key (e.g., "PvZ", "ZvP" - these are different!)
 */
function getRaceMatchupKey(race1, race2) {
  if (!race1 || !race2) return null;

  // Race abbreviations
  const raceAbbr = {
    'Protoss': 'P',
    'Terran': 'T',
    'Zerg': 'Z',
    'Random': 'R'
  };

  const abbr1 = raceAbbr[race1] || race1;
  const abbr2 = raceAbbr[race2] || race2;

  // Directional: PvT is different from TvP
  return `${abbr1}v${abbr2}`;
}

/**
 * Get the inverse matchup key (PvT -> TvP)
 * @param {string} matchupKey - Original matchup key (e.g., "PvT")
 * @returns {string} Inverse matchup key (e.g., "TvP")
 */
function getInverseMatchupKey(matchupKey) {
  if (!matchupKey || !matchupKey.includes('v')) return null;
  const [race1, race2] = matchupKey.split('v');
  return `${race2}v${race1}`;
}

/**
 * Get races from a team, using player defaults if needed
 * @param {Object} team - Team object with player1 and player2
 * @param {Object} playerDefaults - Object mapping player names to default races
 * @returns {Array<string|null>} Array of races (may include null)
 */
function getTeamRaces(team, playerDefaults = {}) {
  const race1 = getPlayerRace(team?.player1, playerDefaults);
  const race2 = getPlayerRace(team?.player2, playerDefaults);
  return [race1, race2].filter(r => r !== null);
}

/**
 * Calculate race rankings from all tournament JSON files
 * Uses prediction-based scoring: points change based on outperforming/underperforming expectations
 * Tracks race vs race matchups (e.g., PvZ, TvP, etc.)
 * 
 * For a match PT vs ZP where PT wins:
 * - PvZ +1 (Protoss vs Zerg, Protoss wins)
 * - PvP +0 (Protoss vs Protoss, cancel each other out)
 * - TvZ +1 (Terran vs Zerg, Terran wins)
 * - TvP +1 (Terran vs Protoss, Terran wins)
 * 
 * @param {boolean} mainCircuitOnly - Whether to only include main circuit tournaments
 * @param {Array<string>|null} seasons - Array of season strings to filter by
 * @param {boolean} hideRandom - Whether to exclude Random race matchups from calculations
 * @returns {Promise<Object>} Object with rankings and matchHistory
 */
export async function calculateRaceRankings(mainCircuitOnly = false, seasons = null, hideRandom = false) {
  const raceStats = new Map(); // Key: race matchup (e.g., "PvZ"), Value: stats object
  const allMatches = [];

  try {
    // Load player defaults first
    const playerDefaults = await loadPlayerDefaults();
    console.log(`Loaded ${Object.keys(playerDefaults).length} player defaults`);

    // Read all JSON files from output directory
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json');
    console.log(`Found ${jsonFiles.length} tournament JSON files`);

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

    console.log(`Processing ${allMatches.length} matches`);
    let matchesWithRaces = 0;
    let matchesWithoutRaces = 0;
    let matchesSkippedRandom = 0;

    for (const match of allMatches) {
      // Get races from each team, applying player defaults if needed
      // Match data races take precedence over defaults
      const team1Races = getTeamRaces(match.team1, playerDefaults);
      const team2Races = getTeamRaces(match.team2, playerDefaults);

      // Skip if we don't have races for both teams
      if (team1Races.length === 0 || team2Races.length === 0) {
        matchesWithoutRaces++;
        continue;
      }

      // Skip matches with Random races if hideRandom is enabled
      const allRaces = [...team1Races, ...team2Races];
      if (hideRandom && allRaces.includes('Random')) {
        matchesSkippedRandom++;
        continue;
      }

      matchesWithRaces++;

      // Debug: log if we see Random race
      if (allRaces.includes('Random')) {
        console.log(`Found Random race in match ${match.match_id}: team1=${team1Races}, team2=${team2Races}`);
      }

      // Determine winner
      const { team1Won, team2Won, isDraw } = determineMatchOutcome(
        match.team1_score,
        match.team2_score
      );

      // Check if this is a mirror matchup (same races, different order)
      // For example: TP vs PT, TZ vs ZT, PZ vs ZP
      // In mirror matchups, what one race gains, it loses in the inverse matchup
      // So the net effect on race ratings should be zero
      const isMirrorMatchup = (() => {
        if (team1Races.length !== team2Races.length) return false;
        // Sort both arrays and compare - if they have the same races, it's a mirror
        const sorted1 = [...team1Races].sort();
        const sorted2 = [...team2Races].sort();
        return sorted1.length === sorted2.length &&
          sorted1.every((race, idx) => race === sorted2[idx]);
      })();

      // Track race matchup impacts for this match
      const raceImpacts = new Map();

      // Capture ALL matchup ratings BEFORE any updates (critical for zero-sum)
      // This ensures that even if the same matchup pair is processed multiple times
      // (e.g., in mirror matchups), we use the original baseline ratings
      const matchupRatingsBefore = new Map();

      // First pass: initialize all matchups and capture their BEFORE ratings
      for (const race1 of team1Races) {
        for (const race2 of team2Races) {
          if (race1 === race2) continue;

          const matchupKey = getRaceMatchupKey(race1, race2);
          const inverseKey = getInverseMatchupKey(matchupKey);
          if (!matchupKey || !inverseKey) continue;

          // Calculate population statistics BEFORE initializing new matchups
          // This allows us to start new matchups at the population mean
          const existingPopulationStats = calculatePopulationStats(raceStats);
          const populationMean = existingPopulationStats.mean;

          // Initialize both matchup stats if needed, starting them at population mean
          if (!raceStats.has(matchupKey)) {
            raceStats.set(matchupKey, initializeStats(matchupKey, {
              race1: race1,
              race2: race2
            }, populationMean));
          }
          if (!raceStats.has(inverseKey)) {
            raceStats.set(inverseKey, initializeStats(inverseKey, {
              race1: race2,
              race2: race1
            }, populationMean));
          }

          // Capture BEFORE ratings (only once per unique matchup key)
          if (!matchupRatingsBefore.has(matchupKey)) {
            matchupRatingsBefore.set(matchupKey, raceStats.get(matchupKey).points);
          }
          if (!matchupRatingsBefore.has(inverseKey)) {
            matchupRatingsBefore.set(inverseKey, raceStats.get(inverseKey).points);
          }
        }
      }

      // Track which matchup pairs we've already processed (to avoid double-processing in mirrors)
      const processedPairs = new Set();

      // Skip race matchup processing for mirror matchups (zero net effect)
      if (isMirrorMatchup) {
        // Still create match history entry, but with no race impacts
        // This ensures the match appears in history but doesn't affect race ratings
      } else {
        // Compare each race from team1 against each race from team2
        for (const race1 of team1Races) {
          for (const race2 of team2Races) {
            // If races are the same, skip (cancel each other out = +0)
            if (race1 === race2) {
              continue;
            }

            // Create directional matchup keys (PvT and TvP are different!)
            const matchupKey = getRaceMatchupKey(race1, race2); // e.g., "PvT"
            const inverseKey = getInverseMatchupKey(matchupKey); // e.g., "TvP"
            if (!matchupKey || !inverseKey) continue;

            // Skip if we've already processed this pair (can happen in mirror matchups)
            // Use the lexicographically smaller key as the pair identifier
            const pairKey = matchupKey < inverseKey ? `${matchupKey}|${inverseKey}` : `${inverseKey}|${matchupKey}`;
            if (processedPairs.has(pairKey)) {
              continue;
            }
            processedPairs.add(pairKey);

            // Determine winner: if team1 won, race1 beats race2
            const matchupWon = team1Won;

            const matchupStats = raceStats.get(matchupKey);
            const inverseStats = raceStats.get(inverseKey);

            // Use the BEFORE ratings captured at the start (ensures zero-sum even for duplicates)
            const matchupRatingBefore = matchupRatingsBefore.get(matchupKey);
            const inverseRatingBefore = matchupRatingsBefore.get(inverseKey);

            // Calculate population statistics for race matchups (adapts to actual skill distribution)
            const populationStats = calculatePopulationStats(raceStats);
            const populationStdDev = populationStats.stdDev;
            const populationMean = populationStats.mean;

            // Compare against the inverse matchup, not average!
            // PvT rating vs TvP rating - this makes it zero-sum
            // When P beats T: PvT gains points based on TvP's rating, TvP loses based on PvT's rating
            // IMPORTANT: Use BEFORE ratings for both sides to ensure true zero-sum
            // Note: Since we use explicit currentRating, first-match logic doesn't apply here,
            // but we pass populationMean for consistency

            // Update PvT: compare its BEFORE rating against TvP's BEFORE rating
            const matchupResult = updateStatsForMatch(
              matchupStats,
              matchupWon,
              !matchupWon,
              inverseRatingBefore, // Use TvP's rating BEFORE update
              populationStdDev, // Population std dev for adaptive scaling
              0, // opponentConfidence
              matchupRatingBefore, // Use PvT's rating BEFORE update (explicit)
              populationMean, // Population mean (for first-match logic, though explicit rating takes precedence)
              isDraw
            );

            // Update TvP: compare its BEFORE rating against PvT's BEFORE rating
            // This ensures zero-sum: what PvT gains, TvP loses
            const inverseResult = updateStatsForMatch(
              inverseStats,
              !matchupWon,
              matchupWon,
              matchupRatingBefore, // Use PvT's rating BEFORE update
              populationStdDev, // Population std dev for adaptive scaling
              0, // opponentConfidence
              inverseRatingBefore, // Use TvP's rating BEFORE update (explicit)
              populationMean, // Population mean (for first-match logic, though explicit rating takes precedence)
              isDraw
            );

            // Track impact
            raceImpacts.set(matchupKey, {
              ratingBefore: matchupRatingBefore,
              ratingChange: matchupResult.ratingChange,
              won: matchupWon,
              isDraw: isDraw,
              opponentRating: inverseRatingBefore,
              race1: race1,
              race2: race2,
              ...matchupResult.calculationDetails
            });
          }
        }
      }

      // Get player races for display
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

      // Store match history entry
      matchHistory.push({
        match_id: match.match_id,
        tournament_slug: match.tournamentSlug,
        tournament_date: match.tournamentDate,
        match_date: match.date,
        round: match.round,
        team1_races: team1Races,
        team2_races: team2Races,
        team1_score: match.team1_score,
        team2_score: match.team2_score,
        race_impacts: Object.fromEntries(raceImpacts),
        // Include player names and races
        team1_player1: match.team1?.player1?.name || null,
        team1_player1_race: getRaceAbbr(getPlayerRace(match.team1?.player1, playerDefaults)),
        team1_player2: match.team1?.player2?.name || null,
        team1_player2_race: getRaceAbbr(getPlayerRace(match.team1?.player2, playerDefaults)),
        team2_player1: match.team2?.player1?.name || null,
        team2_player1_race: getRaceAbbr(getPlayerRace(match.team2?.player1, playerDefaults)),
        team2_player2: match.team2?.player2?.name || null,
        team2_player2_race: getRaceAbbr(getPlayerRace(match.team2?.player2, playerDefaults))
      });
    }

    // Convert to array and sort using shared sorting function
    const rankings = sortRankings(Array.from(raceStats.values()));

    // Calculate combined race statistics (TvX, ZvX, PvX)
    const combinedStats = new Map();
    const raceAbbr = {
      'Protoss': 'P',
      'Terran': 'T',
      'Zerg': 'Z',
      'Random': 'R'
    };

    // Aggregate all matchups for each race
    for (const matchup of rankings) {
      const race1 = matchup.race1;
      const raceAbbr1 = raceAbbr[race1];

      const combinedKey = `${raceAbbr1}vX`;

      if (!combinedStats.has(combinedKey)) {
        combinedStats.set(combinedKey, {
          name: combinedKey,
          race1: race1,
          race2: 'All',
          matches: 0,
          wins: 0,
          losses: 0,
          points: 0
        });
      }

      const combined = combinedStats.get(combinedKey);
      combined.matches += matchup.matches;
      combined.wins += matchup.wins;
      combined.losses += matchup.losses;
      combined.draws = (combined.draws || 0) + (matchup.draws || 0);
      combined.points += matchup.points;
    }

    // Convert combined stats to array and sort
    const combinedRankings = sortRankings(Array.from(combinedStats.values()));

    console.log(`Matches with races: ${matchesWithRaces}, without races: ${matchesWithoutRaces}`);
    if (hideRandom && matchesSkippedRandom > 0) {
      console.log(`Matches skipped (Random races): ${matchesSkippedRandom}`);
    }
    console.log(`Found ${rankings.length} race matchups`);
    console.log(`Found ${combinedRankings.length} combined race statistics`);

    return { rankings, combinedRankings, matchHistory };
  } catch (error) {
    console.error('Error calculating race rankings:', error);
    throw error;
  }
}

// If run directly, output rankings
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('calculateRaceRankings.js')) {
  calculateRaceRankings()
    .then(({ rankings, combinedRankings }) => {
      if (combinedRankings && combinedRankings.length > 0) {
        console.log('\nCombined Race Statistics:');
        console.log('=========================\n');
        combinedRankings.forEach((matchup, index) => {
          console.log(
            `${(index + 1).toString().padStart(3)}. ${matchup.name.padEnd(10)} ` +
            `(${matchup.race1} vs All) ` +
            `Matches: ${matchup.matches.toString().padStart(3)} ` +
            `Wins: ${matchup.wins.toString().padStart(3)} ` +
            `Losses: ${matchup.losses.toString().padStart(3)} ` +
            `Points: ${matchup.points >= 0 ? '+' : ''}${matchup.points.toString().padStart(3)}`
          );
        });
      }

      console.log('\nRace Matchup Rankings:');
      console.log('======================\n');
      rankings.forEach((matchup, index) => {
        console.log(
          `${(index + 1).toString().padStart(3)}. ${matchup.name.padEnd(10)} ` +
          `(${matchup.race1} vs ${matchup.race2}) ` +
          `Matches: ${matchup.matches.toString().padStart(3)} ` +
          `Wins: ${matchup.wins.toString().padStart(3)} ` +
          `Losses: ${matchup.losses.toString().padStart(3)} ` +
          `Points: ${matchup.points >= 0 ? '+' : ''}${matchup.points.toString().padStart(3)}`
        );
      });
    })
    .catch(err => {
      console.error('Failed to calculate race rankings:', err);
      process.exit(1);
    });
}
