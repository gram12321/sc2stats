/**
 * Database Seeding Module
 * Bridges the seeding system with Supabase database
 */

import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runSeededPlayerRankings, runSeededTeamRankings } from '../import/runSeededRankings.js';
import { supabase } from '../../lib/supabase.js';
import { hasValidScores } from '../ranking/rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', '..', 'output');

/**
 * Load tournament files and filter by season
 */
export async function loadTournamentsByYear(year) {
  const files = await readdir(outputDir);
  const jsonFiles = files.filter(f => f.endsWith('.json') && 
    f !== 'player_defaults.json' && 
    !f.startsWith('seeded_'));
  
  const tournaments = [];
  
  for (const file of jsonFiles) {
    try {
      const filePath = join(outputDir, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.tournament && data.matches) {
        const tournamentYear = new Date(data.tournament.date).getFullYear();
        if (tournamentYear === year) {
          tournaments.push({ ...data, filename: file });
        }
      }
    } catch (err) {
      console.error(`Error processing ${file}:`, err);
    }
  }
  
  return tournaments;
}

/**
 * Collect matches from tournaments
 */
function collectMatches(tournaments) {
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
 * Generate seeds for Season 1 (2025)
 * Returns final ratings from Pass 3 of three-pass seeding
 * Pass 3 IS the actual Season 1 run, not just starting seeds
 */
export async function generateSeason1Seeds() {
  console.log('Loading Season 1 tournaments (2025)...');
  const tournaments = await loadTournamentsByYear(2025);
  
  if (tournaments.length === 0) {
    throw new Error('No Season 1 tournaments found');
  }
  
  console.log(`Found ${tournaments.length} Season 1 tournaments`);
  const matches = collectMatches(tournaments);
  console.log(`Collected ${matches.length} matches`);
  
  // Run three-pass seeding
  console.log('\nRunning three-pass seeding process...');
  const playerResults = await runSeededPlayerRankings(matches);
  const teamResults = await runSeededTeamRankings(matches);
  
  // Extract seed ratings from final pass (Pass 3 final ratings)
  const playerSeeds = new Map();
  const playerStatsMap = new Map(); // Store full stats for import
  playerResults.rankings.forEach(player => {
    playerSeeds.set(player.name, player.points);
    playerStatsMap.set(player.name, {
      matches: player.matches,
      wins: player.wins,
      losses: player.losses,
      confidence: player.confidence || 0
    });
  });
  
  const teamSeeds = new Map();
  const teamStatsMap = new Map(); // Store full stats for import
  teamResults.rankings.forEach(team => {
    const teamKey = [team.player1, team.player2].sort().join('+');
    teamSeeds.set(teamKey, team.points);
    teamStatsMap.set(teamKey, {
      matches: team.matches,
      wins: team.wins,
      losses: team.losses,
      confidence: team.confidence || 0
    });
  });
  
  console.log(`Generated seeds for ${playerSeeds.size} players and ${teamSeeds.size} teams`);
  
  // Extract rating history from Pass 3 (for tooltips)
  const teamRatingHistory = teamResults.ratingHistory || [];
  
  return { playerSeeds, teamSeeds, playerStatsMap, teamStatsMap, teamRatingHistory };
}

/**
 * Import player seeds into database
 * These are FINAL ratings from Pass 3, not starting seeds
 */
export async function importPlayerSeeds(playerSeeds, playerStatsMap = null) {
  console.log('\nImporting player seeds...');
  
  // If playerStatsMap is provided (from Pass 3 results), use those stats
  // Otherwise, just import ratings with default stats
  const players = Array.from(playerSeeds.entries()).map(([name, rating]) => {
    if (playerStatsMap && playerStatsMap.has(name)) {
      const stats = playerStatsMap.get(name);
      return {
        name,
        current_rating: rating, // Final rating from Pass 3
        current_confidence: stats.confidence || 0,
        matches: stats.matches || 0,
        wins: stats.wins || 0,
        losses: stats.losses || 0
      };
    }
    return {
      name,
      current_rating: rating,
      current_confidence: 0,
      matches: 0,
      wins: 0,
      losses: 0
    };
  });
  
  // Batch insert (Supabase handles upsert automatically with unique constraint)
  const { data, error } = await supabase
    .from('players')
    .upsert(players, { onConflict: 'name' })
    .select();
  
  if (error) {
    throw new Error(`Failed to import player seeds: ${error.message}`);
  }
  
  console.log(`Imported ${data.length} players`);
  return data;
}

/**
 * Import team seeds into database
 * These are FINAL ratings from Pass 3, not starting seeds
 */
export async function importTeamSeeds(teamSeeds, playerIdMap, teamStatsMap = null) {
  console.log('\nImporting team seeds...');
  
  const teams = [];
  
  for (const [teamKey, rating] of teamSeeds.entries()) {
    const [player1Name, player2Name] = teamKey.split('+');
    const player1Id = playerIdMap.get(player1Name);
    const player2Id = playerIdMap.get(player2Name);
    
    if (!player1Id || !player2Id) {
      console.warn(`Skipping team ${teamKey}: players not found in database`);
      continue;
    }
    
    // If teamStatsMap is provided (from Pass 3 results), use those stats
    const stats = teamStatsMap?.get(teamKey);
    teams.push({
      player1_id: player1Id,
      player2_id: player2Id,
      team_key: teamKey,
      current_rating: rating, // Final rating from Pass 3
      current_confidence: stats?.confidence || 0,
      matches: stats?.matches || 0,
      wins: stats?.wins || 0,
      losses: stats?.losses || 0
    });
  }
  
  // Batch insert
  const { data, error } = await supabase
    .from('teams')
    .upsert(teams, { onConflict: 'team_key' })
    .select();
  
  if (error) {
    throw new Error(`Failed to import team seeds: ${error.message}`);
  }
  
  console.log(`Imported ${data.length} teams`);
  return data;
}

/**
 * Get player ID map from database
 */
export async function getPlayerIdMap() {
  const { data, error } = await supabase
    .from('players')
    .select('id, name');
  
  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }
  
  const idMap = new Map();
  data.forEach(player => {
    idMap.set(player.name, player.id);
  });
  
  return idMap;
}

/**
 * Import rating history from Pass 3 seeding
 * Creates rating_history records for tooltips
 */
export async function importTeamRatingHistory(teamRatingHistory, teamIdMap, matchIdMap) {
  console.log('\nImporting team rating history...');
  
  if (!teamRatingHistory || teamRatingHistory.length === 0) {
    console.log('No rating history to import');
    return;
  }
  
  const historyRecords = [];
  
  for (const entry of teamRatingHistory) {
    const team1Id = teamIdMap.get(entry.team1Key);
    const team2Id = teamIdMap.get(entry.team2Key);
    const matchId = matchIdMap.get(entry.matchKey || entry.matchId);
    
    if (!team1Id || !team2Id || !matchId) {
      console.warn(`Skipping history for match ${entry.matchKey || entry.matchId}: missing IDs`);
      continue;
    }
    
    // Add team1 history
    historyRecords.push({
      entity_type: 'team',
      entity_id: team1Id,
      match_id: matchId,
      rating_before: entry.team1Data.ratingBefore,
      rating_after: entry.team1Data.ratingAfter,
      rating_change: entry.team1Data.ratingChange,
      confidence: entry.team1Data.confidence,
      expected_win_probability: entry.team1Data.expectedWin,
      k_factor: entry.team1Data.kFactor
    });
    
    // Add team2 history
    historyRecords.push({
      entity_type: 'team',
      entity_id: team2Id,
      match_id: matchId,
      rating_before: entry.team2Data.ratingBefore,
      rating_after: entry.team2Data.ratingAfter,
      rating_change: entry.team2Data.ratingChange,
      confidence: entry.team2Data.confidence,
      expected_win_probability: entry.team2Data.expectedWin,
      k_factor: entry.team2Data.kFactor
    });
  }
  
  // Batch insert history records
  const { data, error } = await supabase
    .from('rating_history')
    .insert(historyRecords)
    .select();
  
  if (error) {
    throw new Error(`Failed to import rating history: ${error.message}`);
  }
  
  console.log(`Imported ${data.length} rating history records`);
  return data;
}
