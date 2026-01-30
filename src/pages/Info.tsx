
interface InfoProps {
      onBack?: () => void;
}

export function Info({ onBack }: InfoProps) {
      return (
            <div className="min-h-screen bg-gray-50">
                  {/* Header */}
                  <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
                        <div className="max-w-7xl mx-auto px-6 py-4">
                              <div className="flex items-center justify-between">
                                    <h1 className="text-2xl font-bold text-gray-900">System Information</h1>
                                    {onBack && (
                                          <button
                                                onClick={onBack}
                                                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
                                          >
                                                ← Back
                                          </button>
                                    )}
                              </div>
                        </div>
                  </div>

                  <div className="max-w-4xl mx-auto p-6 space-y-8">
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
                  </div>
            </div>
      );
}
