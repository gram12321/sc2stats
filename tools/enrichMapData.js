#!/usr/bin/env node

import { readdir, readFile, writeFile } from 'fs/promises';
import { join, dirname, basename, isAbsolute } from 'path';
import { fileURLToPath } from 'url';
import { scrapeTournament } from './scraper.js';

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

function isTournamentJsonFile(fileName) {
  return fileName.endsWith('.json') && !NON_TOURNAMENT_FILES.has(fileName);
}

function normalizeDate(dateValue) {
  return String(dateValue || '').replace(/\s+/g, ' ').trim();
}

function normalizeTeamKey(team) {
  const names = [team?.player1?.name, team?.player2?.name]
    .filter(Boolean)
    .map((name) => String(name).trim())
    .sort((a, b) => a.localeCompare(b));

  return names.join('+');
}

function buildMatchSignature(match) {
  return [
    String(match?.round || '').trim(),
    normalizeTeamKey(match?.team1),
    normalizeTeamKey(match?.team2),
    normalizeDate(match?.date)
  ].join('|');
}

function gamesEqual(existingGames, scrapedGames) {
  if (existingGames.length !== scrapedGames.length) return false;
  return existingGames.every((game, index) => {
    const scraped = scrapedGames[index];
    return game?.map === scraped?.map && game?.winner === scraped?.winner;
  });
}

function isPrefixMatch(existingGames, scrapedGames) {
  if (existingGames.length >= scrapedGames.length) return false;
  return existingGames.every((game, index) => {
    const scraped = scrapedGames[index];
    return game?.map === scraped?.map && game?.winner === scraped?.winner;
  });
}

function indexScrapedMatches(matches) {
  const byId = new Map();
  const bySignature = new Map();

  for (const match of matches) {
    if (match?.match_id) {
      byId.set(match.match_id, match);
    }
    bySignature.set(buildMatchSignature(match), match);
  }

  return { byId, bySignature };
}

function mergeTournamentMapData(existingData, scrapedData) {
  const { byId, bySignature } = indexScrapedMatches(scrapedData.matches || []);
  const updatedMatches = [];
  const report = {
    matchedById: 0,
    matchedBySignature: 0,
    unmatched: 0,
    filledEmptyGames: 0,
    appendedGames: 0,
    unchangedExistingGames: 0,
    noScrapedGames: 0,
    conflicts: 0,
    tournamentMapsFilled: false,
    conflictMatches: []
  };

  const existingTournamentMaps = Array.isArray(existingData?.tournament?.maps)
    ? existingData.tournament.maps
    : [];
  const scrapedTournamentMaps = Array.isArray(scrapedData?.tournament?.maps)
    ? scrapedData.tournament.maps
    : [];

  const updatedTournament = { ...(existingData.tournament || {}) };
  if (existingTournamentMaps.length === 0 && scrapedTournamentMaps.length > 0) {
    updatedTournament.maps = scrapedTournamentMaps;
    report.tournamentMapsFilled = true;
  }

  for (const existingMatch of existingData.matches || []) {
    let scrapedMatch = null;

    if (existingMatch?.match_id && byId.has(existingMatch.match_id)) {
      scrapedMatch = byId.get(existingMatch.match_id);
      report.matchedById += 1;
    } else {
      const signature = buildMatchSignature(existingMatch);
      if (bySignature.has(signature)) {
        scrapedMatch = bySignature.get(signature);
        report.matchedBySignature += 1;
      }
    }

    if (!scrapedMatch) {
      report.unmatched += 1;
      updatedMatches.push(existingMatch);
      continue;
    }

    const existingGames = Array.isArray(existingMatch.games) ? existingMatch.games : [];
    const scrapedGames = Array.isArray(scrapedMatch.games) ? scrapedMatch.games : [];

    if (scrapedGames.length === 0) {
      report.noScrapedGames += 1;
      updatedMatches.push(existingMatch);
      continue;
    }

    if (existingGames.length === 0) {
      report.filledEmptyGames += 1;
      updatedMatches.push({ ...existingMatch, games: scrapedGames });
      continue;
    }

    if (gamesEqual(existingGames, scrapedGames)) {
      report.unchangedExistingGames += 1;
      updatedMatches.push(existingMatch);
      continue;
    }

    if (isPrefixMatch(existingGames, scrapedGames)) {
      report.appendedGames += 1;
      updatedMatches.push({
        ...existingMatch,
        games: [...existingGames, ...scrapedGames.slice(existingGames.length)]
      });
      continue;
    }

    report.conflicts += 1;
    if (report.conflictMatches.length < 20) {
      report.conflictMatches.push({
        match_id: existingMatch.match_id,
        round: existingMatch.round,
        existingGames: existingGames.length,
        scrapedGames: scrapedGames.length
      });
    }
    updatedMatches.push(existingMatch);
  }

  return {
    updatedData: {
      ...existingData,
      tournament: updatedTournament,
      matches: updatedMatches
    },
    report
  };
}

function buildLiquipediaUrl(slug) {
  return `https://liquipedia.net/starcraft2/${slug}`;
}

async function resolveTargetFiles(args) {
  if (args.includes('--all')) {
    const files = await readdir(outputDir);
    return files.filter(isTournamentJsonFile).map((fileName) => join(outputDir, fileName));
  }

  const targetArg = args.find((arg) => !arg.startsWith('--'));
  if (!targetArg) {
    throw new Error('Usage: node tools/enrichMapData.js <tournament-file.json|--all> [--write]');
  }

  if (isAbsolute(targetArg)) {
    return [targetArg];
  }

  return [join(outputDir, basename(targetArg))];
}

function printFileReport(filePath, report, writeMode) {
  const name = basename(filePath);
  const action = writeMode ? 'updated' : 'dry-run';

  console.log(`\n${name} (${action})`);
  console.log(`  matched by id: ${report.matchedById}`);
  console.log(`  matched by signature: ${report.matchedBySignature}`);
  console.log(`  filled empty games: ${report.filledEmptyGames}`);
  console.log(`  appended games: ${report.appendedGames}`);
  console.log(`  unchanged existing games: ${report.unchangedExistingGames}`);
  console.log(`  no scraped games: ${report.noScrapedGames}`);
  console.log(`  unmatched matches: ${report.unmatched}`);
  console.log(`  conflicts skipped: ${report.conflicts}`);
  if (report.tournamentMapsFilled) {
    console.log('  tournament map pool filled');
  }
  for (const conflict of report.conflictMatches) {
    console.log(`  conflict ${conflict.match_id} (${conflict.round}): existing ${conflict.existingGames}, scraped ${conflict.scrapedGames}`);
  }
}

async function enrichFile(filePath, writeMode) {
  const content = await readFile(filePath, 'utf-8');
  const existingData = JSON.parse(content);
  const slug = existingData?.tournament?.liquipedia_slug;

  if (!slug) {
    throw new Error(`${basename(filePath)} is missing tournament.liquipedia_slug`);
  }

  const scrapedData = await scrapeTournament(buildLiquipediaUrl(slug));
  const { updatedData, report } = mergeTournamentMapData(existingData, scrapedData);

  if (writeMode) {
    const changed = report.filledEmptyGames > 0 || report.appendedGames > 0 || report.tournamentMapsFilled;
    if (changed) {
      await writeFile(filePath, JSON.stringify(updatedData, null, 2), 'utf-8');
    }
  }

  return report;
}

async function main() {
  const args = process.argv.slice(2);
  const writeMode = args.includes('--write');
  const targetFiles = await resolveTargetFiles(args);

  if (!writeMode) {
    console.log('Dry run mode: no files will be modified. Pass --write to apply map-only enrichment.');
  }

  for (const filePath of targetFiles) {
    const report = await enrichFile(filePath, writeMode);
    printFileReport(filePath, report, writeMode);
  }
}

main().catch((error) => {
  console.error('Failed to enrich map data:', error.message);
  process.exit(1);
});
