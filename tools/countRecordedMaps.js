import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');

const NON_TOURNAMENT_FILES = new Set([
  'player_countries.json',
  'player_defaults.json',
  'seeded_player_rankings.json',
  'seeded_player_seeds.json',
  'seeded_team_rankings.json',
  'seeded_team_seeds.json'
]);

function normalizeMapName(mapName) {
  return String(mapName || '').replace(/\s+/g, ' ').trim();
}

function isEarlyRound(roundName) {
  return /^Early\b/i.test(String(roundName || '').trim());
}

function getValidPlayedMaps(match) {
  const bestOf = Number.isFinite(match.best_of) ? match.best_of : null;
  const team1Score = Number.isFinite(match.team1_score) ? match.team1_score : null;
  const team2Score = Number.isFinite(match.team2_score) ? match.team2_score : null;

  if (bestOf === null || team1Score === null || team2Score === null) {
    return { playedMaps: null, reason: 'missing-score-data' };
  }

  const winsNeeded = Math.floor(bestOf / 2) + 1;
  const playedMaps = team1Score + team2Score;
  const invalid = team1Score < 0
    || team2Score < 0
    || playedMaps < winsNeeded
    || playedMaps > bestOf
    || (team1Score < winsNeeded && team2Score < winsNeeded)
    || (team1Score >= winsNeeded && team2Score >= winsNeeded);

  if (invalid) {
    return { playedMaps: null, reason: 'inconsistent-score-data' };
  }

  return { playedMaps, reason: null };
}

async function loadTournamentFiles() {
  const files = await readdir(outputDir);
  const jsonFiles = files.filter((file) => file.endsWith('.json') && !NON_TOURNAMENT_FILES.has(file));
  const tournaments = [];

  for (const file of jsonFiles) {
    try {
      const content = await readFile(join(outputDir, file), 'utf-8');
      const data = JSON.parse(content);

      if (Array.isArray(data.matches)) {
        tournaments.push({ file, data });
      }
    } catch (error) {
      console.error(`Error reading ${file}:`, error.message);
    }
  }

  return tournaments;
}

function countRecordedMaps(tournaments) {
  const mapCounts = new Map();
  let totalRecordedMapEntries = 0;
  let totalMatchesScanned = 0;
  let excludedEarlyRoundMatches = 0;
  let includedNonEarlyMatches = 0;
  let matchesWithRecordedMapData = 0;
  let matchesWithRecordedMapDataNonEarly = 0;
  let recordedMapEntriesNonEarly = 0;
  let maxPossibleMapSlotsNonEarly = 0;
  let maxPossibleMapSlotsEarly = 0;
  let playedMapsFromValidScoresNonEarly = 0;
  let includedNonEarlyMatchesMissingScores = 0;
  let includedNonEarlyMatchesWithInconsistentScores = 0;

  for (const { data } of tournaments) {
    for (const match of data.matches) {
      totalMatchesScanned += 1;

      const earlyRound = isEarlyRound(match.round);
      const bestOf = Number.isFinite(match.best_of) ? match.best_of : null;
      const { playedMaps, reason } = getValidPlayedMaps(match);

      if (earlyRound) {
        excludedEarlyRoundMatches += 1;
        if (bestOf) maxPossibleMapSlotsEarly += bestOf;
      } else {
        includedNonEarlyMatches += 1;
        if (bestOf) maxPossibleMapSlotsNonEarly += bestOf;
        if (playedMaps !== null) {
          playedMapsFromValidScoresNonEarly += playedMaps;
        } else if (reason === 'missing-score-data') {
          includedNonEarlyMatchesMissingScores += 1;
        } else if (reason === 'inconsistent-score-data') {
          includedNonEarlyMatchesWithInconsistentScores += 1;
        }
      }

      const games = Array.isArray(match.games) ? match.games : [];
      if (games.length > 0) {
        matchesWithRecordedMapData += 1;
        if (!earlyRound) {
          matchesWithRecordedMapDataNonEarly += 1;
        }
      }

      for (const game of games) {
        const mapName = normalizeMapName(game?.map);
        if (!mapName) continue;

        totalRecordedMapEntries += 1;
        if (!earlyRound) {
          recordedMapEntriesNonEarly += 1;
        }
        mapCounts.set(mapName, (mapCounts.get(mapName) || 0) + 1);
      }
    }
  }

  return {
    totalRecordedMapEntries,
    totalMatchesScanned,
    excludedEarlyRoundMatches,
    includedNonEarlyMatches,
    matchesWithRecordedMapData,
    matchesWithRecordedMapDataNonEarly,
    recordedMapEntriesNonEarly,
    maxPossibleMapSlotsNonEarly,
    maxPossibleMapSlotsEarly,
    playedMapsFromValidScoresNonEarly,
    includedNonEarlyMatchesMissingScores,
    includedNonEarlyMatchesWithInconsistentScores,
    rows: Array.from(mapCounts.entries())
      .sort((a, b) => {
        if (b[1] !== a[1]) return b[1] - a[1];
        return a[0].localeCompare(b[0]);
      })
      .map(([map, count]) => ({ map, count }))
  };
}

function printResults(results) {
  const mapWidth = Math.max('Map Name'.length, ...results.rows.map((row) => row.map.length));
  const countWidth = Math.max('Recorded Count'.length, ...results.rows.map((row) => String(row.count).length));
  const scoreBasedCoverage = results.playedMapsFromValidScoresNonEarly > 0
    ? ((results.recordedMapEntriesNonEarly / results.playedMapsFromValidScoresNonEarly) * 100).toFixed(1)
    : '0.0';
  const matchCoverage = results.includedNonEarlyMatches > 0
    ? ((results.matchesWithRecordedMapDataNonEarly / results.includedNonEarlyMatches) * 100).toFixed(1)
    : '0.0';

  console.log(`Total tournament matches scanned: ${results.totalMatchesScanned}`);
  console.log(`Excluded early-round matches: ${results.excludedEarlyRoundMatches}`);
  console.log(`Included non-early matches: ${results.includedNonEarlyMatches}`);
  console.log(`Matches with recorded map data (all scanned matches): ${results.matchesWithRecordedMapData}`);
  console.log(`Matches with recorded map data (included non-early matches): ${results.matchesWithRecordedMapDataNonEarly}`);
  console.log(`Match-level map-data coverage across included non-early matches: ${matchCoverage}%`);
  console.log(`Recorded map entries (all scanned matches): ${results.totalRecordedMapEntries}`);
  console.log(`Recorded map entries (included non-early matches): ${results.recordedMapEntriesNonEarly}`);
  console.log(`Maximum possible map slots in included non-early matches (from best_of): ${results.maxPossibleMapSlotsNonEarly}`);
  console.log(`Maximum possible map slots in excluded early-round matches (from best_of): ${results.maxPossibleMapSlotsEarly}`);
  console.log(`Played maps in included non-early matches with valid scores: ${results.playedMapsFromValidScoresNonEarly}`);
  console.log(`Included non-early matches missing score data: ${results.includedNonEarlyMatchesMissingScores}`);
  console.log(`Included non-early matches with score/best_of inconsistencies: ${results.includedNonEarlyMatchesWithInconsistentScores}`);
  console.log(`Map-entry coverage versus played maps in included non-early matches with valid scores: ${scoreBasedCoverage}%`);
  console.log(`Unique map names with recorded entries: ${results.rows.length}`);
  console.log('');
  console.log(`${'Map Name'.padEnd(mapWidth)}  ${'Recorded Count'.padStart(countWidth)}`);
  console.log(`${'-'.repeat(mapWidth)}  ${'-'.repeat(countWidth)}`);

  for (const row of results.rows) {
    console.log(`${row.map.padEnd(mapWidth)}  ${String(row.count).padStart(countWidth)}`);
  }
}

async function main() {
  const tournaments = await loadTournamentFiles();
  const results = countRecordedMaps(tournaments);
  printResults(results);
}

main().catch((error) => {
  console.error('Failed to count recorded maps:', error);
  process.exit(1);
});