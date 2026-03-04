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
const playerCountriesFile = join(outputDir, 'player_countries.json');
const metadataJsonFiles = new Set(['player_defaults.json', 'player_countries.json']);

function isTournamentJsonFile(fileName) {
  return fileName.endsWith('.json') && !metadataJsonFiles.has(fileName) && !fileName.startsWith('seeded_');
}

function normalizeCountryCode(country) {
  if (!country) return null;
  const normalized = String(country).trim().toUpperCase();
  return /^[A-Z]{2}$/.test(normalized) ? normalized : null;
}

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

const versionLogPath = join(__dirname, '..', 'docs', 'versionlog.md');

function normalizePlayerNameForSimilarity(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function shouldReplacePlayerName(currentName, fromName, toName) {
  if (typeof currentName !== 'string') return false;

  if (currentName === fromName) {
    return currentName !== toName;
  }

  const isWhitespaceVariantMerge = fromName === toName;
  if (!isWhitespaceVariantMerge) {
    return false;
  }

  return currentName !== toName && currentName.trimEnd() === toName;
}

function extractPlayerCountriesFromTournamentData(tournamentData, target = {}) {
  if (!tournamentData?.matches || !Array.isArray(tournamentData.matches)) {
    return target;
  }

  tournamentData.matches.forEach((match) => {
    const players = [
      match?.team1?.player1,
      match?.team1?.player2,
      match?.team2?.player1,
      match?.team2?.player2
    ];

    players.forEach((player) => {
      if (!player?.name) return;
      const code = normalizeCountryCode(player?.country || player?.nation || player?.flag);
      if (code && !target[player.name]) {
        target[player.name] = code;
      }
    });
  });

  return target;
}

async function loadStoredPlayerCountries() {
  try {
    const content = await readFile(playerCountriesFile, 'utf-8');
    const parsed = JSON.parse(content);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {};

    const normalized = {};
    Object.entries(parsed).forEach(([name, country]) => {
      const code = normalizeCountryCode(country);
      if (code) normalized[name] = code;
    });
    return normalized;
  } catch (err) {
    if (err.code === 'ENOENT') return {};
    throw err;
  }
}

async function loadScrapedPlayerCountries() {
  const countries = {};
  const files = await readdir(outputDir);
  const tournamentFiles = files.filter(isTournamentJsonFile);

  for (const file of tournamentFiles) {
    try {
      const filePath = join(outputDir, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);
      extractPlayerCountriesFromTournamentData(data, countries);
    } catch (err) {
      console.error(`Error reading ${file} for scraped countries:`, err);
    }
  }

  return countries;
}

function replacePlayerInTournamentData(tournamentData, fromName, toName) {
  if (!tournamentData?.matches || !Array.isArray(tournamentData.matches)) {
    return { changed: false, replacements: 0 };
  }

  let replacements = 0;

  tournamentData.matches.forEach((match) => {
    const players = [
      match?.team1?.player1,
      match?.team1?.player2,
      match?.team2?.player1,
      match?.team2?.player2
    ];

    players.forEach((player) => {
      if (shouldReplacePlayerName(player?.name, fromName, toName)) {
        player.name = toName;
        replacements += 1;
      }
    });
  });

  return { changed: replacements > 0, replacements };
}

function replacePlayerInSeededPlayerSeeds(data, fromName, toName) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { changed: false, replacements: 0, updated: data };
  }

  const updated = { ...data };
  const sourceKeys = Object.keys(updated).filter((key) => shouldReplacePlayerName(key, fromName, toName));

  if (sourceKeys.length === 0) {
    return { changed: false, replacements: 0, updated: data };
  }

  sourceKeys.forEach((sourceKey) => {
    if (!(toName in updated)) {
      updated[toName] = updated[sourceKey];
    }
    delete updated[sourceKey];
  });

  return { changed: true, replacements: sourceKeys.length, updated };
}

function replacePlayerInSeededTeamSeeds(data, fromName, toName) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { changed: false, replacements: 0, updated: data };
  }

  let replacements = 0;
  const updated = {};

  Object.entries(data).forEach(([teamKey, value]) => {
    const [p1, p2] = teamKey.split('+');
    if (!p1 || !p2) {
      updated[teamKey] = value;
      return;
    }

    const nextP1 = shouldReplacePlayerName(p1, fromName, toName) ? toName : p1;
    const nextP2 = shouldReplacePlayerName(p2, fromName, toName) ? toName : p2;
    if (nextP1 !== p1 || nextP2 !== p2) {
      replacements += (nextP1 !== p1 ? 1 : 0) + (nextP2 !== p2 ? 1 : 0);
    }

    const nextKey = [nextP1, nextP2].sort().join('+');
    if (!(nextKey in updated)) {
      updated[nextKey] = value;
    }
  });

  return { changed: replacements > 0, replacements, updated };
}

function replacePlayerInSeededPlayerRankings(data, fromName, toName) {
  if (!Array.isArray(data)) {
    return { changed: false, replacements: 0, updated: data };
  }

  let replacements = 0;
  const updated = data.map((row) => {
    if (shouldReplacePlayerName(row?.name, fromName, toName)) {
      replacements += 1;
      return { ...row, name: toName };
    }
    return row;
  });

  return { changed: replacements > 0, replacements, updated };
}

function replacePlayerInSeededTeamRankings(data, fromName, toName) {
  if (!Array.isArray(data)) {
    return { changed: false, replacements: 0, updated: data };
  }

  let replacements = 0;
  const updated = data.map((row) => {
    const nextPlayer1 = shouldReplacePlayerName(row?.player1, fromName, toName) ? toName : row?.player1;
    const nextPlayer2 = shouldReplacePlayerName(row?.player2, fromName, toName) ? toName : row?.player2;

    if (nextPlayer1 !== row?.player1 || nextPlayer2 !== row?.player2) {
      replacements += (nextPlayer1 !== row?.player1 ? 1 : 0) + (nextPlayer2 !== row?.player2 ? 1 : 0);
      return { ...row, player1: nextPlayer1, player2: nextPlayer2 };
    }

    return row;
  });

  return { changed: replacements > 0, replacements, updated };
}

// Version log (for topbar version + view in app)
app.get('/api/versionlog', async (req, res) => {
  try {
    const content = await readFile(versionLogPath, 'utf-8');
    res.type('text/plain').send(content);
  } catch (err) {
    console.error('Error reading version log:', err);
    res.status(500).send('Version log unavailable.');
  }
});

// List all JSON files in output directory
app.get('/api/tournaments', async (req, res) => {
  try {
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(isTournamentJsonFile);

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
    const jsonFiles = files.filter((file) => file.endsWith('.json') && !metadataJsonFiles.has(file));

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

// Get teammate history per player across all tournaments
app.get('/api/player-teammates', async (req, res) => {
  try {
    const files = await readdir(outputDir);
    const jsonFiles = files.filter(isTournamentJsonFile);

    const teammateCounts = new Map();

    const addPair = (playerA, playerB) => {
      if (!playerA || !playerB || playerA === playerB) return;

      if (!teammateCounts.has(playerA)) {
        teammateCounts.set(playerA, new Map());
      }

      const currentCount = teammateCounts.get(playerA).get(playerB) || 0;
      teammateCounts.get(playerA).set(playerB, currentCount + 1);
    };

    for (const file of jsonFiles) {
      try {
        const filePath = join(outputDir, file);
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);

        if (!Array.isArray(data?.matches)) continue;

        data.matches.forEach((match) => {
          const t1p1 = match.team1?.player1?.name;
          const t1p2 = match.team1?.player2?.name;
          const t2p1 = match.team2?.player1?.name;
          const t2p2 = match.team2?.player2?.name;

          addPair(t1p1, t1p2);
          addPair(t1p2, t1p1);
          addPair(t2p1, t2p2);
          addPair(t2p2, t2p1);
        });
      } catch (err) {
        console.error(`Error reading ${file} for teammate history:`, err);
      }
    }

    const teammates = {};
    teammateCounts.forEach((counts, player) => {
      teammates[player] = Array.from(counts.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .map(([teammate]) => teammate);
    });

    res.json({ teammates });
  } catch (error) {
    console.error('Error getting player teammate history:', error);
    res.status(500).json({ error: 'Failed to get player teammate history' });
  }
});

app.post('/api/players/rename', async (req, res) => {
  try {
    const fromName = String(req.body?.fromName || '');
    const toName = String(req.body?.toName || '').trim();
    const fromNameTrimmed = fromName.trim();

    if (!fromNameTrimmed || !toName) {
      return res.status(400).json({ error: 'Both fromName and toName are required' });
    }

    const isWhitespaceVariantMerge = fromName === toName;

    const fromNormalized = normalizePlayerNameForSimilarity(fromNameTrimmed);
    const toNormalized = normalizePlayerNameForSimilarity(toName);

    if (!fromNormalized || !toNormalized) {
      return res.status(400).json({ error: 'Names must include at least one letter or number' });
    }

    const files = await readdir(outputDir);
    const tournamentFiles = files.filter(isTournamentJsonFile);

    let filesUpdated = 0;
    let replacements = 0;

    for (const file of tournamentFiles) {
      const filePath = join(outputDir, file);
      const content = await readFile(filePath, 'utf-8');
      const data = JSON.parse(content);

      const result = replacePlayerInTournamentData(data, fromName, toName);
      if (result.changed) {
        await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
        filesUpdated += 1;
        replacements += result.replacements;
      }
    }

    let defaultsUpdated = false;
    try {
      const defaultsContent = await readFile(playerDefaultsFile, 'utf-8');
      const defaults = JSON.parse(defaultsContent);

      const defaultSourceKeys = Object.keys(defaults).filter((key) => shouldReplacePlayerName(key, fromName, toName));
      if (defaultSourceKeys.length > 0) {
        defaultSourceKeys.forEach((sourceKey) => {
          if (!Object.prototype.hasOwnProperty.call(defaults, toName)) {
            defaults[toName] = defaults[sourceKey];
          }
          delete defaults[sourceKey];
        });
        await writeFile(playerDefaultsFile, JSON.stringify(defaults, null, 2), 'utf-8');
        defaultsUpdated = true;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    let countriesUpdated = false;
    try {
      const countriesContent = await readFile(playerCountriesFile, 'utf-8');
      const countries = JSON.parse(countriesContent);

      const countrySourceKeys = Object.keys(countries).filter((key) => shouldReplacePlayerName(key, fromName, toName));
      if (countrySourceKeys.length > 0) {
        countrySourceKeys.forEach((sourceKey) => {
          if (!Object.prototype.hasOwnProperty.call(countries, toName)) {
            countries[toName] = countries[sourceKey];
          }
          delete countries[sourceKey];
        });
        await writeFile(playerCountriesFile, JSON.stringify(countries, null, 2), 'utf-8');
        countriesUpdated = true;
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    const seededUpdaters = [
      {
        filename: 'seeded_player_seeds.json',
        updater: replacePlayerInSeededPlayerSeeds
      },
      {
        filename: 'seeded_team_seeds.json',
        updater: replacePlayerInSeededTeamSeeds
      },
      {
        filename: 'seeded_player_rankings.json',
        updater: replacePlayerInSeededPlayerRankings
      },
      {
        filename: 'seeded_team_rankings.json',
        updater: replacePlayerInSeededTeamRankings
      }
    ];

    let seededFilesUpdated = 0;
    let seededReplacements = 0;

    for (const item of seededUpdaters) {
      const filePath = join(outputDir, item.filename);
      try {
        const content = await readFile(filePath, 'utf-8');
        const data = JSON.parse(content);
        const result = item.updater(data, fromName, toName);
        if (result.changed) {
          await writeFile(filePath, JSON.stringify(result.updated, null, 2), 'utf-8');
          seededFilesUpdated += 1;
          seededReplacements += result.replacements;
        }
      } catch (err) {
        if (err.code !== 'ENOENT') {
          console.error(`Error updating ${item.filename}:`, err);
        }
      }
    }

    if (replacements === 0 && seededReplacements === 0 && !defaultsUpdated && !countriesUpdated) {
      if (isWhitespaceVariantMerge) {
        return res.status(404).json({ error: `No trailing-whitespace variants found for "${toName}"` });
      }
      return res.status(404).json({ error: `Player "${fromName}" was not found` });
    }

    res.json({
      success: true,
      fromName,
      toName,
      filesUpdated,
      replacements,
      defaultsUpdated,
      countriesUpdated,
      seededFilesUpdated,
      seededReplacements
    });
  } catch (error) {
    console.error('Error renaming player:', error);
    res.status(500).json({ error: 'Failed to rename player' });
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

// Get player countries (stored overrides + scraped fallbacks)
app.get('/api/player-countries', async (req, res) => {
  try {
    const [stored, scraped] = await Promise.all([
      loadStoredPlayerCountries(),
      loadScrapedPlayerCountries()
    ]);

    // Stored values override scraped defaults
    res.json({ ...scraped, ...stored });
  } catch (error) {
    console.error('Error getting player countries:', error);
    res.status(500).json({ error: 'Failed to get player countries' });
  }
});

// Update single player country
app.put('/api/player-countries/:playerName', async (req, res) => {
  try {
    const playerName = decodeURIComponent(req.params.playerName);
    const country = normalizeCountryCode(req.body?.country);

    let countries = {};
    try {
      const content = await readFile(playerCountriesFile, 'utf-8');
      countries = JSON.parse(content);
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }

    if (!country) {
      delete countries[playerName];
    } else {
      countries[playerName] = country;
    }

    await mkdir(outputDir, { recursive: true });
    await writeFile(playerCountriesFile, JSON.stringify(countries, null, 2), 'utf-8');

    res.json({ success: true });
  } catch (error) {
    console.error('Error updating player country:', error);
    res.status(500).json({ error: 'Failed to update player country' });
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

// Get team ranks at tournament context (rank before each team's first scored match in that tournament)
app.get('/api/tournament-team-rankings/:slug', async (req, res) => {
  try {
    const tournamentSlug = decodeURIComponent(req.params.slug);
    const useSeeds = req.query.useSeeds === 'true';
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;

    let teamSeeds = null;
    if (useSeeds) {
      const seeds = await loadSeeds();
      teamSeeds = seeds.teamSeeds;
    }

    const { matchHistory } = await calculateTeamRankings(teamSeeds, isMainCircuitOnly, seasons);

    const tournamentMatches = (matchHistory || [])
      .filter(match => match.tournament_slug === tournamentSlug)
      .sort((a, b) => {
        const dateA = new Date(a.match_date || a.tournament_date || 0).getTime();
        const dateB = new Date(b.match_date || b.tournament_date || 0).getTime();
        if (dateA !== dateB) return dateA - dateB;
        return (a.match_id || '').localeCompare(b.match_id || '');
      });

    const rankMap = {};

    for (const match of tournamentMatches) {
      const impacts = match.team_impacts || {};
      for (const [teamKey, impact] of Object.entries(impacts)) {
        if (rankMap[teamKey] !== undefined) continue;

        const rawRank = impact?.rankBefore;
        const parsedRank = typeof rawRank === 'number'
          ? rawRank
          : parseInt(String(rawRank), 10);

        if (!Number.isNaN(parsedRank) && parsedRank > 0) {
          rankMap[teamKey] = parsedRank;
        }
      }
    }

    res.json({
      tournament_slug: tournamentSlug,
      basis: 'rank-before-first-scored-match',
      ranks: rankMap
    });
  } catch (error) {
    console.error('Error getting tournament team rankings:', error);
    res.status(500).json({ error: 'Failed to get tournament team rankings' });
  }
});

// Get seeded player rankings (from three-pass seeding process)
app.get('/api/seeded-player-rankings', async (req, res) => {
  try {
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;

    const seededRankingsFile = join(outputDir, 'seeded_player_rankings.json');
    try {
      // Load seeds for recalculation
      const { playerSeeds } = await loadSeeds();

      // If filtering is needed, recalculate with filters and seeds
      if (isMainCircuitOnly || (seasons && seasons.length > 0)) {
        const { rankings } = await calculateRankings(playerSeeds, isMainCircuitOnly, seasons);
        res.json(rankings);
      } else {
        // No filtering, return pre-calculated results
        const content = await readFile(seededRankingsFile, 'utf-8');
        const rankings = JSON.parse(content);
        res.json(rankings);
      }
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
    const isMainCircuitOnly = req.query.mainCircuitOnly === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;

    const seededRankingsFile = join(outputDir, 'seeded_team_rankings.json');
    try {
      // Load seeds for recalculation
      const { teamSeeds } = await loadSeeds();

      // If filtering is needed, recalculate with filters and seeds
      if (isMainCircuitOnly || (seasons && seasons.length > 0)) {
        const { rankings } = await calculateTeamRankings(teamSeeds, isMainCircuitOnly, seasons);
        res.json(rankings);
      } else {
        // No filtering, return pre-calculated results
        const content = await readFile(seededRankingsFile, 'utf-8');
        const rankings = JSON.parse(content);
        res.json(rankings);
      }
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, combinedRankings, matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons, hideRandom);
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons, hideRandom);
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons, hideRandom);
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { rankings, combinedRankings, matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons, hideRandom);
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons, hideRandom);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: raceMatchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons, hideRandom);

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

    const raceMatchMap = new Map();
    if (raceMatchHistory) {
      raceMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        raceMatchMap.set(key, match);
      });
    }
    // Note: matchHistory from calculateTeamRaceRankings already contains combo_impacts
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
      const raceMatch = raceMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts,
        race_impacts: raceMatch?.race_impacts || null,
        combo_impacts: match.combo_impacts || null
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
    const hideRandom = req.query.hideRandom === 'true';
    const seasons = req.query.seasons ? req.query.seasons.split(',') : null;
    const { matchHistory } = await calculateTeamRaceRankings(isMainCircuitOnly, seasons, hideRandom);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: playerMatchHistory } = await calculateRankings(null, isMainCircuitOnly, seasons);
    const { matchHistory: raceMatchHistory } = await calculateRaceRankings(isMainCircuitOnly, seasons, hideRandom);

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

    const raceMatchMap = new Map();
    if (raceMatchHistory) {
      raceMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        raceMatchMap.set(key, match);
      });
    }

    // Note: matchHistory from calculateTeamRaceRankings already contains combo_impacts

    // Filter matches where either team1_combo or team2_combo matches the combo and merge team_impacts and player_impacts
    const matches = matchHistory.filter(match => {
      return match.team1_combo === combo || match.team2_combo === combo;
    }).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const playerMatch = playerMatchMap.get(key);
      const raceMatch = raceMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts,
        player_impacts: playerMatch?.player_impacts || match.player_impacts,
        race_impacts: raceMatch?.race_impacts || null,
        combo_impacts: match.combo_impacts || null
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
    const hideRandom = req.query.hideRandom === 'true';
    const { rankings, matchHistory } = await calculateRankings(playerSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(teamSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: raceMatchHistory } = await calculateRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);
    const { matchHistory: comboMatchHistory } = await calculateTeamRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);

    // Create a map of team match history by match_id for quick lookup
    const teamMatchMap = new Map();
    if (teamMatchHistory) {
      teamMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        teamMatchMap.set(key, match);
      });
    }

    // Create a map of race match history by match_id for quick lookup
    const raceMatchMap = new Map();
    if (raceMatchHistory) {
      raceMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        raceMatchMap.set(key, match);
      });
    }
    const comboMatchMap = new Map();
    if (comboMatchHistory) {
      comboMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        comboMatchMap.set(key, match);
      });
    }
    // Merge team_impacts and race_impacts into match history
    let filteredHistory = (matchHistory || []).map(match => {
      const key = `${match.tournament_slug}-${match.match_id}`;
      const teamMatch = teamMatchMap.get(key);
      const raceMatch = raceMatchMap.get(key);
      const comboMatch = comboMatchMap.get(key);
      return {
        ...match,
        team_impacts: teamMatch?.team_impacts || match.team_impacts,
        race_impacts: raceMatch?.race_impacts || null,
        combo_impacts: comboMatch?.combo_impacts || null
      };
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
    const hideRandom = req.query.hideRandom === 'true';
    const { rankings, matchHistory } = await calculateRankings(playerSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: teamMatchHistory } = await calculateTeamRankings(teamSeeds, req.query.mainCircuitOnly === 'true', seasons);
    const { matchHistory: raceMatchHistory } = await calculateRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);
    const { matchHistory: comboMatchHistory } = await calculateTeamRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);

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

    // Create a map of race match history by match_id for quick lookup
    const raceMatchMap = new Map();
    if (raceMatchHistory) {
      raceMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        raceMatchMap.set(key, match);
      });
    }

    // Create a map of combo match history by match_id for quick lookup
    const comboMatchMap = new Map();
    if (comboMatchHistory) {
      comboMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        comboMatchMap.set(key, match);
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
      const raceMatch = raceMatchMap.get(key);
      const comboMatch = comboMatchMap.get(key);
      return {
        ...match,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        isDraw: impact?.isDraw || false,
        opponentRating: impact?.opponentRating || 0,
        team_impacts: teamMatch?.team_impacts || match.team_impacts,
        race_impacts: raceMatch?.race_impacts || null,
        combo_impacts: comboMatch?.combo_impacts || null
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
    const hideRandom = req.query.hideRandom === 'true';
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
    const { matchHistory: raceMatchHistory } = await calculateRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);
    const { matchHistory: comboMatchHistory } = await calculateTeamRaceRankings(req.query.mainCircuitOnly === 'true', seasons, hideRandom);
    const playerMatchMap = new Map();
    if (playerMatchHistory) {
      playerMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        playerMatchMap.set(key, match);
      });
    }

    // Create a map of race match history by match_id for quick lookup
    const raceMatchMap = new Map();
    if (raceMatchHistory) {
      raceMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        raceMatchMap.set(key, match);
      });
    }

    // Create a map of combo match history by match_id for quick lookup
    const comboMatchMap = new Map();
    if (comboMatchHistory) {
      comboMatchHistory.forEach(match => {
        const key = `${match.tournament_slug}-${match.match_id}`;
        comboMatchMap.set(key, match);
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
      const raceMatch = raceMatchMap.get(key);
      const comboMatch = comboMatchMap.get(key);
      return {
        ...match,
        // Merge race data from playerMatch if available
        team1: playerMatch?.team1 || match.team1,
        team2: playerMatch?.team2 || match.team2,
        ratingChange: impact?.ratingChange || 0,
        won: impact?.won || false,
        isDraw: impact?.isDraw || false,
        opponentRating: impact?.opponentRating || 0,
        player_impacts: playerMatch?.player_impacts || match.player_impacts,
        race_impacts: raceMatch?.race_impacts || null,
        combo_impacts: comboMatch?.combo_impacts || null
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
