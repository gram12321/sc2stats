# Round Snapshot Ranking History Design

## Purpose

Player and team detail pages currently show rating and rank history only at matches involving the selected player or team. That view is still useful because every point reflects direct activity. The new view should supplement it with a global timeline that shows how the selected entity's rating and rank looked after each tournament round in the filtered ranking universe.

This makes inactive movement visible. A player or team may keep the same rating while their rank changes because other players or teams move around them.

## Scope

Add a supplementary chart mode to:

- `src/pages/PlayerDetails.tsx`
- `src/pages/TeamDetails.tsx`

The existing match/activity chart remains the default. The new mode will be selectable from the detail page chart controls.

Out of scope:

- Replacing the existing chart.
- Adding every-match global snapshots.
- Adding tournament-end-only snapshots as the primary solution.
- Adding dedicated unit, API, or browser tests for this change.

## User Experience

The chart area should offer two timeline modes:

- `Matches`: the current behavior, showing points only when the selected player or team played.
- `Global rounds`: a new global movement timeline, showing one point after each tournament round.

The rating/rank toggle can remain separate from the timeline mode. In global round mode:

- Rating usually changes only in rounds where the entity played.
- Rank can change in rounds where the entity did not play.
- Tooltips should identify tournament, round, current rating or rank, whether the entity played that round, and the rating/rank delta since the previous snapshot when available.

The label and tooltip copy should make the semantics explicit: this is global standing over time, not only direct performance history.

## Data Model

Use this snapshot point shape for API responses and frontend mapping:

```ts
interface RankingSnapshotPoint {
  tournamentSlug: string;
  tournamentName: string;
  tournamentDate: string | null;
  round: string;
  date: string;
  dateLabel: string;
  label: string;
  rating: number;
  absoluteRank?: number;
  rank?: number;
  confidence?: number;
  playedInRound: boolean;
  ratingChangeInRound: number;
  rankChangeSincePreviousSnapshot?: number;
  snapshotKey: string;
}
```

The frontend should map this into the existing `RatingChart` data shape and extend `RatingChart` to read the optional snapshot fields for tooltip copy.

## Backend Design

Add derived snapshot support for players and teams. The implementation should reuse the same ranking replay outputs that already power the ranking and detail endpoints.

For each selected entity:

1. Recalculate rankings using the same filters currently active on the detail page:
   - seasons
   - main circuit only
   - seeded rankings
   - intermediate team rating where applicable
2. Walk the chronological match history in ranking replay order.
3. Close a snapshot checkpoint whenever the `tournament_slug` or normalized `round` changes.
4. After each group, capture the selected entity's current rating, confidence, and absolute rank in the global ranking list.
5. Mark whether the entity played in that round and aggregate its rating change for that round.
6. Carry the previous rating forward for inactive rounds.
7. Recompute rank against the full field after each round so inactive rank drift is visible.

The series starts at the first checkpoint where the selected entity has ranking state. For seeded rankings, that may be the first checkpoint in the filtered history. For unseeded teams or players, it will usually be the first round where they appear in a processed match.

The grouping key should not rely on `tournament_date` alone. It should use:

- `tournament_slug`
- `round`
- chronological processing order
- `match_date` and `match_id` as ordering aids where needed

## Rank Semantics

The existing detail pages convert absolute rank into display rank by applying confidence qualification. The new global round snapshots must use the same display-rank semantics as the current detail page, so the chart rank matches the current page's visible ranking model.

The snapshot `rank` field represents display rank. The optional `absoluteRank` field can be returned for debugging or future UI use, but the chart should use `rank`.

## API Shape

Add focused endpoints rather than expanding the current detail payload:

- `GET /api/player/:playerName/ranking-snapshots`
- `GET /api/team/:player1/:player2/ranking-snapshots`

These endpoints should accept the same relevant query parameters as the detail pages:

- `useSeeds`
- `mainCircuitOnly`
- `seasons`
- team rating options for team snapshots

Both endpoints should call a shared internal helper with different entity accessors.

## Frontend Design

`PlayerDetails.tsx` and `TeamDetails.tsx` should:

1. Keep current `chartData` for match history.
2. Fetch snapshot history when the detail page loads or when filters change.
3. Add a timeline mode state, defaulting to `matches`.
4. Pass either match data or snapshot data into the chart based on timeline mode.
5. Preserve the existing rating/rank mode state.

`RatingChart.tsx` can be extended conservatively:

- Support optional snapshot metadata.
- Show inactive/played status in the tooltip.
- Use stable labels for round snapshots.
- Keep existing match tooltip behavior unchanged.

## Error Handling

If the snapshot endpoint fails, the page should still render the existing match chart. Show a lightweight error near the chart controls and keep the timeline mode on `Matches`.

If no snapshot data is available, show the existing empty chart treatment with copy specific to global round history.

## Verification

Per user preference, verification for implementation should be limited to baseline code checks:

- Run `npm run lint`.
- Run `npm run build`.

No additional dedicated unit tests, API tests, or browser automation are required for this change.
