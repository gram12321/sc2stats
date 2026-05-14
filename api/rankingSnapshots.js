import { sortRankings } from '../tools/rankingUtils.js';

function normalizeRound(round) {
  const value = typeof round === 'string' ? round.trim() : '';
  return value || 'Unknown round';
}

function getMatchGroup(match) {
  const tournamentSlug = match?.tournament_slug || 'unknown';
  const round = normalizeRound(match?.round);

  return {
    tournamentSlug,
    round,
    key: `${tournamentSlug}::${round}`
  };
}

function getMatchDate(match) {
  return match?.match_date || match?.tournament_date || null;
}

function getImpactAfterRating(impact) {
  return (Number(impact?.ratingBefore) || 0) + (Number(impact?.ratingChange) || 0);
}

function updateOutcomeStats(row, impact) {
  row.matches += 1;

  if (impact?.isDraw === true) {
    row.draws += 1;
  } else if (impact?.won === true) {
    row.wins += 1;
  } else {
    row.losses += 1;
  }
}

function getDisplayRank(sortedRows, selectedKey) {
  if (!sortedRows.length) {
    return { absoluteRank: undefined, rank: undefined };
  }

  const averageConfidence = sortedRows.reduce(
    (sum, row) => sum + (Number(row.confidence) || 0),
    0
  ) / sortedRows.length;

  let displayRank = 0;

  for (let index = 0; index < sortedRows.length; index += 1) {
    const row = sortedRows[index];
    const isRanked = (Number(row.confidence) || 0) >= averageConfidence;

    if (isRanked) displayRank += 1;

    if (row.entityKey === selectedKey) {
      return {
        absoluteRank: index + 1,
        rank: isRanked ? displayRank : undefined
      };
    }
  }

  return { absoluteRank: undefined, rank: undefined };
}

function createSnapshotLabel(tournamentSlug, round) {
  return `${tournamentSlug} - ${round}`;
}

function createInitialState(entityKey, impact) {
  return {
    entityKey,
    name: entityKey,
    matches: 0,
    wins: 0,
    losses: 0,
    draws: 0,
    points: Number(impact?.ratingBefore) || 0,
    confidence: Number(impact?.rankBeforeConfidence) || 0
  };
}

export function buildRankingRoundSnapshots(matchHistory, options) {
  const {
    selectedKey,
    impactField,
    getSortName = (row) => row.entityKey
  } = options;

  const history = Array.isArray(matchHistory) ? matchHistory : [];
  const states = new Map();
  const snapshots = [];
  let activeGroup = null;
  let previousSnapshot = null;

  const finalizeGroup = () => {
    if (!activeGroup) return;

    const selectedState = states.get(selectedKey);
    if (!selectedState) {
      activeGroup = null;
      return;
    }

    const sortedRows = sortRankings(Array.from(states.values()), getSortName);
    const { absoluteRank, rank } = getDisplayRank(sortedRows, selectedKey);
    const rating = Number(selectedState.points) || 0;
    const playedInRound = activeGroup.playedKeys.has(selectedKey);
    const ratingChangeInRound = Number(activeGroup.ratingChanges.get(selectedKey)) || 0;
    const rankChangeSincePreviousSnapshot = (
      previousSnapshot
      && typeof previousSnapshot.rank === 'number'
      && typeof rank === 'number'
    )
      ? previousSnapshot.rank - rank
      : undefined;

    const snapshot = {
      tournamentSlug: activeGroup.tournamentSlug,
      tournamentName: activeGroup.tournamentSlug,
      tournamentDate: activeGroup.tournamentDate,
      round: activeGroup.round,
      date: activeGroup.lastDate || activeGroup.tournamentDate || '',
      dateLabel: activeGroup.lastDate || activeGroup.tournamentDate || activeGroup.round,
      label: createSnapshotLabel(activeGroup.tournamentSlug, activeGroup.round),
      rating,
      absoluteRank,
      rank,
      confidence: Number(selectedState.confidence) || 0,
      playedInRound,
      ratingChangeInRound,
      rankChangeSincePreviousSnapshot,
      snapshotKey: `${activeGroup.tournamentSlug}::${activeGroup.round}::${snapshots.length + 1}`
    };

    snapshots.push(snapshot);
    previousSnapshot = snapshot;
    activeGroup = null;
  };

  for (const match of history) {
    const group = getMatchGroup(match);

    if (!activeGroup || activeGroup.key !== group.key) {
      finalizeGroup();
      activeGroup = {
        ...group,
        tournamentDate: match?.tournament_date || null,
        lastDate: getMatchDate(match),
        playedKeys: new Set(),
        ratingChanges: new Map()
      };
    }

    activeGroup.lastDate = getMatchDate(match) || activeGroup.lastDate;
    if (!activeGroup.tournamentDate && match?.tournament_date) {
      activeGroup.tournamentDate = match.tournament_date;
    }

    const impacts = match?.[impactField] || {};
    for (const [entityKey, impact] of Object.entries(impacts)) {
      if (!states.has(entityKey)) {
        states.set(entityKey, createInitialState(entityKey, impact));
      }

      const row = states.get(entityKey);
      row.points = getImpactAfterRating(impact);
      row.confidence = Number(impact?.rankAfterConfidence ?? impact?.confidence ?? row.confidence) || 0;
      updateOutcomeStats(row, impact);

      activeGroup.playedKeys.add(entityKey);
      activeGroup.ratingChanges.set(
        entityKey,
        (Number(activeGroup.ratingChanges.get(entityKey)) || 0) + (Number(impact?.ratingChange) || 0)
      );
    }
  }

  finalizeGroup();

  return snapshots;
}
