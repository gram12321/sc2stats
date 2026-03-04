import { execSync } from 'child_process';
import { cp, mkdtemp, rm, symlink, writeFile } from 'fs/promises';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath, pathToFileURL } from 'url';

import { calculateRankings } from './processRankings.js';
import { calculateTeamRankings } from './calculateTeamRankings.js';
import { calculateRaceRankings } from './calculateRaceRankings.js';
import { calculateTeamRaceRankings } from './calculateTeamRaceRankings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = join(__dirname, '..');

function percentile(values, p) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  return sorted[idx];
}

function buildRankMap(rankings, keyFn) {
  const rankMap = new Map();
  const pointsMap = new Map();

  rankings.forEach((entry, index) => {
    const key = keyFn(entry);
    rankMap.set(key, index + 1);
    pointsMap.set(key, entry.points ?? 0);
  });

  return { rankMap, pointsMap };
}

function computeChurnMetrics(beforeRankings, afterRankings, keyFn, topN = 10) {
  const { rankMap: beforeRanks, pointsMap: beforePoints } = buildRankMap(beforeRankings, keyFn);
  const { rankMap: afterRanks, pointsMap: afterPoints } = buildRankMap(afterRankings, keyFn);

  const commonKeys = [...beforeRanks.keys()].filter((k) => afterRanks.has(k));
  const rankDeltas = commonKeys.map((k) => beforeRanks.get(k) - afterRanks.get(k));
  const absRankDeltas = rankDeltas.map((d) => Math.abs(d));
  const ratingDeltas = commonKeys.map((k) => (afterPoints.get(k) ?? 0) - (beforePoints.get(k) ?? 0));

  const changedRankCount = absRankDeltas.filter((d) => d > 0).length;

  const topBefore = beforeRankings.slice(0, topN).map(keyFn);
  const topAfter = afterRankings.slice(0, topN).map(keyFn);
  const topWindow = Math.max(1, Math.min(topN, topBefore.length, topAfter.length));
  const topBeforeSet = new Set(topBefore);
  const topAfterSet = new Set(topAfter);

  const topOverlap = topAfter.filter((k) => topBeforeSet.has(k)).length;
  const topEntrants = topAfter.filter((k) => !topBeforeSet.has(k));
  const topDropouts = topBefore.filter((k) => !topAfterSet.has(k));

  let biggestRise = { key: null, delta: 0 };
  let biggestDrop = { key: null, delta: 0 };

  commonKeys.forEach((key) => {
    const delta = beforeRanks.get(key) - afterRanks.get(key);
    if (delta > biggestRise.delta) biggestRise = { key, delta };
    if (delta < biggestDrop.delta) biggestDrop = { key, delta };
  });

  return {
    comparedEntities: commonKeys.length,
    changedRankCount,
    changedRankPct: commonKeys.length ? (changedRankCount / commonKeys.length) * 100 : 0,
    meanAbsRankDelta: commonKeys.length
      ? absRankDeltas.reduce((sum, x) => sum + x, 0) / commonKeys.length
      : 0,
    p95AbsRankDelta: percentile(absRankDeltas, 0.95),
    meanAbsRatingDelta: commonKeys.length
      ? ratingDeltas.reduce((sum, x) => sum + Math.abs(x), 0) / commonKeys.length
      : 0,
    topN,
    topWindow,
    topOverlap,
    topOverlapPct: (topOverlap / topWindow) * 100,
    topEntrants,
    topDropouts,
    biggestRise,
    biggestDrop
  };
}

async function importLegacyModules(tmpRoot) {
  const toolsRoot = join(tmpRoot, 'tools');
  const processModule = await import(pathToFileURL(join(toolsRoot, 'processRankings.js')).href);
  const teamModule = await import(pathToFileURL(join(toolsRoot, 'calculateTeamRankings.js')).href);
  const raceModule = await import(pathToFileURL(join(toolsRoot, 'calculateRaceRankings.js')).href);
  const teamRaceModule = await import(pathToFileURL(join(toolsRoot, 'calculateTeamRaceRankings.js')).href);

  return {
    calculateRankings: processModule.calculateRankings,
    calculateTeamRankings: teamModule.calculateTeamRankings,
    calculateRaceRankings: raceModule.calculateRaceRankings,
    calculateTeamRaceRankings: teamRaceModule.calculateTeamRaceRankings
  };
}

async function buildLegacyWorkspace() {
  const tmpRoot = await mkdtemp(join(tmpdir(), 'sc2stats-churn-'));
  await cp(join(repoRoot, 'tools'), join(tmpRoot, 'tools'), { recursive: true });
  await symlink(join(repoRoot, 'output'), join(tmpRoot, 'output'));

  const legacyRankingCalculations = execSync('git show HEAD:tools/rankingCalculations.js', {
    cwd: repoRoot,
    encoding: 'utf-8'
  });

  await writeFile(join(tmpRoot, 'tools', 'rankingCalculations.js'), legacyRankingCalculations, 'utf-8');
  return tmpRoot;
}

async function run() {
  const config = {
    seeds: null,
    mainCircuitOnly: false,
    seasons: null,
    hideRandom: false
  };

  const tmpRoot = await buildLegacyWorkspace();

  try {
    const legacy = await importLegacyModules(tmpRoot);

    const [beforePlayers, beforeTeams, beforeRaces, beforeTeamRaces] = await Promise.all([
      legacy.calculateRankings(config.seeds, config.mainCircuitOnly, config.seasons),
      legacy.calculateTeamRankings(config.seeds, config.mainCircuitOnly, config.seasons),
      legacy.calculateRaceRankings(config.mainCircuitOnly, config.seasons, config.hideRandom),
      legacy.calculateTeamRaceRankings(config.mainCircuitOnly, config.seasons, config.hideRandom)
    ]);

    const [afterPlayers, afterTeams, afterRaces, afterTeamRaces] = await Promise.all([
      calculateRankings(config.seeds, config.mainCircuitOnly, config.seasons),
      calculateTeamRankings(config.seeds, config.mainCircuitOnly, config.seasons),
      calculateRaceRankings(config.mainCircuitOnly, config.seasons, config.hideRandom),
      calculateTeamRaceRankings(config.mainCircuitOnly, config.seasons, config.hideRandom)
    ]);

    const summary = {
      config,
      playerRankings: computeChurnMetrics(beforePlayers.rankings, afterPlayers.rankings, (x) => x.name),
      teamRankings: computeChurnMetrics(beforeTeams.rankings, afterTeams.rankings, (x) => `${x.player1}+${x.player2}`),
      raceMatchups: computeChurnMetrics(beforeRaces.rankings, afterRaces.rankings, (x) => x.name),
      raceCombined: computeChurnMetrics(beforeRaces.combinedRankings, afterRaces.combinedRankings, (x) => x.name),
      comboMatchups: computeChurnMetrics(beforeTeamRaces.rankings, afterTeamRaces.rankings, (x) => x.name),
      comboCombined: computeChurnMetrics(beforeTeamRaces.combinedRankings, afterTeamRaces.combinedRankings, (x) => x.name)
    };

    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await rm(tmpRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error('Failed to compare churn:', error);
  process.exit(1);
});
