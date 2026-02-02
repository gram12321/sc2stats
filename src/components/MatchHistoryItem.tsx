import { Race } from '../types/tournament';
import { formatRankingPoints } from '../lib/utils';
import { Tooltip } from './ui/tooltip';
import { cn } from '../lib/utils'; // Import cn utility

interface PlayerImpact {
  ratingBefore: number;
  rankBefore?: number | string;
  rankBeforeConfidence?: number;
  ratingChange: number;
  won: boolean;
  isDraw?: boolean;
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
  isDraw?: boolean;
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
    isDraw?: boolean;
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
  highlightPlayers?: string[];
  highlightTeamKey?: string;
  highlightRace?: string;
  highlightCombo?: string;
  showWinLoss?: boolean;
  winLossValue?: boolean;
  isDrawValue?: boolean;
  showRatingBreakdown?: boolean;
  showRaceInfo?: boolean;
  raceInfo?: {
    race1: string;
    race2: string;
    ratingChange: number;
    isCombinedStats?: boolean;
    matchupKey?: string;
  };
  showComboInfo?: boolean;
  comboInfo?: {
    combo1: string;
    combo2: string;
    ratingChange: number;
  };
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

function getRatingChangeTooltip(
  impact: PlayerImpact | TeamImpact,
  subjectName: string,
  opponentName: string,
  type: 'player' | 'team' | 'race' = 'player'
): React.ReactNode {
  const { ratingBefore, ratingChange, won, opponentRating, expectedWin, baseK, adjustedK, confidence, matchCount } = impact;

  if (expectedWin === undefined || adjustedK === undefined) {
    return (
      <div className="text-left text-xs text-foreground">
        <div className="font-semibold mb-1">Rating Change</div>
        <div>
          <span className="text-primary">{subjectName}:</span> {formatRankingPoints(ratingChange)}
        </div>
      </div>
    );
  }

  const expectedWinPercent = Math.round(expectedWin * 100);
  const isDraw = impact.isDraw === true;
  const actualResult = isDraw ? 0.5 : (won ? 1 : 0);
  const typeLabel = type === 'team' ? 'Team' : type === 'race' ? 'Race' : 'Player';
  const calculation = `${adjustedK.toFixed(1)} × (${actualResult} - ${expectedWin.toFixed(3)}) = ${formatRankingPoints(ratingChange)}`;

  return (
    <div className="text-left space-y-1 max-w-xs text-foreground">
      <div className="font-semibold mb-1 border-b border-border pb-1">{typeLabel} Rating Change Calculation</div>
      <div className="text-xs space-y-1">
        <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
          <div className="text-blue-400 font-medium">{subjectName}:</div>
          <div className="text-right">{formatRankingPoints(ratingBefore)}</div>

          <div className="text-red-400 font-medium">{opponentName}:</div>
          <div className="text-right">{formatRankingPoints(opponentRating)}</div>
        </div>

        <div className="pt-1 border-t border-border mt-1">
          <div><span className="text-muted-foreground">Expected Win:</span> {expectedWinPercent}% ({expectedWin.toFixed(3)})</div>
          <div><span className="text-muted-foreground">Actual Result:</span> {isDraw ? 'Draw' : (won ? 'Win' : 'Loss')} ({actualResult})</div>
          <div className="text-muted-foreground italic">
            Performance: {isDraw && expectedWin >= 0.4 && expectedWin <= 0.6 ? 'Met expectations' :
              (actualResult > expectedWin ? 'Outperformed' : 'Underperformed')} by {Math.abs(actualResult - expectedWin).toFixed(3)}
          </div>
        </div>
        {baseK !== undefined && (
          <div className="pt-1 border-t border-border mt-1 grid grid-cols-2 gap-x-2">
            <div><span className="text-muted-foreground">Base K:</span> {baseK.toFixed(1)}</div>
            {adjustedK !== undefined && adjustedK !== baseK && (
              <div><span className="text-muted-foreground">Adj K:</span> {adjustedK.toFixed(1)}</div>
            )}
            {confidence !== undefined && (
              <div className="text-muted-foreground">Conf: {Math.round(confidence)}%</div>
            )}
            {matchCount !== undefined && (
              <div className="text-muted-foreground">Matches: {matchCount}</div>
            )}
          </div>
        )}
        <div className="pt-1 border-t border-border mt-1">
          <div className="text-muted-foreground mb-0.5">Final Calculation:</div>
          <div className="font-mono text-xs bg-muted px-1.5 py-1 rounded border border-border text-center">
            {calculation}
          </div>
          <div className="text-muted-foreground text-[10px] mt-0.5 text-center italic">
            K-factor × (Actual - Expected) = Change
          </div>
        </div>
      </div>
    </div>
  );
}

export function MatchHistoryItem({
  match,
  team1Rank,
  team2Rank,
  playerRankings = {},
  playerRaces = {},
  highlightPlayers = [],
  highlightTeamKey,
  highlightRace,
  highlightCombo,
  showWinLoss = false,
  winLossValue,
  isDrawValue,
  showRatingBreakdown = true,
  showRaceInfo = false,
  raceInfo,
  extractRaceChanges,
  normalizeTeamKey,
  getTeamImpact,
  getPlayerImpact,
  formatDate
}: MatchHistoryItemProps) {

  const shouldSwap = (() => {
    if (highlightTeamKey) {
      const t2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
      return highlightTeamKey === t2Key;
    }
    const t1Players = [match.team1.player1, match.team1.player2].filter(Boolean);
    const t2Players = [match.team2.player1, match.team2.player2].filter(Boolean);

    if (highlightPlayers.length > 0) {
      const team1HasHighlight = t1Players.some(p => highlightPlayers.includes(p));
      const team2HasHighlight = t2Players.some(p => highlightPlayers.includes(p));
      return team2HasHighlight && !team1HasHighlight;
    }

    if (highlightRace && playerRaces) {
      const getTeamRaces = (players: string[]) => players.map(p => playerRaces[p]).filter(Boolean);
      const t1Races = getTeamRaces(t1Players);
      const t2Races = getTeamRaces(t2Players);
      const hasRace = (races: (string | null | undefined)[]) => {
        if (!highlightRace) return false;
        const raceCheck = highlightRace;
        const raceCheckAbbr = raceCheck[0];
        return races.some(r => {
          if (!r) return false;
          return r === raceCheck || r === raceCheckAbbr || (r[0] && r[0] === raceCheckAbbr);
        });
      };
      const t1HasRace = hasRace(t1Races);
      const t2HasRace = hasRace(t2Races);
      return t2HasRace && !t1HasRace;
    }

    if (highlightCombo && playerRaces) {
      const getTeamCombo = (players: string[]) => {
        const races = players.map(p => {
          const r = playerRaces[p];
          return r === 'Random' ? 'R' : (r ? r[0] : '');
        }).filter(Boolean).sort();
        return races.join('');
      };
      const t1Combo = getTeamCombo(t1Players);
      const t2Combo = getTeamCombo(t2Players);
      return t2Combo === highlightCombo && t1Combo !== highlightCombo;
    }
    return false;
  })();

  const team1Data = shouldSwap ? match.team2 : match.team1;
  const team2Data = shouldSwap ? match.team1 : match.team2;
  const team1Score = shouldSwap ? match.team2_score : match.team1_score;
  const team2Score = shouldSwap ? match.team1_score : match.team2_score;

  const team1Impact = getTeamImpact(match, team1Data.player1, team1Data.player2);
  const team2Impact = getTeamImpact(match, team2Data.player1, team2Data.player2);

  const parseRank = (val: number | string | undefined): number | undefined => {
    if (val === undefined) return undefined;
    const r = typeof val === 'number' ? val : parseInt(String(val), 10);
    return !isNaN(r) ? r : undefined;
  };

  const resolveTeamRank = (currentRankObj: TeamRanking | undefined | null, impact: TeamImpact | null) => {
    if (impact && impact.rankBefore !== undefined) {
      const validRank = parseRank(impact.rankBefore);
      const result: Partial<TeamRanking> = {};
      if (impact.rankBeforeConfidence !== undefined) {
        result.confidence = impact.rankBeforeConfidence;
      } else if (currentRankObj) {
        result.confidence = currentRankObj.confidence;
      }
      if (validRank) {
        result.rank = validRank;
        return result as TeamRanking;
      }
    }
    return currentRankObj;
  };

  const displayTeam1Rank = resolveTeamRank(shouldSwap ? team2Rank : team1Rank, team1Impact);
  const displayTeam2Rank = resolveTeamRank(shouldSwap ? team1Rank : team2Rank, team2Impact);

  const team1Players = [team1Data.player1, team1Data.player2].filter(Boolean);
  const team2Players = [team2Data.player1, team2Data.player2].filter(Boolean);
  const isDraw = team1Score === team2Score;
  const team1Won = team1Score > team2Score;

  const resolvePlayerRank = (playerName: string, impact: PlayerImpact | null) => {
    let rank = playerRankings[playerName]?.rank;
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

  // Determine container classes based on state
  const containerClasses = cn(
    "px-3 py-2 border rounded-md overflow-hidden transition-colors hover:bg-muted/50",
    {
      "bg-emerald-500/10 border-emerald-500/20": ((showWinLoss && winLossValue) || team1Won) && !isDraw,
      "bg-muted/40 border-border": ((showWinLoss && isDrawValue) || isDraw),
      "border-border bg-card": !((showWinLoss && winLossValue) || team1Won) && !isDraw,
      "ring-1 ring-primary/20": isTeam1Highlighted || isTeam2Highlighted
    }
  );

  return (
    <div className={containerClasses}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">{match.tournament_slug}</span>
          <span>•</span>
          <span>{match.round}</span>
          <span>•</span>
          <span>{formatDate(match.match_date || match.tournament_date)}</span>
        </div>
        {showWinLoss && (
          <span className={cn(
            "px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide",
            (isDrawValue ?? isDraw) ? "bg-muted text-muted-foreground" :
              ((winLossValue ?? team1Won) ? "bg-emerald-500/20 text-emerald-500" : "bg-rose-500/20 text-rose-500")
          )}>
            {(isDrawValue ?? isDraw) ? 'Draw' : ((winLossValue ?? team1Won) ? 'Win' : 'Loss')}
          </span>
        )}
        {!showWinLoss && (
          <div className="text-[10px] text-muted-foreground/50 font-mono">
            {match.match_id.substring(0, 6)}...
          </div>
        )}
      </div>

      {/* Match row */}
      <div className="flex items-center gap-2 text-sm">
        {/* Team 1 */}
        <div className={cn("flex-1 flex items-center gap-2 min-w-0", team1Won && "font-semibold text-foreground")}>
          {displayTeam1Rank && (
            <div className={cn(
              "flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded border text-xs",
              isTeam1Highlighted ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
            )}>
              <span className="font-bold text-foreground">T#{displayTeam1Rank.rank}</span>
              <span className={cn(
                "font-semibold",
                displayTeam1Rank.confidence >= 70 ? "text-primary" : displayTeam1Rank.confidence >= 40 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {Math.round(displayTeam1Rank.confidence)}%
              </span>
              {team1Impact && (
                <Tooltip content={getRatingChangeTooltip(team1Impact, team1Players.join('+'), team2Players.join('+'), 'team')}>
                  <span className={cn("font-bold cursor-help ml-1", team1Impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {team1Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team1Impact.ratingChange)}
                  </span>
                </Tooltip>
              )}
            </div>
          )}

          <div className="flex items-center gap-1 min-w-0 flex-wrap">
            {team1Players.map((playerName, idx) => {
              const impact = getPlayerImpact(match, playerName);
              const rank = resolvePlayerRank(playerName, impact);
              const race = playerRaces[playerName];
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <span className="text-muted-foreground">+</span>}
                  <span className={isHighlighted ? "text-primary font-bold" : "text-foreground"}>{playerName}</span>
                  {race && <span className="text-xs text-muted-foreground">({getRaceAbbrev(race)})</span>}
                  {rank && <span className="text-[10px] text-muted-foreground/70">#{rank}</span>}
                  {impact && (
                    <Tooltip content={getRatingChangeTooltip(impact, playerName, team2Players.join('+'), 'player')}>
                      <span className={cn("text-xs font-medium cursor-help", impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
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
        <div className="flex items-center gap-2 font-bold text-lg shrink-0 px-2 bg-muted/20 rounded-md">
          <span className={team1Won ? "text-emerald-500" : isDraw ? "text-muted-foreground" : "text-muted-foreground"}>{team1Score}</span>
          <span className="text-muted-foreground/30 text-base font-normal">-</span>
          <span className={(!team1Won && !isDraw) ? "text-emerald-500" : isDraw ? "text-muted-foreground" : "text-muted-foreground"}>{team2Score}</span>
        </div>

        {/* Team 2 */}
        <div className={cn("flex-1 flex items-center gap-2 min-w-0 justify-end", !team1Won && !isDraw && "font-semibold text-foreground")}>
          <div className="flex items-center gap-1 min-w-0 flex-wrap justify-end">
            {team2Players.map((playerName, idx) => {
              const impact = getPlayerImpact(match, playerName);
              const rank = resolvePlayerRank(playerName, impact);
              const race = playerRaces[playerName];
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-1 shrink-0 flex-row-reverse">
                  <span className={isHighlighted ? "text-primary font-bold" : "text-foreground"}>{playerName}</span>
                  {race && <span className="text-xs text-muted-foreground">({getRaceAbbrev(race)})</span>}
                  {rank && <span className="text-[10px] text-muted-foreground/70">#{rank}</span>}
                  {impact && (
                    <Tooltip content={getRatingChangeTooltip(impact, playerName, team1Players.join('+'), 'player')}>
                      <span className={cn("text-xs font-medium cursor-help", impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                        {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                      </span>
                    </Tooltip>
                  )}
                  {idx < team2Players.length - 1 && <span className="text-muted-foreground">+</span>}
                </div>
              );
            })}
          </div>
          {displayTeam2Rank && (
            <div className={cn(
              "flex items-center gap-1 shrink-0 px-1.5 py-0.5 rounded border text-xs flex-row-reverse",
              isTeam2Highlighted ? "bg-primary/10 border-primary/30" : "bg-muted/50 border-border"
            )}>
              {team2Impact && (
                <Tooltip content={getRatingChangeTooltip(team2Impact, team2Players.join('+'), team1Players.join('+'), 'team')}>
                  <span className={cn("font-bold cursor-help mr-1", team2Impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {team2Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team2Impact.ratingChange)}
                  </span>
                </Tooltip>
              )}
              <span className={cn(
                "font-semibold",
                displayTeam2Rank.confidence >= 70 ? "text-primary" : displayTeam2Rank.confidence >= 40 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {Math.round(displayTeam2Rank.confidence)}%
              </span>
              <span className="font-bold text-foreground">T#{displayTeam2Rank.rank}</span>
            </div>
          )}
        </div>
      </div>

      {/* Breakdown Footer */}
      {showRatingBreakdown && (
        <div className="mt-2 pt-2 border-t border-border/50 flex flex-col gap-1 text-[11px] text-muted-foreground">
          {/* Teams Breakdown */}
          {((displayTeam1Rank && team1Impact) || (displayTeam2Rank && team2Impact)) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground/60 mr-2">Team Impact:</span>
              <div className="flex items-center gap-3">
                {displayTeam1Rank && team1Impact && (
                  <Tooltip content={getRatingChangeTooltip(team1Impact, team1Players.join('+'), team2Players.join('+'), 'team')}>
                    <span className={cn("flex items-center gap-1 cursor-help hover:underline", team1Impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      <span>{team1Players.join('+')}</span>
                      <span className="font-mono font-bold">{team1Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team1Impact.ratingChange)}</span>
                    </span>
                  </Tooltip>
                )}
                {displayTeam2Rank && team2Impact && (
                  <Tooltip content={getRatingChangeTooltip(team2Impact, team2Players.join('+'), team1Players.join('+'), 'team')}>
                    <span className={cn("flex items-center gap-1 cursor-help hover:underline", team2Impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      <span>{team2Players.join('+')}</span>
                      <span className="font-mono font-bold">{team2Impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(team2Impact.ratingChange)}</span>
                    </span>
                  </Tooltip>
                )}
              </div>
            </div>
          )}
          {/* Race Impact Logic (Simplified adaptation from original) */}
          {((showRaceInfo && raceInfo) || (extractRaceChanges && extractRaceChanges(match)?.length)) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground/60 mr-2">Race Impact:</span>
              <div className="flex items-center gap-3">
                {extractRaceChanges && extractRaceChanges(match)?.map(rc => (
                  <span key={rc.race} className={cn("font-mono font-medium", rc.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {rc.race}: {rc.change >= 0 ? '+' : ''}{formatRankingPoints(rc.change)}
                  </span>
                ))}
                {!extractRaceChanges && showRaceInfo && raceInfo && (
                  <span className={cn("font-mono font-medium", raceInfo.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {raceInfo.race1}: {raceInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(raceInfo.ratingChange)}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
