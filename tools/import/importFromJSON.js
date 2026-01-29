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
 * 4. Run two-pass seeding for Season 1 data (baseline only)
 * 5. Store seed ratings and import them into the database
 * 6. Process ALL matches via the normal ranking engine
 * 7. Store all match history with rating snapshots
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
  saveSeasonSeeds
} from '../database/databaseSeeding.js';
import { processTournamentMatches } from '../database/databaseRankingEngine.js';
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
 * Generate and import Season 1 seed ratings (baseline only)
 */
async function seedSeason1() {
  console.log('\n' + '='.repeat(80));
  console.log('SEASON 1 (2025) - SEEDING BASELINE');
  console.log('='.repeat(80));

  const { playerSeeds, teamSeeds, playerStatsMap, teamStatsMap } = await generateSeason1Seeds();
  await saveSeasonSeeds(2025, playerSeeds, teamSeeds);

  await importPlayerSeeds(playerSeeds, playerStatsMap);
  const playerIdMap = await getPlayerIdMap();
  await importTeamSeeds(teamSeeds, playerIdMap, teamStatsMap);

  console.log('\n✓ Seed ratings imported successfully');
}

/**
 * Process all seasons using the normal ranking engine
 */
async function processAllSeasons(tournaments) {
  tournaments.sort((a, b) =>
    new Date(a.tournament.date).getTime() - new Date(b.tournament.date).getTime()
  );

  console.log(`\nProcessing ${tournaments.length} tournaments...`);
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

  console.log(`\n✓ All seasons complete: ${totalMatches} matches processed`);
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

  const skipSeason1Seeding = process.env.SKIP_SEASON1_SEED === 'true';

  // Seed Season 1 baseline if present
  const season1 = bySeason.get(2025);
  if (!skipSeason1Seeding && season1 && season1.length > 0) {
    await seedSeason1();
  } else if (skipSeason1Seeding) {
    console.log('\n⚠️  Skipping Season 1 seeding (SKIP_SEASON1_SEED=true)');
  } else {
    console.log('\n⚠️  No Season 1 (2025) tournaments found - skipping seeding');
  }

  // Process all matches via the normal engine
  await processAllSeasons(allTournaments);
  
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
