/**
 * Database Ranking Engine
 * Processes matches and updates persistent rankings in Supabase
 */

import { supabase } from '../../lib/supabase.js';
import {
  updateStatsForMatch,
  calculatePopulationStats
} from '../ranking/rankingCalculations.js';
import { determineMatchOutcome } from '../ranking/rankingUtils.js';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache for player defaults
let playerDefaultsCache = null;

/**
 * Load player race defaults from JSON file
 */
async function loadPlayerDefaults() {
  if (playerDefaultsCache) {
    return playerDefaultsCache;
  }
  
  try {
    const playerDefaultsPath = join(__dirname, '..', '..', 'output', 'player_defaults.json');
    const content = await readFile(playerDefaultsPath, 'utf-8');
    playerDefaultsCache = JSON.parse(content);
    return playerDefaultsCache;
  } catch (error) {
    console.warn('Could not load player_defaults.json:', error.message);
    return {};
  }
}

/**
 * Get races for a team (from match data or defaults)
 */
function getTeamRaces(team, playerDefaults) {
  const races = [];
  
  if (team?.player1) {
    const race1 = team.player1.race || playerDefaults[team.player1.name];
    if (race1 && race1 !== 'Random') races.push(race1);
  }
  
  if (team?.player2) {
    const race2 = team.player2.race || playerDefaults[team.player2.name];
    if (race2 && race2 !== 'Random') races.push(race2);
  }
  
  return races;
}

/**
 * Get race matchup key (normalized)
 */
function getRaceMatchupKey(race1, race2) {
  if (!race1 || !race2 || race1 === race2) return null;
  const short1 = race1.charAt(0);
  const short2 = race2.charAt(0);
  return `${short1}v${short2}`;
}

/**
 * Get team race matchup key (normalized, alphabetical)
 */
function getTeamRaceMatchupKey(team1Races, team2Races) {
  if (team1Races.length !== 2 || team2Races.length !== 2) return null;
  
  const team1Key = team1Races.map(r => r.charAt(0)).sort().join('');
  const team2Key = team2Races.map(r => r.charAt(0)).sort().join('');
  
  // Normalize: alphabetically sort the two team keys
  const [first, second] = [team1Key, team2Key].sort();
  return `${first} vs ${second}`;
}

/**
 * Get or create player in database
 */
export async function getOrCreatePlayer(name, initialRating = 0) {
  // Try to get existing player
  let { data, error } = await supabase
    .from('players')
    .select('*')
    .eq('name', name)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Player doesn't exist, create it
    const { data: newPlayer, error: insertError } = await supabase
      .from('players')
      .insert({
        name,
        current_rating: initialRating,
        current_confidence: 0,
        matches: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create player ${name}: ${insertError.message}`);
    }
    
    return newPlayer;
  }
  
  if (error) {
    throw new Error(`Failed to fetch player ${name}: ${error.message}`);
  }
  
  return data;
}

/**
 * Get or create team in database
 */
export async function getOrCreateTeam(player1Name, player2Name, initialRating = 0) {
  // Create team key (sorted alphabetically)
  const teamKey = [player1Name, player2Name].sort().join('+');
  
  // Try to get existing team
  let { data, error } = await supabase
    .from('teams')
    .select('*')
    .eq('team_key', teamKey)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Team doesn't exist, get/create players first
    const player1 = await getOrCreatePlayer(player1Name);
    const player2 = await getOrCreatePlayer(player2Name);
    
    // Create team
    const { data: newTeam, error: insertError } = await supabase
      .from('teams')
      .insert({
        player1_id: player1.id,
        player2_id: player2.id,
        team_key: teamKey,
        current_rating: initialRating,
        current_confidence: 0,
        matches: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create team ${teamKey}: ${insertError.message}`);
    }
    
    return newTeam;
  }
  
  if (error) {
    throw new Error(`Failed to fetch team ${teamKey}: ${error.message}`);
  }
  
  return data;
}

/**
 * Get or create race ranking in database
 */
async function getOrCreateRaceRanking(raceMatchup, initialRating = 0) {
  // Try to get existing race ranking
  let { data, error } = await supabase
    .from('race_rankings')
    .select('*')
    .eq('race_matchup', raceMatchup)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Race ranking doesn't exist, create it
    const { data: newRanking, error: insertError } = await supabase
      .from('race_rankings')
      .insert({
        race_matchup: raceMatchup,
        current_rating: initialRating,
        current_confidence: 0,
        matches: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create race ranking ${raceMatchup}: ${insertError.message}`);
    }
    
    return newRanking;
  }
  
  if (error) {
    throw new Error(`Failed to fetch race ranking ${raceMatchup}: ${error.message}`);
  }
  
  return data;
}

/**
 * Get or create team race ranking in database
 */
async function getOrCreateTeamRaceRanking(teamRaceMatchup, initialRating = 0) {
  // Try to get existing team race ranking
  let { data, error } = await supabase
    .from('team_race_rankings')
    .select('*')
    .eq('team_race_matchup', teamRaceMatchup)
    .single();
  
  if (error && error.code === 'PGRST116') {
    // Team race ranking doesn't exist, create it
    const { data: newRanking, error: insertError } = await supabase
      .from('team_race_rankings')
      .insert({
        team_race_matchup: teamRaceMatchup,
        current_rating: initialRating,
        current_confidence: 0,
        matches: 0,
        wins: 0,
        losses: 0
      })
      .select()
      .single();
    
    if (insertError) {
      throw new Error(`Failed to create team race ranking ${teamRaceMatchup}: ${insertError.message}`);
    }
    
    return newRanking;
  }
  
  if (error) {
    throw new Error(`Failed to fetch team race ranking ${teamRaceMatchup}: ${error.message}`);
  }
  
  return data;
}

/**
 * Calculate population statistics from current database state
 */
export async function getPopulationStats(entityType = 'player') {
  const table = entityType === 'player' ? 'players' : 
                entityType === 'race' ? 'race_rankings' :
                entityType === 'team_race' ? 'team_race_rankings' : 'teams';
  
  const { data, error } = await supabase
    .from(table)
    .select('current_rating');
  
  if (error) {
    throw new Error(`Failed to fetch ${entityType} ratings: ${error.message}`);
  }
  
  if (data.length === 0) {
    return { mean: 0, stdDev: 350 };
  }
  
  const ratings = data.map(item => item.current_rating);
  const mean = ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  
  const variance = ratings.reduce((sum, r) => {
    const diff = r - mean;
    return sum + (diff * diff);
  }, 0) / ratings.length;
  
  const stdDev = Math.max(Math.sqrt(variance), 50);
  
  return { mean, stdDev };
}

/**
 * Process race rankings for a match
 */
async function processRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults) {
  const team1Races = getTeamRaces(match.team1, playerDefaults);
  const team2Races = getTeamRaces(match.team2, playerDefaults);
  
  if (team1Races.length === 0 || team2Races.length === 0) {
    return; // Skip if we don't have race data
  }
  
  const racePopStats = await getPopulationStats('race');
  
  // Process each race matchup
  for (const race1 of team1Races) {
    for (const race2 of team2Races) {
      if (race1 === race2) continue; // Skip mirror matchups
      
      const matchupKey = getRaceMatchupKey(race1, race2);
      if (!matchupKey) continue;
      
      const inverseKey = getRaceMatchupKey(race2, race1);
      if (!inverseKey) continue;
      
      // Get or create both matchup rankings
      const ranking1 = await getOrCreateRaceRanking(matchupKey, racePopStats.mean);
      const ranking2 = await getOrCreateRaceRanking(inverseKey, racePopStats.mean);
      
      // Capture ratings before update
      const rating1Before = ranking1.current_rating;
      const rating2Before = ranking2.current_rating;
      
      // Create stats objects
      const stats1 = {
        matches: ranking1.matches,
        wins: ranking1.wins,
        losses: ranking1.losses,
        points: ranking1.current_rating,
        confidence: ranking1.current_confidence || 0
      };
      
      const stats2 = {
        matches: ranking2.matches,
        wins: ranking2.wins,
        losses: ranking2.losses,
        points: ranking2.current_rating,
        confidence: ranking2.current_confidence || 0
      };
      
      // Calculate rating changes
      const result1 = updateStatsForMatch(
        stats1,
        team1Won,
        team2Won,
        rating2Before,
        racePopStats.stdDev,
        ranking2.current_confidence || 0,
        null,
        racePopStats.mean
      );
      
      const result2 = updateStatsForMatch(
        stats2,
        team2Won,
        team1Won,
        rating1Before,
        racePopStats.stdDev,
        ranking1.current_confidence || 0,
        null,
        racePopStats.mean
      );
      
      // Update both rankings
      await supabase
        .from('race_rankings')
        .update({
          current_rating: stats1.points,
          current_confidence: stats1.confidence,
          matches: stats1.matches,
          wins: stats1.wins,
          losses: stats1.losses
        })
        .eq('id', ranking1.id);
      
      await supabase
        .from('race_rankings')
        .update({
          current_rating: stats2.points,
          current_confidence: stats2.confidence,
          matches: stats2.matches,
          wins: stats2.wins,
          losses: stats2.losses
        })
        .eq('id', ranking2.id);
      
      // Store history
      await supabase
        .from('rating_history')
        .insert([
          {
            entity_type: 'race',
            entity_id: ranking1.id,
            match_id: matchRecord.id,
            rating_before: rating1Before,
            rating_after: stats1.points,
            rating_change: result1.ratingChange,
            confidence: stats1.confidence,
            expected_win_probability: result1.calculationDetails?.expectedWin,
            k_factor: result1.calculationDetails?.adjustedK
          },
          {
            entity_type: 'race',
            entity_id: ranking2.id,
            match_id: matchRecord.id,
            rating_before: rating2Before,
            rating_after: stats2.points,
            rating_change: result2.ratingChange,
            confidence: stats2.confidence,
            expected_win_probability: result2.calculationDetails?.expectedWin,
            k_factor: result2.calculationDetails?.adjustedK
          }
        ]);
    }
  }
}

/**
 * Process team race rankings for a match
 */
async function processTeamRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults) {
  const team1Races = getTeamRaces(match.team1, playerDefaults);
  const team2Races = getTeamRaces(match.team2, playerDefaults);
  
  if (team1Races.length !== 2 || team2Races.length !== 2) {
    return; // Skip if we don't have complete team race data
  }
  
  const matchupKey = getTeamRaceMatchupKey(team1Races, team2Races);
  if (!matchupKey) return;
  
  const teamRacePopStats = await getPopulationStats('team_race');
  
  // Get or create team race ranking
  const ranking = await getOrCreateTeamRaceRanking(matchupKey, teamRacePopStats.mean);
  
  // Determine which side of the matchup won
  const parts = matchupKey.split(' vs ');
  const team1Key = team1Races.map(r => r.charAt(0)).sort().join('');
  const team2Key = team2Races.map(r => r.charAt(0)).sort().join('');
  
  // Check if team1 is the first part of the matchup key
  const team1IsFirst = team1Key === parts[0];
  
  // Adjust wins/losses based on matchup direction
  const matchupWon = team1IsFirst ? team1Won : team2Won;
  const matchupLost = team1IsFirst ? team2Won : team1Won;
  
  // Capture rating before update
  const ratingBefore = ranking.current_rating;
  
  // Create stats object
  const stats = {
    matches: ranking.matches,
    wins: ranking.wins,
    losses: ranking.losses,
    points: ranking.current_rating,
    confidence: ranking.current_confidence || 0
  };
  
  // Calculate rating change (using itself as opponent for simplicity in team race matchups)
  const result = updateStatsForMatch(
    stats,
    matchupWon,
    matchupLost,
    ratingBefore,
    teamRacePopStats.stdDev,
    ranking.current_confidence || 0,
    null,
    teamRacePopStats.mean
  );
  
  // Update ranking
  await supabase
    .from('team_race_rankings')
    .update({
      current_rating: stats.points,
      current_confidence: stats.confidence,
      matches: stats.matches,
      wins: stats.wins,
      losses: stats.losses
    })
    .eq('id', ranking.id);
  
  // Store history
  await supabase
    .from('rating_history')
    .insert({
      entity_type: 'team_race',
      entity_id: ranking.id,
      match_id: matchRecord.id,
      rating_before: ratingBefore,
      rating_after: stats.points,
      rating_change: result.ratingChange,
      confidence: stats.confidence,
      expected_win_probability: result.calculationDetails?.expectedWin,
      k_factor: result.calculationDetails?.adjustedK
    });
}

/**
 * Process a single match and update database
 */
export async function processMatch(match, tournamentId, options = {}) {
  // Extract team information
  const team1Player1 = match.team1?.player1?.name;
  const team1Player2 = match.team1?.player2?.name;
  const team2Player1 = match.team2?.player1?.name;
  const team2Player2 = match.team2?.player2?.name;
  
  if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
    console.warn(`Skipping match ${match.match_id}: missing player names`);
    return null;
  }
  
  // Get population statistics before processing
  const popStats = await getPopulationStats('team');
  
  // Get or create teams
  const team1 = await getOrCreateTeam(team1Player1, team1Player2, popStats.mean);
  const team2 = await getOrCreateTeam(team2Player1, team2Player2, popStats.mean);
  
  // Determine match outcome
  const { team1Won, team2Won } = determineMatchOutcome(
    match.team1_score,
    match.team2_score
  );
  
  // Capture ratings BEFORE update
  const team1RatingBefore = team1.current_rating;
  const team2RatingBefore = team2.current_rating;
  
  // Create stats objects for calculation
  const team1Stats = {
    matches: team1.matches,
    wins: team1.wins,
    losses: team1.losses,
    points: team1.current_rating,
    confidence: team1.current_confidence || 0
  };
  
  const team2Stats = {
    matches: team2.matches,
    wins: team2.wins,
    losses: team2.losses,
    points: team2.current_rating,
    confidence: team2.current_confidence || 0
  };
  
  // Calculate rating changes
  const team1Result = updateStatsForMatch(
    team1Stats,
    team1Won,
    team2Won,
    team2RatingBefore,
    popStats.stdDev,
    team2.current_confidence || 0,
    null,
    popStats.mean
  );
  
  const team2Result = updateStatsForMatch(
    team2Stats,
    team2Won,
    team1Won,
    team1RatingBefore,
    popStats.stdDev,
    team1.current_confidence || 0,
    null,
    popStats.mean
  );
  
  // Insert match record first
  const { data: matchRecord, error: matchError } = await supabase
    .from('matches')
    .insert({
      tournament_id: tournamentId,
      match_id: match.match_id,
      round: match.round,
      date: match.date || match.tournamentDate,
      team1_id: team1.id,
      team2_id: team2.id,
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      best_of: match.best_of,
      processed: true
    })
    .select()
    .single();
  
  if (matchError) {
    throw new Error(`Failed to insert match: ${matchError.message}`);
  }
  
  // Update team1 in database
  const { error: team1UpdateError } = await supabase
    .from('teams')
    .update({
      current_rating: team1Stats.points,
      current_confidence: team1Stats.confidence,
      matches: team1Stats.matches,
      wins: team1Stats.wins,
      losses: team1Stats.losses
    })
    .eq('id', team1.id);
  
  if (team1UpdateError) {
    throw new Error(`Failed to update team1: ${team1UpdateError.message}`);
  }
  
  // Update team2 in database
  const { error: team2UpdateError } = await supabase
    .from('teams')
    .update({
      current_rating: team2Stats.points,
      current_confidence: team2Stats.confidence,
      matches: team2Stats.matches,
      wins: team2Stats.wins,
      losses: team2Stats.losses
    })
    .eq('id', team2.id);
  
  if (team2UpdateError) {
    throw new Error(`Failed to update team2: ${team2UpdateError.message}`);
  }
  
  // Store rating history for both teams
  const historyRecords = [
    {
      entity_type: 'team',
      entity_id: team1.id,
      match_id: matchRecord.id,
      rating_before: team1RatingBefore,
      rating_after: team1Stats.points,
      rating_change: team1Result.ratingChange,
      confidence: team1Stats.confidence,
      expected_win_probability: team1Result.calculationDetails?.expectedWin,
      k_factor: team1Result.calculationDetails?.adjustedK
    },
    {
      entity_type: 'team',
      entity_id: team2.id,
      match_id: matchRecord.id,
      rating_before: team2RatingBefore,
      rating_after: team2Stats.points,
      rating_change: team2Result.ratingChange,
      confidence: team2Stats.confidence,
      expected_win_probability: team2Result.calculationDetails?.expectedWin,
      k_factor: team2Result.calculationDetails?.adjustedK
    }
  ];
  
  const { error: historyError } = await supabase
    .from('rating_history')
    .insert(historyRecords);
  
  if (historyError) {
    console.warn(`Failed to store rating history: ${historyError.message}`);
  }
  
  if (options.playerNames) {
    options.playerNames.add(team1Player1);
    options.playerNames.add(team1Player2);
    options.playerNames.add(team2Player1);
    options.playerNames.add(team2Player2);
  }

  if (!options.deferPlayerStats) {
    // Update player stats (aggregate from team stats)
    await updatePlayerStatsFromTeams([team1Player1, team1Player2, team2Player1, team2Player2]);
  }
  
  // Process race rankings
  try {
    const playerDefaults = await loadPlayerDefaults();
    await processRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults);
    await processTeamRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults);
  } catch (error) {
    console.warn(`Failed to process race rankings for match ${match.match_id}:`, error.message);
  }
  
  return matchRecord;
}

export async function processRaceAndTeamRaceOnly(match, matchRecord) {
  if (!matchRecord) return;
  if (!match?.team1 || !match?.team2) return;

  const { team1Won, team2Won } = determineMatchOutcome(
    match.team1_score,
    match.team2_score
  );
  const playerDefaults = await loadPlayerDefaults();
  await processRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults);
  await processTeamRaceRankings(match, matchRecord, team1Won, team2Won, playerDefaults);
}

/**
 * Update player stats by aggregating their team performances
 */
export async function updatePlayerStatsFromTeams(playerNames) {
  for (const playerName of playerNames) {
    const player = await getOrCreatePlayer(playerName);
    
    // Get all teams this player is part of
    const { data: teams, error } = await supabase
      .from('teams')
      .select('matches, wins, losses, current_rating, current_confidence')
      .or(`player1_id.eq.${player.id},player2_id.eq.${player.id}`);
    
    if (error) {
      console.warn(`Failed to fetch teams for player ${playerName}: ${error.message}`);
      continue;
    }
    
    // Aggregate stats
    const totalMatches = teams.reduce((sum, t) => sum + t.matches, 0);
    const totalWins = teams.reduce((sum, t) => sum + t.wins, 0);
    const totalLosses = teams.reduce((sum, t) => sum + t.losses, 0);
    const avgRating = teams.length > 0
      ? teams.reduce((sum, t) => sum + t.current_rating, 0) / teams.length
      : 0;
    const avgConfidence = teams.length > 0
      ? teams.reduce((sum, t) => sum + (t.current_confidence || 0), 0) / teams.length
      : 0;
    
    // Update player
    await supabase
      .from('players')
      .update({
        matches: totalMatches,
        wins: totalWins,
        losses: totalLosses,
        current_rating: avgRating,
        current_confidence: avgConfidence
      })
      .eq('id', player.id);
  }
}

/**
 * Process all matches from a tournament
 */
export async function processTournamentMatches(tournament, tournamentId) {
  console.log(`\nProcessing matches for: ${tournament.tournament.name}`);
  
  const matches = tournament.matches.filter(m => 
    m.team1_score !== null && 
    m.team2_score !== null &&
    m.team1?.player1?.name &&
    m.team1?.player2?.name &&
    m.team2?.player1?.name &&
    m.team2?.player2?.name
  );
  
  console.log(`  ${matches.length} valid matches to process`);
  
  let processed = 0;
  const playerNames = new Set();
  for (const match of matches) {
    try {
      await processMatch(match, tournamentId, { deferPlayerStats: true, playerNames });
      processed++;
    } catch (error) {
      console.error(`  Error processing match ${match.match_id}:`, error.message);
    }
  }

  if (playerNames.size > 0) {
    await updatePlayerStatsFromTeams(Array.from(playerNames));
  }
  
  console.log(`  Processed ${processed}/${matches.length} matches`);
  return processed;
}
