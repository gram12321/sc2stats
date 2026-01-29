/**
 * Import Single Tournament
 *
 * Incrementally imports one tournament JSON into Supabase.
 *
 * Usage:
 *   node tools/import/importSingleTournament.js UThermal_2v2_Circuit_2026_1.json
 */

import 'dotenv/config';
import { readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { supabase, checkConnection } from '../../lib/supabase.js';
import { processTournamentMatches } from '../database/databaseRankingEngine.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', '..', 'output');

async function importSingleTournament(filename) {
  if (!filename) {
    throw new Error('Filename is required. Example: UThermal_2v2_Circuit_2026_1.json');
  }

  console.log('SC2 2v2 Stats - Import Single Tournament');
  console.log('='.repeat(80));

  console.log('\nChecking Supabase connection...');
  const connected = await checkConnection();
  if (!connected) {
    throw new Error('Failed to connect to Supabase. Please check your credentials.');
  }
  console.log('Connected to Supabase');

  const filePath = join(outputDir, filename);
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  if (!data.tournament || !data.matches) {
    throw new Error('Invalid tournament data. Missing tournament or matches.');
  }

  const { data: existing } = await supabase
    .from('tournaments')
    .select('id, name')
    .eq('liquipedia_slug', data.tournament.liquipedia_slug)
    .single();

  if (existing) {
    throw new Error(`Tournament already imported: ${existing.name}`);
  }

  const { data: tournamentRecord, error: insertError } = await supabase
    .from('tournaments')
    .insert({
      name: data.tournament.name,
      liquipedia_slug: data.tournament.liquipedia_slug,
      date: data.tournament.date,
      prize_pool: data.tournament.prize_pool,
      format: data.tournament.format,
      processed: false
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to insert tournament: ${insertError.message}`);
  }

  const processed = await processTournamentMatches(data, tournamentRecord.id);

  await supabase
    .from('tournaments')
    .update({ processed: true })
    .eq('id', tournamentRecord.id);

  console.log('\nImport complete');
  console.log(`Tournament: ${tournamentRecord.name}`);
  console.log(`Matches processed: ${processed}`);
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('importSingleTournament.js')) {
  const filename = process.argv[2];
  importSingleTournament(filename).catch(err => {
    console.error('\nImport failed:', err.message || err);
    process.exit(1);
  });
}
