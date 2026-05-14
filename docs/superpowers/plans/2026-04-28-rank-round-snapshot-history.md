# Round Snapshot Ranking History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add supplementary global round snapshot history to player and team detail charts.

**Architecture:** Reconstruct round-level ranking checkpoints from existing chronological match histories and impacts. Serve player/team snapshot endpoints from the API, then let the detail pages fetch and map those snapshots into the existing `RatingChart` with additional tooltip metadata.

**Tech Stack:** Express.js, React 18, TypeScript, Recharts, Vite.

---

### Task 1: Backend Snapshot Helper

**Files:**
- Create: `api/rankingSnapshots.js`

- [ ] **Step 1: Create helper module**

Add a helper that walks processed match history, tracks entity state, finalizes a snapshot when tournament or round changes, and returns points for one selected entity.

```js
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
  if (!sortedRows.length) return { absoluteRank: undefined, rank: undefined };

  const averageConfidence = sortedRows.reduce((sum, row) => sum + (Number(row.confidence) || 0), 0) / sortedRows.length;
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
      previousSnapshot && typeof previousSnapshot.rank === 'number' && typeof rank === 'number'
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
        states.set(entityKey, {
          entityKey,
          name: entityKey,
          matches: 0,
          wins: 0,
          losses: 0,
          draws: 0,
          points: Number(impact?.ratingBefore) || 0,
          confidence: Number(impact?.rankBeforeConfidence) || 0
        });
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
```

### Task 2: Snapshot API Routes

**Files:**
- Modify: `api/server.js`

- [ ] **Step 1: Import helper**

Add:

```js
import { buildRankingRoundSnapshots } from './rankingSnapshots.js';
```

- [ ] **Step 2: Add player snapshot endpoint**

Add `GET /api/player/:playerName/ranking-snapshots`. It should load seeds and filters the same way as `GET /api/player/:playerName`, call `calculateRankings`, build snapshots from `player_impacts`, and return `{ snapshots }`.

- [ ] **Step 3: Add team snapshot endpoint**

Add `GET /api/team/:player1/:player2/ranking-snapshots`. It should load seeds and filters the same way as `GET /api/team/:player1/:player2`, call `calculateTeamRankings`, normalize the selected team key, build snapshots from `team_impacts`, and return `{ snapshots }`.

### Task 3: Chart Snapshot Metadata

**Files:**
- Modify: `src/components/RatingChart.tsx`

- [ ] **Step 1: Extend point interface**

Add optional fields for `round`, `playedInRound`, `ratingChangeInRound`, `rankChangeSincePreviousSnapshot`, and `timelineMode`.

- [ ] **Step 2: Update tooltip**

Show round and played/inactive context when `timelineMode === 'rounds'`. Preserve existing match tooltip behavior.

- [ ] **Step 3: Add empty label prop**

Allow pages to pass a custom empty message for global round mode.

### Task 4: Player Detail Wiring

**Files:**
- Modify: `src/pages/PlayerDetails.tsx`

- [ ] **Step 1: Add snapshot state and fetcher**

Add `rankingSnapshots`, `snapshotError`, and `chartTimelineMode` state. Fetch `/api/player/:playerName/ranking-snapshots` with the same filter params used by player details.

- [ ] **Step 2: Map snapshot data**

Map snapshots into `RatingChart` points with formatted dates and `formatTournamentName`.

- [ ] **Step 3: Add timeline toggle**

Add `Matches` and `Global rounds` controls near the rating/rank toggle. Use `Matches` by default and fall back to it if snapshot fetch fails.

### Task 5: Team Detail Wiring

**Files:**
- Modify: `src/pages/TeamDetails.tsx`

- [ ] **Step 1: Add snapshot state and fetcher**

Add `rankingSnapshots`, `snapshotError`, and `chartTimelineMode` state. Fetch `/api/team/:player1/:player2/ranking-snapshots` with the same filter params used by team details.

- [ ] **Step 2: Map snapshot data**

Map snapshots into `RatingChart` points with formatted dates and `formatTournamentName`.

- [ ] **Step 3: Add timeline toggle**

Add `Matches` and `Global rounds` controls near the rating/rank toggle. Use `Matches` by default and fall back to it if snapshot fetch fails.

### Task 6: Verification

**Files:**
- No code edits.

- [ ] **Step 1: Run lint**

Run: `npm run lint`

- [ ] **Step 2: Run build**

Run: `npm run build`
