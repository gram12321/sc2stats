import 'dotenv/config';
import express from 'express';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
// Race and team race rankings now read from database
// On-demand calculations removed - all rankings stored in database
import { supabase } from '../lib/supabase.js';
import { processTournamentMatches } from '../tools/database/databaseRankingEngine.js';

/**
 * Fetch match history with rating impacts from database
 * Replaces old on-the-fly calculation approach
 */
async function getMatchHistoryFromDatabase(filters = {}) {
  try {
    // Load race data from player_defaults.json
    let playerRaces = {};
    try {
      const defaultsContent = await readFile(playerDefaultsFile, 'utf-8');
      playerRaces = JSON.parse(defaultsContent);
    } catch (err) {
      console.warn('Could not load player defaults:', err.message);
    }
    
    let query = supabase
      .from('matches')
      .select(`
        id,
        tournament:tournaments(name, liquipedia_slug, date),
        date,
        round,
        team1:teams!matches_team1_id_fkey(team_key, player1:player1_id(name), player2:player2_id(name)),
        team2:teams!matches_team2_id_fkey(team_key, player1:player1_id(name), player2:player2_id(name)),
        team1_score,
        team2_score
      `)
      .order('date', { ascending: true });
    
    const { data: matches, error } = await query;
    if (error) throw error;

    if (!matches || matches.length === 0) {
      return [];
    }
    
    // Fetch all rating history for these matches
    const matchIds = matches.map(m => m.id);
    let histories = [];
    if (matchIds.length > 0) {
      const { data: historyData, error: histError } = await supabase
        .from('rating_history')
        .select(`
          match_id,
          entity_type,
          entity_id,
          rating_before,
          rating_after,
          rating_change,
          confidence,
          expected_win_probability,
          k_factor
        `)
        .in('match_id', matchIds);
      
      if (histError) throw histError;
      histories = historyData || [];
    }
    
    // Group histories by match and entity type
    const historyByMatch = new Map();
    for (const hist of histories) {
      if (!historyByMatch.has(hist.match_id)) {
        historyByMatch.set(hist.match_id, { players: [], teams: [], races: [], team_races: [] });
      }
      const matchHist = historyByMatch.get(hist.match_id);
      if (hist.entity_type === 'player') matchHist.players.push(hist);
      else if (hist.entity_type === 'team') matchHist.teams.push(hist);
      else if (hist.entity_type === 'race') matchHist.races.push(hist);
      else if (hist.entity_type === 'team_race') matchHist.team_races.push(hist);
    }
    
    // Fetch player/team/race/team_race data to map entity_id back to names/keys
    const playerIds = [...new Set((histories || []).filter(h => h.entity_type === 'player').map(h => h.entity_id))];
    const teamIds = [...new Set((histories || []).filter(h => h.entity_type === 'team').map(h => h.entity_id))];
    const raceIds = [...new Set((histories || []).filter(h => h.entity_type === 'race').map(h => h.entity_id))];
    const teamRaceIds = [...new Set((histories || []).filter(h => h.entity_type === 'team_race').map(h => h.entity_id))];
    
    const players = playerIds.length > 0
      ? (await supabase.from('players').select('id, name').in('id', playerIds)).data
      : [];
    const teams = teamIds.length > 0
      ? (await supabase.from('teams').select('id, team_key').in('id', teamIds)).data
      : [];
    const races = raceIds.length > 0
      ? (await supabase.from('race_rankings').select('id, race_matchup').in('id', raceIds)).data
      : [];
    const teamRaces = teamRaceIds.length > 0
      ? (await supabase.from('team_race_rankings').select('id, team_race_matchup').in('id', teamRaceIds)).data
      : [];
    
    const playerMap = new Map((players || []).map(p => [p.id, p.name]));
    const teamMap = new Map((teams || []).map(t => [t.id, t.team_key]));
    const raceMap = new Map((races || []).map(r => [r.id, r.race_matchup]));
    const teamRaceMap = new Map((teamRaces || []).map(tr => [tr.id, tr.team_race_matchup]));
    
    // Format matches with impacts
    const formattedMatches = matches.map(match => {
      const hist = historyByMatch.get(match.id) || { players: [], teams: [], races: [], team_races: [] };
      
      // Determine winner
      const team1Won = match.team1_score > match.team2_score;
      
      // Build player_impacts
      const player_impacts = {};
      for (const playerHist of hist.players) {
        const playerName = playerMap.get(playerHist.entity_id);
        if (!playerName) continue;
        
        // Determine opponent rating - find the opposing team's average player rating
        const isTeam1Player = match.team1.player1.name === playerName || match.team1.player2.name === playerName;
        const opponentTeamHists = hist.players.filter(ph => {
          const pName = playerMap.get(ph.entity_id);
          if (isTeam1Player) {
            return pName === match.team2.player1.name || pName === match.team2.player2.name;
          } else {
            return pName === match.team1.player1.name || pName === match.team1.player2.name;
          }
        });
        const opponentRating = opponentTeamHists.length > 0
          ? opponentTeamHists.reduce((sum, h) => sum + h.rating_before, 0) / opponentTeamHists.length
          : 0;
        
        const won = isTeam1Player ? team1Won : !team1Won;
        
        player_impacts[playerName] = {
          ratingBefore: playerHist.rating_before,
          ratingChange: playerHist.rating_change,
          won,
          opponentRating,
          expectedWin: playerHist.expected_win_probability,
          adjustedK: playerHist.k_factor,
          baseK: playerHist.k_factor, // We don't store base K separately, use adjusted
          confidence: playerHist.confidence
        };
      }
      
      // Build team_impacts
      const team_impacts = {};
      for (const teamHist of hist.teams) {
        const teamKey = teamMap.get(teamHist.entity_id);
        if (!teamKey) continue;
        
        // Determine opponent team rating
        const isTeam1 = match.team1.team_key === teamKey;
        const opponentTeamHist = hist.teams.find(th => teamMap.get(th.entity_id) === (isTeam1 ? match.team2.team_key : match.team1.team_key));
        const opponentRating = opponentTeamHist ? opponentTeamHist.rating_before : 0;
        
        const won = isTeam1 ? team1Won : !team1Won;
        
        team_impacts[teamKey] = {
          ratingBefore: teamHist.rating_before,
          ratingChange: teamHist.rating_change,
          won,
          opponentRating,
          expectedWin: teamHist.expected_win_probability,
          adjustedK: teamHist.k_factor,
          baseK: teamHist.k_factor,
          confidence: teamHist.confidence
        };
      }
      
      // Build race_impacts
      const race_impacts = {};
      for (const raceHist of hist.races) {
        const raceMatchup = raceMap.get(raceHist.entity_id);
        if (!raceMatchup) continue;
        
        // Race matchup format is "PvT" - extract races
        const [race1, race2] = raceMatchup.split('v');
        
        // Find opponent race rating (from the opposing race in this matchup)
        const opponentRaceHist = hist.races.find(rh => {
          const rm = raceMap.get(rh.entity_id);
          return rm && rm !== raceMatchup && (rm.includes(race1) || rm.includes(race2));
        });
        const opponentRating = opponentRaceHist ? opponentRaceHist.rating_before : 0;
        
        // Determine if this race won (determine from rating change direction)
        const raceWon = raceHist.rating_change > 0;
        
        race_impacts[raceMatchup] = {
          ratingBefore: raceHist.rating_before,
          ratingChange: raceHist.rating_change,
          won: raceWon,
          opponentRating,
          race1: race1,
          race2: race2,
          expectedWin: raceHist.expected_win_probability,
          adjustedK: raceHist.k_factor,
          baseK: raceHist.k_factor,
          confidence: raceHist.confidence
        };
      }
      
      return {
        match_id: match.id,
        tournament_slug: match.tournament.liquipedia_slug,
        tournament_name: match.tournament.name,
        tournament_date: match.tournament.date,
        match_date: match.date,
        round: match.round,
        team1: {
          player1: match.team1.player1.name,
          player2: match.team1.player2.name
        },
        team2: {
          player1: match.team2.player1.name,
          player2: match.team2.player2.name
        },
        team1_score: match.team1_score,
        team2_score: match.team2_score,
        // Get race data from player_defaults.json
        team1_races: [
          playerRaces[match.team1.player1.name],
          playerRaces[match.team1.player2.name]
        ].filter(Boolean),
        team2_races: [
          playerRaces[match.team2.player1.name],
          playerRaces[match.team2.player2.name]
        ].filter(Boolean),
        team1_combo: [
          playerRaces[match.team1.player1.name],
          playerRaces[match.team1.player2.name]
        ].map(r => r?.[0] || '?').sort().join(''),
        team2_combo: [
          playerRaces[match.team2.player1.name],
          playerRaces[match.team2.player2.name]
        ].map(r => r?.[0] || '?').sort().join(''),
        player_impacts,
        team_impacts,
        race_impacts
      };
    });
    
    return formattedMatches;
  } catch (error) {
    console.error('Error fetching match history from database:', error);
    throw error;
  }
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');
const playerDefaultsFile = join(outputDir, 'player_defaults.json');

const app = express();
app.use(cors());
app.use(express.json());

// List all JSON files in output directory
app.get('/api/tournaments', async (req, res) => {
  try {
    // Ensure output directory exists
    try {
      await mkdir(outputDir, { recursive: true });
    } catch (err) {
      // Directory might already exist, ignore error
    }
    
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json');
    
    const tournaments = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = join(outputDir, file);
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          return {
            filename: file,
            name: data.tournament?.name || file.replace('.json', ''),
            slug: data.tournament?.liquipedia_slug || file.replace('.json', ''),
            date: data.tournament?.date || null,
            matchCount: data.matches?.length || 0
          };
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
          return null;
        }
      })
    );
    
    res.json(tournaments.filter(t => t !== null));
  } catch (error) {
    console.error('Error listing tournaments:', error);
    res.status(500).json({ error: 'Failed to list tournaments', details: error.message });
  }
});

// Get specific tournament data
app.get('/api/tournaments/:filename', async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = join(outputDir, filename);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    res.json(data);
  } catch (error) {
    console.error('Error reading tournament:', error);
    res.status(404).json({ error: 'Tournament not found' });
  }
});

// Save tournament data (overwrites existing file)
app.post('/api/tournaments/:filename', async (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const data = req.body;
    
    console.log(`Saving tournament: ${filename}`);
    
    // Validate data structure
    if (!data.tournament || !data.matches) {
      console.error('Invalid data structure:', { hasTournament: !!data.tournament, hasMatches: !!data.matches });
      return res.status(400).json({ error: 'Invalid tournament data format' });
    }
    
    const filePath = join(outputDir, filename);
    console.log(`Writing to: ${filePath}`);
    
    await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    
    console.log(`Successfully saved tournament: ${filename}`);
    res.json({ success: true, message: 'Tournament saved successfully' });
  } catch (error) {
    console.error('Error saving tournament:', error);
    res.status(500).json({ error: error.message || 'Failed to save tournament' });
  }
});

// Get all unique players from all tournaments
app.get('/api/players', async (req, res) => {
  try {
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json');
    
    const playerSet = new Set();
    
    for (const file of jsonFiles) {
      try {
        const filePath = join(outputDir, file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        
        if (data.matches && Array.isArray(data.matches)) {
          data.matches.forEach(match => {
            if (match.team1?.player1?.name) playerSet.add(match.team1.player1.name);
            if (match.team1?.player2?.name) playerSet.add(match.team1.player2.name);
            if (match.team2?.player1?.name) playerSet.add(match.team2.player1.name);
            if (match.team2?.player2?.name) playerSet.add(match.team2.player2.name);
          });
        }
      } catch (err) {
        console.error(`Error reading ${file}:`, err);
      }
    }
    
    const players = Array.from(playerSet).sort();
    res.json(players);
  } catch (error) {
    console.error('Error getting players:', error);
    res.status(500).json({ error: 'Failed to get players' });
  }
});

// Get player defaults
app.get('/api/player-defaults', async (req, res) => {
  try {
    try {
      const content = await readFile(playerDefaultsFile, 'utf-8');
      const defaults = JSON.parse(content);
      res.json(defaults);
    } catch (err) {
      // File doesn't exist yet, return empty object
      if (err.code === 'ENOENT') {
        res.json({});
      } else {
        throw err;
      }
    }
  } catch (error) {
    console.error('Error getting player defaults:', error);
    res.status(500).json({ error: 'Failed to get player defaults' });
  }
});

// Set player defaults
app.post('/api/player-defaults', async (req, res) => {
  try {
    const defaults = req.body;
    
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });
    
    // Write to JSON file
    await writeFile(playerDefaultsFile, JSON.stringify(defaults, null, 2), 'utf-8');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error saving player defaults:', error);
    res.status(500).json({ error: 'Failed to save player defaults' });
  }
});

// Update single player default
app.put('/api/player-defaults/:playerName', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.playerName);
    const { race } = req.body;
    
    // Read existing defaults
    let defaults = {};
    try {
      const content = await readFile(playerDefaultsFile, 'utf-8');
      defaults = JSON.parse(content);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
    
    // Update or delete
    if (race === null || race === '') {
      delete defaults[playerName];
    } else {
      defaults[playerName] = race;
    }
    
    // Ensure output directory exists
    await mkdir(outputDir, { recursive: true });
    
    // Write back
    await writeFile(playerDefaultsFile, JSON.stringify(defaults, null, 2), 'utf-8');
    
    res.json({ success: true });
  } catch (error) {
    console.error('Error updating player default:', error);
    res.status(500).json({ error: 'Failed to update player default' });
  }
});

// Get player rankings from database
app.get('/api/player-rankings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('name, matches, wins, losses, current_rating, current_confidence')
      .order('current_rating', { ascending: false });
    
    if (error) {
      console.error('Supabase error:', error);
      
      // Check if table doesn't exist (common error code: 42P01)
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        return res.status(500).json({ 
          error: 'Database tables not found',
          message: 'Please run the database import first: node tools/import/importFromJSON.js',
          details: error.message
        });
      }
      
      throw error;
    }
    
    // Map database columns to API response format
    const rankings = (data || []).map(player => ({
      name: player.name,
      matches: player.matches,
      wins: player.wins,
      losses: player.losses,
      points: player.current_rating,
      confidence: player.current_confidence
    }));
    
    res.json(rankings);
  } catch (error) {
    console.error('Error fetching player rankings:', error);
    res.status(500).json({ 
      error: 'Failed to fetch player rankings',
      details: error.message || String(error),
      code: error.code || 'UNKNOWN',
      hint: error.code === '42P01' ? 'Run: node tools/import/importFromJSON.js' : undefined
    });
  }
});

// Get team rankings from database
app.get('/api/team-rankings', async (req, res) => {
  try {
    const { data: teams, error } = await supabase
      .from('teams')
      .select(`
        team_key,
        matches,
        wins,
        losses,
        current_rating,
        current_confidence,
        player1:player1_id(name),
        player2:player2_id(name)
      `)
      .order('current_rating', { ascending: false });
    
    if (error) throw error;
    
    // Format for frontend
    const formatted = teams.map(team => ({
      player1: team.player1.name,
      player2: team.player2.name,
      matches: team.matches,
      wins: team.wins,
      losses: team.losses,
      points: team.current_rating,
      confidence: team.current_confidence
    }));
    
    res.json(formatted);
  } catch (error) {
    console.error('Error fetching team rankings:', error);
    res.status(500).json({ error: 'Failed to fetch team rankings' });
  }
});

// Note: Seeded rankings endpoints removed - seeding is now automatic for Season 1
// All rankings are read from Supabase database which includes seeded Season 1 data
// Season 1 (2025) was initialized with three-pass seeding during migration

// Get race rankings from database
app.get('/api/race-rankings', async (req, res) => {
  try {
    const { data: raceRankings, error } = await supabase
      .from('race_rankings')
      .select('*')
      .order('current_rating', { ascending: false });
    
    if (error) throw error;
    
    // Format for frontend (matches old structure)
    const rankings = raceRankings.map(r => ({
      matchup: r.race_matchup,
      matches: r.matches,
      wins: r.wins,
      losses: r.losses,
      points: r.current_rating,
      confidence: r.current_confidence
    }));
    
    // For combined rankings (e.g., "TvX"), aggregate all matchups
    const combinedRankings = {};
    const races = ['P', 'T', 'Z'];
    
    for (const race of races) {
      const matchups = raceRankings.filter(r => r.race_matchup.startsWith(race));
      const totalMatches = matchups.reduce((sum, m) => sum + m.matches, 0);
      const totalWins = matchups.reduce((sum, m) => sum + m.wins, 0);
      const totalLosses = matchups.reduce((sum, m) => sum + m.losses, 0);
      const avgRating = matchups.length > 0
        ? matchups.reduce((sum, m) => sum + m.current_rating, 0) / matchups.length
        : 0;
      const avgConfidence = matchups.length > 0
        ? matchups.reduce((sum, m) => sum + m.current_confidence, 0) / matchups.length
        : 0;
      
      combinedRankings[`${race}vX`] = {
        matchup: `${race}vX`,
        matches: totalMatches,
        wins: totalWins,
        losses: totalLosses,
        points: avgRating,
        confidence: avgConfidence
      };
    }
    
    res.json({ rankings, combinedRankings, matchHistory: [] });
  } catch (error) {
    console.error('Error fetching race rankings:', error);
    res.status(500).json({ error: 'Failed to fetch race rankings' });
  }
});

// Get all matches for a specific race matchup (e.g., PvT)
app.get('/api/race-matchup/:race1/:race2', async (req, res) => {
  try {
    const { race1, race2 } = req.params;
    
    // Create matchup key (e.g., "PvT")
    const raceAbbr = {
      'Protoss': 'P',
      'Terran': 'T',
      'Zerg': 'Z',
      'Random': 'R'
    };
    const abbr1 = raceAbbr[race1] || race1[0];
    const abbr2 = raceAbbr[race2] || race2[0];
    const matchupKey = `${abbr1}v${abbr2}`;
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Filter matches that have this matchup in race_impacts
    const matches = matchHistory.filter(match => {
      return match.race_impacts && match.race_impacts[matchupKey];
    });
    
    res.json(matches);
  } catch (error) {
    console.error('Error fetching race matchup matches:', error);
    res.status(500).json({ error: 'Failed to fetch matchup matches' });
  }
});

// Get all matches for a specific race (for combined stats, e.g., TvX)
app.get('/api/race-combo/:race', async (req, res) => {
  try {
    const { race } = req.params;
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Filter matches where the race appears in team1_races or team2_races
    const matches = matchHistory.filter(match => {
      const team1Races = match.team1_races || [];
      const team2Races = match.team2_races || [];
      return team1Races.includes(race) || team2Races.includes(race);
    });
    
    res.json(matches);
  } catch (error) {
    console.error('Error fetching race combo matches:', error);
    res.status(500).json({ error: 'Failed to fetch combo matches' });
  }
});

app.get('/api/team-race-rankings', async (req, res) => {
  try {
    const { data: teamRaceRankings, error } = await supabase
      .from('team_race_rankings')
      .select('*')
      .order('current_rating', { ascending: false });
    
    if (error) throw error;
    
    // Format for frontend (matches old structure)
    const rankings = teamRaceRankings.map(r => ({
      matchup: r.team_race_matchup,
      matches: r.matches,
      wins: r.wins,
      losses: r.losses,
      points: r.current_rating,
      confidence: r.current_confidence
    }));
    
    // For combined rankings (e.g., "PP vs X"), aggregate all matchups with that team composition
    const combinedRankings = {};
    const teamCombos = ['PP', 'PT', 'PZ', 'TT', 'TZ', 'ZZ'];
    
    for (const combo of teamCombos) {
      const matchups = teamRaceRankings.filter(r => 
        r.team_race_matchup.startsWith(combo + ' vs') || 
        r.team_race_matchup.endsWith('vs ' + combo)
      );
      const totalMatches = matchups.reduce((sum, m) => sum + m.matches, 0);
      const totalWins = matchups.reduce((sum, m) => sum + m.wins, 0);
      const totalLosses = matchups.reduce((sum, m) => sum + m.losses, 0);
      const avgRating = matchups.length > 0
        ? matchups.reduce((sum, m) => sum + m.current_rating, 0) / matchups.length
        : 0;
      const avgConfidence = matchups.length > 0
        ? matchups.reduce((sum, m) => sum + m.current_confidence, 0) / matchups.length
        : 0;
      
      combinedRankings[`${combo} vs X`] = {
        matchup: `${combo} vs X`,
        matches: totalMatches,
        wins: totalWins,
        losses: totalLosses,
        points: avgRating,
        confidence: avgConfidence
      };
    }
    
    res.json({ rankings, combinedRankings, matchHistory: [] });
  } catch (error) {
    console.error('Error fetching team race rankings:', error);
    res.status(500).json({ error: 'Failed to fetch team race rankings' });
  }
});

app.get('/api/team-race-matchup/:combo1/:combo2', async (req, res) => {
  try {
    const { combo1, combo2 } = req.params;
    
    // Normalize combos (sort alphabetically to match internal key format)
    const sorted = [combo1, combo2].sort();
    const combo1Normalized = sorted[0];
    const combo2Normalized = sorted[1];
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Filter matches for this matchup
    const matches = matchHistory.filter(match => {
      const matchTeam1Combo = match.team1_combo;
      const matchTeam2Combo = match.team2_combo;
      const matchSorted = [matchTeam1Combo, matchTeam2Combo].sort();
      return matchSorted[0] === combo1Normalized && matchSorted[1] === combo2Normalized;
    });
    
    res.json(matches);
  } catch (error) {
    console.error('Error fetching team race matchup matches:', error);
    res.status(500).json({ error: 'Failed to fetch matchup matches' });
  }
});

// Get all matches for a specific team race combination (for combined stats)
app.get('/api/team-race-combo/:combo', async (req, res) => {
  try {
    const { combo } = req.params;
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Filter matches where either team1_combo or team2_combo matches the combo
    const matches = matchHistory.filter(match => {
      return match.team1_combo === combo || match.team2_combo === combo;
    });
    
    res.json(matches);
  } catch (error) {
    console.error('Error fetching team race combo matches:', error);
    res.status(500).json({ error: 'Failed to fetch combo matches' });
  }
});

// Legacy endpoint for backwards compatibility - now redirects to player rankings
app.get('/api/rankings', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('players')
      .select('name, matches, wins, losses, current_rating, current_confidence')
      .order('current_rating', { ascending: false });
    
    if (error) throw error;
    
    const rankings = (data || []).map(player => ({
      name: player.name,
      matches: player.matches,
      wins: player.wins,
      losses: player.losses,
      points: player.current_rating,
      confidence: player.current_confidence
    }));
    
    res.json(rankings);
  } catch (error) {
    console.error('Error fetching rankings:', error);
    res.status(500).json({ error: 'Failed to fetch rankings' });
  }
});

// Get match history with ranking impacts
app.get('/api/match-history', async (req, res) => {
  try {
    const { player, team, tournament } = req.query;
    
    // Fetch all match history from database
    let filteredHistory = await getMatchHistoryFromDatabase();
    
    // Filter by player if specified
    if (player) {
      filteredHistory = filteredHistory.filter(match => {
        const players = [
          match.team1?.player1,
          match.team1?.player2,
          match.team2?.player1,
          match.team2?.player2
        ];
        return players.includes(player);
      });
    }
    
    // Filter by tournament if specified
    if (tournament) {
      filteredHistory = filteredHistory.filter(match => 
        match.tournament_slug === tournament
      );
    }
    
    // Sort by newest first (reverse chronological)
    filteredHistory.sort((a, b) => {
      // First by tournament date
      if (a.tournament_date && b.tournament_date) {
        const dateA = new Date(a.tournament_date);
        const dateB = new Date(b.tournament_date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
      }
      
      // Then by match date
      if (a.match_date && b.match_date) {
        const dateA = new Date(a.match_date);
        const dateB = new Date(b.match_date);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateB.getTime() - dateA.getTime();
        }
      }
      
      // Finally by match_id (reverse)
      return (b.match_id || '').localeCompare(a.match_id || '');
    });
    
    res.json(filteredHistory);
  } catch (error) {
    console.error('Error getting match history:', error);
    res.status(500).json({ error: 'Failed to get match history' });
  }
});

// Get player details with match history
app.get('/api/player/:playerName', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.playerName);
    
    // Get player from database
    const { data: playerData, error: playerError } = await supabase
      .from('players')
      .select('name, matches, wins, losses, current_rating, current_confidence')
      .eq('name', playerName)
      .single();
    
    if (playerError || !playerData) {
      return res.status(404).json({ error: 'Player not found' });
    }
    
    const player = {
      name: playerData.name,
      matches: playerData.matches,
      wins: playerData.wins,
      losses: playerData.losses,
      points: playerData.current_rating,
      confidence: playerData.current_confidence
    };
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Get player's match history
    const playerMatches = matchHistory.filter(match => {
      const players = [
        match.team1?.player1,
        match.team1?.player2,
        match.team2?.player1,
        match.team2?.player2
      ];
      return players.includes(playerName);
    }).map(match => {
      const impact = match.player_impacts?.[playerName];
      return {
        ...match,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        opponentRating: impact?.opponentRating || 0
      };
    });
    
    res.json({
      ...player,
      matchHistory: playerMatches
    });
  } catch (error) {
    console.error('Error getting player details:', error);
    res.status(500).json({ error: 'Failed to get player details' });
  }
});

// Get team details with match history
app.get('/api/team/:player1/:player2', async (req, res) => {
  try {
    const player1 = decodeURIComponent(req.params.player1);
    const player2 = decodeURIComponent(req.params.player2);
    const teamKey = [player1, player2].sort().join('+');
    
    // Get team from database
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .select(`
        team_key,
        matches,
        wins,
        losses,
        current_rating,
        current_confidence,
        player1:player1_id(name),
        player2:player2_id(name)
      `)
      .eq('team_key', teamKey)
      .single();
    
    if (teamError || !teamData) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    const team = {
      player1: teamData.player1.name,
      player2: teamData.player2.name,
      matches: teamData.matches,
      wins: teamData.wins,
      losses: teamData.losses,
      points: teamData.current_rating,
      confidence: teamData.current_confidence
    };
    
    // Fetch all match history from database
    const matchHistory = await getMatchHistoryFromDatabase();
    
    // Get team's match history
    const teamMatches = matchHistory.filter(match => {
      const matchTeam1 = [match.team1?.player1, match.team1?.player2].sort().join('+');
      const matchTeam2 = [match.team2?.player1, match.team2?.player2].sort().join('+');
      return matchTeam1 === teamKey || matchTeam2 === teamKey;
    }).map(match => {
      const impact = match.team_impacts?.[teamKey];
      return {
        ...match,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        opponentRating: impact?.opponentRating || 0
      };
    });
    
    res.json({
      ...team,
      matchHistory: teamMatches
    });
  } catch (error) {
    console.error('Error getting team details:', error);
    res.status(500).json({ error: 'Failed to get team details' });
  }
});

// Admin: Import new tournament into database
app.post('/api/admin/import-tournament', async (req, res) => {
  try {
    const { filename } = req.body;
    
    if (!filename) {
      return res.status(400).json({ error: 'Filename is required' });
    }
    
    // Load tournament from file
    const filePath = join(outputDir, filename);
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    if (!data.tournament || !data.matches) {
      return res.status(400).json({ error: 'Invalid tournament data' });
    }
    
    // Check if already imported
    const { data: existing } = await supabase
      .from('tournaments')
      .select('id, name')
      .eq('liquipedia_slug', data.tournament.liquipedia_slug)
      .single();
    
    if (existing) {
      return res.status(400).json({ 
        error: 'Tournament already imported',
        tournament: existing
      });
    }
    
    // Import tournament
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
    
    // Process matches
    const processed = await processTournamentMatches(data, tournamentRecord.id);
    
    // Mark as processed
    await supabase
      .from('tournaments')
      .update({ processed: true })
      .eq('id', tournamentRecord.id);
    
    res.json({ 
      success: true, 
      tournament: tournamentRecord,
      matchesProcessed: processed
    });
  } catch (error) {
    console.error('Error importing tournament:', error);
    res.status(500).json({ error: error.message || 'Failed to import tournament' });
  }
});

// Admin: Force recalculation of all rankings
app.post('/api/admin/recalculate', async (req, res) => {
  try {
    console.log('Starting recalculation...');
    
    // Delete all data (cascade will handle related records)
    await supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    await supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    
    console.log('Cleared database');
    
    // Re-run recalculation
    const { recalculateAllRankings } = await import('../tools/recalculation/recalculateAllRankings.js');
    await recalculateAllRankings();
    
    console.log('Recalculation complete');
    
    res.json({ success: true, message: 'Recalculation complete' });
  } catch (error) {
    console.error('Error recalculating:', error);
    res.status(500).json({ error: error.message || 'Failed to recalculate' });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
