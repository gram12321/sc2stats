/**
 * Import matches for historical record without updating ratings
 * Used for Season 1 where ratings are already set from seeds
 */

import { supabase } from '../../lib/supabase.js';

/**
 * Import a match into database without updating ratings
 */
export async function importMatchOnly(match, tournamentId) {
  const team1Player1 = match.team1?.player1?.name;
  const team1Player2 = match.team1?.player2?.name;
  const team2Player1 = match.team2?.player1?.name;
  const team2Player2 = match.team2?.player2?.name;
  
  if (!team1Player1 || !team1Player2 || !team2Player1 || !team2Player2) {
    return null;
  }
  
  // Get team keys
  const team1Key = [team1Player1, team1Player2].sort().join('+');
  const team2Key = [team2Player1, team2Player2].sort().join('+');
  
  // Get teams (should already exist from seed import)
  const { data: team1 } = await supabase
    .from('teams')
    .select('id')
    .eq('team_key', team1Key)
    .single();
  
  const { data: team2 } = await supabase
    .from('teams')
    .select('id')
    .eq('team_key', team2Key)
    .single();
  
  if (!team1 || !team2) {
    console.warn(`Skipping match ${match.match_id}: teams not found`);
    return null;
  }
  
  // Insert match record (no rating updates)
  const { data: matchRecord, error } = await supabase
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
  
  if (error) {
    throw new Error(`Failed to import match: ${error.message}`);
  }
  
  return matchRecord;
}

/**
 * Import all matches from a tournament without updating ratings
 */
export async function importTournamentMatchesOnly(tournament, tournamentId) {
  const matches = tournament.matches.filter(m => 
    m.team1_score !== null && 
    m.team2_score !== null &&
    m.team1?.player1?.name &&
    m.team1?.player2?.name &&
    m.team2?.player1?.name &&
    m.team2?.player2?.name
  );
  
  let imported = 0;
  for (const match of matches) {
    try {
      await importMatchOnly(match, tournamentId);
      imported++;
    } catch (error) {
      console.error(`  Error importing match ${match.match_id}:`, error.message);
    }
  }
  
  return imported;
}
