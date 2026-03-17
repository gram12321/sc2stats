import { readdir, readFile } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { summarizeMapRecording } from './mapRecordingSummary.js';

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

function printResults(results) {
  const mapWidth = Math.max('Map Name'.length, ...results.rows.map((row) => row.map.length));
  const countWidth = Math.max('Recorded Count'.length, ...results.rows.map((row) => String(row.count).length));

  console.log(`Total tournament matches scanned: ${results.totalMatchesScanned}`);
  console.log(`Excluded early-round matches: ${results.excludedEarlyRoundMatches}`);
  console.log(`Included non-early matches: ${results.includedNonEarlyMatches}`);
  console.log(`Matches with recorded map data (all scanned matches): ${results.matchesWithRecordedMapData}`);
  console.log(`Matches with recorded map data (included non-early matches): ${results.matchesWithRecordedMapDataNonEarly}`);
  console.log(`Match-level map-data coverage across included non-early matches: ${results.matchLevelCoverageNonEarly}%`);
  console.log(`Recorded map entries (all scanned matches): ${results.totalRecordedMapEntries}`);
  console.log(`Recorded map entries (included non-early matches): ${results.recordedMapEntriesNonEarly}`);
  console.log(`Maximum possible map slots in included non-early matches (from best_of): ${results.maxPossibleMapSlotsNonEarly}`);
  console.log(`Maximum possible map slots in excluded early-round matches (from best_of): ${results.maxPossibleMapSlotsEarly}`);
  console.log(`Played maps in included non-early matches with valid scores: ${results.playedMapsFromValidScoresNonEarly}`);
  console.log(`Included non-early matches missing score data: ${results.includedNonEarlyMatchesMissingScores}`);
  console.log(`Included non-early matches with score/best_of inconsistencies: ${results.includedNonEarlyMatchesWithInconsistentScores}`);
  console.log(`Map-entry coverage versus played maps in included non-early matches with valid scores: ${results.mapEntryCoverageVsPlayedNonEarly}%`);
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
  const results = summarizeMapRecording(tournaments.map(({ data }) => data));
  printResults(results);
}

main().catch((error) => {
  console.error('Failed to count recorded maps:', error);
  process.exit(1);
});