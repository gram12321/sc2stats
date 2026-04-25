import {
  getNewnessKFactor,
  getConfidenceMultiplier,
  applyOpponentNewnessAsymmetry,
  getSeriesOutcomeMultiplier,
  getSeriesScoreMultiplier,
  getScoreReliabilityMultiplier
} from './rankingCalculations.js';

const BASELINE_ESTABLISHED_BASE_K = 32;
const DEFAULT_ESTABLISHED_BASE_K = 24;
const ESTABLISHED_BONUS = 100;

const MATCH_COUNTS = [8, 9, 16, 32, 64];
const CONFIDENCE_LEVELS = [30, 50, 70];
const BEST_OF_VALUES = [3, 5, 7];
const EXPECTED_WIN_VALUES = [0.5, 0.65, 0.8, 0.9];

const RESULT_SHAPES = [
  { key: 'win-close', label: 'Win close', score: (bestOf) => [neededWins(bestOf), neededWins(bestOf) - 1] },
  { key: 'win-sweep', label: 'Win sweep', score: (bestOf) => [neededWins(bestOf), 0] },
  { key: 'loss-close', label: 'Loss close', score: (bestOf) => [neededWins(bestOf) - 1, neededWins(bestOf)] },
  { key: 'loss-sweep', label: 'Loss sweep', score: (bestOf) => [0, neededWins(bestOf)] }
];

function arg(name, fallback = null) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallback;
}

function fmt(n, digits = 2) {
  return Number(n).toFixed(digits);
}

function neededWins(bestOf) {
  return Math.floor(bestOf / 2) + 1;
}

function establishedBaseK(matchCount, establishedBaseK) {
  if (matchCount <= 8) return getNewnessKFactor(matchCount);
  return Math.min(50, establishedBaseK + (ESTABLISHED_BONUS / matchCount));
}

function ratingChange(scenario, establishedBaseKValue) {
  const {
    matchCount,
    confidence,
    opponentMatchCount,
    opponentConfidence,
    expectedWin,
    bestOf,
    score,
    opponentScore
  } = scenario;

  const baseK = establishedBaseK(matchCount, establishedBaseKValue);
  const confidenceMultiplier = getConfidenceMultiplier(confidence, opponentConfidence);
  const confidenceAdjustedK = baseK * confidenceMultiplier;
  const adjustedK = applyOpponentNewnessAsymmetry(
    confidenceAdjustedK,
    matchCount,
    opponentMatchCount
  );

  const outcomeSeriesMultiplier = getSeriesOutcomeMultiplier(bestOf);
  const matchK = adjustedK * outcomeSeriesMultiplier;
  const actualResult = score > opponentScore ? 1 : 0;
  const matchTerm = matchK * (actualResult - expectedWin);

  const mapsPlayed = score + opponentScore;
  const actualScoreShare = score / mapsPlayed;
  const seriesScoreMultiplier = getSeriesScoreMultiplier(bestOf, mapsPlayed);
  const scoreReliabilityMultiplier = getScoreReliabilityMultiplier(
    matchCount,
    opponentMatchCount,
    confidence,
    opponentConfidence
  );
  const scoreWeight = 0.55 * seriesScoreMultiplier * scoreReliabilityMultiplier;
  const scoreK = adjustedK * scoreWeight;
  const scoreTerm = scoreK * (actualScoreShare - expectedWin);
  const total = matchTerm + scoreTerm;

  return {
    total,
    baseK,
    adjustedK,
    confidenceMultiplier,
    outcomeSeriesMultiplier,
    matchTerm,
    scoreTerm,
    scoreWeight,
    scoreK
  };
}

function buildScenarios() {
  const scenarios = [];

  for (const matchCount of MATCH_COUNTS) {
    for (const confidence of CONFIDENCE_LEVELS) {
      for (const bestOf of BEST_OF_VALUES) {
        for (const expectedWin of EXPECTED_WIN_VALUES) {
          for (const resultShape of RESULT_SHAPES) {
            const [score, opponentScore] = resultShape.score(bestOf);
            scenarios.push({
              matchCount,
              opponentMatchCount: matchCount,
              confidence,
              opponentConfidence: confidence,
              bestOf,
              expectedWin,
              resultKey: resultShape.key,
              resultLabel: resultShape.label,
              score,
              opponentScore
            });
          }
        }
      }
    }
  }

  return scenarios;
}

function summarizeByGroup(rows) {
  const groups = new Map();

  for (const row of rows) {
    const key = [
      `m${row.scenario.matchCount}`,
      `c${row.scenario.confidence}`,
      `bo${row.scenario.bestOf}`
    ].join('|');

    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(row);
  }

  return Array.from(groups.entries()).map(([key, groupRows]) => {
    const baselineAbs = groupRows.map((row) => Math.abs(row.baseline.total));
    const candidateAbs = groupRows.map((row) => Math.abs(row.candidate.total));
    const avgBaselineAbs = average(baselineAbs);
    const avgCandidateAbs = average(candidateAbs);

    return {
      key,
      matchCount: groupRows[0].scenario.matchCount,
      confidence: groupRows[0].scenario.confidence,
      bestOf: groupRows[0].scenario.bestOf,
      baselineBaseK: groupRows[0].baseline.baseK,
      candidateBaseK: groupRows[0].candidate.baseK,
      avgBaselineAbs,
      avgCandidateAbs,
      maxBaselineAbs: Math.max(...baselineAbs),
      maxCandidateAbs: Math.max(...candidateAbs),
      avgAbsReductionPct: pctReduction(avgBaselineAbs, avgCandidateAbs),
      maxAbsReductionPct: pctReduction(Math.max(...baselineAbs), Math.max(...candidateAbs))
    };
  });
}

function average(values) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function pctReduction(before, after) {
  if (Math.abs(before) === 0) return 0;
  return ((Math.abs(before) - Math.abs(after)) / Math.abs(before)) * 100;
}

function printBaseKSchedule(candidateEstablishedBaseK) {
  console.log('Base K schedule');
  console.log('matches | baseline | candidate | reduction');

  for (const matchCount of MATCH_COUNTS) {
    const baseline = establishedBaseK(matchCount, BASELINE_ESTABLISHED_BASE_K);
    const candidate = establishedBaseK(matchCount, candidateEstablishedBaseK);
    console.log(
      `${String(matchCount).padStart(7)} | ${fmt(baseline).padStart(8)} | ${fmt(candidate).padStart(9)} | ${fmt(pctReduction(baseline, candidate), 1).padStart(8)}%`
    );
  }
}

function printGroupSummary(summaryRows) {
  console.log('');
  console.log('Scenario matrix summary');
  console.log('Each row averages expected win 50/65/80/90 and close/sweep win/loss shapes.');
  console.log('m | conf | BO | baseK old->new | avg abs old->new | max abs old->new | avg reduction');

  for (const row of summaryRows) {
    console.log(
      [
        String(row.matchCount).padStart(2),
        `${String(row.confidence).padStart(2)}%`,
        `BO${row.bestOf}`,
        `${fmt(row.baselineBaseK)}->${fmt(row.candidateBaseK)}`,
        `${fmt(row.avgBaselineAbs)}->${fmt(row.avgCandidateAbs)}`,
        `${fmt(row.maxBaselineAbs)}->${fmt(row.maxCandidateAbs)}`,
        `${fmt(row.avgAbsReductionPct, 1)}%`
      ].join(' | ')
    );
  }
}

function printTopDampened(rows) {
  console.log('');
  console.log('Largest absolute dampening');
  console.log('m | conf | BO | expected | result | score | total old->new | match term old->new | score term old->new');

  const topRows = rows
    .filter((row) => row.scenario.matchCount >= 9)
    .map((row) => ({
      ...row,
      absReduction: Math.abs(row.baseline.total) - Math.abs(row.candidate.total)
    }))
    .sort((a, b) => b.absReduction - a.absReduction)
    .slice(0, 12);

  for (const row of topRows) {
    const s = row.scenario;
    console.log(
      [
        String(s.matchCount).padStart(2),
        `${String(s.confidence).padStart(2)}%`,
        `BO${s.bestOf}`,
        fmt(s.expectedWin, 2),
        s.resultLabel,
        `${s.score}-${s.opponentScore}`,
        `${fmt(row.baseline.total)}->${fmt(row.candidate.total)}`,
        `${fmt(row.baseline.matchTerm)}->${fmt(row.candidate.matchTerm)}`,
        `${fmt(row.baseline.scoreTerm)}->${fmt(row.candidate.scoreTerm)}`
      ].join(' | ')
    );
  }
}

function run() {
  const candidateEstablishedBaseK = Number(
    arg('established-base-k', arg('candidate-established-base-k', DEFAULT_ESTABLISHED_BASE_K))
  );

  if (!Number.isFinite(candidateEstablishedBaseK) || candidateEstablishedBaseK <= 0) {
    throw new Error('Use --established-base-k=<positive number>');
  }

  console.log(
    `Established K test: baseline=${BASELINE_ESTABLISHED_BASE_K}, candidate=${candidateEstablishedBaseK}, bonus=${ESTABLISHED_BONUS}`
  );
  console.log('Confidence levels: 30%, 50%, 70% (current realistic range)');
  console.log('Opponent is mirrored to the same match count and confidence to isolate established-vs-established pressure.');
  console.log('');

  const rows = buildScenarios().map((scenario) => ({
    scenario,
    baseline: ratingChange(scenario, BASELINE_ESTABLISHED_BASE_K),
    candidate: ratingChange(scenario, candidateEstablishedBaseK)
  }));

  printBaseKSchedule(candidateEstablishedBaseK);
  printGroupSummary(summarizeByGroup(rows));
  printTopDampened(rows);
}

run();
