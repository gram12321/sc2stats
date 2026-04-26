import { mkdir, readFile, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { calculateTeamRankings } from './calculateTeamRankings.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const outputDir = join(__dirname, '..', 'output');

const EPSILON = 1e-9;
const DEFAULT_JSON_REPORT = join(outputDir, 'prediction_quality_report.json');

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function parseSeasons() {
  const raw = arg('seasons', arg('season', null));
  if (!raw) return null;

  const seasons = raw
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  return seasons.length > 0 ? seasons : null;
}

async function loadSeeds() {
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
}

function normalizeTeamKey(player1, player2) {
  return [player1, player2].filter(Boolean).sort().join('+');
}

function clampProbability(value) {
  return Math.min(0.999999, Math.max(0.000001, value));
}

function scoreToActual(teamScore, opponentScore) {
  if (teamScore > opponentScore) return 1;
  if (teamScore < opponentScore) return 0;
  return 0.5;
}

function finiteOr(value, fallback = null) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function mean(values) {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sum(values) {
  return values.reduce((total, value) => total + value, 0);
}

function formatNumber(value, digits = 3) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(digits);
}

function formatPercent(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatPointPct(value, digits = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  const sign = value > 0 ? '+' : '';
  return `${sign}${(value * 100).toFixed(digits)} pp`;
}

function pad(value, width) {
  return String(value).padEnd(width);
}

function favoriteBucket(probability) {
  if (Math.abs(probability - 0.5) <= EPSILON) return 'exact 50%';
  if (probability < 0.6) return '50-60%';
  if (probability < 0.7) return '60-70%';
  if (probability < 0.8) return '70-80%';
  if (probability < 0.9) return '80-90%';
  return '90-100%';
}

function bestOfBucket(bestOf) {
  if (!Number.isFinite(bestOf) || bestOf <= 0) return 'unknown';
  if (bestOf <= 1) return 'BO1';
  if (bestOf <= 3) return 'BO3';
  if (bestOf <= 5) return 'BO5';
  if (bestOf <= 7) return 'BO7';
  return 'BO8+';
}

function maturityBucket(team1PreMatches, team2PreMatches) {
  const minMatches = Math.min(team1PreMatches, team2PreMatches);
  const maxMatches = Math.max(team1PreMatches, team2PreMatches);

  if (maxMatches === 0) return 'both first match';
  if (maxMatches <= 8) return 'both provisional';
  if (minMatches >= 9) return 'both established';
  return 'mixed new/established';
}

function confidenceBucket(team1Confidence, team2Confidence) {
  const avgConfidence = mean([team1Confidence, team2Confidence].filter(Number.isFinite));

  if (avgConfidence === null) return 'unknown';
  if (avgConfidence < 25) return '0-25% avg conf';
  if (avgConfidence < 50) return '25-50% avg conf';
  if (avgConfidence < 75) return '50-75% avg conf';
  return '75-100% avg conf';
}

function predictionSourceBucket(row) {
  return row.itrActive ? 'ITR active' : 'direct ratings';
}

function buildTeamPredictionRows(matchHistory) {
  const rows = [];
  const skipped = [];

  for (const match of matchHistory) {
    const team1Key = normalizeTeamKey(match.team1?.player1, match.team1?.player2);
    const team2Key = normalizeTeamKey(match.team2?.player1, match.team2?.player2);
    const team1Impact = match.team_impacts?.[team1Key];
    const team2Impact = match.team_impacts?.[team2Key];

    if (!team1Impact || !team2Impact || !Number.isFinite(team1Impact.expectedWin)) {
      skipped.push({
        matchId: match.match_id,
        tournament: match.tournament_slug,
        reason: 'missing team impact or expectedWin'
      });
      continue;
    }

    const probability = clampProbability(team1Impact.expectedWin);
    const actual = scoreToActual(match.team1_score, match.team2_score);
    const favoriteSide = Math.abs(probability - 0.5) <= EPSILON
      ? 'none'
      : (probability > 0.5 ? 'team1' : 'team2');
    const favoriteProbability = Math.max(probability, 1 - probability);
    const actualFavorite = favoriteSide === 'none'
      ? null
      : (favoriteSide === 'team1' ? actual : 1 - actual);

    const team1PreMatches = Math.max(0, (Number(team1Impact.matchCount) || 0) - 1);
    const team2PreMatches = Math.max(0, (Number(team2Impact.matchCount) || 0) - 1);
    const team1PreConfidence = Number(team1Impact.rankBeforeConfidence) || 0;
    const team2PreConfidence = Number(team2Impact.rankBeforeConfidence) || 0;
    const bestOf = Number.isFinite(team1Impact.bestOf) ? team1Impact.bestOf : null;
    const team1RatingBefore = finiteOr(team1Impact.ratingBefore, 0);
    const team2RatingBefore = finiteOr(team1Impact.opponentRating, 0);
    const team1EffectiveRating = finiteOr(team1Impact.effectiveRatingUsed, team1RatingBefore);
    const team2EffectiveRating = finiteOr(team1Impact.opponentEffectiveRating, team2RatingBefore);
    const directRatingDelta = Math.abs(team1RatingBefore - team2RatingBefore);
    const effectiveRatingDelta = Math.abs(team1EffectiveRating - team2EffectiveRating);
    const itrActive = Math.abs(effectiveRatingDelta - directRatingDelta) > 0.001
      || Math.abs(team1EffectiveRating - team1RatingBefore) > 0.001
      || Math.abs(team2EffectiveRating - team2RatingBefore) > 0.001;

    rows.push({
      model: 'team',
      matchId: match.match_id,
      tournament: match.tournament_slug,
      tournamentDate: match.tournament_date,
      matchDate: match.match_date,
      round: match.round,
      team1Key,
      team2Key,
      team1Label: `${match.team1?.player1 || '?'} + ${match.team1?.player2 || '?'}`,
      team2Label: `${match.team2?.player1 || '?'} + ${match.team2?.player2 || '?'}`,
      team1Score: match.team1_score,
      team2Score: match.team2_score,
      score: `${match.team1_score}-${match.team2_score}`,
      favoriteScore: favoriteSide === 'team1'
        ? `${match.team1_score}-${match.team2_score}`
        : (favoriteSide === 'team2' ? `${match.team2_score}-${match.team1_score}` : `${match.team1_score}-${match.team2_score}`),
      probability,
      favoriteProbability,
      actual,
      actualFavorite,
      favoriteSide,
      favoriteBucket: favoriteBucket(favoriteProbability),
      bestOf,
      bestOfBucket: bestOfBucket(bestOf),
      team1PreMatches,
      team2PreMatches,
      team1PreConfidence,
      team2PreConfidence,
      maturityBucket: maturityBucket(team1PreMatches, team2PreMatches),
      confidenceBucket: confidenceBucket(team1PreConfidence, team2PreConfidence),
      predictionSource: itrActive ? 'ITR active' : 'direct ratings',
      itrActive,
      brier: Math.pow(probability - actual, 2),
      logLoss: actual === 0.5
        ? null
        : -(actual * Math.log(probability) + (1 - actual) * Math.log(1 - probability))
    });
  }

  return { rows, skipped };
}

function summarizeRows(rows) {
  const nonDrawRows = rows.filter((row) => row.actual !== 0.5);
  const favoriteRows = rows.filter((row) => row.actualFavorite !== null);
  const favoriteDecidedRows = favoriteRows.filter((row) => row.actual !== 0.5);
  const exactTossups = rows.filter((row) => row.favoriteSide === 'none');
  const avgFavoritePrediction = mean(favoriteRows.map((row) => row.favoriteProbability));
  const actualFavoriteWinRate = mean(favoriteRows.map((row) => row.actualFavorite));

  return {
    matches: rows.length,
    draws: rows.length - nonDrawRows.length,
    exactTossups: exactTossups.length,
    favoriteDecidedMatches: favoriteDecidedRows.length,
    brierScore: mean(rows.map((row) => row.brier)),
    logLoss: mean(nonDrawRows.map((row) => row.logLoss).filter(Number.isFinite)),
    avgFavoritePrediction,
    actualFavoriteWinRate,
    calibrationError: actualFavoriteWinRate === null || avgFavoritePrediction === null
      ? null
      : actualFavoriteWinRate - avgFavoritePrediction,
    favoriteAccuracy: mean(favoriteDecidedRows.map((row) => row.actualFavorite)),
    upsetRate: mean(favoriteDecidedRows.map((row) => row.actualFavorite === 0 ? 1 : 0)),
    tossupTeam1WinRate: mean(exactTossups.filter((row) => row.actual !== 0.5).map((row) => row.actual))
  };
}

function groupBy(rows, getKey) {
  const grouped = new Map();

  for (const row of rows) {
    const key = getKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }

  return grouped;
}

function summarizeGroups(rows, getKey, order = null) {
  const grouped = groupBy(rows, getKey);
  const keys = order || Array.from(grouped.keys()).sort();

  return keys
    .filter((key) => grouped.has(key))
    .map((key) => ({
      key,
      ...summarizeRows(grouped.get(key))
    }));
}

function expectedCalibrationError(bucketRows) {
  const usable = bucketRows.filter((row) => row.key !== 'exact 50%' && row.matches > 0 && row.actualFavoriteWinRate !== null);
  const total = sum(usable.map((row) => row.matches));
  if (total === 0) return null;

  return sum(usable.map((row) => Math.abs(row.calibrationError) * row.matches)) / total;
}

function printOverall(summary, ece) {
  console.log('Overall');
  console.log(`  Matches scored: ${summary.matches}`);
  console.log(`  Draws: ${summary.draws}`);
  console.log(`  Exact 50/50 predictions: ${summary.exactTossups}`);
  console.log(`  Brier score: ${formatNumber(summary.brierScore, 4)} (lower is better; 0.2500 is a constant 50/50 baseline)`);
  console.log(`  Log loss: ${formatNumber(summary.logLoss, 4)} (draws excluded)`);
  console.log(`  Favorite pick accuracy: ${formatPercent(summary.favoriteAccuracy)} (${summary.favoriteDecidedMatches} non-draw matches with a favorite)`);
  console.log(`  Avg favorite prediction: ${formatPercent(summary.avgFavoritePrediction)}`);
  console.log(`  Actual favorite win rate: ${formatPercent(summary.actualFavoriteWinRate)}`);
  console.log(`  Calibration gap: ${formatPointPct(summary.calibrationError)}`);
  console.log(`  Broad-bucket ECE: ${formatPointPct(ece)}`);

  if (summary.exactTossups > 0) {
    console.log(`  Exact 50/50 team1 win rate: ${formatPercent(summary.tossupTeam1WinRate)} (team order is not random, so this is diagnostic only)`);
  }
}

function printTable(title, rows) {
  console.log('');
  console.log(title);
  console.log(
    [
      pad('Bucket', 24),
      pad('Matches', 8),
      pad('Avg pred', 10),
      pad('Actual', 10),
      pad('Gap', 11),
      pad('Brier', 8),
      pad('Pick acc', 9)
    ].join(' | ')
  );

  for (const row of rows) {
    console.log(
      [
        pad(row.key, 24),
        pad(row.matches, 8),
        pad(formatPercent(row.avgFavoritePrediction), 10),
        pad(formatPercent(row.actualFavoriteWinRate), 10),
        pad(formatPointPct(row.calibrationError), 11),
        pad(formatNumber(row.brierScore, 4), 8),
        pad(formatPercent(row.favoriteAccuracy), 9)
      ].join(' | ')
    );
  }
}

function printMostConfidentMisses(rows, limit = 10) {
  const misses = rows
    .filter((row) => row.actualFavorite === 0)
    .sort((a, b) => b.favoriteProbability - a.favoriteProbability)
    .slice(0, limit);

  if (misses.length === 0) return;

  console.log('');
  console.log('Most Confident Misses');
  console.log(
    [
      pad('Pred', 7),
      pad('FavScore', 9),
      pad('Favorite', 34),
      pad('Opponent', 34),
      pad('Tournament', 34),
      'Round'
    ].join(' | ')
  );

  for (const row of misses) {
    const favorite = row.favoriteSide === 'team1' ? row.team1Label : row.team2Label;
    const opponent = row.favoriteSide === 'team1' ? row.team2Label : row.team1Label;
    console.log(
      [
        pad(formatPercent(row.favoriteProbability), 7),
        pad(row.favoriteScore, 9),
        pad(favorite.slice(0, 34), 34),
        pad(opponent.slice(0, 34), 34),
        pad(String(row.tournament || '').slice(0, 34), 34),
        row.round || ''
      ].join(' | ')
    );
  }
}

function buildReport(rows, skipped, options, rankingSummary) {
  const bucketRows = summarizeGroups(
    rows,
    (row) => row.favoriteBucket,
    ['exact 50%', '50-60%', '60-70%', '70-80%', '80-90%', '90-100%']
  );

  return {
    generatedAt: new Date().toISOString(),
    model: 'team',
    options,
    rankingSummary,
    skipped,
    overall: {
      ...summarizeRows(rows),
      broadBucketEce: expectedCalibrationError(bucketRows)
    },
    calibrationBuckets: bucketRows,
    breakdowns: {
      bestOf: summarizeGroups(rows, (row) => row.bestOfBucket, ['BO1', 'BO3', 'BO5', 'BO7', 'BO8+', 'unknown']),
      maturity: summarizeGroups(rows, (row) => row.maturityBucket, [
        'both first match',
        'both provisional',
        'mixed new/established',
        'both established'
      ]),
      confidence: summarizeGroups(rows, (row) => row.confidenceBucket, [
        '0-25% avg conf',
        '25-50% avg conf',
        '50-75% avg conf',
        '75-100% avg conf',
        'unknown'
      ]),
      predictionSource: summarizeGroups(rows, (row) => row.predictionSource, ['direct ratings', 'ITR active'])
    },
    mostConfidentMisses: rows
      .filter((row) => row.actualFavorite === 0)
      .sort((a, b) => b.favoriteProbability - a.favoriteProbability)
      .slice(0, 20)
  };
}

async function maybeWriteJson(report) {
  const requestedPath = arg('write-json', hasFlag('write-json') ? DEFAULT_JSON_REPORT : null);
  if (!requestedPath) return null;

  const reportPath = requestedPath === 'true' ? DEFAULT_JSON_REPORT : requestedPath;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf-8');
  return reportPath;
}

export async function analyzePredictionQuality(options = {}) {
  const {
    useSeeds = false,
    mainCircuitOnly = false,
    seasons = null,
    useIntermediateTeamRating = false,
    intermediateFadeMatches = 20
  } = options;

  const teamOptions = {
    useIntermediateTeamRating,
    intermediateFadeMatches: Number.isFinite(intermediateFadeMatches) && intermediateFadeMatches > 0
      ? intermediateFadeMatches
      : 20,
    playerSeeds: null
  };

  let teamSeeds = null;
  if (useSeeds) {
    const seeds = await loadSeeds();
    teamSeeds = seeds.teamSeeds;
    teamOptions.playerSeeds = seeds.playerSeeds;
  }

  const reportOptions = {
    useSeeds,
    mainCircuitOnly,
    seasons: seasons || 'all',
    useIntermediateTeamRating,
    intermediateFadeMatches: teamOptions.intermediateFadeMatches
  };

  const result = await calculateTeamRankings(teamSeeds, mainCircuitOnly, seasons, teamOptions);
  const { rows, skipped } = buildTeamPredictionRows(result.matchHistory);
  return buildReport(rows, skipped, reportOptions, result.summary);
}

async function run() {
  const useSeeds = hasFlag('use-seeds');
  const mainCircuitOnly = hasFlag('main-circuit-only');
  const seasons = parseSeasons();
  const useIntermediateTeamRating = hasFlag('use-intermediate-team-rating');
  const intermediateFadeMatches = Number(arg('intermediate-fade-matches', 20));
  const report = await analyzePredictionQuality({
    useSeeds,
    mainCircuitOnly,
    seasons,
    useIntermediateTeamRating,
    intermediateFadeMatches
  });
  const reportPath = await maybeWriteJson(report);

  console.log('Prediction quality analysis');
  console.log('Model: team pre-match expectedWin from the existing chronological ranking pass');
  console.log(
    `Filters: seasons=${Array.isArray(report.options.seasons) ? report.options.seasons.join(',') : report.options.seasons}, ` +
    `mainCircuitOnly=${mainCircuitOnly}, seeds=${useSeeds ? 'on' : 'off'}, ` +
    `ITR=${useIntermediateTeamRating ? `on(fade=${report.options.intermediateFadeMatches})` : 'off'}`
  );
  console.log('');

  printOverall(report.overall, report.overall.broadBucketEce);
  printTable('Calibration by Favorite Probability', report.calibrationBuckets);
  printTable('Breakdown by Best-of', report.breakdowns.bestOf);
  printTable('Breakdown by Team Maturity', report.breakdowns.maturity);
  printTable('Breakdown by Pre-match Confidence', report.breakdowns.confidence);
  printTable('Breakdown by Prediction Source', report.breakdowns.predictionSource);
  printMostConfidentMisses(report.mostConfidentMisses);

  if (report.skipped.length > 0) {
    console.log('');
    console.log(`Skipped ${report.skipped.length} matches with missing prediction data.`);
  }

  if (reportPath) {
    console.log('');
    console.log(`Wrote JSON report: ${reportPath}`);
  }
}

if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('analyzePredictionQuality.js')) {
  run().catch((error) => {
    console.error('Failed to analyze prediction quality:', error);
    process.exit(1);
  });
}
