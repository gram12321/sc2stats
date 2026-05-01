# Version Log - SC2 2v2 Stats Scraper

## AI Instructions For New Entries

### Goal
Write clear, factual release notes that explain what changed, where, and why it matters.

### Scope Rules
- Log only meaningful changes (features, refactors, balancing changes, architecture updates, major bug fixes, doc restructures).
- Skip trivial noise (format-only edits, typos, minor wording tweaks) unless bundled with a meaningful change.
- Group related commits into one entry when they represent one logical change.

### Evidence Rules
- Use actual repository data before writing (commit hash(es), changed files, basic stats).
- Review the commit patch line-by-line before writing behavior summaries:
  - single commit: `git show --no-color <commit>`
  - grouped commits: run the same for each commit in the group.
- Do not guess file changes.
- Do not claim behavior/mechanics that are not visible in the reviewed diff.
- If commits are grouped, list each commit hash in the entry header.

### Entry Format (required)
Use this exact structure for each entry:

```
## Version <tag> - <short title>
**Date:** YYYY-MM-DD | **Commit(s):** <hash or comma-separated hashes> | **Stats:** <additions/deletions summary>

### Summary
- 1-3 bullets describing intent and outcome.

### Changes
- `path/to/file.ts` - what changed and why it matters.
- `path/to/other.tsx` - what changed and why it matters.
- **NEW FILE:** `path/to/newFile.ts` (<line count> lines) - purpose.
- **REMOVED:** `path/to/oldFile.ts` - reason removed/replaced.

### Notes
- Migration, compatibility, balancing impact, follow-up items, or known limitations.
```

### Writing Rules
- Keep entries concrete and technical.
- Prefer file paths over vague descriptions.
- Use `NEW FILE` and `REMOVED` markers exactly.
- If relevant, call out architecture decisions and intentional deviations from earlier plans.

### Ordering
- Newest entry goes at the top (below this instruction section).
- Keep entries in reverse chronological order.

---

## Version 1.0010a - Individual race mirror filtering and race impact label fix
**Date:** 2026-05-01 | **Commit(s):** 801ced13ec0dd05c23a158204fdb637632df1003 | **Stats:** +79 / -24

### Summary
- Extended the `hideMirror` filter to individual race rankings (was previously only team race rankings).
- Race rankings now deduplicate symmetric matchup rows (PvZ and ZvP become one entry) and aggregate combined stats from both sides of each matchup.
- Race impact labels in match history tooltips now use abbreviations (PvZ) instead of full race names.

### Changes
- `api/server.js` - Threaded `hideMirror` query parameter through `/api/race-rankings`, `/api/race-matchup/:race1/:race2`, and `/api/race-combo/:race` endpoints.
- `src/pages/RaceRankings.tsx` - Added `hideMirror`/`setHideMirror` from the settings context; appended `hideMirror` to all fetch query strings; added "Ignore Mirror teams" checkbox to the page filter bar; re-triggers data load when `hideMirror` changes.
- `src/components/MatchHistoryItem.tsx` - Race impact key labels now call `getRaceAbbr()` so they render as `PvZ` instead of `ProtosvZerg`.
- `tools/calculateRaceRankings.js` - Added `hideMirror` parameter; added mirror-skip logic (skips any match where either team's two players share a race); added deduplication pass that keeps one canonical direction per matchup pair; fixed combined-stats aggregation to process both sides of each deduplicated matchup so `TvX`, `ZvX`, `PvX` totals are correct.

### Notes
- Deduplicated race ranking rows change the visible row count; previously symmetric pairs each had a separate entry.

---

## Version 1.0010 - Mirror match filter for team race rankings
**Date:** 2026-05-01 | **Commit(s):** 18595843175da7feb5a9ee9f3e832fdaf4dbce25 | **Stats:** +71 / -25

### Summary
- Added a `hideMirror` toggle that excludes matches where either team runs a mirror race combo (PP, TT, ZZ, RR) from team race ranking calculations and display.
- The setting is persisted via localStorage alongside the existing `hideRandom` preference.

### Changes
- `src/context/RankingSettingsContext.tsx` - Added `hideMirror` state (default `false`), `setHideMirror` setter, and `sc2stats_hide_mirror` localStorage key; exposed both through the context type and provider value.
- `src/pages/TeamRaceRankings.tsx` - Consumes `hideMirror`/`setHideMirror` from context; appends `hideMirror=true` to fetch requests; adds "Ignore Mirror matchups" checkbox beside the existing "Ignore Random matchups" checkbox; re-fetches when `hideMirror` changes.
- `tools/calculateTeamRaceRankings.js` - Added `hideMirror` parameter to `calculateTeamRaceRankings()`; skips any match where either team's combo is a mirror (PP, TT, ZZ, RR); increments `matchesSkippedMirror` counter.
- `api/server.js` - Reads `hideMirror` query param and passes it to `calculateTeamRaceRankings()` in the rankings, matchup, and combo endpoints; adds `mirror-skip` to filter-summary log lines.

### Notes
- `package-lock.json` peer-dependency field changes are also included in this commit but are unrelated to the feature.

---

## Version 1.009 - Live match predictor panel
**Date:** 2026-04-28 | **Commit(s):** 15333e24feea2cc3be8b3cd613c238a8d4f3df2c | **Stats:** +1102 / -9

### Summary
- Added a live match-prediction panel available from the Rankings section that calculates calibrated win probabilities and series outcome breakdowns for any two teams.
- New `/api/match-predict` endpoint computes effective ratings (including intermediate team rating blend) for both known teams and unknown team combinations built from individual player ratings.
- Minor fixes to `PredictionQuality` page and `calculateTeamRankings` exports.

### Changes
- **NEW FILE:** `src/components/MatchPredictorPanel.tsx` (747 lines) - Full prediction UI: two-team player input fields with datalist autocomplete, best-of selector, calibrated win-probability display, series-outcome probability table (e.g. 3-0, 2-1, 1-2, 0-3), ITR blend-weight badge, and team source indicator (`team-rating` vs `player-average`).
- `api/server.js` - Added `/api/match-predict` GET endpoint; imports `getIntermediateBlendWeight`, `getIntermediateTeamRating` from `calculateTeamRankings`; imports `calculatePopulationStats`, `predictWinProbability`, `calibrateWinProbability` from `rankingCalculations`; added server-side helpers `resolveCanonicalPlayerName`, `parseCanonicalTeamKey`, `parseBestOf`, `clampProbability`, `resolveEffectiveTeamRating`, `buildPredictionTeam`, `getCombination`, `getExpectedSeriesOutcomes` to build and validate the prediction response.
- `tools/calculateTeamRankings.js` - Exports `getIntermediateBlendWeight` and `getIntermediateTeamRating` for reuse by the predict endpoint.
- `src/pages/PredictionQuality.tsx` - Minor fix (16 additions, matches commit stat).
- `docs/data-specification.md` - Added 7-line entry describing the `match-predict` endpoint fields.
- `README.md` - Corrected API server port reference from 3001 to 3002 and added Vite proxy note.

### Notes
- New teams (player pairs with no shared match history) are predicted using the intermediate team rating blend from player individual ratings; the team source is indicated in the response and UI.
- The commit message tag reads "0.009" but follows 1.008 in sequence; logged here as 1.009.

---

## Version 1.008 - Prediction quality page and analysis tool
**Date:** 2026-04-27 | **Commit(s):** 477bf3c0c41a4ec8d88cf458589a544772deaf83 | **Stats:** +1515 / -2

### Summary
- Added a Prediction Quality page and CLI tool that score the model's pre-match `expectedWin` values against actual outcomes using Brier score, log loss, calibration buckets, and settings-comparison tables.
- New `/api/prediction-quality` endpoint surfaces the full calibration report to the frontend, respecting existing filter settings.
- The `analyze-prediction-quality` npm script exposes the same analysis from the command line.

### Changes
- **NEW FILE:** `src/pages/PredictionQuality.tsx` (846 lines) - Full calibration dashboard: overall Brier score, log loss, favorite accuracy, calibration-bucket breakdown, settings-impact comparison table (seed on/off, ITR on/off, circuit scope, season scope), and most-confident misses list.
- **NEW FILE:** `tools/analyzePredictionQuality.js` (507 lines) - CLI analysis tool reusing the chronological team-ranking pass; scores `expectedWin` values stored in `team_impacts`; reports overall metrics, calibration buckets, and breakdowns by best-of length, team maturity, and prediction source; supports `--use-seeds`, `--main-circuit-only`, `--season`, `--use-intermediate-team-rating`, `--write-json` flags.
- `api/server.js` - Added `/api/prediction-quality` GET endpoint; passes `useSeeds`, `mainCircuitOnly`, `seasons`, and `teamOptions` from query params into `analyzePredictionQuality()`; logs Brier score and favorite accuracy in the API summary line.
- `src/App.tsx` - Added `prediction-quality` to the `View` union type and renders `<PredictionQuality />` when active.
- `src/components/Header.tsx` - Added `prediction-quality` view with a `Target` icon under the `info` section as "Predictions".
- `package.json` - Added `analyze-prediction-quality` script.
- `.gitignore` - Ignores `output/*_prediction_quality_report.json` and `output/prediction_quality_report.json` artifacts.
- `docs/data-specification.md` - Added "Prediction Quality Analysis" section documenting CLI usage, metric definitions, and the Settings Impact table behavior.

### Notes
- Exact 50/50 predictions are included in probability-error metrics but excluded from favorite-side calibration rows.
- The settings-comparison table in the UI keeps the current filters as the baseline and shows `dBrier` and `dAbs gap` deltas; negative values are improvements.

---

## Version 1.007 - Established ranking dampening and K scenario analysis
**Date:** 2026-04-26 | **Commit(s):** 6a9c0177d6ca6df38e14b6079fa50bd5762fcaca | **Stats:** +284 / -13

### Summary
- Reduced the live newness K schedule so established rankings, and especially later-match entities, move less sharply.
- Added a base-K scenario analysis CLI for comparing dampening candidates across match counts, confidence levels, series lengths, expected-win bands, and close/sweep result shapes.
- Updated K-factor documentation and ignored generated scenario-report JSON artifacts.

### Changes
- `.gitignore` - Ignores generated `output/*_scenario_report.json` analysis files.
- `package.json` - Added the `analyze-base-k` script.
- `docs/data-specification.md`, `src/pages/Info.tsx` - Updated public K-factor explanation text for the established-phase formula, though these docs still need a follow-up pass to match the live `18 + 100/matches` implementation exactly.
- **NEW FILE:** `tools/analyzeBaseKScenarios.js` (270 lines) - CLI scenario matrix for comparing baseline and candidate established K schedules.
- `tools/rankingCalculations.js` - Changed `getNewnessKFactor()` to lower K values: matches 1-2 now return `60`, matches 3-4 return `40`, matches 5-8 return `25`, and matches 9+ use `min(50, 18 + 100/matches)`.

### Notes
- This is a balancing change: it intentionally reduces volatility for entities with established match history while preserving a higher-provisional phase.
- Follow-up: `tools/rankingCalculations.js` comments, `docs/data-specification.md`, and `src/pages/Info.tsx` still describe older/24-based K values in places; the live implementation now returns `60`, `40`, `25`, then `min(50, 18 + 100/matches)`.

---

## Version 1.006 - Bonus Cup 8 data and race point movement
**Date:** 2026-04-25 | **Commit(s):** 37c5948ee165022d8681189dfbc7cc54dcd65b7c | **Stats:** +776 / -101

### Summary
- Added Bonus Cup 8 tournament data with bracket scorelines and the event map pool.
- Race and Team Race rankings now expose latest-tournament point movement alongside current points.
- Backend race abbreviation logic was centralized for race, team-race, and matchup endpoints.

### Changes
- `api/server.js` - Added latest-tournament point-delta builders for race and team-race rankings, returning `previousPoints`, `pointChange`, `pointDirection`, and movement metadata in API responses.
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_8.json` (425 lines) - Bonus Cup 8 bracket, scorelines, teams, and map pool.
- `output/player_countries.json`, `output/player_defaults.json` - Added country/race metadata for newly covered Bonus Cup 8 players.
- `src/pages/RaceRankings.tsx`, `src/pages/TeamRaceRankings.tsx` - Added tooltip-backed point-change indicators next to current race and team-race points.
- `tools/calculateRaceRankings.js`, `tools/calculateTeamRaceRankings.js`, `tools/processRankings.js` - Replaced duplicated local race abbreviation maps with a shared helper.
- **NEW FILE:** `tools/raceUtils.js` (16 lines) - Shared backend race abbreviation helper.

### Notes
- Point movement is calculated against the latest tournament found in match history, not against an arbitrary previous page load.

---

## Version 1.005 series - April event data, rank movement, deterministic name cleanup
**Date:** 2026-04-19 | **Commit(s):** 02d16a742b92aa64e1b64b3e95e8f40b673a210b, 70bdf60a59f0ee12113fa67b3fc906c3b57bd3eb, 62ba30e2f80b071af8e494c705d69e908c280af4, 7af378bb6eaace225104a4b1da49cc67354cf1f0 | **Stats:** +3883 / -195

### Summary
- Added April tournament coverage for SEL Doubles 2, uThermal 2v2 Circuit April 2026, and Bonus Cup 7, plus refreshed player defaults, countries, and seeded outputs.
- Player and Team rankings now show rank movement based on the latest tournament, with detail pages converting absolute ranks into confidence-filtered display ranks.
- Ranking processors now normalize deterministic case/trim player-name variants, and Player Manager can apply those safe merges.

### Changes
- `api/server.js` - Added latest-tournament rank-movement helpers for player/team ranking endpoints and seeded ranking endpoints, including fallback recalculation when cached seeded rows do not include movement metadata.
- **NEW FILE:** `output/SEL_Doubles_2.json` (467 lines) - SEL Doubles 2 tournament bracket, scorelines, teams, and map pool.
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_4.json` (1518 lines) - uThermal 2v2 Circuit April 2026 bracket with dated matches and recorded map data.
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_7.json` (491 lines) - Bonus Cup 7 bracket, scorelines, teams, and map pool.
- `output/UThermal_2v2_Circuit_2026_2.json`, `output/UThermal_2v2_Circuit_2026_3.json`, `output/UThermal_2v2_Circuit_2026_Bonus_Cup_5.json`, `output/seeded_player_rankings.json`, `output/seeded_team_rankings.json` - Corrected deterministic player-name variants such as `LateleX` to `LetaleX` and `iba` to `Iba`.
- `output/player_countries.json`, `output/player_defaults.json` - Added metadata for April event players and removed stale duplicate/default entries.
- `src/components/BracketView.tsx`, `src/components/MatchBox.tsx` - Loaded player countries into bracket view and displayed flags beside match-card player names.
- `src/pages/PlayerManager.tsx` - Added deterministic case/trim merge detection, per-group apply, apply-all, refresh handling, and merge feedback.
- `src/pages/PlayerRankings.tsx`, `src/pages/TeamRankings.tsx` - Added display-rank movement indicators and tooltips that respect the confidence-filtered visible rank list.
- `src/pages/PlayerDetails.tsx`, `src/pages/TeamDetails.tsx` - Preserved backend chronological match order for charts, converted absolute impact ranks to display ranks, hid ranks for low-confidence entities, and appended current-rank snapshots when needed.
- `src/components/MatchHistoryItem.tsx` - Shows post-match team points when a display rank is not available and includes those points in team-impact breakdowns.
- `src/lib/display.ts` - Improved tournament-name formatting for slash-based sequence slugs such as `SEL_Doubles/2` and `Bonus_Cup/7`.
- `tools/rankingUtils.js` - Added deterministic player-name normalizers and expanded `getRoundSortOrder()` for generic rounds, upper/winner rounds, playoff labels, finals variants, and show matches.
- `tools/processRankings.js`, `tools/calculateTeamRankings.js`, `tools/calculateRaceRankings.js`, `tools/calculateTeamRaceRankings.js`, `tools/runSeededRankings.js` - Applied deterministic player-name normalization before ranking calculations.
- `tools/scraper.js` - Hardened infobox field parsing for nested templates, wiki links, `SUBPAGENAME`/`PAGENAME`, multiline values, and normalized tournament metadata extraction.

### Notes
- The rank movement patches changed the baseline from "last impact rank" to a reconstructed pre-latest-tournament ranking, so arrows describe the latest event's effect.

---

## Version 1.004a - Local Manage access and navigation cleanup
**Date:** 2026-03-23 | **Commit(s):** f78ebc74a1b5d3f57e463378bd1c538cc8c58013 | **Stats:** +374 / -311

### Summary
- The public header was simplified by moving Manage access out of the main section navigation.
- Player Manager access is now localhost-only, with a footer Manage button shown only in local admin contexts.
- Highlights moved under the Stats & Info area, and the Info page was rewritten around current system behavior.

### Changes
- `src/App.tsx` - Added localhost detection for the Manage route, redirects non-local Manage navigation to Info, renders a local-only Manage message when needed, and passes a Manage navigation callback to the footer.
- `src/components/Header.tsx` - Renamed `Circuit` to `Results`, renamed `Info` to `Stats & Info`, removed the Manage section, and moved Highlights into the Info lower row.
- `src/components/Footer.tsx` - Added a localhost-only Manage button wired through the app-level navigation callback.
- `src/pages/Info.tsx` - Replaced the previous Info copy with a fuller system overview, ranking category descriptions, technical implementation notes, and FAQ content.

### Notes
- This keeps editing/management UI available during local development while removing it from normal public navigation.

---

## Version 1.004 - Section navigation, footer summary, bracket maps, ITR visibility
**Date:** 2026-03-23 | **Commit(s):** 37ce89faf4d7b64d38d8fc27b1fe8ec2f1bed46e | **Stats:** +758 / -137

### Summary
- App navigation was reorganized into section-based Circuit/Rankings/Manage/Info rows, and the version log moved into a new footer summary panel.
- Bracket UI now shows tournament map pools plus expandable recorded map lists on each match card.
- Intermediate Team Rating (ITR) metadata is now exposed in team rankings, team details, and team-impact tooltips, including the effective ratings used for prediction.

### Changes
- `src/App.tsx` - Added section-aware routing (`circuit`, `rankings`, `manage`, `info`), split circuit/ranking render paths, and mounted the new footer.
- `src/components/Header.tsx` - Replaced the flat all-views nav with a two-level section/view navigation model; detail pages map back to their parent ranking tabs.
- **NEW FILE:** `src/components/Footer.tsx` (127 lines) - Footer summary bar with app version, ranked-player count, tournament count, latest tournament, and a lazy-loaded version-log sheet.
- `api/server.js` - Added cached `/api/footer-summary`; `seeded-team-rankings` now recalculates when `useIntermediateTeamRating=true`, even without season/circuit filters.
- `src/components/BracketView.tsx` - Shows the current tournament map pool above the bracket when maps are available.
- `src/components/MatchBox.tsx` - Added expandable recorded-map rows (`Maps (N)`) with per-map win/loss markers for each team.
- `src/components/MatchHistoryItem.tsx` - Team impact tooltips now show ITR blend percentages, effective ratings used for win-probability input, and explicit notes when player/race/combo views use direct ratings instead of ITR.
- **NEW FILE:** `src/lib/intermediateTeamRating.ts` (17 lines) - Shared blend-weight helper for client-side ITR display.
- `src/pages/TeamDetails.tsx`, `src/pages/TeamRankings.tsx` - Added ITR badges/tooltips next to ranking points using API-provided or derived blend weights.
- `tools/calculateTeamRankings.js` - Ranking output now includes `intermediateTeamRating` and `intermediateBlendWeight` metadata for each team row.

### Notes
- This commit makes the ITR toggle visible in the UI, but the underlying team-blend calculation itself was introduced in the earlier `1.0023` work.

---

## Version 1.003 - Bonus Cup 6 data, Round X bracket sorting
**Date:** 2026-03-22 | **Commit(s):** db86e796a8923144b622e97c0ffffc21c3e25862 | **Stats:** +480 / -19

### Summary
- Added Bonus Cup 6 tournament data with semifinal and grand final map records.
- Bracket view now sorts upper bracket rounds from parsed `Round of X`, generic `Round N`, and named finals instead of relying on a fixed hardcoded list.
- Player metadata was updated for new defaults and corrected country data.

### Changes
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_6.json` (434 lines) - Bonus Cup 6 bracket, scores, and late-round map data.
- `src/components/BracketView.tsx` - Replaced the hardcoded upper-bracket order with `getUpperRoundSortKey()`, so `Round 1`, `Round 2`, `Round of 16`, and named finals render in stable bracket order.
- `output/player_countries.json` - Corrected `goblin` country code from `CR` to `HR`.
- `output/player_defaults.json` - Added `MaxMor` and corrected/added `LetaleX`.

### Notes
- This fixes bracket rendering for events that use `Round N` naming instead of only `Round of X` or named bracket rounds.

---

## Version 1.0025 / 1.0025a - Map data page, shared summary, enrichment tool
**Date:** 2026-03-17 | **Commit(s):** e99032e3de814641940ffa72f89d7189cf179091, 0016c1295b1dacd36ede69bf6bfae8138161ee54 | **Stats:** +843 / -154

### Summary
- Added a Map Data page and API that report map-entry coverage using played maps from valid scores while excluding early rounds from the primary coverage metrics.
- Refactored map counting into a shared summary module and added a map-only enrichment script that merges newly scraped `games` data back into existing tournament JSON.
- Scraper now parses nested `{{Map}}` templates and exports `scrapeTournament()` for reuse by enrichment tooling.

### Changes
- **NEW FILE:** `src/pages/MapData.tsx` (246 lines) - Map coverage dashboard with aggregate counters, coverage percentages, and per-map counts.
- `api/server.js` - Added `/api/map-recording-summary`; loads all tournament JSON and returns `summarizeMapRecording(...)`.
- **NEW FILE:** `tools/mapRecordingSummary.js` (131 lines) - Shared summary logic for map counts, early-round exclusion, score validation, and coverage percentages.
- `tools/countRecordedMaps.js` - Reworked to call the shared summary module instead of duplicating counting logic inline.
- **NEW FILE:** `tools/enrichMapData.js` (261 lines) - Dry-run/write CLI that matches existing matches to scraped output and fills or appends `games` plus tournament map pools.
- `tools/scraper.js` - Added `parseMapTemplate()`, `extractMatchGames()`, and exported `scrapeTournament(url)` so map enrichment can reuse the scraper.
- `package.json`, `src/App.tsx`, `src/components/Header.tsx` - Added `scrape-tournament` / `enrich-map-data` scripts and a `Maps` view in the app shell.

### Notes
- Coverage is measured against played maps from valid scorelines, not against maximum possible best-of slots.

---

## Version 1.0024 series - Bonus Cup 5 data, quieter API logs
**Date:** 2026-03-17 | **Commit(s):** 119afd5d4b0f51b8375809e75e3bf83a79d276c9, 8a681ad113bc8752631fa6a600dad70a87471924 | **Stats:** +1085 / -75

### Summary
- Added Bonus Cup 5 data and new player defaults for the event.
- Server logging now emits structured per-endpoint summaries instead of noisy ad hoc console output, and common `304` metadata requests are suppressed.
- Added a CLI summary for recorded map coverage that later feeds the map-data work.

### Changes
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_5.json` (451 lines) - Bonus Cup 5 bracket with semifinal and grand final map records.
- `output/player_defaults.json` - Added `iba`, `sebesdes`, and `shinobu`.
- `api/server.js` - Added request middleware, quiet-path suppression, startup snapshot helpers, and summary logging for tournaments, rankings, match history, and player/team detail endpoints.
- `tools/countRecordedMaps.js` - Added CLI reporting for match-level map coverage, valid-score map coverage, and per-map counts.
- `output/player_countries.json` - Expanded stored country overrides used by the UI/API country pipeline.

### Notes
- The logging pass changes observability only; it does not change ranking math.

---

## Version 1.0023 / 1.0022 - Country metadata, calibration toggle, intermediate team rating
**Date:** 2026-03-04 | **Commit(s):** cc7630905dcb8f98f028e8a705775aec404d1852, d28a4c6d2ae12351949db6e4e3c0b6fbf620b8de | **Stats:** +1739 / -662

### Summary
- Added country metadata support plus reusable flag/race UI components across rankings, match history, highlights, and team views.
- Added prediction calibration controls and an optional intermediate team rating blend for early team matches.
- Rebuilt Player Manager around match counts, missing-data triage, country editing, and persisted intermediate-team filters.

### Changes
- `api/server.js` - Added `player_countries.json` support, `/api/player-countries`, `/api/player-match-counts`, and threaded `useIntermediateTeamRating` plus `playerSeeds` through team-related endpoints.
- `tools/rankingCalculations.js` - Added `setPredictionCalibration()`, `getPredictionCalibrationSettings()`, `calibrateWinProbability()`, and `rawExpectedWin` in calculation details; default calibration temperature is `1.4`.
- `tools/calculateTeamRankings.js` - Added per-player shadow stats, `intermediateTeamRating`, blend weights, and `effectiveRatingUsed` for early team matches when the option is enabled.
- **NEW FILE:** `src/lib/display.ts` (158 lines) - Tournament-name formatting plus shared race-display helpers.
- **NEW FILE:** `src/components/ui/CountryFlag.tsx` (20 lines) - Reusable country flag component for rankings, match history, and detail views.
- **NEW FILE:** `src/components/ui/RaceBadge.tsx` (36 lines) - Reusable race badge component with shared tone/icon handling.
- `src/pages/PlayerManager.tsx` - Replaced the old defaults-only screen with a table-driven manager for race defaults, ISO country codes, match counts, missing-data filters, and rename/merge suggestions.
- `src/components/RankingFilters.tsx`, `src/context/RankingSettingsContext.tsx`, `src/pages/Highlights.tsx`, `src/pages/TeamRankings.tsx`, `src/pages/TeamDetails.tsx` - Added persisted `Intermediate Team Rating` toggle and passed it to affected views.
- `src/index.css`, `tailwind.config.js`, `src/pages/PlayerRankings.tsx`, `src/pages/TeamRankings.tsx`, `src/pages/MatchesList.tsx`, `src/pages/TeamDetails.tsx` - Refreshed the light theme and switched core tables/cards to formatted event names, flags, and race badges.
- `docs/aligulac-comparison.md` - Added calibration-toggle notes and the default temperature for A/B testing.

### Notes
- Intermediate team rating only affects team calculations when the toggle is enabled; player and race models stay direct.

---

## Version 1.0021 / 1.0020 - Highlights page and peak records
**Date:** 2026-03-04 | **Commit(s):** 1cfc95c430221cae49b00eab16d33351f27db830, 1644e55e31f0797f5a5df81d7656d38990385317 | **Stats:** +1514 / -591

### Summary
- Added a Highlights section with upset/expected/gain/scoreline cards plus peak-rating tables for players, teams, races, and combos.
- Navigation can deep-link from highlights into matches, player details, and team details.
- Info and docs were expanded to explain highlight eligibility and supporting ranking-analysis context.

### Changes
- **NEW FILE:** `src/pages/Highlights.tsx` (490 lines) - Initial Highlights view with biggest-upset, most-expected, rating-gain, lopsided-score, and peak-rating tables; later refined in `1.0021` with sorting, formatted event names, and race-badge presentation.
- `src/App.tsx`, `src/components/Header.tsx` - Added Highlights route/button and navigation hooks from highlight actions into `matches`, `player-details`, and `team-details`.
- `src/pages/MatchesList.tsx` - Added `initialTournament` and `focusMatchId` support so highlight actions can open the relevant match context directly.
- `src/pages/Info.tsx` - Added FAQ copy for Random eligibility in peak highlights and for interpreting expected series scorelines.
- **NEW FILE:** `docs/aligulac-comparison.md` (172 lines) - Notes comparing the project's ranking model to Aligulac.
- **REMOVED:** `tools/compareChurn.js` - Temporary churn-analysis helper removed after the comparison work moved into docs/UI.
- **REMOVED:** `tools/debug_wikitext.js` - Temporary bracket-debug helper removed after the March parser/view work stabilized.

### Notes
- Highlights are filter-sensitive, so visible upset/peak records change with seeds, circuit filters, seasons, and later the intermediate-team toggle.

---

## Version 1.0019 / 0.0018 series - Scoreline weighting, tooltip overhaul, race fallbacks
**Date:** 2026-03-04 | **Commit(s):** e31a11a4ae93444a9fb5e24c91b2d38b6d096f18, 0358045fc7ad59a2a2463af05a525a02d97c99b3, 5ae9d9b2737c2e103fb3d00627bb5e97480d6345, f19ab15252662b25ddbfd0306ae9e2add8f3e0e6, ef888e30f90e569150594309c5eeb773f46933fc | **Stats:** +2295 / -202

### Summary
- Rating changes now blend series result with scoreline margin, and tooltips expose the two-term breakdown, expected series outcomes, and factor details.
- Rename handling and match creation normalize trailing-whitespace variants, preventing duplicate player names from accidental spaces.
- Race matchup stats now handle reverse matchup keys and fall back to team/player deltas when backend race impacts are missing; more early results were also added to tournament data.

### Changes
- `tools/rankingCalculations.js` - Added scoreline-share weighting and exposed `matchK`, `scoreK`, `matchRatingChange`, `scoreRatingChange`, score weights, reliability multipliers, and expected/actual score-share details.
- `src/components/MatchHistoryItem.tsx` - Tooltip now shows collapsible calculation sections, expected series scorelines, factor details, and total change as `Match term + Scoreline term`.
- `src/components/ui/tooltip.tsx` - Tooltip became interactive, keyboard-closable, and resilient to resize/scroll changes via separate open/close timers and observers.
- `api/server.js`, `src/components/BracketView.tsx` - Player rename path and new-match entry sanitize trailing whitespace so whitespace variants can be merged or avoided.
- `src/components/RaceMatchupStats.tsx` - Reverse-key race impacts are inverted correctly; missing backend race deltas fall back to team/player impact so team statistics still populate.
- `src/lib/utils.ts`, `src/pages/TeamDetails.tsx`, `src/pages/TeamRaceRankings.tsx` - Shared `getRoundSortOrder()` now drives early upper/lower round sorting in UI views.
- `output/UThermal_2v2_Circuit_2.json`, `output/UThermal_2v2_Circuit_3.json`, `output/UThermal_2v2_Circuit_4.json` - Added early-round results and more recorded score/map data.

### Notes
- Re-running rankings after this batch changes numbers because scoreline margin now contributes to rating changes.

---

## Version 1.0012 / 0.0012a-0.0016a - March data, bracket overhaul, rename tooling
**Date:** 2026-03-04 | **Commit(s):** 8b294178a298484e2e009a5805bff3c90933b8ab, e696af26df2f6d42c6027e74f9b15fa3946e4c4b, 4ce0146b651199f45456189d068634edbc61726d, 6bb3ac855215437c640a19122e1411a2f354acf7, 9ca1331e2ab97a542e5f19ed49ef5fd0138909ba, d93ec9f2b3db302141fa25b5e40c19bed22b39c3, c0dea18988a2d52bbbb164c6e92d2883edf51985, aa2ec4215f0cbceb2f0b6c2435cf909dcf1de8c4 | **Stats:** +6709 / -1823

### Summary
- Added March main-circuit and SEL Doubles data, then enriched `UThermal_2v2_Circuit_2026_3.json` with main-circuit metadata, races, scores, and early-round results.
- Bracket parser/view/editor now understand upper/lower bracket labels from Liquipedia comments, render early rounds as connected mini-brackets, show tournament-context team ranks, and suggest teammates from tournament/history data.
- Match history and detail views now show post-match rank snapshots, and player rename tooling propagates changes across tournament/default/seeded files.

### Changes
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_3.json` (458 lines) - March 2026 circuit event; later commits fill scores, races, main-circuit metadata, and early rounds.
- **NEW FILE:** `output/SEL_Doubles_1.json` (573 lines) - SEL Doubles tournament data.
- `output/player_defaults.json` - Expanded defaults for March and SEL players.
- `tools/scraper.js` - Uses bracket section comments to map matches to `Upper Bracket Quarterfinals`, `Lower Bracket Final`, and related labels instead of only generic `Round of X`.
- `src/components/BracketView.tsx` - Added stacked upper/lower bracket rendering, early-round section types (`standard`, `upper`, `lower`), bracket connectors/drop markers, tournament-context team ranks, entrant swapping, round creation by type, and teammate-priority suggestions.
- `src/components/MatchBox.tsx` - Moved the team-rank badge into a dedicated right-side chip and cleaned score/rank layout.
- `api/server.js` - Added `/api/tournament-team-rankings/:slug`, `/api/players/rename`, and `/api/player-teammates`; rename updates tournament JSON, defaults, and seeded ranking/seed files.
- `tools/processRankings.js`, `tools/calculateTeamRankings.js`, `tools/calculateRaceRankings.js` - Recorded `rankAfter` / `rankAfterConfidence` snapshots for player/team/race impacts.
- `src/components/MatchHistoryItem.tsx`, `src/pages/PlayerDetails.tsx`, `src/pages/TeamDetails.tsx`, `src/lib/playerDefaults.ts`, `src/pages/PlayerManager.tsx` - UI now prefers post-match rank display and adds rename/merge controls with similar-name detection.
- `tools/rankingUtils.js` - `getRoundSortOrder()` learned `Early Upper Bracket Round N` and `Early Lower Bracket Round N`.

### Notes
- This batch changes both bracket visualization and historical ranking context; match cards/details can now show before/after rank movement rather than only pre-match state.

---

## Version 1.0011a - Version log endpoint, header sheet, Circuit 1 early rounds
**Date:** 2026-02-23 | **Commit(s):** 1975f0cd6762b4d2ec7d3384f0dbe99e98385413 | **Stats:** +1278 / -43

### Summary
- Header now reads the repository version log through an API endpoint, displays the latest version tag, and opens the full log in a side sheet.
- Added early-round data to `UThermal_2v2_Circuit_1.json` and expanded defaults for players appearing there.
- Replaced the older version-log instructions with the current evidence-based format used in this file.

### Changes
- `api/server.js` - Added `/api/versionlog` plain-text endpoint.
- `src/components/Header.tsx` - Fetches the version log, extracts the top `## Version ...` tag, and shows the full log in a `Sheet`.
- `docs/versionlog.md` - Replaced the earlier AI-agent guidance with the current evidence rules, required entry format, and ordering instructions.
- `output/UThermal_2v2_Circuit_1.json` - Added a large Early Round 1 / Early Round 2 block for Circuit 1.
- `output/player_defaults.json` - Added `RotterdaM`, `Pie`, `Coucoute`, `Molten`, `Bumbz`, and `Taruviel`.

### Notes
- The version log became a user-facing in-app surface in this commit, not just a docs file.

---

## Version 1.0011 - Newness K, confidence dampening, vs-new-team protection
**Date:** 2026-02-22 | **Commit(s):** 75ee5b0ae094ca78dc07d6c473f57b5002f11471 | **Stats:** +372 / -91

### Summary
- Ranking engine: explicit newness K-factor schedule, confidence multiplier (low conf dampens, high conf amplifies), and opponent-newness protection with "new vs new" moderation.
- Match history tooltips now show K breakdown (base × conf mult × protection) and opponent match count; Info page and docs updated to describe the three layers.
- Round sort order centralized in `rankingUtils.getRoundSortOrder()` (Early Round N, group stage, upper/lower bracket, Round of X); all ranking tools and processRankings use it.

### Changes
- `README.md` - Added "Rating System Notes" section describing base newness K, confidence multiplier, and protection vs new opponent.
- `docs/data-specification.md` - Added "Ranking/K-Factor Notes" with newness K schedule (1–2: 80, 3–4: 60, 5–8: 50, 9+: adaptive), confidence 0.9x–1.1x, and protection exception when both sides ≤4 matches.
- `src/components/MatchHistoryItem.tsx` - Tooltip shows `confidenceMultiplier`, `opponentMatchCount`, protection multiplier, "New vs New" note; K expression line (base × conf × protection = adjustedK).
- `src/pages/Info.tsx` - Provisional period and confidence score copy updated to match new newness schedule and damp/amplify behavior; "Use Initial Seeds" and baseline wording clarified.
- `tools/rankingCalculations.js` - `getProvisionalKFactor` renamed to `getNewnessKFactor` (matches 3–4: 60 not 40); `getConfidenceMultiplier()` added (0.9 + combinedConfidence/100*0.2); `applyOpponentNewnessAsymmetry()` added (protection by opponent match count, halved when both ≤4); `updateStatsForMatch()` takes `opponentMatchCount`, uses three layers (base K → confidence → asymmetry); `getNewnessScore()` added; backward-compat alias `getProvisionalKFactor = getNewnessKFactor`.
- `tools/rankingUtils.js` - `getRoundSortOrder(round)` added: Early Round N, group stage, upper/lower bracket rounds, Round of X, Quarterfinals/Semifinals/Final/Grand Final.
- `tools/processRankings.js` - Removed local `ROUND_ORDER`; uses `getRoundSortOrder`; added `getAverageOpponentMatches()`; passes `team1AvgOpponentMatches`/`team2AvgOpponentMatches` into `updateStatsForMatch`.
- `tools/calculateTeamRankings.js`, `tools/calculateRaceRankings.js`, `tools/calculateTeamRaceRankings.js` - Use `getRoundSortOrder`; pass opponent match count (or opponent confidence/match count) into `updateStatsForMatch`.
- `tools/runSeededRankings.js` - Same: `getRoundSortOrder`, `getAverageOpponentMatches`, opponent match count passed to `updateStatsForMatch`; new players/teams initialized with `initializeStats(name, {})` (fixed anchor).

### Notes
- Re-running rankings will change numbers due to new K schedule and opponent-newness protection. Docs and Info page now reflect current behavior.

---

## Version 1.0010 - K confidence both sides, common utils
**Date:** 2026-02-22 | **Commit(s):** 67dbb543187684bda9a533acabcbf6a00ca53a3d | **Stats:** +305 / -306

### Summary
- K-factor now uses combined confidence of both sides (self + opponent); race and team race rankings pass opponent confidence; team/player init uses fixed anchor (no population mean).
- Shared UI helpers moved to `src/lib/utils.ts` (`getRaceAbbr`, `ROUND_ORDER`); RaceMatchupStats uses backend `race_impacts` and match-specific race resolution.

### Changes
- `src/lib/utils.ts` - Added `ROUND_ORDER` map and `getRaceAbbr(race)` (Random→R, else first letter).
- `src/components/MatchBox.tsx` - Uses `getRaceAbbr` from `utils`; removed local `getRaceAbbrev`.
- `src/components/RaceMatchupStats.tsx` - Refactored: `getTeamRaces`, `resolvePerspectiveTeams`, `getOpponentMatchupKey`, `getBackendRaceImpactDelta`, `getMatchResult`; matchup stats use `match.race_impacts` deltas instead of local K/rating math; match count per matchup removed from display.
- `src/pages/TeamDetails.tsx`, `src/pages/TeamRaceRankings.tsx` - Import `ROUND_ORDER` from `utils`; removed local ROUND_ORDER.
- `src/pages/PlayerRankings.tsx` - Import formatting only (no behavior change).
- `tools/rankingCalculations.js` - `applyConfidenceAdjustment(baseK, confidence, opponentConfidence)` uses combined confidence; `updateStatsForMatch` returns `opponentConfidence`.
- `tools/rankingUtils.js` - `initializeStats(name, additionalFields)` no longer takes `populationMean`; new entities start at 0 unless seeded.
- `tools/processRankings.js` - `getAverageOpponentConfidence()` added; passes opponent confidence into `updateStatsForMatch`; new players initialized with `initializeStats(playerName, {})`.
- `tools/calculateTeamRankings.js` - Passes `team1Confidence`/`team2Confidence` into `updateStatsForMatch`; removed population-mean init for new teams.
- `tools/calculateRaceRankings.js` - Passes `inverseConfidenceBefore`/`matchupConfidenceBefore`; fixed win/loss args (`matchupLost`, `inverseWon`, etc.); removed `isDraw` from `updateStatsForMatch` call.
- `tools/calculateTeamRaceRankings.js` - Combo confidence tracked; `combo1TempStats`/`combo2TempStats` use pre-update match count and confidence; passes opponent confidence; draw handling for combo wins/losses.
- `tools/runSeededRankings.js` - `getAverageOpponentConfidence()` added; all `updateStatsForMatch` calls pass opponent confidence; new players/teams use `initializeStats(..., {})` without population mean.

### Notes
- Race matchup stats in UI now align with backend race rankings (race_impacts). Seeded rankings still use seeds when provided; otherwise anchor at 0.

---

## Version 1.0009 - Bonus Cup 4 data
**Date:** 2026-02-22 | **Commit(s):** f123fdef8d7801ac7940b692aa4474717b434c59 | **Stats:** +408 / -1

### Summary
- Added tournament data for uThermal 2v2 Circuit 2026 Bonus Cup #4 and two player defaults (Fluffy, Peekaboo).

### Changes
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_4.json` (405 lines) - Tournament matches and metadata for Bonus Cup 4.
- `output/player_defaults.json` - Added Fluffy (Zerg), Peekaboo (Protoss).

### Notes
- Data-only commit.

---

## Version 1.0008 - Bonus Cup 2 2026 (Bonus Cup 3 data)
**Date:** 2026-02-15 | **Commit(s):** e06ae4e0e1246d072384260ed962d43515586a60 | **Stats:** +444 / -0

### Summary
- Added tournament JSON for uThermal 2v2 Circuit 2026 Bonus Cup #3.

### Changes
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_Bonus_Cup_3.json` (444 lines) - Tournament matches and metadata.

### Notes
- Data-only commit.

---

## Version X1.0007 / X1.00071 - Feb tournament, bracket view, early rounds
**Date:** 2026-02-08 | **Commit(s):** 4a420a73, ca05f621 | **Stats:** +537 / -3 (4a420a73); ca05f621 adds early rounds to same tournament data

### Summary
- February 2026 circuit tournament data added (X1.0007); X1.00071 adds early-round matches to the same tournament JSON. Bracket view round order extended for lower bracket; version log guidelines for AI added in docs.

### Changes
- `docs/versionlog.md` - New "Guideline for versionlog update for AI-Agents" section (MCP-only, include diff, grouping, repo info, example entry).
- **NEW FILE:** `output/UThermal_2v2_Circuit_2026_2.json` - February 2026 tournament with upper/lower bracket and grand final (4a420a73); ca05f621 expands same file with early rounds data.
- `output/player_defaults.json` - Added herO (Protoss), Maru (Terran).
- `src/components/BracketView.tsx` - Upper bracket order extended with "Upper Bracket Quarterfinals"; lower bracket order includes "Lower Bracket Round 1", "Lower Bracket Round 2".

### Notes
- Bracket view supports the round names used in the Feb 2026 double-elim data. X1.00071 is data-only (early rounds added to existing tournament).

---

## Version X1.0006 series - Team race impact, combo fixes, build fix
**Date:** 2026-02-04 | **Commit(s):** 1f26a2c6, 372e8508, 4b0af87c, 24b3cdad | **Stats:** combined +235 / -81

### Summary
- API and UI now merge race_impacts and combo_impacts into player/team/match-history responses; MatchHistoryItem shows race and combo impacts with tooltips; combo key fixed to use race combo (e.g. PT) not team key; build fix removes unused icon imports.

### Changes
- `api/server.js` (1f26a2c6) - Team-race-matchup and team-race-combo load raceMatchHistory and comboMatchHistory; merge race_impacts and combo_impacts into matches; /api/match-history and /api/player, /api/team merge race_impacts and combo_impacts; hideRandom passed through where needed.
- `src/components/MatchHistoryItem.tsx` (1f26a2c6) - Race impact block uses match.race_impacts (backend) with tooltip per matchup (e.g. PvT); new Team Combo Impact block with combo_impacts and getRatingChangeTooltip.
- `src/pages/TeamDetails.tsx` (1f26a2c6) - highlightCombo computed from player races and passed to MatchHistoryItem.
- `src/pages/TeamRaceRankings.tsx`, `src/pages/RaceRankings.tsx`, `src/pages/MatchesList.tsx` (1f26a2c6) - race_impacts passed through; match history order/convert for component.
- `tools/calculateTeamRaceRankings.js` (1f26a2c6) - combo_impacts key changed from team1Key/team2Key to team1Combo/team2Combo (race combo).
- (372e8508 - Teamcombo fixes: additional combo/race wiring as needed.)
- `api/server.js` (4b0af87c) - /api/match-history loads combo from calculateTeamRaceRankings; team-race endpoints use match.combo_impacts from matchHistory, no separate comboMatchMap.
- `src/components/MatchHistoryItem.tsx` (4b0af87c) - Combo block shows single matchup label (e.g. PTvsZZ), highlightCombo support, isCombo in getRatingChangeTooltip.
- `src/pages/PlayerRankings.tsx`, `src/pages/TeamRankings.tsx` (24b3cdad) - Removed unused TrendingUp, TrendingDown imports (build fix).

### Notes
- Race and combo impacts now flow from ranking tools through API into detail pages and match history.

---

## Version X1.0005 - Race matchup stats
**Date:** 2026-02-03 | **Commit(s):** fcc4267964ea0c8db6693de9f3d9eda2626330a2 | **Stats:** +219 / -10

### Summary
- New RaceMatchupStats component shows wins/losses/draws and win rate by opponent race(s); integrated into Player and Team detail pages.

### Changes
- **NEW FILE:** `src/components/RaceMatchupStats.tsx` (187 lines) - Computes matchup keys (e.g. TP, ZZ, P) from opponent races, aggregates W/L/D and win rate, progress bar and percentage display; supports single player or team.
- `src/pages/PlayerDetails.tsx` - RaceMatchupStats added between rating chart and match history; layout wrapped in `space-y-6`.
- `src/pages/TeamDetails.tsx` - Same: RaceMatchupStats with `playerNames={[player1, player2]}`, `isTeam={true}`.

### Notes
- Uses player default races for opponent race when not on match; later commits add match-specific race and backend race_impacts.

---

## Version 1.0005b / x1.0005a / x1.00005a - Tooltip UI, race fixes, match-specific race
**Date:** 2026-02-03 | **Commit(s):** ad1a77cc, 3d2c0e0d, 5b65b674 | **Stats:** +26/-8 (tooltip), +102/-9 (race fixs), +327/-59 (match-specific race)

### Summary
- Tooltip component restyled (white background, border, arrow). API and RaceMatchupStats use match-specific races (player1_race/player2_race from backend) and optional per-matchup rating; team merge from playerMatch for race data. Match history and detail pages use match-specific race when available (else default); getRaceAbbr centralized in utils; processRankings emits player1_race/player2_race from player defaults.

### Changes
- `src/components/ui/tooltip.tsx` (ad1a77cc) - getArrowStyles(side) with inline styles; tooltip container bg-white, border, shadow; arrow border color #ffffff.
- `api/server.js` (3d2c0e0d) - Team endpoint merge: team1/team2 from playerMatch when available so race data is present.
- `src/components/RaceMatchupStats.tsx` (3d2c0e0d) - Rating and matchCount per matchup; local predictWinProbability, getKFactor, calculateRatingChange; sorted matches; display rating and ratingChange; getMatchRaces uses match player1_race/player2_race; Match interfaces gain player1_race, player2_race.
- `src/components/MatchHistoryItem.tsx` (5b65b674) - getPlayerRaceInMatch(playerName, team, playerRaces) uses team.player1_race/player2_race then fallback to playerRaces; race display uses that; getRaceAbbr from utils.
- `src/lib/utils.ts` (5b65b674) - getRaceAbbr(race) added (Random→R, else first letter).
- `src/components/RaceMatchupStats.tsx` (5b65b674) - getMatchRaces(match, teamPlayers) for match-specific races; MatchHistoryItem integration, modal for matchup history; playerRankings, teamRankings, getTeamImpact, getPlayerImpact, formatDate props; PlayerDetails/TeamDetails pass those into RaceMatchupStats.
- `tools/processRankings.js` (5b65b674) - loadPlayerDefaults(), getPlayerRace(player, playerDefaults); match history entries include player1_race, player2_race (from match race or playerDefaults); calculateRankingsFromMatches takes playerDefaults.
- `src/pages/PlayerDetails.tsx`, `src/pages/TeamDetails.tsx`, `src/pages/MatchesList.tsx`, `src/pages/TeamRankings.tsx` (5b65b674) - getRaceAbbr from utils; Match interfaces player1_race/player2_race; RaceMatchupStats props for modal and impacts.

### Notes
- Backend match history now carries race abbreviations so UI can show race used in each match; ranking pipeline reads player_defaults and injects races into match payload.
---

## Version X1.0004 - Player races update
**Date:** 2026-02-03 | **Commit(s):** 9f741b94110e75d3d03c206ce3f48574c3975505 | **Stats:** +12 / -14

### Summary
- Tournament JSON and player defaults updated: main event metadata (is_main_circuit, season), some match races set to Random, player_defaults edits (add/remove entries, race changes).

### Changes
- `output/UThermal_2v2_Circuit_Main_Event.json` - Added is_main_circuit: true, season: 2025; trigger, Lambo, uThermal race set to Random in selected matches.
- `output/player_defaults.json` - Blademaster Protoss; removed RyeRye, SirGheorghe, RACCOON, Jaeger, Elimisu, Sivean, armonox, GeneParmesean; added HonMonO (Terran), Rate (Random), WannaBeByuN (Terran), prome (Protoss).

### Notes
- Data-only commit.

---

## Version X1.0003 series - Filter and defaults, stats display
**Date:** 2026-02-02 | **Commit(s):** 708e1847, aaf002e7, 21680cc9 | **Stats:** 708e1847 +2/-2; others (filter/defaults) variable

### Summary
- Ranking pages: total matches card uses divided counts (players ÷4, teams ÷2). Filter and default improvements for rankings/race views; RaceRankings match history uses convertMatchForComponent and formatDate/normalizeTeamKey.

### Changes
- `src/pages/PlayerRankings.tsx` (708e1847) - Card total: `rankedRankings.reduce(..., 0) / 4` (was /2).
- `src/pages/TeamRankings.tsx` (708e1847) - Card total: `Math.floor(rankedRankings.reduce(..., 0) / 2)`.
- (21680cc9 X1.0003) - MatchHistoryItem: removed getRaceChangeTooltip, showComboInfo/comboInfo; RatingChart: removed unused LineChart; PlayerRankings: removed local getRaceAbbr; RaceRankings: convertMatchForComponent, ROUND_ORDER/Target/TrendingUp/Down removed, normalizeTeamKey and formatDate passed to MatchHistoryItem; TeamRaceRankings: ratingChange logic simplified.
- (aaf002e7 X1.0003a) - Filter and default refinements.

### Notes
- Stats cards now reflect “unique matches” style counts where appropriate.

---

## Version X1.0002a / X1.0002 CS - Cleanup
**Date:** 2026-02-02 | **Commit(s):** dbee9507, 218e311a | **Stats:** +30 / -68

### Summary
- TeamRaceRankings: removed combined-stats ratingChange ordering block. MatchHistoryItem and RaceRankings/TeamRaceRankings cleanup (unused props, convert match for component).

### Changes
- `src/pages/TeamRaceRankings.tsx` (dbee9507) - Removed ~24 lines: ratingChange branch for isCombinedStats vs individual matchup (team1Combo/team2Combo swap and ratingChange sign).
- `src/components/MatchHistoryItem.tsx` (218e311a) - Removed performanceDiff variable; removed getRaceChangeTooltip; removed showComboInfo, comboInfo props.
- `src/components/RatingChart.tsx` (218e311a) - Removed unused LineChart import.
- `src/pages/PlayerRankings.tsx` (218e311a) - Removed local getRaceAbbr.
- `src/pages/RaceRankings.tsx` (218e311a) - convertMatchForComponent added; match history uses it and normalizeTeamKey, formatDate.
- `src/pages/TeamRaceRankings.tsx` (218e311a) - ratingChange only, no team1Combo/team2Combo in block.

### Notes
- Code shrink and consistent use of shared utils (getRaceAbbr later in utils).

---

## Version X1.0002 White UI
**Date:** 2026-02-01 | **Commit(s):** 14bd72e31a40fd45d51d521473867986c1406037

### Summary
- UI theme/styling update: white/light emphasis across ranking and detail pages.

### Changes
- Theming and layout updates across ranking and detail views (exact file list in commit diff).

### Notes
- Prep for ShadCN and consistent light theme.

---

## Version D1.00001 - ShadCN components
**Date:** 2026-02-01 | **Commit(s):** 891e524a68cec0b1add85757e6509a4d3aa0af32

### Summary
- Introduced ShadCN UI component set; styling and components aligned with ShadCN patterns.

### Changes
- ShadCN-style components and theme integration (exact file list in commit diff).

### Notes
- Per project rules, styling uses Tailwind and ShadCN UI.

---

## Version B1.0011 - Chart for detail pages
**Date:** 2026-01-31 | **Commit(s):** ff84f407117bc937825ec6de17f82a5eb54e234b

### Summary
- Rating chart added to player and team detail pages to show rating over time.

### Changes
- RatingChart (or equivalent) integrated into PlayerDetails and TeamDetails; chart data derived from match history (exact file list in commit diff).

### Notes
- Complements match history and stats on detail pages.

---

## Version B1.0010 - Draws and off-circuit tournaments
**Date:** 2026-01-31 | **Commit(s):** 8a6ea911f09c4428fb37726a9fe0a8a241d9a40b

### Summary
- Draw handling and additional off-circuit tournament data or filters.

### Changes
- Draw support in ranking/match logic and/or tournament data (exact file list in commit diff).

### Notes
- Data and logic for draws and non-main-circuit events.

---

## Version B1.0009 - Ranking calculation less volatile
**Date:** 2026-01-30 | **Commit(s):** 2b542de68c3f3af9b15612e55a288f84d481a170 | **Stats:** +25 / -15

### Summary
- Provisional K-factor made zig-zag (1–2: 80, 3–4: 40, 5–8: 50, 9+: adaptive); confidence multiplier capped at 1.2x; win-probability curve flattened (base 3 instead of 10).

### Changes
- `tools/rankingCalculations.js` - getProvisionalKFactor: matches 1–2 → 80, 3–4 → 40, 5–8 → 50, 9+ → 32 + 100/matchCount capped at 50. applyConfidenceAdjustment: max multiplier 1.2 (was 1.5). predictWinProbability: base 10 → 3 (flatter curve, ~75% at 1 std dev).

### Notes
- Less volatile early ratings and more stable win expectancy.

---

## Version B1.0003–B1.0008 - Tournament data, FAQ, header, UI order
**Date:** 2026-01-30 | **Commit(s):** 0675f786, 0d6abc89, 993ee6c9, 1e2cc008, 06ced077, 850b027a, 55ce0e19

### Summary
- 2026 Bonus Cup II data; FAQ (B1.0007a); header and secondary header (B1.0008, B1.0008a); UI order fixes for race pages and match history (actual vs current ranking, race tooltip, player/team order).

### Changes
- Tournament JSON and/or player defaults (0675f786 B1.0003). UI order and ranking display fixes (0d6abc89 B1.0004, 993ee6c9 B1.0005, 1e2cc008 B1.0006). FAQ content (06ced077 B1.0007a). Header and filter/secondary header (850b027a B1.0008, 55ce0e19 B1.0008a).

### Notes
- Mixed data and UI polish; match history and race tooltips show “actual” ranking at time of match where applicable.

---

## Version B1.0007 - Infopage
**Date:** 2026-01-30 | **Commit(s):** 88f29b53566d78d34084f3fa5c5a75ef42020871 | **Stats:** +195 / -9

### Summary
- New Info page describing system overview, ranking categories (player, team, race, team-race), K-factor/confidence, chronological processing, and seeded rankings.

### Changes
- **NEW FILE:** `src/pages/Info.tsx` (170 lines) - System overview, ranking categories, technical implementation (win probability, K-factor, confidence, seeding 3-pass).
- `src/App.tsx` - View type 'info'; route to Info; Info onBack.
- `src/pages/TournamentEditor.tsx` - onNavigateToInfo prop; "Info" button in header.

### Notes
- Single place for users to read how rankings and confidence work.

---

## Version B1.0002 / C1.0001 / B1.0001 - Ranking fixes, timestamp, initial seed
**Date:** 2026-01-30 | **Commit(s):** d2351505, a7f06754, 85d81e8e, 98b588cd (and 2cc85807, c50df935, 32f578f7)

### Summary
- Bug fixes for team/race ranking timing; timestamp handling fix; initial seed system fixes; Vercel config and deployment fixes.

### Changes
- (d2351505 B1.0002) - Various bug fixes related to ranking calculations and match timing for team/race.
- (a7f06754 C1.0001) - Timestamp issue fix.
- (85d81e8e B1.0001) - Fixes for initial seed system.
- (98b588cd B1.0001) - Initial seed or ranking baseline.
- (2cc85807, c50df935, 32f578f7 B1.0002a/b/c) - More fixes; Vercel fix; Vercel config.

### Notes
- Ensures correct chronological application of matches and correct seeding behavior.

---

## Version 1.00009 - Initial seed and UI filtering
**Date:** 2026-01-17 | **Commit(s):** ffff60bc128cfa03f152daa892e29c2002321f3a

### Summary
- Optional initial seed system and improved UI filtering for rankings/lists.

### Changes
- Seeded rankings and filter UI improvements (exact file list in commit diff).

### Notes
- Aligns with “Use Initial Seeds” and filter controls in the app.

---

## Version 1.00008 - Improve ranking calculations
**Date:** 2026-01-16 | **Commit(s):** 946ec85fff2fec4a32e88a6f6dd02e76d73ca22b

### Summary
- Refinements to ranking calculation pipeline and output.

### Changes
- Updates to ranking tools and/or processRankings (exact file list in commit diff).

### Notes
- Incremental improvement on 1.00006/1.00007.

---

## Version 1.00007a / 1.00007 - Better UI tooltips, enhance UI
**Date:** 2026-01-16 | **Commit(s):** ca88a80f, 59aac32abda8906bb50c53c426becce303e7902c

### Summary
- Tooltip and general UI improvements on ranking and detail pages.

### Changes
- (ca88a80f 1.00007a) - Better UI tooltips.
- (59aac32a 1.00007) - Enhance UI across relevant pages.

### Notes
- UX polish before docs and later ranking changes.

---

## Version 1.00006 - Enhance calculator
**Date:** 2026-01-16 | **Commit(s):** b8a41d4881f2ac3d54e5c8d67367e2367dbcc8c4 | **Stats:** +475 / -20

### Summary
- Full enhanced ranking system: provisional K-factor, confidence tracking, confidence-based K adjustment, tighter scale (350); bracket and detail pages show team rank and confidence; plan document added.

### Changes
- **NEW FILE:** `.cursor/plans/enhanced_ranking_system_52d51741.plan.md` (273 lines) - Plan for provisional K, confidence, K adjustment, scale, seeding.
- `tools/rankingCalculations.js` - getProvisionalKFactor (1–5: 80, 6–10: 48, 11–20: 40, 21+: adaptive); updateConfidence; applyConfidenceAdjustment; predictWinProbability scale 350; updateStatsForMatch uses provisional K and confidence.
- `tools/rankingUtils.js` - initializeStats: confidence 0.
- `src/components/BracketView.tsx` - Load team rankings from API; teamRankings state; pass teamRankings to MatchBox.
- `src/components/MatchBox.tsx` - teamRankings prop; getTeamKey; display team rank (e.g. (1)) next to team names.
- `src/pages/PlayerDetails.tsx` - Confidence in details; grid 5 cols; confidence card with color by level.
- `src/pages/TeamDetails.tsx` - Same: confidence card, 5 cols.
- `src/pages/TeamRankings.tsx` - loadPlayerRankings; player rank shown next to each player in team cell; convertMatchForComponent usage.

### Notes
- Foundation for all later K/confidence changes; 1.0011 and 1.0010 refine the same system.

---

## Version 1.00005b - Docs
**Date:** 2026-01-16 | **Commit(s):** 1092f97656a65ad6e94d5da47cd0ae19e9341644 | **Stats:** +225 / -27

### Summary
- Documentation and version log added: README updated for bracket/group stage and match editing; AI prompt docs and data spec expanded; initial version log with entries up to 1.0005a.

### Changes
- `README.md` - Current Status and Scraper sections updated (bracket types, group stage, score editing); Getting Started steps 5–7 clarified (viewing tournaments, editing matches, download).
- `docs/AIpromt_docs.md` - Restructured: docs to update, rules vs README, version log format (MCP tools, entry guidelines), current project features (scraper, UI, data).
- `docs/data-specification.md` - Round/stage examples include group names; Matchlist template and group stage format; "Tournament Formats Supported" (single/double-elim, group stage); note on manual score editing.
- **NEW FILE:** `docs/versionlog.md` (114 lines) - Version log with AI instructions and entries from 1.0005a back to 1.00001.

### Notes
- This commit created the version log file; entries above (1.0011–X1.0005) are later additions.

---

## Version 1.0005a - 2026-01-16 (f8451990)

### 🎯 **Group Stage/Round Robin Support**

#### ✅ **Scraper Enhancements**
- **tools/scraper.js**: Added `parseGroupStage()` function to extract matches from `{{Matchlist}}` templates
- Enhanced group name detection with multiple pattern matching (Group A/B headers, GroupTableLeague titles)
- Extracts matches from Matchlist templates (M1, M2, M3, etc.) with unique IDs (`GS_M1_1`, `GS_M2_1`)
- Combines bracket matches and group stage matches in final output

#### ✅ **UI Enhancements**
- **src/components/BracketView.tsx**: Added tab navigation for "Playoffs" vs "Group Stage"
- Separated group stage matches from bracket matches with automatic detection
- Group stage matches displayed in responsive grid layout grouped by group name
- Each group shown in dedicated card with match count

#### ✅ **Match Editor Enhancements**
- **src/components/MatchEditor.tsx**: Added score editing functionality
- Centered score input section with Team 1 and Team 2 score fields
- Real-time score updates with proper null handling for missing scores
- Visual score separator (":") and "Best of X" display

---

## Version 1.0005 - 2026-01-16 (3acf0414)

### 🎯 **Double-Elimination Bracket Support**

#### ✅ **Bracket View Enhancements**
- **src/components/BracketView.tsx**: Enhanced bracket rendering for double-elimination tournaments
- Separated upper bracket and lower bracket rounds with visual distinction
- Lower bracket detection based on round name patterns ("Lower Bracket" keyword)
- Grand Final displayed separately after lower bracket
- Dynamic round ordering for both single and double-elimination formats

#### ✅ **Round Detection Logic**
- Implemented `useMemo` hooks for efficient round categorization
- Upper bracket rounds exclude "Lower Bracket" matches
- Proper sorting for both bracket types with fallback alphabetical ordering

---

## Version 1.00004 - 2026-01-16 (35539c8b)

### 📊 **Additional Tournament Data**

#### ✅ **Data Collection**
- Enhanced tournament data collection and processing
- Improved match data extraction and storage

---

## Version 1.00003a - 2026-01-16 (ef2da9e1)

### 🔧 **Git Output Fixes**

#### ✅ **Output Improvements**
- Fixed git output formatting and display issues
- Improved commit message handling

---

## Version 1.00003 - 2026-01-15 (2cb5ed30)

### 📊 **Statistics Enhancements**

#### ✅ **Additional Statistics**
- Added more statistical calculations and displays
- Enhanced data analysis capabilities

---

## Version 1.00003 - 2026-01-15 (9a38ca19)

### 🏆 **Ranking System Alpha**

#### ✅ **Ranking Implementation**
- Initial implementation of ranking system
- Player and team ranking calculations
- Ranking display components

---

## Version 1.00002a - 2026-01-15 (5329d8ec)

### 🔧 **Setup Improvements**

#### ✅ **Configuration Updates**
- Refined project setup and configuration
- Improved development environment setup

---

## Version 1.00002 - 2026-01-15 (83c4e5ea)

### ✅ **Working Setup**

#### ✅ **Initial Setup**
- Established working project setup
- Basic functionality implemented

---

## Version 1.00001 - 2026-01-15 (0e29bc0d)

### 🚀 **New Iteration Initial Commit**

#### ✅ **Project Restart**
- New iteration of SC2 2v2 Stats project
- Initial commit with basic structure
- React + TypeScript + Vite setup
- Express.js API server for tournament data
