import express from 'express';
import { readdir, readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import cors from 'cors';

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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`API server running on http://localhost:${PORT}`);
});
