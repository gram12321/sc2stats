function normalizeMapName(mapName) {
  return String(mapName || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s+(?:LE|CE)$/i, '');
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

export function summarizeMapRecording(tournaments) {
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

  for (const tournament of tournaments) {
    const matches = Array.isArray(tournament?.matches) ? tournament.matches : [];

    for (const match of matches) {
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

  const rows = Array.from(mapCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .map(([map, count]) => ({ map, count }));

  const matchLevelCoverageNonEarly = includedNonEarlyMatches > 0
    ? Number(((matchesWithRecordedMapDataNonEarly / includedNonEarlyMatches) * 100).toFixed(1))
    : 0;

  const mapEntryCoverageVsPlayedNonEarly = playedMapsFromValidScoresNonEarly > 0
    ? Number(((recordedMapEntriesNonEarly / playedMapsFromValidScoresNonEarly) * 100).toFixed(1))
    : 0;

  return {
    totalMatchesScanned,
    excludedEarlyRoundMatches,
    includedNonEarlyMatches,
    matchesWithRecordedMapData,
    matchesWithRecordedMapDataNonEarly,
    totalRecordedMapEntries,
    recordedMapEntriesNonEarly,
    maxPossibleMapSlotsNonEarly,
    maxPossibleMapSlotsEarly,
    playedMapsFromValidScoresNonEarly,
    includedNonEarlyMatchesMissingScores,
    includedNonEarlyMatchesWithInconsistentScores,
    matchLevelCoverageNonEarly,
    mapEntryCoverageVsPlayedNonEarly,
    uniqueRecordedMapNames: rows.length,
    rows
  };
}
