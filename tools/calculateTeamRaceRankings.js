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
/**
 * Normalize team key - sort player names alphabetically
 */
function normalizeTeamKey(player1, player2) {
  const players = [player1, player2].filter(Boolean).sort();
  return players.join('+');
}

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
 * Normalize team race combination (PT = TP, sort alphabetically)
 * @param {string} race1 - First race
 * @param {string} race2 - Second race
 * @returns {string} Normalized team race combination (e.g., "PT", "ZZ")
 */
function normalizeTeamRaceCombo(race1, race2) {
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

  // Sort alphabetically to normalize (PT = TP)
  const sorted = [abbr1, abbr2].sort();
  return sorted.join('');
}

/**
 * Create symmetric team race matchup key (PT vs ZZ = ZZ vs PT)
 * @param {string} team1Combo - Normalized team race combination for team 1 (e.g., "PT")
 * @param {string} team2Combo - Normalized team race combination for team 2 (e.g., "ZZ")
 * @returns {string} Symmetric matchup key (e.g., "PT vs ZZ")
 */
function getTeamRaceMatchupKey(team1Combo, team2Combo) {
  if (!team1Combo || !team2Combo) return null;

  // Sort alphabetically to make symmetric (PT vs ZZ = ZZ vs PT)
  const sorted = [team1Combo, team2Combo].sort();
  return `${sorted[0]} vs ${sorted[1]}`;
}

/**
 * Get full race names from abbreviation combo
 * @param {string} combo - Race combination abbreviation (e.g., "PT")
 * @returns {Object} Object with race1 and race2 full names
 */
function getFullRaceNames(combo) {
  const raceMap = {
    'P': 'Protoss',
    'T': 'Terran',
    'Z': 'Zerg',
    'R': 'Random'
  };

  const race1 = raceMap[combo[0]] || combo[0];
  const race2 = combo.length > 1 ? (raceMap[combo[1]] || combo[1]) : null;

  return { race1, race2 };
}

/**
 * Calculate team race rankings from all tournament JSON files
 * Tracks team race combinations (PT, ZZ, etc.) and their matchups
 * Uses symmetric matchups: PT vs ZZ = ZZ vs PT
 * 
 * @param {boolean} mainCircuitOnly - Whether to only include main circuit tournaments
 * @param {Array<string>|null} seasons - Array of season strings to filter by
 * @param {boolean} hideRandom - Whether to exclude Random race matchups from calculations
 * @returns {Promise<Object>} Object with rankings and matchHistory
 */
export async function calculateTeamRaceRankings(mainCircuitOnly = false, seasons = null, hideRandom = false) {
  const teamRaceStats = new Map(); // Key: matchup (e.g., "PT vs ZZ"), Value: stats object
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
      // Get races from each team
      const team1Races = getTeamRaces(match.team1, playerDefaults);
      const team2Races = getTeamRaces(match.team2, playerDefaults);

      // Skip if we don't have exactly 2 races for both teams
      if (team1Races.length !== 2 || team2Races.length !== 2) {
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

      // Normalize team race combinations (PT = TP)
      const team1Combo = normalizeTeamRaceCombo(team1Races[0], team1Races[1]);
      const team2Combo = normalizeTeamRaceCombo(team2Races[0], team2Races[1]);

      if (!team1Combo || !team2Combo) {
        matchesWithoutRaces++;
        continue;
      }

      // Skip same-combo matchups (PT vs PT) - they're always zero-sum and not meaningful
      if (team1Combo === team2Combo) {
        continue;
      }

      // Create symmetric matchup key (PT vs ZZ = ZZ vs PT)
      const matchupKey = getTeamRaceMatchupKey(team1Combo, team2Combo);
      if (!matchupKey) continue;

      // Determine winner
      const { team1Won, team2Won, isDraw } = determineMatchOutcome(
        match.team1_score,
        match.team2_score
      );

      // Initialize matchup stats if needed
      if (!teamRaceStats.has(matchupKey)) {
        const [combo1, combo2] = matchupKey.split(' vs ');
        const team1RacesFull = getFullRaceNames(combo1);
        const team2RacesFull = getFullRaceNames(combo2);

        // Initialize with separate stats for each combo
        teamRaceStats.set(matchupKey, {
          name: matchupKey,
          combo1: combo1,
          combo2: combo2,
          combo1Race1: team1RacesFull.race1,
          combo1Race2: team1RacesFull.race2,
          combo2Race1: team2RacesFull.race1,
          combo2Race2: team2RacesFull.race2,
          // Stats for combo1 perspective
          combo1Matches: 0,
          combo1Wins: 0,
          combo1Losses: 0,
          combo1Points: 0,
          // Stats for combo2 perspective
          combo2Matches: 0,
          combo2Wins: 0,
          combo2Losses: 0,
          combo2Points: 0,
          // Overall matchup stats (combined)
          matches: 0,
          wins: 0, // wins for combo1
          losses: 0, // losses for combo1 (wins for combo2)
          draws: 0,
          points: 0 // net points for combo1
        });
      }

      const matchupStats = teamRaceStats.get(matchupKey);
      const [combo1, combo2] = matchupKey.split(' vs ');

      // Determine which combo won
      // combo1 is the one that comes first alphabetically in the matchup key
      const combo1Won = (team1Combo === combo1 && team1Won) || (team2Combo === combo1 && team2Won);

      // Update overall matchup stats
      matchupStats.matches++;
      if (isDraw) {
        matchupStats.draws++;
      } else if (combo1Won) {
        matchupStats.wins++;
      } else {
        matchupStats.losses++;
      }

      // Update combo-specific stats
      matchupStats.combo1Matches++;
      matchupStats.combo2Matches++;

      if (combo1Won) {
        matchupStats.combo1Wins++;
        matchupStats.combo2Losses++;
      } else {
        matchupStats.combo1Losses++;
        matchupStats.combo2Wins++;
      }

      // Use Elo-like scoring: compare combo1's rating against combo2's rating
      // This creates a zero-sum relationship within the matchup
      const combo1RatingBefore = matchupStats.combo1Points;
      const combo2RatingBefore = matchupStats.combo2Points;

      // Calculate population statistics for team race matchups (adapts to actual skill distribution)
      const populationStats = calculatePopulationStats(teamRaceStats);
      const populationStdDev = populationStats.stdDev;
      const populationMean = populationStats.mean;

      // Create temporary stats objects for updateStatsForMatch
      const combo1TempStats = {
        matches: matchupStats.combo1Matches,
        wins: matchupStats.combo1Wins,
        losses: matchupStats.combo1Losses,
        points: matchupStats.combo1Points
      };

      const combo2TempStats = {
        matches: matchupStats.combo2Matches,
        wins: matchupStats.combo2Wins,
        losses: matchupStats.combo2Losses,
        points: matchupStats.combo2Points
      };

      // Update combo1 stats comparing against combo2
      const combo1Result = updateStatsForMatch(
        combo1TempStats,
        combo1Won,
        !combo1Won,
        combo2RatingBefore,
        populationStdDev,
        0,
        null,
        populationMean,
        isDraw
      );

      // Update combo2 stats comparing against combo1 (before combo1 update)
      const combo2Result = updateStatsForMatch(
        combo2TempStats,
        !combo1Won,
        combo1Won,
        combo1RatingBefore,
        populationStdDev,
        0,
        null,
        populationMean,
        isDraw
      );

      // Apply changes back to matchup stats
      matchupStats.combo1Points = combo1TempStats.points;
      matchupStats.combo2Points = combo2TempStats.points;

      // Net points for combo1 (used for overall ranking)
      matchupStats.points = matchupStats.combo1Points - matchupStats.combo2Points;

      // Determine team/combo correspondence for detailed stats
      const team1Key = normalizeTeamKey(match.team1?.player1?.name, match.team1?.player2?.name);
      const team2Key = normalizeTeamKey(match.team2?.player1?.name, match.team2?.player2?.name);

      const team1Stats = (team1Combo === combo1)
        ? { ratingBefore: combo1RatingBefore, result: combo1Result, won: combo1Won, isDraw: isDraw, opponentRating: combo2RatingBefore }
        : { ratingBefore: combo2RatingBefore, result: combo2Result, won: !combo1Won, isDraw: isDraw, opponentRating: combo1RatingBefore };

      const team2Stats = (team2Combo === combo1)
        ? { ratingBefore: combo1RatingBefore, result: combo1Result, won: combo1Won, isDraw: isDraw, opponentRating: combo2RatingBefore }
        : { ratingBefore: combo2RatingBefore, result: combo2Result, won: !combo1Won, isDraw: isDraw, opponentRating: combo1RatingBefore };

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
        ...match, // Spread existing match properties
        tournament_date: match.tournamentDate,
        tournament_slug: match.tournamentSlug,
        team1_combo: team1Combo,
        team2_combo: team2Combo,
        combo1_won: combo1Won,
        rating_change: team1Stats.result.ratingChange,
        // Detailed impacts for tooltips (explains why rating change is what it is)
        combo_impacts: {
          [team1Combo]: {
            ratingBefore: team1Stats.ratingBefore,
            ratingChange: team1Stats.result.ratingChange,
            won: team1Stats.won,
            isDraw: team1Stats.isDraw,
            opponentRating: team1Stats.opponentRating,
            ...team1Stats.result.calculationDetails
          },
          [team2Combo]: {
            ratingBefore: team2Stats.ratingBefore,
            ratingChange: team2Stats.result.ratingChange,
            won: team2Stats.won,
            isDraw: team2Stats.isDraw,
            opponentRating: team2Stats.opponentRating,
            ...team2Stats.result.calculationDetails
          }
        },
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

    // Convert to array and format for sorting
    // Always show the winning combo first with positive points
    const rankings = sortRankings(
      Array.from(teamRaceStats.values()).map(stats => {
        // If points are negative, swap combos and flip the sign
        // This ensures we always show the winning combo first with positive points
        if (stats.points < 0) {
          return {
            name: `${stats.combo2} vs ${stats.combo1}`, // Swap the display name
            combo1: stats.combo2, // Swap combo1 and combo2
            combo2: stats.combo1,
            combo1Race1: stats.combo2Race1,
            combo1Race2: stats.combo2Race2,
            combo2Race1: stats.combo1Race1,
            combo2Race2: stats.combo1Race2,
            matches: stats.matches,
            wins: stats.losses, // Swap wins and losses
            losses: stats.wins,
            draws: stats.draws,
            points: -stats.points // Flip the sign to make it positive
          };
        } else {
          return {
            name: stats.name,
            combo1: stats.combo1,
            combo2: stats.combo2,
            combo1Race1: stats.combo1Race1,
            combo1Race2: stats.combo1Race2,
            combo2Race1: stats.combo2Race1,
            combo2Race2: stats.combo2Race2,
            matches: stats.matches,
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            points: stats.points
          };
        }
      })
    );

    // Calculate combined team race statistics (PTvX, PPvX, etc.)
    const combinedStats = new Map();

    // Helper function to add/update combined stats for a combo
    const addToCombinedStats = (combo, matches, wins, losses, draws, points) => {
      const combinedKey = `${combo}vX`;

      if (!combinedStats.has(combinedKey)) {
        const comboRacesFull = getFullRaceNames(combo);
        combinedStats.set(combinedKey, {
          name: combinedKey,
          combo1: combo,
          combo2: 'All',
          combo1Race1: comboRacesFull.race1,
          combo1Race2: comboRacesFull.race2,
          combo2Race1: 'All',
          combo2Race2: 'All',
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          points: 0
        });
      }

      const combined = combinedStats.get(combinedKey);
      combined.matches += matches;
      combined.wins += wins;
      combined.losses += losses;
      combined.draws += draws;
      combined.points += points;
    };

    // Aggregate all matchups for each team race combination
    // We need to process BOTH combo1 and combo2 from each matchup
    for (const matchup of rankings) {
      const combo1 = matchup.combo1; // combo1 is the one shown first (winning combo)
      const combo2 = matchup.combo2; // combo2 is the losing combo in this matchup

      // Add stats for combo1 (wins from this matchup)
      addToCombinedStats(
        combo1,
        matchup.matches,
        matchup.wins,
        matchup.losses,
        matchup.draws,
        matchup.points
      );

      // Add stats for combo2 (losses from this matchup, but wins from combo2's perspective)
      // When combo1 wins, combo2 loses, so we swap wins/losses
      addToCombinedStats(
        combo2,
        matchup.matches,
        matchup.losses, // combo2's wins = combo1's losses
        matchup.wins,   // combo2's losses = combo1's wins
        matchup.draws,
        -matchup.points // combo2's points are negative of combo1's points
      );
    }

    // Convert combined stats to array and sort
    const combinedRankings = sortRankings(Array.from(combinedStats.values()));

    console.log(`Matches with races: ${matchesWithRaces}, without races: ${matchesWithoutRaces}`);
    if (hideRandom && matchesSkippedRandom > 0) {
      console.log(`Matches skipped (Random races): ${matchesSkippedRandom}`);
    }
    console.log(`Found ${rankings.length} team race matchup combinations`);
    console.log(`Found ${combinedRankings.length} combined team race statistics`);

    return { rankings, combinedRankings, matchHistory };
  } catch (error) {
    console.error('Error calculating team race rankings:', error);
    throw error;
  }
}

// If run directly, output rankings
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('calculateTeamRaceRankings.js')) {
  calculateTeamRaceRankings()
    .then(({ rankings, combinedRankings }) => {
      if (combinedRankings && combinedRankings.length > 0) {
        console.log('\nCombined Team Race Statistics:');
        console.log('================================\n');
        combinedRankings.forEach((matchup, index) => {
          console.log(
            `${(index + 1).toString().padStart(3)}. ${matchup.name.padEnd(15)} ` +
            `Matches: ${matchup.matches.toString().padStart(3)} ` +
            `Wins: ${matchup.wins.toString().padStart(3)} ` +
            `Losses: ${matchup.losses.toString().padStart(3)} ` +
            `Points: ${matchup.points >= 0 ? '+' : ''}${matchup.points.toString().padStart(3)}`
          );
        });
      }

      console.log('\nTeam Race Matchup Rankings:');
      console.log('============================\n');
      rankings.forEach((matchup, index) => {
        console.log(
          `${(index + 1).toString().padStart(3)}. ${matchup.name.padEnd(15)} ` +
          `Matches: ${matchup.matches.toString().padStart(3)} ` +
          `Wins: ${matchup.wins.toString().padStart(3)} ` +
          `Losses: ${matchup.losses.toString().padStart(3)} ` +
          `Points: ${matchup.points >= 0 ? '+' : ''}${matchup.points.toString().padStart(3)}`
        );
      });
    })
    .catch(err => {
      console.error('Failed to calculate team race rankings:', err);
      process.exit(1);
    });
}
