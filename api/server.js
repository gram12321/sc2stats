import express from 'express';
import { readdir, readFile, writeFile, mkdir, appendFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { calculateRankings } from '../tools/processRankings.js';
import { calculateTeamRankings } from '../tools/calculateTeamRankings.js';
import { calculateRaceRankings } from '../tools/calculateRaceRankings.js';
import { calculateTeamRaceRankings } from '../tools/calculateTeamRaceRankings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');
const playerDefaultsFile = join(outputDir, 'player_defaults.json');

const app = express();
app.use(cors());
app.use(express.json());

// Helper to load seeds
async function loadSeeds() {
  try {
    const playerSeedsFile = join(outputDir, 'seeded_player_seeds.json');
    const teamSeedsFile = join(outputDir, 'seeded_team_seeds.json');

    const [playerContent, teamContent] = await Promise.all([
      readFile(playerSeedsFile, 'utf-8').catch(() => null),
      readFile(teamSeedsFile, 'utf-8').catch(() => null)
    ]);

    return {
      playerSeeds: playerContent ? JSON.parse(playerContent) : null,
      teamSeeds: teamContent ? JSON.parse(teamContent) : null
    };
  } catch (err) {
    console.error('Error loading seeds:', err);
    return { playerSeeds: null, teamSeeds: null };
  }
}

// List all JSON files in output directory
app.get('/api/tournaments', async (req, res) => {
  try {
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'player_defaults.json' && !f.startsWith('seeded_'));

    const tournaments = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const filePath = join(outputDir, file);
          const content = await readFile(filePath, 'utf-8');
          const data = JSON.parse(content);
          return {
            filename: file,
            name: data?.tournament?.name || file.replace('.json', ''),
            slug: data?.tournament?.liquipedia_slug || file.replace('.json', ''),
            date: data?.tournament?.date || null,
            matchCount: data?.matches?.length || 0
          };
        } catch (err) {
          console.error(`Error reading ${file}:`, err);
          await appendFile(join(__dirname, '..', 'server_errors.log'), `${new Date().toISOString()} Error reading ${file}: ${err.stack}\n`).catch(() => { });
          return null;
        }
      })
    );

    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';

    const filteredTournaments = tournaments.filter(t => {
      if (!t) return false;

      // Filter by season
      if (seasons && seasons.length > 0) {
        if (!t.date) return false;
        const year = t.date.split('-')[0];
        if (!seasons.includes(year)) return false;
      }

      // Filter by main circuit
      if (isMainCircuitOnly) {
        const nameLower = t.name.toLowerCase();
        if (!nameLower.includes('uthermal')) return false;
      }

      return true;
    });

    res.json(filteredTournaments);
  } catch (error) {
    console.error('Error listing tournaments:', error);
    await appendFile(join(__dirname, '..', 'server_errors.log'), `${new Date().toISOString()} Error listing tournaments: ${error.stack}\n`).catch(() => { });
    res.status(500).json({ error: 'Failed to list tournaments' });
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

// Get player rankings
app.get('/api/player-rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings } = await calculateRankings(null, isMainCircuitOnly, seasons);
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating player rankings:', error);
    res.status(500).json({ error: 'Failed to calculate player rankings' });
  }
});

// Get team rankings
app.get('/api/team-rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating team rankings:', error);
    res.status(500).json({ error: 'Failed to calculate team rankings' });
  }
});

// Get seeded player rankings (from three-pass seeding process)
app.get('/api/seeded-player-rankings', async (req, res) => {
  try {
    const seededRankingsFile = join(outputDir, 'seeded_player_rankings.json');
    try {
      const content = await readFile(seededRankingsFile, 'utf-8');
      const rankings = JSON.parse(content);
      res.json(rankings);
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        res.status(404).json({ error: 'Seeded rankings not found. Please run the seeding script first: node tools/runSeededRankings.js' });
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    console.error('Error loading seeded player rankings:', error);
    res.status(500).json({ error: 'Failed to load seeded player rankings' });
  }
});

// Get seeded team rankings (from three-pass seeding process)
app.get('/api/seeded-team-rankings', async (req, res) => {
  try {
    const seededRankingsFile = join(outputDir, 'seeded_team_rankings.json');
    try {
      const content = await readFile(seededRankingsFile, 'utf-8');
      const rankings = JSON.parse(content);
      res.json(rankings);
    } catch (fileError) {
      if (fileError.code === 'ENOENT') {
        res.status(404).json({ error: 'Seeded rankings not found. Please run the seeding script first: node tools/runSeededRankings.js' });
      } else {
        throw fileError;
      }
    }
  } catch (error) {
    console.error('Error loading seeded team rankings:', error);
    res.status(500).json({ error: 'Failed to load seeded team rankings' });
  }
});

// Get race rankings
app.get('/api/race-rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, combinedRankings, matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons);
    res.json({ rankings, combinedRankings, matchHistory });
  } catch (error) {
    console.error('Error calculating race rankings:', error);
    res.status(500).json({ error: 'Failed to calculate race rankings' });
  }
});

// Get all matches for a specific race matchup (e.g., PvT)
app.get('/api/race-matchup/:race1/:race2', async (req, res) => {
  try {
    const { race1, race2 } = req.params;
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);

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

    // Create maps for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    // Filter matches that have this matchup in race_impacts and merge team_impacts and player_impacts
    const matches = matchHistory.filter(match => {
      return match.race_impacts && match.race_impacts[matchupKey];
    }).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const playerMatch = playerMatchMap.get(key);
      return {
        ...match,
        team_impacts: match.team_impacts || teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts
      };
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
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);

    // Create maps for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    // Filter matches where the race appears in team1_races or team2_races and merge team_impacts and player_impacts
    const matches = matchHistory.filter(match => {
      const team1Races = match.team1_races || [];
      const team2Races = match.team2_races || [];
      return team1Races.includes(race) || team2Races.includes(race);
    }).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const playerMatch = playerMatchMap.get(key);
      return {
        ...match,
        team_impacts: match.team_impacts || teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts
      };
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching race combo matches:', error);
    res.status(500).json({ error: 'Failed to fetch combo matches' });
  }
});

app.get('/api/team-race-rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, combinedRankings, matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);

    // Create map of team match history for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    // Merge team_impacts (Generic) into match history
    // match.combo_impacts (Race) falls through via spread
    const mergedMatchHistory = (matchHistory || []).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts
      };
    });

    res.json({ rankings, combinedRankings, matchHistory: mergedMatchHistory });
  } catch (error) {
    console.error('Error calculating team race rankings:', error);
    res.status(500).json({ error: 'Failed to calculate team race rankings' });
  }
});

app.get('/api/team-race-matchup/:combo1/:combo2', async (req, res) => {
  try {
    const { combo1, combo2 } = req.params;
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);

    // Normalize combos (sort alphabetically to match internal key format)
    const sorted = [combo1, combo2].sort();
    const combo1Normalized = sorted[0];
    const combo2Normalized = sorted[1];

    // Create maps for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    // Filter matches for this matchup and merge team_impacts and player_impacts
    const matches = matchHistory.filter(match => {
      const matchTeam1Combo = match.team1_combo;
      const matchTeam2Combo = match.team2_combo;
      const matchSorted = [matchTeam1Combo, matchTeam2Combo].sort();
      return matchSorted[0] === combo1Normalized && matchSorted[1] === combo2Normalized;
    }).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const playerMatch = playerMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts
      };
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
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);

    // Create maps for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    // Filter matches where either team1_combo or team2_combo matches the combo and merge team_impacts and player_impacts
    const matches = matchHistory.filter(match => {
      return match.team1_combo === combo || match.team2_combo === combo;
    }).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const playerMatch = playerMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts
      };
    });

    res.json(matches);
  } catch (error) {
    console.error('Error fetching team race combo matches:', error);
    res.status(500).json({ error: 'Failed to fetch combo matches' });
  }
});

// Legacy endpoint for backwards compatibility
app.get('/api/rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings } = await calculateRankings(null, isMainCircuitOnly, seasons);
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating rankings:', error);
    res.status(500).json({ error: 'Failed to calculate rankings' });
  }
});

// Get match history with ranking impacts
app.get('/api/match-history', async (req, res) => {
  try {
    const { player, team, tournament, useSeeds } = req.query;

    let playerSeeds = null;
    let teamSeeds = null;

    if (useSeeds === 'true') {
      console.log('API: useSeeds=true requested');
      const seeds = await loadSeeds();
      playerSeeds = seeds.playerSeeds;
      teamSeeds = seeds.teamSeeds;
      console.log(`API: Loaded seeds - Players: ${playerSeeds ? Object.keys(playerSeeds).length : 0}, Teams: ${teamSeeds ? Object.keys(teamSeeds).length : 0}`);
    }

    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, matchHistory } = await calculateRankings(playerSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(teamSeeds, req.query.mainCircuitOnly === 'true', seasons);

    // Create a map of team match history by match_id for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    // Merge team_impacts into match history
    let filteredHistory = (matchHistory || []).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      if (teamMatch && teamMatch.team_impacts) {
        return {
          ...match,
          team_impacts: teamMatch.team_impacts
        };
      }
      return match;
    });

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
    const { useSeeds } = req.query;

    let playerSeeds = null;
    let teamSeeds = null;

    if (useSeeds === 'true') {
      const seeds = await loadSeeds();
      playerSeeds = seeds.playerSeeds;
      teamSeeds = seeds.teamSeeds;
    }

    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, matchHistory } = await calculateRankings(playerSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(teamSeeds, req.query.mainCircuitOnly === 'true', seasons);

    const player = rankings.find(p => p.name === playerName);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
    }

    // Create a map of team match history by match_id for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    // Get player's match history
    const playerMatches = (matchHistory || []).filter(match => {
      const players = [
        match.team1?.player1,
        match.team1?.player2,
        match.team2?.player1,
        match.team2?.player2
      ];
      return players.includes(playerName);
    }).map(match => {
      const impact = match.player_impacts?.[playerName];
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      return {
        ...match,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        opponentRating: impact?.opponentRating || 0,
        team_impacts: teamMatch?.team_impacts || match.team_impacts
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
    const { useSeeds } = req.query;
    const teamKey = [player1, player2].sort().join('+');

    let playerSeeds = null;
    let teamSeeds = null;

    if (useSeeds === 'true') {
      const seeds = await loadSeeds();
      playerSeeds = seeds.playerSeeds;
      teamSeeds = seeds.teamSeeds;
    }

    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, matchHistory } = await calculateTeamRankings(teamSeeds, req.query.mainCircuitOnly === 'true', seasons);

    const team = rankings.find(t =>
      (t.player1 === player1 && t.player2 === player2) ||
      (t.player1 === player2 && t.player2 === player1)
    );

    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }

    // Get team's match history
    const { matchHistory: playerMatchHistory } = await calculateRankings(playerSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    const teamMatches = (matchHistory || []).filter(match => {
      const matchTeam1 = [match.team1?.player1, match.team1?.player2].sort().join('+');
      const matchTeam2 = [match.team2?.player1, match.team2?.player2].sort().join('+');
      return matchTeam1 === teamKey || matchTeam2 === teamKey;
    }).map(match => {
      const impact = match.team_impacts?.[teamKey];
      const key = `${match.tournament_slug}-${match.match_id}`;
      const playerMatch = playerMatchMap.get(key);
      return {
        ...match,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        opponentRating: impact?.opponentRating || 0,
        player_impacts: playerMatch?.player_impacts || match.player_impacts
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

// Export for Vercel
export default app;

// Only listen if run directly
if (process.env.NODE_ENV !== 'production') {
  const PORT = process.env.PORT || 3002;
  app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
  });
}
