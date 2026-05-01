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
  const mapCounts = new Map();              // non-early recorded plays per map
  const mapPoolCounts = new Map();          // number of tournaments each map appeared in pool (for filtering)
  const mapRecordedSlots = new Map();       // total recorded non-early games in tournaments where map was in pool
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
    const pool = Array.isArray(tournament?.tournament?.maps) ? tournament.tournament.maps : [];
    const poolSet = new Set();
    for (const mapName of pool) {
      const normalized = normalizeMapName(mapName);
      if (!normalized || poolSet.has(normalized)) continue;
      poolSet.add(normalized);
      mapPoolCounts.set(normalized, (mapPoolCounts.get(normalized) || 0) + 1);
    }

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
          // Each pool map had exactly 1 selection slot in this match
          for (const mapName of poolSet) {
            mapRecordedSlots.set(mapName, (mapRecordedSlots.get(mapName) || 0) + 1);
          }
        }
      }

      for (const game of games) {
        const mapName = normalizeMapName(game?.map);
        if (!mapName) continue;

        totalRecordedMapEntries += 1;
        if (!earlyRound) {
          recordedMapEntriesNonEarly += 1;
          mapCounts.set(mapName, (mapCounts.get(mapName) || 0) + 1);
        }
      }
    }
  }

  const allMapNames = new Set([...mapCounts.keys(), ...mapPoolCounts.keys()]);
  const rows = Array.from(allMapNames)
    .map(map => ({
      map,
      count: mapCounts.get(map) || 0,
      eligibleMatches: mapRecordedSlots.get(map) || 0,
      poolCount: mapPoolCounts.get(map) || 0,
    }))
    .filter(row => !(row.poolCount === 1 && row.count === 0))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.map.localeCompare(b.map);
    })
    .map(({ map, count, eligibleMatches }) => ({ map, count, eligibleMatches }));

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
