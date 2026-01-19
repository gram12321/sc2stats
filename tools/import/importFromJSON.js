/**
 * Import From JSON Script
 * 
 * Imports tournament data from JSON files into Supabase database.
 * Used for initial database setup and importing new tournaments.
 * 
 * Workflow:
 * 1. Check if database is empty (warns if not)
 * 2. Load all tournament JSON files
 * 3. Detect Season 1 tournaments (2025)
 * 4. Run three-pass seeding for Season 1 data (Pass 3 = actual Season 1 run)
 * 5. Import final ratings from Pass 3 into database
 * 6. Import Season 1 match records (ratings already calculated in Pass 3)
 * 7. Process Season 2+ matches incrementally from Season 1 baseline
 * 8. Store all match history with rating snapshots
 */

import 'dotenv/config';
import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase, checkConnection } from '../../lib/supabase.js';
import {
  generateSeason1Seeds,
  importPlayerSeeds,
  importTeamSeeds,
  getPlayerIdMap,
  importTeamRatingHistory
} from '../database/databaseSeeding.js';
import { processTournamentMatches } from '../database/databaseRankingEngine.js';
import { importMatchOnly } from '../database/importMatchesOnly.js';
import { hasValidScores } from '../ranking/rankingUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', '..', 'output');

/**
 * Load all tournament files
 */
async function loadAllTournaments() {
  const files = await readdir(outputDir);
  const jsonFiles = files.filter(f => 
    f.endsWith('.json') && 
    f !== 'player_defaults.json' &&
    !f.startsWith('seeded_')
  );
  
  const tournaments = [];
  
  for (const file of jsonFiles) {
    try {
      const filePath = join(outputDir, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      
      if (data.tournament && data.matches && Array.isArray(data.matches)) {
        tournaments.push({
          ...data,
          filename: file
        });
      }
    } catch (err) {
      console.error(`Error loading ${file}:`, err);
    }
  }
  
  return tournaments;
}

/**
 * Get season (year) from tournament date
 */
function getSeason(date) {
  return new Date(date).getFullYear();
}

/**
 * Separate tournaments by season
 */
function separateBySeason(tournaments) {
  const bySeason = new Map();
  
  for (const tournament of tournaments) {
    const season = getSeason(tournament.tournament.date);
    
    if (!bySeason.has(season)) {
      bySeason.set(season, []);
    }
    
    bySeason.get(season).push(tournament);
  }
  
  return bySeason;
}

/**
 * Sort matches chronologically
 */
function sortMatchesChronologically(matches) {
  const roundOrder = {
    'Round of 16': 1,
    'Round of 8': 2,
    'Quarterfinals': 3,
    'Semifinals': 4,
    'Grand Final': 5,
    'Final': 5
  };
  
  return [...matches].sort((a, b) => {
    // By tournament date
    if (a.tournamentDate && b.tournamentDate) {
      const dateA = new Date(a.tournamentDate);
      const dateB = new Date(b.tournamentDate);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
    }
    
    // By match date
    if (a.date && b.date) {
      const dateA = new Date(a.date);
      const dateB = new Date(b.date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateA.getTime() - dateB.getTime();
      }
    }
    
    // By round order
    const roundA = roundOrder[a.round] || 999;
    const roundB = roundOrder[b.round] || 999;
    if (roundA !== roundB) {
      return roundA - roundB;
    }
    
    // By match ID
    return (a.match_id || '').localeCompare(b.match_id || '');
  });
}

/**
 * Import tournament into database
 */
async function importTournament(tournament) {
  const { data, error } = await supabase
    .from('tournaments')
    .upsert({
      name: tournament.tournament.name,
      liquipedia_slug: tournament.tournament.liquipedia_slug,
      date: tournament.tournament.date,
      prize_pool: tournament.tournament.prize_pool,
      format: tournament.tournament.format,
      processed: false
    }, { onConflict: 'liquipedia_slug' })
    .select()
    .single();
  
  if (error) {
    throw new Error(`Failed to import tournament: ${error.message}`);
  }
  
  return data;
}

/**
 * Process Season 1 with seeding
 */
async function processSeason1(tournaments) {
  console.log('\n' + '='.repeat(80));
  console.log('SEASON 1 (2025) - WITH SEEDING');
  console.log('='.repeat(80));
  
  // Generate and import seeds (includes final Pass 3 ratings with all stats and rating history)
  const { playerSeeds, teamSeeds, playerStatsMap, teamStatsMap, teamRatingHistory } = await generateSeason1Seeds();
  const playerData = await importPlayerSeeds(playerSeeds, playerStatsMap);
  
  // Get player ID map for team import
  const playerIdMap = await getPlayerIdMap();
  await importTeamSeeds(teamSeeds, playerIdMap, teamStatsMap);
  
  console.log('\n✓ Seeds imported successfully');
  
  // For Season 1, import matches for historical record only
  // Pass 3 of seeding already processed all matches and calculated ratings
  // We just need to import match records (rating_history created during Pass 3)
  
  tournaments.sort((a, b) => 
    new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime()
  );
  
  console.log(`\nImporting ${tournaments.length} Season 1 tournaments (matches for history only)...`);
  let totalMatches = 0;
  const matchIdMap = new Map(); // Map of match_id -> database ID
  
  for (const tournament of tournaments) {
    const tournamentRecord = await importTournament(tournament);
    const tournamentKey = tournament.tournament?.liquipedia_slug || tournament.tournament?.name || 'unknown';
    
    // Import matches for historical record only (no rating updates)
    // We need match IDs to create rating_history records
    for (const match of tournament.matches) {
      if (!match.team1_score && match.team1_score !== 0) continue;
      if (!match.team2_score && match.team2_score !== 0) continue;
      
      const matchRecord = await importMatchOnly(match, tournamentRecord.id);
      if (matchRecord) {
        const matchKey = `${match.tournament_slug || tournamentKey}::${match.match_id || 'unknown'}`;
        matchIdMap.set(matchKey, matchRecord.id);
        totalMatches++;
      }
    }
    
    // Mark tournament as processed
    await supabase
      .from('tournaments')
      .update({ processed: true })
      .eq('id', tournamentRecord.id);
  }
  
  console.log(`\n✓ Season 1 matches imported: ${totalMatches} matches`);
  
  // Build team ID map
  const { data: teams } = await supabase.from('teams').select('id, team_key');
  const teamIdMap = new Map();
  teams.forEach(team => teamIdMap.set(team.team_key, team.id));
  
  // Import rating history from Pass 3
  await importTeamRatingHistory(teamRatingHistory, teamIdMap, matchIdMap);
  
  console.log(`\n✓ Season 1 complete: ratings and history from Pass 3`);
}

/**
 * Process other seasons (incremental, no seeding)
 */
async function processOtherSeasons(seasonTournaments) {
  const seasons = Array.from(seasonTournaments.keys()).sort();
  
  for (const season of seasons) {
    if (season === 2025) continue; // Already processed
    
    const tournaments = seasonTournaments.get(season);
    
    console.log('\n' + '='.repeat(80));
    console.log(`SEASON ${season} - INCREMENTAL`);
    console.log('='.repeat(80));
    
    // Sort by date
    tournaments.sort((a, b) => 
      new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime()
    );
    
    console.log(`Processing ${tournaments.length} tournaments...`);
    let totalMatches = 0;
    
    for (const tournament of tournaments) {
      const tournamentRecord = await importTournament(tournament);
      const processed = await processTournamentMatches(tournament, tournamentRecord.id);
      totalMatches += processed;
      
      // Mark tournament as processed
      await supabase
        .from('tournaments')
        .update({ processed: true })
        .eq('id', tournamentRecord.id);
    }
    
    console.log(`\n✓ Season ${season} complete: ${totalMatches} matches processed`);
  }
}

/**
 * Check if database has existing data
 */
async function checkExistingData() {
  const { count, error } = await supabase
    .from('tournaments')
    .select('*', { count: 'exact', head: true });
  
  if (error) {
    throw new Error(`Failed to check existing data: ${error.message}`);
  }
  
  return count > 0;
}

/**
 * Main recalculation function
 */
export async function importFromJSON() {
  console.log('SC2 2v2 Stats - Recalculate Rankings');
  console.log('='.repeat(80));
  
  // Check database connection
  console.log('\nChecking Supabase connection...');
  const connected = await checkConnection();
  
  if (!connected) {
    throw new Error('Failed to connect to Supabase. Please check your credentials.');
  }
  
  console.log('✓ Connected to Supabase');
  
  // Check for existing data
  console.log('\nChecking for existing data...');
  const hasData = await checkExistingData();
  
  if (hasData) {
    console.log('\n⚠️  WARNING: Database already contains tournament data!');
    console.log('Use the admin recalculation endpoint to reset and re-import.');
    process.exit(1);
  }
  
  console.log('✓ Database is empty, ready for recalculation');
  
  // Load all tournaments
  console.log('\nLoading tournament files...');
  const allTournaments = await loadAllTournaments();
  console.log(`✓ Loaded ${allTournaments.length} tournament files`);
  
  if (allTournaments.length === 0) {
    console.error('\n❌ No tournaments found to process');
    process.exit(1);
  }
  
  // Separate by season
  const bySeason = separateBySeason(allTournaments);
  console.log(`\nFound tournaments from ${bySeason.size} season(s):`);
  for (const [season, tournaments] of bySeason.entries()) {
    console.log(`  - ${season}: ${tournaments.length} tournament(s)`);
  }
  
  // Process Season 1 with seeding
  const season1 = bySeason.get(2025);
  if (season1 && season1.length > 0) {
    await processSeason1(season1);
  } else {
    console.log('\n⚠️  No Season 1 (2025) tournaments found - skipping seeding');
  }
  
  // Process other seasons
  if (bySeason.size > 1 || (bySeason.size === 1 && !bySeason.has(2025))) {
    await processOtherSeasons(bySeason);
  }
  
  // Final summary
  console.log('\n' + '='.repeat(80));
  console.log('RECALCULATION COMPLETE');
  console.log('='.repeat(80));
  
  // Get final counts
  const { data: playerCount } = await supabase.from('players').select('count');
  const { data: teamCount } = await supabase.from('teams').select('count');
  const { data: matchCount } = await supabase.from('matches').select('count');
  
  console.log('\nDatabase Statistics:');
  console.log(`  - Players: ${playerCount?.[0]?.count || 0}`);
  console.log(`  - Teams: ${teamCount?.[0]?.count || 0}`);
  console.log(`  - Matches: ${matchCount?.[0]?.count || 0}`);
  console.log('\nRankings are now available via API endpoints:');
  console.log('  - GET /api/player-rankings');
  console.log('  - GET /api/team-rankings');
}

// Run if executed directly
// Allow running directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('importFromJSON.js')) {
  importFromJSON().catch(err => {
    console.error('\n❌ Import failed:', err);
    process.exit(1);
  });
}
