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
    const deleteAll = async (table) => {
      const { error } = await supabase
        .from(table)
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) {
        throw new Error(`Failed to clear ${table}: ${error.message}`);
      }
    };

    const verifyEmpty = async (table) => {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (error) {
        throw new Error(`Failed to verify ${table}: ${error.message}`);
      }
      if ((count || 0) > 0) {
        throw new Error(`Table ${table} not empty after delete (count=${count})`);
      }
    };

    // Clear all rankings (using a condition that's always true to delete all)
    await deleteAll('rating_history');
    await deleteAll('matches');
    await deleteAll('team_race_rankings');
    await deleteAll('race_rankings');
    await deleteAll('teams');
    await deleteAll('players');
    await deleteAll('tournaments');

    await verifyEmpty('rating_history');
    await verifyEmpty('matches');
    await verifyEmpty('team_race_rankings');
    await verifyEmpty('race_rankings');
    await verifyEmpty('teams');
    await verifyEmpty('players');
    await verifyEmpty('tournaments');
    
    console.log('All ranking data cleared\n');
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
