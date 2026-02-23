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
