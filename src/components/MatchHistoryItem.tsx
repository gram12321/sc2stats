import { Race } from '../types/tournament';
import { formatRankingPoints } from '../lib/utils';
import { Tooltip } from './ui/tooltip';

interface PlayerImpact {
  ratingBefore: number;
  rankBefore?: number | string;
  rankBeforeConfidence?: number;
  ratingChange: number;
  won: boolean;
  opponentRating: number;
  expectedWin?: number;
  baseK?: number;
  adjustedK?: number;
  confidence?: number;
  matchCount?: number;
}

interface TeamImpact {
  ratingBefore: number;
  rankBefore?: number | string;
  rankBeforeConfidence?: number;
  ratingChange: number;
  won: boolean;
  opponentRating: number;
  expectedWin?: number;
  baseK?: number;
  adjustedK?: number;
  confidence?: number;
  matchCount?: number;
}

interface MatchData {
  match_id: string;
  tournament_slug: string;
  tournament_date: string | null;
  match_date: string | null;
  round: string;
  team1: {
    player1: string;
    player2: string;
  };
  team2: {
    player1: string;
    player2: string;
  };
  team1_score: number;
  team2_score: number;
  player_impacts?: Record<string, PlayerImpact>;
  team_impacts?: Record<string, TeamImpact>;
  combo_impacts?: Record<string, TeamImpact>;
  race_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    race1: string;
    race2: string;
    expectedWin?: number;
    baseK?: number;
    adjustedK?: number;
    confidence?: number;
    matchCount?: number;
  }>;
}

interface TeamRanking {
  rank: number;
  points: number;
  confidence: number;
}

interface PlayerRanking {
  rank: number;
  points: number;
  confidence: number;
}

interface MatchHistoryItemProps {
  match: MatchData;
  team1Rank?: TeamRanking | null;
  team2Rank?: TeamRanking | null;
  playerRankings?: Record<string, PlayerRanking>;
  playerRaces?: Record<string, Race>;
  highlightPlayers?: string[]; // Players to highlight (e.g., current player or team players)
  highlightTeamKey?: string; // Team key to highlight (e.g., current team)
  showWinLoss?: boolean; // Show W/L badge
  winLossValue?: boolean; // Whether this entity won
  showRatingBreakdown?: boolean; // Show detailed rating breakdown at bottom
  showRaceInfo?: boolean; // Show race changes (for race rankings)
  raceInfo?: {
    race1: string;
    race2: string;
    ratingChange: number;
    isCombinedStats?: boolean;
    matchupKey?: string;
  };
  showComboInfo?: boolean; // Show combo changes (for team race rankings)
  comboInfo?: {
    combo1: string;
    combo2: string;
    ratingChange: number;
  };
  // For extracting race changes from match data
  extractRaceChanges?: (match: MatchData) => Array<{ race: string; change: number }> | null;
  normalizeTeamKey: (player1: string, player2: string) => string;
  getTeamImpact: (match: MatchData, player1: string, player2: string) => TeamImpact | null;
  getPlayerImpact: (match: MatchData, playerName: string) => PlayerImpact | null;
  formatDate: (dateStr: string | null) => string;
}

const getRaceAbbrev = (race: Race | null | undefined): string => {
  if (!race) return '';
  return race === 'Random' ? 'R' : race[0];
};

/**
 * Generate tooltip content explaining the rating change calculation
 * Uses calculation details from backend
 */
function getRatingChangeTooltip(
  impact: PlayerImpact | TeamImpact,
  subjectName: string,
  opponentName: string,
  type: 'player' | 'team' | 'race' = 'player'
): React.ReactNode {
  const { ratingBefore, ratingChange, won, opponentRating, expectedWin, baseK, adjustedK, confidence, matchCount } = impact;

  if (expectedWin === undefined || adjustedK === undefined) {
    // Backend should always provide these values
    return (
      <div className="text-left text-xs">
        <div className="font-semibold mb-1">Rating Change</div>
        <div>
          <span className="text-blue-200">{subjectName}:</span> {formatRankingPoints(ratingChange)}
        </div>
      </div>
    );
  }

  const expectedWinPercent = Math.round(expectedWin * 100);
  const actualResult = won ? 1 : 0;
  const typeLabel = type === 'team' ? 'Team' : type === 'race' ? 'Race' : 'Player';

  // Format the calculation breakdown using backend-provided values
  const performanceDiff = (actualResult - expectedWin).toFixed(3);
  const calculation = `${adjustedK.toFixed(1)} × (${actualResult} - ${expectedWin.toFixed(3)}) = ${formatRankingPoints(ratingChange)}`;

  return (
    <div className="text-left space-y-1 max-w-xs">
      <div className="font-semibold mb-1 border-b border-gray-700 pb-1">{typeLabel} Rating Change Calculation</div>
      <div className="text-xs space-y-1">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <div className="text-blue-300 font-medium">{subjectName}:</div>
          <div className="text-right">{formatRankingPoints(ratingBefore)}</div>

          <div className="text-red-300 font-medium">{opponentName}:</div>
          <div className="text-right">{formatRankingPoints(opponentRating)}</div>
        </div>

        <div className="pt-1 border-t border-gray-700 mt-1">
          <div><span className="opacity-80">Expected Win:</span> {expectedWinPercent}% ({expectedWin.toFixed(3)})</div>
          <div><span className="opacity-80">Actual Result:</span> {won ? 'Win' : 'Loss'} ({actualResult})</div>
          <div className="text-gray-300 italic">
            Performance: {won ? 'Outperformed' : 'Underperformed'} by {Math.abs(parseFloat(performanceDiff)).toFixed(3)}
          </div>
        </div>
        {baseK !== undefined && (
          <div className="pt-1 border-t border-gray-700 mt-1 grid grid-cols-2 gap-x-2">
            <div><span className="opacity-80">Base K:</span> {baseK.toFixed(1)}</div>
            {adjustedK !== undefined && adjustedK !== baseK && (
              <div><span className="opacity-80">Adj K:</span> {adjustedK.toFixed(1)}</div>
            )}
            {confidence !== undefined && (
              <div className="text-gray-300 opacity-80">Conf: {Math.round(confidence)}%</div>
            )}
            {matchCount !== undefined && (
              <div className="text-gray-300 opacity-80">Matches: {matchCount}</div>
            )}
          </div>
        )}
        <div className="pt-1 border-t border-gray-700 mt-1">
          <div className="opacity-80 mb-0.5">Final Calculation:</div>
          <div className="font-mono text-xs bg-gray-800 px-1.5 py-1 rounded border border-gray-700 text-center">
            {calculation}
          </div>
          <div className="text-gray-400 text-[10px] mt-0.5 text-center italic">
            K-factor × (Actual - Expected) = Change
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Generate tooltip for race impact (when we have race_impacts data)
 */
function getRaceChangeTooltip(
  impact: { ratingBefore: number; ratingChange: number; won: boolean; opponentRating: number; race1: string; race2: string; expectedWin?: number; baseK?: number; adjustedK?: number; confidence?: number; matchCount?: number },
  subjectRace: string,
  opponentRace: string
): React.ReactNode {
  return getRatingChangeTooltip(impact, subjectRace, opponentRace, 'race');
}

export function MatchHistoryItem({
  match,
  team1Rank,
  team2Rank,
  playerRankings = {},
  playerRaces = {},
  highlightPlayers = [],
  highlightTeamKey,
  showWinLoss = false,
  winLossValue,
  showRatingBreakdown = true,
  showRaceInfo = false,
  raceInfo,
  showComboInfo = false,
  comboInfo,
  extractRaceChanges,
  normalizeTeamKey,
  getTeamImpact,
  getPlayerImpact,
  formatDate
}: MatchHistoryItemProps) {
  // Determine if we should swap positions (to show highlighted team/player on left)
  const shouldSwap = (() => {
    if (highlightTeamKey) {
      const t2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
      return highlightTeamKey === t2Key;
    }
    if (highlightPlayers.length > 0) {
      const matchTeam1Players = [match.team1.player1, match.team1.player2].filter(Boolean);
      const matchTeam2Players = [match.team2.player1, match.team2.player2].filter(Boolean);
      const team1HasHighlight = matchTeam1Players.some(p => highlightPlayers.includes(p));
      const team2HasHighlight = matchTeam2Players.some(p => highlightPlayers.includes(p));
      return team2HasHighlight && !team1HasHighlight;
    }
    return false;
  })();

  // Define display data based on swap
  const team1Data = shouldSwap ? match.team2 : match.team1;
  const team2Data = shouldSwap ? match.team1 : match.team2;
  const team1Score = shouldSwap ? match.team2_score : match.team1_score;
  const team2Score = shouldSwap ? match.team1_score : match.team2_score;

  // Use historical impacts if available, otherwise just use curr/fallback props
  const team1Impact = getTeamImpact(match, team1Data.player1, team1Data.player2);
  const team2Impact = getTeamImpact(match, team2Data.player1, team2Data.player2);

  // Helper to parse rank from impact (handles number or string)
  const parseRank = (val: number | string | undefined): number | undefined => {
    if (val === undefined) return undefined;
    const r = typeof val === 'number' ? val : parseInt(String(val), 10);
    return !isNaN(r) ? r : undefined;
  };

  // Helper to resolve rank/confidence (Historical > Current)
  const resolveTeamRank = (currentRankObj: TeamRanking | undefined | null, impact: TeamImpact | null) => {
    // If we have historical rank, prefer it
    if (impact && impact.rankBefore !== undefined) {
      const validRank = parseRank(impact.rankBefore);

      const result: Partial<TeamRanking> = {};

      // If we have historical confidence, use it
      if (impact.rankBeforeConfidence !== undefined) {
        result.confidence = impact.rankBeforeConfidence;
      } else if (currentRankObj) {
        result.confidence = currentRankObj.confidence;
      }

      if (validRank) {
        result.rank = validRank;
        // Even if we don't have points, we have rank and confidence which is what's displayed in the badge
        // (Points are used in tooltip which comes from impact directly)
        return result as TeamRanking;
      }
    }
    // Fallback: use current rank object
    return currentRankObj;
  };

  const displayTeam1Rank = resolveTeamRank(shouldSwap ? team2Rank : team1Rank, team1Impact);
  const displayTeam2Rank = resolveTeamRank(shouldSwap ? team1Rank : team2Rank, team2Impact);

  const team1Players = [team1Data.player1, team1Data.player2].filter(Boolean);
  const team2Players = [team2Data.player1, team2Data.player2].filter(Boolean);
  const team1Won = team1Score > team2Score;

  // Helper to resolve player rank (Historical > Current)
  const resolvePlayerRank = (playerName: string, impact: PlayerImpact | null) => {
    // Default to current rank
    let rank = playerRankings[playerName]?.rank;

    // Override with historical rank if available and valid
    if (impact && impact.rankBefore !== undefined) {
      const r = parseRank(impact.rankBefore);
      if (r !== undefined) {
        rank = r;
      }
    }

    return rank;
  };

  const displayTeam1Key = normalizeTeamKey(team1Data.player1, team1Data.player2);
  const displayTeam2Key = normalizeTeamKey(team2Data.player1, team2Data.player2);

  const isTeam1Highlighted = highlightTeamKey === displayTeam1Key;
  const isTeam2Highlighted = highlightTeamKey === displayTeam2Key;

  return (
    <div
      className={`px-2 py-1.5 border border-gray-200 rounded overflow-hidden ${(showWinLoss && winLossValue) || team1Won ? 'bg-green-50/30 border-green-300' : 'border-gray-200'
        } ${isTeam1Highlighted || isTeam2Highlighted ? 'bg-blue-50/50' : ''}`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <span>{match.tournament_slug}</span>
          <span>•</span>
          <span>{match.round}</span>
          <span>•</span>
          <span>{formatDate(match.match_date || match.tournament_date)}</span>
        </div>
        {showWinLoss && winLossValue !== undefined && (
          <span className={`px-2 py-0.5 rounded text-xs font-medium ${winLossValue ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
            {winLossValue ? 'W' : 'L'}
          </span>
        )}
        {!showWinLoss && (
          <div className="text-xs text-gray-400 font-mono">
            {match.match_id}
          </div>
        )}
      </div>

      {/* Match row - compact single line layout */}
      <div className="flex items-center gap-2 text-sm">
        {/* Team 1 */}
        <div className={`flex-1 flex items-center gap-1.5 min-w-0 ${team1Won ? 'font-semibold' : ''}`}>
          {/* Team ranking, confidence & rating change - highlighted */}
          {displayTeam1Rank && (
            <div className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded border ${isTeam1Highlighted ? 'bg-blue-100 border-blue-300' : 'bg-blue-50 border-blue-200'
              }`}>
              <span className="text-sm font-bold text-gray-700">
                T#{displayTeam1Rank.rank}
              </span>
              <span className={`text-sm font-semibold ${displayTeam1Rank.confidence >= 70 ? 'text-blue-700' :
                displayTeam1Rank.confidence >= 40 ? 'text-yellow-700' :
                  'text-gray-500'
                }`}>
                {Math.round(displayTeam1Rank.confidence)}%
              </span>
              {team1Impact && (
                <Tooltip content={getRatingChangeTooltip(team1Impact, team1Players.join('+'), team2Players.join('+'), 'team')}>
                  <span className={`text-sm font-bold cursor-help ${team1Impact.ratingChange >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {team1Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team1Impact.ratingChange)}
                  </span>
                </Tooltip>
              )}
            </div>
          )}
          {/* Players */}
          <div className="flex items-center gap-0.5 min-w-0">
            {team1Players.map((playerName, idx) => {
              const impact = getPlayerImpact(match, playerName);
              const playerRankDisplay = resolvePlayerRank(playerName, impact);
              const playerRace = playerRaces[playerName];
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-0.5 shrink-0">
                  {idx > 0 && <span className="text-gray-400 mx-0.5">+</span>}
                  <span className={isHighlighted ? 'font-bold text-gray-900' : 'text-gray-900'}>{playerName}</span>
                  {playerRace && (
                    <span className="text-xs text-gray-600 font-medium">
                      ({getRaceAbbrev(playerRace)})
                    </span>
                  )}
                  {playerRankDisplay && (
                    <span className="text-xs text-gray-500">#{playerRankDisplay}</span>
                  )}
                  {impact && (
                    <Tooltip content={getRatingChangeTooltip(impact, playerName, team2Players.join('+'), 'player')}>
                      <span className={`text-xs font-medium cursor-help ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                      </span>
                    </Tooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Score */}
        <div className="flex items-center gap-1 font-bold text-base shrink-0 px-1">
          <span className={team1Won ? 'text-green-700' : 'text-gray-700'}>
            {team1Score}
          </span>
          <span className="text-gray-400">-</span>
          <span className={!team1Won ? 'text-green-700' : 'text-gray-700'}>
            {team2Score}
          </span>
        </div>

        {/* Team 2 */}
        <div className={`flex-1 flex items-center gap-1.5 min-w-0 justify-end ${!team1Won ? 'font-semibold' : ''}`}>
          {/* Players */}
          <div className="flex items-center gap-0.5 min-w-0 justify-end flex-row-reverse">
            {team2Players.map((playerName, idx) => {
              const impact = getPlayerImpact(match, playerName);
              const playerRankDisplay = resolvePlayerRank(playerName, impact);
              const playerRace = playerRaces[playerName];
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-0.5 shrink-0 flex-row-reverse">
                  {impact && (
                    <Tooltip content={getRatingChangeTooltip(impact, playerName, team1Players.join('+'), 'player')}>
                      <span className={`text-xs font-medium cursor-help ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                        {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                      </span>
                    </Tooltip>
                  )}
                  {playerRankDisplay && (
                    <span className="text-xs text-gray-500">#{playerRankDisplay}</span>
                  )}
                  {playerRace && (
                    <span className="text-xs text-gray-600 font-medium">
                      ({getRaceAbbrev(playerRace)})
                    </span>
                  )}
                  <span className={isHighlighted ? 'font-bold text-gray-900' : 'text-gray-900'}>{playerName}</span>
                  {idx < team2Players.length - 1 && <span className="text-gray-400 mx-0.5">+</span>}
                </div>
              );
            })}
          </div>
          {/* Team ranking, confidence & rating change - highlighted */}
          {displayTeam2Rank && (
            <div className={`flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded border flex-row-reverse ${isTeam2Highlighted ? 'bg-blue-100 border-blue-300' : 'bg-blue-50 border-blue-200'
              }`}>
              {team2Impact && (
                <Tooltip content={getRatingChangeTooltip(team2Impact, team2Players.join('+'), team1Players.join('+'), 'team')}>
                  <span className={`text-sm font-bold cursor-help ${team2Impact.ratingChange >= 0 ? 'text-green-700' : 'text-red-700'
                    }`}>
                    {team2Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team2Impact.ratingChange)}
                  </span>
                </Tooltip>
              )}
              <span className={`text-sm font-semibold ${displayTeam2Rank.confidence >= 70 ? 'text-blue-700' :
                displayTeam2Rank.confidence >= 40 ? 'text-yellow-700' :
                  'text-gray-500'
                }`}>
                {Math.round(displayTeam2Rank.confidence)}%
              </span>
              <span className="text-sm font-bold text-gray-700">
                T#{displayTeam2Rank.rank}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Rating changes breakdown */}
      {showRatingBreakdown && (
        <div className="mt-1 flex flex-col gap-0.5 text-xs">
          {/* Team changes */}
          {(displayTeam1Rank && team1Impact) || (displayTeam2Rank && team2Impact) ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-gray-600">Teams:</span>
                {displayTeam1Rank && team1Impact && (
                  <Tooltip content={getRatingChangeTooltip(team1Impact, team1Players.join('+'), team2Players.join('+'), 'team')}>
                    <span className={`font-medium cursor-help ${team1Impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {team1Players.join('+')} {team1Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team1Impact.ratingChange)}
                    </span>
                  </Tooltip>
                )}
                {displayTeam1Rank && team1Impact && displayTeam2Rank && team2Impact && <span className="text-gray-400">•</span>}
                {displayTeam2Rank && team2Impact && (
                  <Tooltip content={getRatingChangeTooltip(team2Impact, team2Players.join('+'), team1Players.join('+'), 'team')}>
                    <span className={`font-medium cursor-help ${team2Impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {team2Players.join('+')} {team2Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team2Impact.ratingChange)}
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          ) : null}
          {/* Player changes */}
          {(team1Players.some(n => getPlayerImpact(match, n)) || team2Players.some(n => getPlayerImpact(match, n))) ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                <span className="text-gray-600">Players:</span>
                {team1Players.map((name, idx) => {
                  const impact = getPlayerImpact(match, name);
                  if (!impact) return null;
                  return (
                    <Tooltip key={name} content={getRatingChangeTooltip(impact, name, team2Players.join('+'), 'player')}>
                      <span className={`font-medium cursor-help ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {name} {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                        {idx < team1Players.length - 1 || team2Players.some(n => getPlayerImpact(match, n)) ? ',' : ''}
                      </span>
                    </Tooltip>
                  );
                })}
                {team2Players.map((name, idx) => {
                  const impact = getPlayerImpact(match, name);
                  if (!impact) return null;
                  return (
                    <Tooltip key={name} content={getRatingChangeTooltip(impact, name, team1Players.join('+'), 'player')}>
                      <span className={`font-medium cursor-help ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {name} {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                        {idx < team2Players.length - 1 ? ',' : ''}
                      </span>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
          ) : null}
          {/* Race changes */}
          {(showRaceInfo && raceInfo) || extractRaceChanges ? (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1 flex-wrap">
                {(() => {
                  // Try extractRaceChanges first (for general pages)
                  if (extractRaceChanges) {
                    const raceChanges = extractRaceChanges(match);
                    if (raceChanges && raceChanges.length > 0) {
                      return (
                        <>
                          <span className="text-gray-600">Races:</span>
                          {raceChanges.map((rc, idx) => {
                            // Try to find the race impact for this race
                            const raceImpact = Object.values(match.race_impacts || {}).find(imp =>
                              (imp.race1 === rc.race || imp.race2 === rc.race) &&
                              Math.abs(imp.ratingChange - rc.change) < 0.01
                            );



                            const tooltipContent = raceImpact ? getRaceChangeTooltip(raceImpact, rc.race, raceImpact.race1 === rc.race ? raceImpact.race2 : raceImpact.race1) : (
                              <div className="text-left text-xs">
                                <div className="font-semibold mb-1">Race Rating Change</div>
                                <div>{rc.race}: {rc.change >= 0 ? '+' : ''}{formatRankingPoints(rc.change)}</div>
                              </div>
                            );

                            return (
                              <span key={rc.race}>
                                {idx > 0 && <span className="text-gray-400">•</span>}
                                <Tooltip content={tooltipContent}>
                                  <span className={`font-medium cursor-help ${rc.change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                    {rc.race} {rc.change >= 0 ? '+' : ''}{formatRankingPoints(rc.change)}
                                  </span>
                                </Tooltip>
                              </span>
                            );
                          })}
                        </>
                      );
                    }
                  }

                  // Fall back to raceInfo (for race rankings page)
                  if (showRaceInfo && raceInfo) {
                    if (!raceInfo.isCombinedStats) {
                      const matchupKey = raceInfo.matchupKey || '';
                      const impact = match.race_impacts?.[matchupKey];
                      if (!impact) return null;
                      const race1Change = impact.race1 === raceInfo.race1 ? impact.ratingChange : -impact.ratingChange;
                      const race2Change = -race1Change;
                      const race2Name = raceInfo.race2.split(' + ')[0];
                      return (
                        <>
                          <span className="text-gray-600">Races:</span>
                          <Tooltip content={getRaceChangeTooltip(impact, raceInfo.race1, raceInfo.race2.split(' + ')[0])}>
                            <span className={`font-medium cursor-help ${race1Change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {raceInfo.race1} {race1Change >= 0 ? '+' : ''}{formatRankingPoints(race1Change)}
                            </span>
                          </Tooltip>
                          <span className="text-gray-400">•</span>
                          <Tooltip content={getRaceChangeTooltip({
                            ...impact,
                            ratingChange: -impact.ratingChange,
                            won: !impact.won,
                            race1: impact.race2,
                            race2: impact.race1,
                            expectedWin: 1 - (impact.expectedWin || 0.5)
                          }, race2Name, raceInfo.race1)}>
                            <span className={`font-medium cursor-help ${race2Change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {race2Name} {race2Change >= 0 ? '+' : ''}{formatRankingPoints(race2Change)}
                            </span>
                          </Tooltip>
                        </>
                      );
                    } else {
                      // Find race impact for combined stats
                      const raceImpacts = match.race_impacts || {};
                      const raceImpact = Object.values(raceImpacts).find(imp =>
                        (imp.race1 === raceInfo.race1 || imp.race2 === raceInfo.race1)
                      );

                      const tooltipContent = raceImpact ? getRaceChangeTooltip(
                        raceImpact,
                        raceInfo.race1,
                        raceImpact.race1 === raceInfo.race1 ? raceImpact.race2 : raceImpact.race1
                      ) : (
                        <div className="text-left text-xs">
                          <div className="font-semibold mb-1">Race Rating Change</div>
                          <div>{raceInfo.race1}: {raceInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(raceInfo.ratingChange)}</div>
                        </div>
                      );

                      return (
                        <>
                          <span className="text-gray-600">Race:</span>
                          <Tooltip content={tooltipContent}>
                            <span className={`font-medium cursor-help ${raceInfo.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {raceInfo.race1} {raceInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(raceInfo.ratingChange)}
                            </span>
                          </Tooltip>
                        </>
                      );
                    }
                  }
                  return null;
                })()}
              </div>
            </div>
          ) : null}
          {/* Combo changes */}
          {showComboInfo && comboInfo && (() => {
            // Try to find team impact for combo (combo is team race combination)
            const team1Key = normalizeTeamKey(match.team1.player1, match.team1.player2);
            const team2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
            // Prioritize combo_impacts (Race Stats) if available, otherwise fallback to team_impacts (Generic)
            const comboTeam1Impact = match.combo_impacts?.[team1Key] || match.team_impacts?.[team1Key];
            const comboTeam2Impact = match.combo_impacts?.[team2Key] || match.team_impacts?.[team2Key];

            // Determine which team has the combo
            const team1IsCombo1 = comboTeam1Impact && Math.abs(comboTeam1Impact.ratingChange - comboInfo.ratingChange) < 0.01;
            const comboImpact = team1IsCombo1 ? comboTeam1Impact : comboTeam2Impact;
            const subjectCombo = comboInfo.combo1;
            const opponentCombo = comboInfo.combo2; // Approx

            const tooltipContent = comboImpact ? getRatingChangeTooltip(comboImpact, subjectCombo, opponentCombo, 'team') : (
              <div className="text-left text-xs">
                <div className="font-semibold mb-1">Combo Rating Change</div>
                <div>{comboInfo.combo1}: {comboInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(comboInfo.ratingChange)}</div>
              </div>
            );

            return (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1 flex-wrap">
                  <span className="text-gray-600">Combo:</span>
                  <Tooltip content={tooltipContent}>
                    <span className={`font-medium cursor-help ${comboInfo.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {comboInfo.combo1} {comboInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(comboInfo.ratingChange)}
                    </span>
                  </Tooltip>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
