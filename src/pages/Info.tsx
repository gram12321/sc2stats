interface InfoProps {}

export function Info({}: InfoProps) {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-6 space-y-8">
        <div className="mb-2">
          <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
          <p className="text-sm text-gray-600 mt-1">
            This page documents current behavior from the live codebase (rankings, tooltips, filters, highlights, and charts).
          </p>
        </div>

        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
          <div className="space-y-3 text-gray-700 text-sm leading-relaxed">
            <p>
              SC2Stats replays the full filtered match history in chronological order and recalculates model state from scratch.
              Player and Team rankings are the primary leaderboards. Race and Team Race are separate analytical rating models.
            </p>
            <p>
              Filters are calculation filters, not display-only filters. Toggling Main Circuit, Seasons, Seeds,
              Intermediate Team Rating (ITR), Random, or Mirror handling changes which matches and inputs feed the run.
            </p>
            <p>
              Match history, detail pages, and highlights all read from the same recalculated model output and expose
              calculation metadata (expected win, K layers, scoreline terms, confidence, and rank snapshots).
            </p>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Ranking Categories</h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
              <h3 className="text-lg font-bold text-blue-900 mb-2">Player Rankings</h3>
              <p className="text-blue-800 text-sm">
                Tracks each player across all teams they appear in. Confidence affects volatility and rank visibility,
                and scoreline quality is included in each update.
              </p>
            </div>

            <div className="bg-purple-50 rounded-lg p-5 border border-purple-100">
              <h3 className="text-lg font-bold text-purple-900 mb-2">Team Rankings</h3>
              <p className="text-purple-800 text-sm">
                Tracks fixed 2-player duos as separate entities. Optional ITR can blend player-derived strength into
                early team matches, with a fade-out based on team match count.
              </p>
            </div>

            <div className="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
              <h3 className="text-lg font-bold text-indigo-900 mb-2">Race Statistics</h3>
              <p className="text-indigo-800 text-sm">
                Directional race model, but each matchup pair is deduplicated into one canonical row (PvZ and ZvP
                are shown as one entry, the direction with more points). Optional "Ignore Mirror" filter excludes
                matches where either team runs a same-race combo (PP, TT, ZZ, RR).
              </p>
            </div>

            <div className="bg-orange-50 rounded-lg p-5 border border-orange-100">
              <h3 className="text-lg font-bold text-orange-900 mb-2">Team Race Statistics</h3>
              <p className="text-orange-800 text-sm">
                Combo model (for example PT vs ZZ). Matchups are normalized so PT vs ZZ is the same pairing as
                ZZ vs PT. Optional "Ignore Mirror" filter excludes matches where either team runs a mirror combo
                (PP, TT, ZZ, RR).
              </p>
            </div>

            <div className="bg-emerald-50 rounded-lg p-5 border border-emerald-100 md:col-span-2">
              <h3 className="text-lg font-bold text-emerald-900 mb-2">Highlights, Maps, and Detail Analytics</h3>
              <p className="text-emerald-800 text-sm">
                Highlights, map-coverage reporting, and Player/Team detail charts are derived from the same filtered
                dataset and expose model-side metadata for traceability.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Technical Implementation</h2>

          <div className="space-y-6 text-gray-700 text-sm leading-relaxed">
            <div>
              <h3 className="font-bold text-gray-900 mb-2">Win Probability and Calibration</h3>
              <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md space-y-1">
                <li><strong>Raw expected win:</strong> <code>P(win) = 1 / (1 + 3^((opp - self) / populationStdDev))</code></li>
                <li><strong>Calibration:</strong> expected probability is temperature-scaled in logit space (enabled by default, temperature = 1.4).</li>
                <li><strong>Population spread:</strong> population standard deviation is recomputed from current model state during processing.</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Adjusted K (3 Layers)</h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <div><strong>Adjusted K = Base K * Confidence Multiplier * Opponent-Newness Multiplier</strong></div>
                <div><strong>Base K schedule:</strong> matches 1-2 = 60, 3-4 = 40, 5-8 = 25, then <code>min(50, 18 + 100/matches)</code>.</div>
                <div><strong>Confidence multiplier:</strong> uses combined confidence of both sides (0.90x at 0%, 1.00x at 50%, 1.10x at 100%).</div>
                <div>
                  <strong>Opponent-newness protection:</strong> strongest versus very new opponents, then fades with opponent match count.
                  If both sides are very new (at most 4 matches), protection is moderated so early calibration still happens.
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Final Rating Change = Match Term + Scoreline Term</h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <div><strong>Match term:</strong> binary outcome (win/loss/draw) weighted by a series-length multiplier.</div>
                <div><strong>Scoreline term:</strong> map share signal (<code>maps won / maps played</code>) vs expected share, weighted by series length and reliability.</div>
                <div><strong>Score weight:</strong> <code>0.55 * marginSeriesFactor * reliabilityFactor</code>.</div>
                <div><strong>Result:</strong> winners can still gain less than expected, or even lose points, when scoreline underperforms expectation.</div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Confidence Update Rules</h3>
              <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md space-y-1">
                <li>Confidence is clamped to 0-100% and updated after each match.</li>
                <li>Correct prediction: <code>+5 * (1 - confidence/100)</code>.</li>
                <li>Incorrect prediction: <code>-5 * (confidence/100)</code>.</li>
                <li>Draws are treated as correct only when expectation was near even (40%-60%).</li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Intermediate Team Rating (ITR)</h3>
              <div className="bg-amber-50 p-4 rounded-md border border-amber-100 space-y-2">
                <div>Optional team-only blend used for prediction inputs on early team matches.</div>
                <div><strong>Player-derived source:</strong> average of current player-model ratings for the two teammates (when available).</div>
                <div><strong>Blend weight:</strong> <code>clamp((fadeMatches - teamMatches) / fadeMatches, 0, 1)</code>, default fade = 20 matches.</div>
                <div><strong>Effective team rating:</strong> <code>(ITR source * blend) + (direct team rating * (1 - blend))</code>.</div>
                <div>ITR metadata is exposed in team rows, team detail summaries, and team-impact tooltips.</div>
              </div>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Chronology, Filters, and Seeds</h3>
              <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md space-y-1">
                <li>Processing order is strict: tournament date to match date to round order to match id.</li>
                <li>Round ordering supports early rounds, group stage, upper/lower rounds, Round of X, and finals.</li>
                <li>Seeded mode uses a three-pass process. Current seeding script seeds from 2025 data (forward + reverse), then runs all data from averaged seeds.</li>
                <li>Seeded endpoints can return precomputed files when unfiltered, but recalculate when active filters or ITR require it.</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">Feature Notes</h2>

          <div className="space-y-5 text-sm text-gray-700 leading-relaxed">
            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-900 mb-2">Highlights</h3>
              <p>
                Highlights are computed from the currently filtered dataset (Seeds/Main Circuit/Seasons/ITR/Random).
                Biggest Upset uses the lowest winner expected-win value. Largest Skill Difference uses the highest
                favorite expected-win value where the favorite actually won. Biggest Rating Gain uses the winner team's
                team-impact rating change.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-900 mb-2">Random Eligibility in Peak Tables</h3>
              <p>
                Random entries are stricter than fixed races. For player-race peaks, Random only qualifies when Random
                is that player's most-used race in the filtered scope. For combo peaks, Random combos only qualify when
                that combo is the team's most-used combo in the same scope.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-900 mb-2">Rating and Rank Graphs</h3>
              <p>
                Player and Team detail pages provide Rating/Rank chart modes plus Date/Match-axis toggles.
                Rating mode includes a confidence band derived from impact metadata:
                <code>margin = populationStdDev * (1 - confidence/100)</code>, plotted as <code>rating +/- margin</code>.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Map Data</h3>
              <p>
                The Maps page reports map-entry coverage from tournament JSON output, with early rounds excluded from
                primary coverage metrics because map records are generally less complete there.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4">
              <h3 className="font-bold text-gray-900 mb-2">Match Predictor</h3>
              <p>
                The Match Predictor (under Rankings) calculates calibrated win probability and series outcome
                distribution (e.g. 3-0, 2-1, 1-2, 0-3) for any two teams. Known teams use their stored team rating
                with ITR blend applied if enabled. Unknown teams (no shared match history) are built from each
                player's individual rating using the full intermediate blend weight. The predictor respects the
                current Seeds, Main Circuit, Season, and ITR filter settings.
              </p>
            </div>

            <div>
              <h3 className="font-bold text-gray-900 mb-2">Prediction Quality</h3>
              <p>
                The Predictions page (under Stats &amp; Info) scores all pre-match <code>expectedWin</code> values
                stored in the team impact history against actual outcomes. Metrics include Brier score, log loss,
                favorite accuracy, and confidence-bucket calibration. A Settings Impact table compares nearby
                setting variants (seeds on/off, ITR on/off, circuit scope, season scope) against the current
                baseline using Brier delta and absolute-gap delta. The same analysis is available from the CLI
                via <code>npm run analyze-prediction-quality</code>.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900 mb-4">FAQ</h2>

          <div className="space-y-4 text-sm leading-relaxed">
            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Why do some Players or Teams show no numeric rank?</h3>
              <p className="text-gray-700">
                Numeric rank display is confidence-gated. Entries below the current confidence threshold are still tracked,
                but can appear without a number unless low-confidence filtering is enabled.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What does the ITR badge mean?</h3>
              <p className="text-gray-700">
                ITR means prediction used a blended effective team rating: part player-derived source and part direct team rating.
                The shown percentage is the player-derived share used for that team at that point in time.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Does ITR affect Player, Race, or Team-Combo impacts?</h3>
              <p className="text-gray-700">
                No. ITR applies only to Team impact prediction inputs. Player, Race, and Team Combo impacts use their direct models.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Why can ITR appear in one team match but not another?</h3>
              <p className="text-gray-700">
                Blend weight fades with team match count and is also zero when no valid player-derived source exists.
                As teams become established, prediction naturally converges to direct team rating.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Can a match winner lose rating points?</h3>
              <p className="text-gray-700">
                Yes. Because total change is result term plus scoreline term, a heavy favorite can underperform expected
                map share strongly enough to reduce or reverse net gain.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What are "Expected Series Scorelines" in match tooltips?</h3>
              <p className="text-gray-700">
                They convert expected single-map win probability into likely BO outcome distributions (for example 2-0/2-1/1-2/0-2 in BO3).
                They are model expectations, not guaranteed outcomes.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Why do Highlights change when I toggle filters?</h3>
              <p className="text-gray-700">
                Highlights are recalculated from the currently included match history and model outputs. Filters change
                both the candidate matches and the expected-win values used to rank highlight records.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Are Race and Team Race stats used to update Player or Team leaderboards?</h3>
              <p className="text-gray-700">
                No. They are separate analytical tracks and do not feed back into Player or Team rating changes.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What does "Use Initial Seeds" do?</h3>
              <p className="text-gray-700">
                It switches Player/Team pages to seeded outputs. With filters (or Team ITR), seeded endpoints may
                recalculate from stored seed values so results stay filter-consistent.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">How is the chart confidence band computed?</h3>
              <p className="text-gray-700">
                The rating chart uses post-match confidence and stored population standard deviation from impact data.
                Band width is <code>populationStdDev * (1 - confidence/100)</code>, so low confidence widens the band.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Why can tiny differences appear between shown terms and totals?</h3>
              <p className="text-gray-700">
                Internal calculations use higher precision than the UI display. Small differences are normal rounding effects.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">When are rankings recalculated?</h3>
              <p className="text-gray-700">
                Rankings are recalculated from the relevant filtered history when endpoints are requested.
                Editing old matches can therefore change later ratings.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What does the Match Predictor do for a team with no match history?</h3>
              <p className="text-gray-700">
                When a team has no recorded matches, the predictor builds an ad-hoc rating from the individual
                player ratings of the two named players using a full intermediate blend weight (100% player-derived).
                Both named players must be known in the current filter scope. The team source indicator in the
                result shows "player-average" vs "team-rating" to distinguish the two cases.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What does "Ignore Mirror matchups" do?</h3>
              <p className="text-gray-700">
                Enabling this filter excludes any match where either team runs a mirror race combo (both players on
                the same race: PP, TT, ZZ, or RR) from race and team-race ranking calculations. It is off by default
                and persisted in localStorage alongside the Random filter.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">What does Brier score mean on the Predictions page?</h3>
              <p className="text-gray-700">
                Brier score is the mean squared error between predicted win probability and actual outcome (1 for
                win, 0 for loss). Lower is better; a random 50/50 predictor scores 0.25. Log loss penalises
                overconfident wrong predictions more heavily. The Settings Impact table shows how much each
                setting change moves these metrics relative to the current baseline.
              </p>
            </div>

            <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
              <h3 className="font-bold text-gray-900 mb-2">Why are Race Ranking rows deduplicated?</h3>
              <p className="text-gray-700">
                Each race matchup pair (PvZ and ZvP) is shown as a single canonical row — the direction with
                more cumulative points. Combined stats (TvX, ZvX, PvX) aggregate from both sides of each
                deduplicated pair so all matches are counted correctly.
              </p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
