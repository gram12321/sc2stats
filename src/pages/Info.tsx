
interface InfoProps { }

export function Info({ }: InfoProps) {
      return (
            <div className="min-h-screen bg-gray-50">
                  <div className="max-w-4xl mx-auto p-6 space-y-8">
                        <div className="mb-2">
                              <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
                        </div>
                        {/* System Overview */}
                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">System Overview</h2>
                              <p className="text-gray-700 leading-relaxed">
                                    This system tracks and calculates rankings for StarCraft II matches based on tournament data.
                                    It utilizes an Elo-rating based algorithm to determine the relative skill levels of players and teams.
                                    The system processes match history to update ratings dynamically, providing insights into current form
                                    and historical performance.
                              </p>
                        </section>

                        {/* Ranking Types */}
                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-6">Ranking Categories</h2>

                              <div className="grid gap-6 md:grid-cols-2">
                                    {/* Player Rankings */}
                                    <div className="bg-blue-50 rounded-lg p-5 border border-blue-100">
                                          <h3 className="text-lg font-bold text-blue-900 mb-2">Player Rankings</h3>
                                          <p className="text-blue-800 text-sm">
                                                Tracks individual player performance in 2v2 matches.
                                                Ratings are updated after every match, reflecting a player's current standing. The individual ranking take into account the performence
                                                of a player in any team that he is a member of. Importantly the ranking still reflect how the player performs accourdingly to the team
                                                that he is a member of, and the team they play against. (IE. if a player is on one team "A" with a highly ranked teammate he will be expected to win more, than when he plays on team "B" with a less ranked teammate)
                                          </p>
                                    </div>

                                    {/* Team Rankings */}
                                    <div className="bg-purple-50 rounded-lg p-5 border border-purple-100">
                                          <h3 className="text-lg font-bold text-purple-900 mb-2">Team Rankings</h3>
                                          <p className="text-purple-800 text-sm">
                                                Rankings for fixed 2v2 teams. A team is defined by the unique combination
                                                of two players, thus a player may be several times on the list if he has competed in several teams.
                                                Rating changes affect the specific team unit rather than just individual players - though the rating of a player is also affected by the result of the team.
                                          </p>
                                    </div>

                                    {/* Race Rankings */}
                                    <div className="bg-indigo-50 rounded-lg p-5 border border-indigo-100">
                                          <h3 className="text-lg font-bold text-indigo-900 mb-2">Race Statistics</h3>
                                          <p className="text-indigo-800 text-sm">
                                                Aggregates performance data by race (Terran, Zerg, Protoss). This keeps tracts of the individual race, Independent of the Team composition. IE ZVT Not ZT VS ZP.
                                                Thus In a match where a race is on both side ZT vs ZP that will be two updates for Z rating. ZVT and ZVP.  IE the Z on TZ play ZvP while the Z on ZP play ZvT
                                                For now Race statistics are not used in the ranking system for Team and Player rankings. (IE Zerg players are not expected to perform better, if Z is in general considered the stronger race)
                                                For now we keep an eye on race statistics, as they may or may not be bugged. Also note that Random race players are included by default but may be filtered out in UI.

                                          </p>
                                    </div>

                                    {/* Team Race Rankings */}
                                    <div className="bg-orange-50 rounded-lg p-5 border border-orange-100">
                                          <h3 className="text-lg font-bold text-orange-900 mb-2">Team Race Statistics</h3>
                                          <p className="text-orange-800 text-sm">
                                                Analyzes the performance of racial compositions in 2v2 matches. That is ZT VS ZP, ZT VS TP, ZP VS TP. Also Including Same race teams ZZ, PP, TT.
                                                (e.g., Terran+Zerg vs Protoss+Protoss). Useful for understanding synergy between different race combinations.
                                                For now Race statistics are not used in the ranking system for Team and Player rankings. (IE Zerg players are not expected to perform better, if Z is in general considered the stronger race)
                                                For now we keep an eye on race statistics, as they may or may not be bugged. Also note that Random race players are included by default but may be filtered out in UI.
                                                Keep in mind that race rankings does NOT take into account the strength of the Players/Teams in the expected win ratio. This is a skisma that we will have to look into over time. Essentially asking the question.
                                                Is Protoss performing good because Protoss is strong, or is protoss performing good because Maxpax is strong?
                                          </p>
                                    </div>
                              </div>
                        </section>

                        {/* Technical Details (Short) */}
                        {/* Technical Implementation Details */}
                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">Technical Implementation</h2>

                              <div className="space-y-6 text-gray-700">
                                    {/* Algorithm */}
                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">The Core Ranking Algorithm</h3>
                                          <p className="mb-2">
                                                The system uses a modified prediction-based rating system (similar to Elo/Glicko).
                                                Win probabilities are calculated using a logistic function based on the rating difference between opponents
                                                and the population's standard deviation.
                                          </p>
                                          <ul className="list-disc list-inside bg-gray-50 p-4 rounded-md text-sm space-y-1">
                                                <li><strong>Win Probability:</strong> <code>P(Win) = 1 / (1 + 10^((OpponentRating - PlayerRating) / ScaleFactor))</code></li>
                                                <li><strong>Rating Change:</strong> <code>Change = K * (ActualResult - PredictedResult)</code></li>
                                                <li><strong>Population Scaling:</strong> The scale factor adapts dynamically based on the standard deviation of all active players, ensuring the math fits the actual skill spread.</li>
                                          </ul>
                                    </div>

                                    {/* K-Factor & Confidence */}
                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Volatility (K-Factor) & Confidence</h3>
                                          <p className="mb-2">
                                                Ratings are not static; the speed at which they change (K-Factor) adapts to how much we "trust" the current rating.
                                          </p>
                                          <div className="grid md:grid-cols-2 gap-4 mt-2">
                                                <div className="bg-blue-50 p-4 rounded-md">
                                                      <h4 className="font-semibold text-blue-900 text-sm mb-1">Provisional Period</h4>
                                                      <p className="text-xs text-blue-800">
                                                            New entities start with a high K-factor (64), allowing them to maintain rapid placement adjustments.
                                                            This decreases over their first 20 matches (down to ~32) as their rating stabilizes.
                                                      </p>
                                                </div>
                                                <div className="bg-green-50 p-4 rounded-md">
                                                      <h4 className="font-semibold text-green-900 text-sm mb-1">Confidence Score</h4>
                                                      <p className="text-xs text-green-800">
                                                            A separate "Confidence" score (0-100%) tracks prediction accuracy.
                                                            High confidence reduces the K-factor (rating becomes harder to shift).
                                                            Unexpected results lower confidence, making the rating more volatile again to correct itself.
                                                            The confidence score is used as a treshold for aquiring a ranking. Both Players and Teams require a confidence score above average confidence to be ranked.
                                                            The system tracks Players/Teams below average confidence and they can be shown in the rankings. But they do not receive a rank.
                                                      </p>
                                                </div>
                                          </div>
                                    </div>

                                    {/* Data Pipeline */}
                                    <div>
                                          <h3 className="font-bold text-gray-900 mb-2">Chronological Processing</h3>
                                          <p className="text-sm">
                                                To ensure historical accuracy, all matches from all tournaments are aggregated and strictly sorted by time.
                                                <code>Tournament Date → Match Date → Round (Ro16, QF, SF, F) → Match ID</code>.
                                                This ensures the chronological processing of matches, which is important because the system values wins against higher rated players.
                                                Thus its important that if you face a team that has consistantly (Before your match) performed good, you get rewarded for winning against them. Rather than the system not realizing your opponent is a established team. (IE Only truely new teams, are infact treated as new teams.)
                                          </p>
                                    </div>

                                    {/* Seeded Rankings */}
                                    <div className="border-t pt-4">
                                          <h3 className="font-bold text-gray-900 mb-2">Advanced: "Seeded" Rankings</h3>
                                          <p className="text-sm mb-3">
                                                Standard rankings start everyone at the population average (or 0). This creates a "Cold Start" problem where
                                                early history is inaccurate until ratings settle. IE. Team maxpax+spirit are by default rated just the same as every other team in the beginning of season one, but we all know they are not equal strength to every other team.
                                                We solve this with an optional <strong>3-Pass Seeding System</strong>:
                                          </p>
                                          <ol className="list-decimal list-inside space-y-2 text-sm bg-amber-50 p-4 rounded-md border border-amber-100">
                                                <li><strong>Pass 1 (Forward):</strong> Run preset of matches (1. season of Uthermal 2v2 Circuit) normally. </li>
                                                <li><strong>Pass 2 (Backward):</strong> Run preset of matches <i>reverse</i>. This account for chronological processing. IE If we just run it forward, first tournament "Will matter more" Because eveyone is rating equally, by running it backwards we eliminate time chronological factor.</li>
                                                <li><strong>Pass 3 (Final):</strong> A new forward run where every player <strong>starts</strong> (at match #1) with a seed rating derived from the average of Pass 1 & 2. Once this is done we discard the points given from Pass 1 & 2, and only keep the points given from Pass 3. Now we have a single run final score that takes into account the strength of the players from the very first match</li>
                                          </ol>

                                    </div>
                              </div>
                        </section>

                        {/* FAQ Section */}
                        <section className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                              <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions (FAQ)</h2>

                              <div className="space-y-4">
                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why do some Teams/Players not have a rank?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Some players/teams are not ranked because their "Confidence" score is too low. Confidence is the system's way of
                                                describing how sure we are of the Player/Team's strength.
                                                <br /><br />
                                                Confidence goes up when a Team/Player plays more matches—especially if the result of the match is as the system predicted
                                                (e.g., the team predicted to be stronger wins). If a team significantly outperforms or underperforms the expected result,
                                                we lower the confidence in their rating.
                                                <br /><br />
                                                To receive a rank, a Team/Player must have a Confidence score above a set threshold (currently set to be greater than the average confidence).
                                                Entities below this threshold are still tracked but do not receive a numerical rank.
                                          </p>
                                    </div>
                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Does my individual performance affect my Team Rating?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                No. Team Ratings treat a unique pair of players (e.g., Maru + Oliveira) as a single, distinct entity.
                                                If Maru plays with a different partner (e.g., Maru + ByuN), that is considered a completely separate team with its own independent rating history.
                                                <br /><br />
                                                However, your <strong>Individual Player Rating</strong> tracks your personal performance across <i>all</i> the different teams you play in.
                                                For example, Maru's individual rating is updated after matches played with Oliveira AND matches played with ByuN.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Are Race Statistics used to adjust player ratings?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Currently, no. Race statistics (e.g., "Zerg is winning 60% of TvZ matchups") are tracked purely for analytical purposes to monitor game balance and meta trends.
                                                The ranking system does not give "bonus points" for playing a weaker race or penalize playing a stronger one.
                                                A win is a win, regardless of the racial matchup.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Do Grand Final matches count more than Group Stage matches?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Strictly speaking, no. The ranking algorithm calculates points based on the <strong>skill difference</strong> between opponents, not the prestige of the match.
                                                <br /><br />
                                                Winning against a world-class team yields high points whether it happens in the Round of 16 or the Grand Finals. However, since players need to win to reach the Grand Finals, you are far more likely to face highly-rated opponents in later stages. Defeating these strong opponents yields more points. Additionally, both you and your opponents will likely have gained rating from your previous victories leading up to the final, increasing the stakes of the match naturally.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">How quickly can a new, strong team reach rank #1?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Very quickly due to the <strong>Provisional "K-Factor"</strong>.
                                                <br /><br />
                                                For the first 20 matches of a new Player or Team, the system allows for much larger rating swings (up to twice the normal amount).
                                                This ensures that if a pro team forms and dominates, they don't have to grind hundreds of games to reach the top.
                                                <br /><br />
                                                It is common for a newly formed super-team to achieve a #1 <i>rating</i> immediately after winning their first tournament. However, they might not appear on the official leaderboard immediately because they haven't met the <strong>Confidence Threshold</strong> (see above). They need to play enough games to prove their consistency before being awarded an official rank.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">What does the "Use Initial Seeds" toggle do?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                By default, everyone starts at the same baseline. This represents "clean slate" performance.
                                                Checking "Use Initial Seeds" activates a 3-pass algorithm where we simulate history forward, backward, and forward again.
                                                This gives established players a starting rating based on their estimated skill, providing a more predictive ranking list from Day 1 of the season.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">Why is the Confidence Threshold necessary?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                It prevents "One-Hit Wonders" from cluttering the top of the rankings.
                                                Without it, a new team could play one lucky game against a top team, win, and get a massive inflated rating.
                                                The threshold ensures that the leaderboard only shows players and teams with a statistically significant sample size of games.
                                          </p>
                                    </div>

                                    <div className="border-b border-gray-100 pb-4 last:border-0 last:pb-0">
                                          <h3 className="font-bold text-gray-900 mb-2">How often are rankings processed?</h3>
                                          <p className="text-gray-700 text-sm leading-relaxed">
                                                Rankings are recalculated automatically whenever new tournament data is added to the system.
                                                Since the system processes matches chronologically, adding an older tournament triggers a full recalculation of the history to ensure every subsequent match rating remains accurate.
                                          </p>
                                    </div>
                              </div>
                        </section>
                  </div>
            </div>
      );
}
