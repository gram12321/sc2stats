/**
 * Recalculate All Rankings
 * 
 * Clears all ranking data and rebuilds from scratch.
 * Used when ranking algorithm changes or historical data is corrected.
 * 
 * This is TRUE recalculation - it clears the database and re-imports from JSON.
 * Different from import, which just adds new data to existing database.
 */

import 'dotenv/config';
import { supabase } from '../../lib/supabase.js';
import { importFromJSON } from '../import/importFromJSON.js';

export async function recalculateAllRankings() {
  console.log('='.repeat(60));
  console.log('RECALCULATING ALL RANKINGS');
  console.log('='.repeat(60));
  console.log('This will clear all ranking data and rebuild from scratch.\n');
  
  console.log('Step 1: Clearing all ranking data...');
  
  try {
    // Clear all rankings (using a condition that's always true to delete all)
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('race_rankings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('team_race_rankings').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('rating_history').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('✓ All ranking data cleared\n');
  } catch (error) {
    console.error('Error clearing data:', error.message);
    throw error;
  }
  
  console.log('Step 2: Re-importing from JSON...');
  await importFromJSON();
  
  console.log('\n' + '='.repeat(60));
  console.log('RECALCULATION COMPLETE!');
  console.log('='.repeat(60));
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('recalculateAllRankings.js')) {
  recalculateAllRankings().catch(err => {
    console.error('Recalculation failed:', err);
    process.exit(1);
  });
}
