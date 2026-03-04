
interface InfoProps { }

export function Info({ }: InfoProps) {
      return (
            <div className="min-h-screen bg-gray-50">
                  <div className="max-w-4xl mx-auto p-6 space-y-8">
                        <div className="mb-2">
                              <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
                        </div>

                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
                              <p className="text-gray-700 leading-relaxed">
                                    This project tracks StarCraft II 2v2 results and recalculates rankings from full match history.
                                    Rankings are prediction-based and update after every match for players, teams, race matchups,
                                    and team-race compositions. The system uses chronological replay of all included matches so current
                                    ratings reflect the complete sequence of results.
                              </p>
                        </section>

                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-6">Ranking Categories</h2>

                              <div className="grid gap-6 md:grid-cols-2">
                                    <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                                          <h3 className="text-lg font-bold text-blue-900 mb-2">Player Rankings</h3>
                                          <p className="text-blue-800 text-sm">
                                                Individual skill estimate across all teams that player has appeared in.
                                                A player on a stronger team is expected to win more than the same player on a weaker team,
                                                so context still matters even in individual ranking updates.
                                          </p>
                                    </div>

                                    <div className="bg-purple-50 rounded-lg p-5 border border-purple-100">
                                          <h3 className="text-lg font-bold text-purple-900 mb-2">Team Rankings</h3>
                                          <p className="text-purple-800 text-sm">
                                                Ranking for fixed 2-player pairs. Each unique duo is a separate entity with its own match history,
                                                confidence, and rating trajectory.
                                          </p>
                                    </div>

                                    <div className="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
                                          <h3 className="text-lg font-bold text-indigo-900 mb-2">Race Statistics</h3>
                                          <p className="text-indigo-800 text-sm">
                                                Directional race matchups (e.g. PvT is different from TvP) updated from race-vs-race outcomes
                                                extracted from team matches. These stats are analytical and do not directly modify player/team ratings.
                                          </p>
                                    </div>

                                    <div className="bg-orange-50 rounded-lg p-5 border border-orange-100">
                                          <h3 className="text-lg font-bold text-orange-900 mb-2">Team Race Statistics</h3>
                                          <p className="text-orange-800 text-sm">
                                                Team composition matchup stats (e.g. PT vs ZZ). This tracks how race pairings perform as a unit.
                                                Like race stats, this is currently analytical and separate from player/team leaderboard rank assignment.
                                          </p>
                                    </div>
                              </div>
                        </section>

                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">Technical Implementation</h2>

                              <div className="space-y-6 text-gray-700">
                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">The Core Ranking Algorithm</h3>
                                          <p className="mb-2">
                                                The model is Elo-like, but uses both match result and scoreline quality.
                                                Expected win chance uses a logistic curve with adaptive population spread.
                                          </p>
                                          <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md text-sm space-y-1">
                                                <li><strong>Expected Win:</strong> <code>P(win) = 1 / (1 + 3^((opp - self) / populationStdDev))</code></li>
                                                <li><strong>Final Change:</strong> <code>MatchTerm + ScorelineTerm</code></li>
                                                <li><strong>ScorelineTerm:</strong> Can be positive or negative, so a winner may still lose points on a narrow underperformance.</li>
                                          </ul>
                                    </div>

                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">K-Factor, Confidence, and Newness</h3>
                                          <p className="mb-2">
                                                Volatility is dynamic. The system blends provisional K scheduling, confidence, and opponent-newness protection.
                                          </p>
                                          <div className="grid md:grid-cols-2 gap-4 mt-2">
                                                <div className="bg-blue-50 p-4 rounded-md">
                                                      <h4 className="font-semibold text-blue-900 text-sm mb-1">Provisional Period</h4>
                                                      <p className="text-xs text-blue-800">
                                                            Matches 1-2: very high K. Matches 3-4: damped. Matches 5-8: elevated.
                                                            After that, K decays toward a stable long-term band.
                                                      </p>
                                                </div>
                                                <div className="bg-green-50 p-4 rounded-md">
                                                      <h4 className="font-semibold text-green-900 text-sm mb-1">Confidence Score</h4>
                                                      <p className="text-xs text-green-800">
                                                            Confidence (0-100%) tracks prediction reliability. Low combined confidence dampens impact;
                                                            high combined confidence amplifies it. Facing very new opponents applies protection to reduce overreaction.
                                                            In player/team pages, displayed numerical rank requires confidence above the current average threshold.
                                                      </p>
                                                </div>
                                          </div>
                                    </div>

                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Series-Length and Scoreline Logic</h3>
                                          <p className="text-sm">
                                                Match result and scoreline use separate terms:
                                                result term uses a series-length factor (BO3+ treated as stronger evidence than BO1),
                                                while scoreline term uses map share (maps won / maps played), series-length reliability,
                                                and confidence/newness reliability. This is why updates can reflect both who won and how cleanly they won.
                                          </p>
                                    </div>

                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Chronological Processing</h3>
                                          <p className="text-sm">
                                                Matches are replayed in strict order:
                                                <code>Tournament Date → Match Date → Round Order → Match ID</code>.
                                                This keeps historical state consistent so every expectation and rating update uses only information available at that point in time.
                                          </p>
                                    </div>

                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Filters and Scope</h3>
                                          <p className="text-sm">
                                                Rankings can be recalculated by main-circuit-only and by selected seasons.
                                                These filters are computational filters, not just display filters: excluded matches are not part of the rating run.
                                                Random race inclusion for race-based pages is also controlled by backend filtering.
                                          </p>
                                    </div>

                                    <div className="border-t pt-4">
                                          <h3 className="font-bold text-gray-900 mb-2">Advanced: Seeded Rankings</h3>
                                          <p className="text-sm mb-3">
                                                Default mode starts entities at 0. Seeded mode uses precomputed seeds from a 3-pass process,
                                                then runs final rankings from those seeds.
                                          </p>
                                          <ol className="list-decimal list-inside space-y-2 text-sm bg-amber-50 p-4 rounded-md border border-amber-100">
                                                <li><strong>Pass 1:</strong> Forward run on seeding subset.</li>
                                                <li><strong>Pass 2:</strong> Reverse run on same subset.</li>
                                                <li><strong>Pass 3:</strong> Final forward run from averaged seeds; only pass 3 output is used for seeded leaderboards.</li>
                                          </ol>
                                    </div>

                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Match Tooltip Guide</h3>
                                          <p className="text-sm">
                                                Rating tooltips show expected win, expected series scorelines, and total rating change by default.
                                                The detailed math is available in the collapsed <strong>Calculation</strong> section.
                                                Tooltips are interactive with delayed close, so details can be expanded while hovering.
                                          </p>
                                    </div>
                              </div>
                        </section>

                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">FAQ</h2>

                              <div className="space-y-4">
                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why do some Teams/Players not have a rank?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Player/team pages use a confidence threshold for displayed rank position.
                                                Entities below threshold are still tracked, but may appear without a numeric rank unless low-confidence filtering is enabled.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Does my individual performance affect my Team Rating?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Team rating tracks each fixed duo as one entity.
                                                Individual rating tracks your performance across all teams you played in.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Are Race Statistics used to adjust player ratings?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Yes. If a heavy favorite wins by a weaker scoreline than expected, the scoreline term can be negative enough
                                                to partially or fully offset the positive match-result term.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Do later rounds count more than early rounds?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Not directly. Importance comes from opponent strength, confidence/newness context,
                                                and series structure/scoreline, not from the round label itself.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">What does “Use Initial Seeds” do?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                It switches player/team ranking pages to precomputed seeded outputs,
                                                where entities start from seed ratings instead of flat zero.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Are race stats used to change player/team ratings?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                No. Race and team-race pages are currently analytical tracks, separate from player/team leaderboard updates.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why is a tournament missing from my current view?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Check filters first: Main Circuit Only, season checkboxes, and Random-race toggle for race pages.
                                                These affect calculation scope, not just display.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why did “Biggest Upset” change when I enabled Main Circuit Only?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Highlights are recalculated from the currently included match set. Enabling Main Circuit Only does not just hide events;
                                                it reruns the underlying ratings and expected-win values on that filtered history. So a match can still be included,
                                                but move up or down in the upset ranking because its expected probability changed.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">What does “Expected Series Scorelines” mean in match tooltips?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                It converts the expected single-map win chance into probabilities for each series outcome
                                                (for example, 2-0 / 2-1 / 1-2 / 0-2 in BO3). It is a model expectation, not a prediction guarantee.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why does the tooltip have collapsed “Calculation” details?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                The default tooltip now shows high-value summary first (expected result + total change).
                                                Full math is available in the collapsed Calculation section and optional factor-details subsection
                                                to reduce clutter while keeping full transparency.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why can tiny differences appear between shown terms and final total?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                The model computes using full precision, but tooltip numbers are rounded for readability.
                                                Small differences (for example ±0.001 to ±0.01) are rounding artifacts, not logic errors.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Do BO3/BO5 series count differently than BO1?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Yes. Longer series are treated as stronger evidence than BO1.
                                                The model increases trust in both result and scoreline margin for longer series, with BO3 already considered a strong signal.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Does “Use Initial Seeds” affect race and team-race pages?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                No. Seeded mode applies to player and team leaderboards.
                                                Race and team-race pages currently use their own analytical calculations and are not switched to seeded outputs by that toggle.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">How often are rankings processed?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Rankings are recalculated from the relevant match history when pages/endpoints are requested.
                                                Because runs are chronological, adding or editing older matches can change later ratings.
                                          </p>
                                    </div>
                              </div>
                        </section>
                  </div>
            </div>
      );
}
