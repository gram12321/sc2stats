import express from 'express';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';
import { calculateRankings } from '../tools/calculateRankings.js';
import { calculateTeamRankings } from '../tools/calculateTeamRankings.js';
import { calculateRaceRankings } from '../tools/calculateRaceRankings.js';

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
    const { rankings } = await calculateRankings();
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating player rankings:', error);
    res.status(500).json({ error: 'Failed to calculate player rankings' });
  }
});

// Get team rankings
app.get('/api/team-rankings', async (req, res) => {
  try {
    const { rankings } = await calculateTeamRankings();
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating team rankings:', error);
    res.status(500).json({ error: 'Failed to calculate team rankings' });
  }
});

// Get race rankings
app.get('/api/race-rankings', async (req, res) => {
  try {
    const { rankings, combinedRankings } = await calculateRaceRankings();
    res.json({ rankings, combinedRankings });
  } catch (error) {
    console.error('Error calculating race rankings:', error);
    res.status(500).json({ error: 'Failed to calculate race rankings' });
  }
});

// Legacy endpoint for backwards compatibility
app.get('/api/rankings', async (req, res) => {
  try {
    const { rankings } = await calculateRankings();
    res.json(rankings);
  } catch (error) {
    console.error('Error calculating rankings:', error);
    res.status(500).json({ error: 'Failed to calculate rankings' });
  }
});

// Get match history with ranking impacts
app.get('/api/match-history', async (req, res) => {
  try {
    const { player, team, tournament } = req.query;
    const { rankings, matchHistory } = await calculateRankings();
    
    let filteredHistory = matchHistory || [];
    
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
    const { rankings, matchHistory } = await calculateRankings();
    
    const player = rankings.find(p => p.name === playerName);
    if (!player) {
      return res.status(404).json({ error: 'Player not found' });
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
    
    const { rankings, matchHistory } = await calculateTeamRankings();
    
    const team = rankings.find(t => 
      (t.player1 === player1 && t.player2 === player2) ||
      (t.player1 === player2 && t.player2 === player1)
    );
    
    if (!team) {
      return res.status(404).json({ error: 'Team not found' });
    }
    
    // Get team's match history
    const teamMatches = (matchHistory || []).filter(match => {
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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
