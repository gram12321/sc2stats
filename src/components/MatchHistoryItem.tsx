import { Race } from '../types/tournament';
import { formatRankingPoints, getRaceAbbr } from '../lib/utils';
import { Tooltip } from './ui/tooltip';
import { cn } from '../lib/utils'; // Import cn utility

interface PlayerImpact {
  ratingBefore: number;
  rankBefore?: number | string;
  rankBeforeConfidence?: number;
  rankAfter?: number | string;
  rankAfterConfidence?: number;
  ratingChange: number;
  won: boolean;
  isDraw?: boolean;
  opponentRating: number;
  expectedWin?: number;
  baseK?: number;
  adjustedK?: number;
  confidenceMultiplier?: number;
  opponentMatchCount?: number;
  confidence?: number;
  matchCount?: number;
  matchK?: number;
  matchRatingChange?: number;
  scoreRatingChange?: number;
  scoreSignalUsed?: boolean;
  actualScoreShare?: number | null;
  expectedScoreShare?: number | null;
  bestOf?: number | null;
  mapsPlayed?: number | null;
  outcomeSeriesMultiplier?: number;
  scoreWeight?: number;
  scoreK?: number;
  seriesScoreMultiplier?: number;
  scoreReliabilityMultiplier?: number;
}

interface TeamImpact {
  ratingBefore: number;
  rankBefore?: number | string;
  rankBeforeConfidence?: number;
  rankAfter?: number | string;
  rankAfterConfidence?: number;
  ratingChange: number;
  won: boolean;
  isDraw?: boolean;
  opponentRating: number;
  expectedWin?: number;
  baseK?: number;
  adjustedK?: number;
  confidenceMultiplier?: number;
  opponentMatchCount?: number;
  confidence?: number;
  matchCount?: number;
  matchK?: number;
  matchRatingChange?: number;
  scoreRatingChange?: number;
  scoreSignalUsed?: boolean;
  actualScoreShare?: number | null;
  expectedScoreShare?: number | null;
  bestOf?: number | null;
  mapsPlayed?: number | null;
  outcomeSeriesMultiplier?: number;
  scoreWeight?: number;
  scoreK?: number;
  seriesScoreMultiplier?: number;
  scoreReliabilityMultiplier?: number;
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
    player1_race?: string; // Race abbreviation (P, T, Z, R)
    player2_race?: string; // Race abbreviation (P, T, Z, R)
  };
  team2: {
    player1: string;
    player2: string;
    player1_race?: string; // Race abbreviation (P, T, Z, R)
    player2_race?: string; // Race abbreviation (P, T, Z, R)
  };
  team1_score: number;
  team2_score: number;
  player_impacts?: Record<string, PlayerImpact>;
  team_impacts?: Record<string, TeamImpact>;
  combo_impacts?: Record<string, TeamImpact>;
  race_impacts?: Record<string, {
    ratingBefore: number;
    rankBefore?: number | string;
    rankBeforeConfidence?: number;
    rankAfter?: number | string;
    rankAfterConfidence?: number;
    ratingChange: number;
    won: boolean;
    isDraw?: boolean;
    opponentRating: number;
    race1: string;
    race2: string;
    expectedWin?: number;
    baseK?: number;
    adjustedK?: number;
    confidenceMultiplier?: number;
    opponentMatchCount?: number;
    confidence?: number;
    matchCount?: number;
    matchK?: number;
    matchRatingChange?: number;
    scoreRatingChange?: number;
    scoreSignalUsed?: boolean;
    actualScoreShare?: number | null;
    expectedScoreShare?: number | null;
    bestOf?: number | null;
    mapsPlayed?: number | null;
    outcomeSeriesMultiplier?: number;
    scoreWeight?: number;
    scoreK?: number;
    seriesScoreMultiplier?: number;
    scoreReliabilityMultiplier?: number;
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
  comboRankings?: Record<string, { points: number }>; // Combined rankings for combos (e.g., "PZ" -> { points: 324.26 })
  extractRaceChanges?: (match: MatchData) => Array<{ race: string; change: number }> | null;
  normalizeTeamKey: (player1: string, player2: string) => string;
  getTeamImpact: (match: MatchData, player1: string, player2: string) => TeamImpact | null;
  getPlayerImpact: (match: MatchData, playerName: string) => PlayerImpact | null;
  formatDate: (dateStr: string | null) => string;
}

/**
 * Get the actual race used by a player in this specific match
 * Checks match data first, then falls back to playerRaces defaults
 */
function getPlayerRaceInMatch(
  playerName: string,
  team: { player1: string; player2: string; player1_race?: string; player2_race?: string },
  playerRaces: Record<string, Race>
): string {
  // Check if this player is player1 or player2 in the team
  if (team.player1 === playerName && team.player1_race) {
    return team.player1_race;
  }
  if (team.player2 === playerName && team.player2_race) {
    return team.player2_race;
  }
  // Fallback to default race
  const defaultRace = playerRaces[playerName];
  return defaultRace ? getRaceAbbr(defaultRace) : '';
}

function getCombination(n: number, k: number): number {
  if (k < 0 || k > n) return 0;
  if (k === 0 || k === n) return 1;
  const reducedK = Math.min(k, n - k);
  let result = 1;
  for (let i = 1; i <= reducedK; i++) {
    result = (result * (n - reducedK + i)) / i;
  }
  return result;
}

function getExpectedSeriesOutcomes(
  expectedWin: number,
  bestOf?: number | null,
  mapsPlayed?: number | null
): Array<{ score: string; probability: number }> {
  const resolvedBestOf = Number.isFinite(bestOf) && (bestOf as number) > 0
    ? (bestOf as number)
    : (Number.isFinite(mapsPlayed) && (mapsPlayed as number) > 0 ? ((mapsPlayed as number) * 2) - 1 : null);

  if (!Number.isFinite(resolvedBestOf) || (resolvedBestOf as number) <= 1) {
    return [];
  }

  const p = Math.max(0, Math.min(1, expectedWin));
  const q = 1 - p;
  const winsNeeded = Math.floor((resolvedBestOf as number) / 2) + 1;
  const outcomes: Array<{ score: string; probability: number }> = [];

  for (let losses = 0; losses < winsNeeded; losses++) {
    const ways = getCombination((winsNeeded - 1) + losses, losses);
    const probability = ways * Math.pow(p, winsNeeded) * Math.pow(q, losses);
    outcomes.push({ score: `${winsNeeded}-${losses}`, probability });
  }

  for (let wins = winsNeeded - 1; wins >= 0; wins--) {
    const ways = getCombination((winsNeeded - 1) + wins, wins);
    const probability = ways * Math.pow(q, winsNeeded) * Math.pow(p, wins);
    outcomes.push({ score: `${wins}-${winsNeeded}`, probability });
  }

  const total = outcomes.reduce((sum, x) => sum + x.probability, 0) || 1;
  return outcomes.map((x) => ({ ...x, probability: x.probability / total }));
}

function getRatingChangeTooltip(
  impact: PlayerImpact | TeamImpact,
  subjectName: string,
  opponentName: string,
  type: 'player' | 'team' | 'race' = 'player',
  isCombo: boolean = false,
  comboCombinedRatings?: { subjectRating: number; opponentRating: number } // Combined "vsX" ratings
): React.ReactNode {
  const {
    ratingBefore,
    ratingChange,
    won,
    opponentRating,
    expectedWin,
    baseK,
    adjustedK,
    confidenceMultiplier,
    opponentMatchCount,
    confidence,
    matchCount,
    matchK,
    matchRatingChange,
    scoreRatingChange,
    scoreSignalUsed,
    actualScoreShare,
    expectedScoreShare,
    bestOf,
    mapsPlayed,
    outcomeSeriesMultiplier,
    scoreWeight,
    scoreK,
    seriesScoreMultiplier,
    scoreReliabilityMultiplier
  } = impact;

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
  const kAfterConfidence = (baseK !== undefined && confidenceMultiplier !== undefined)
    ? baseK * confidenceMultiplier
    : undefined;
  const protectionMultiplier = (kAfterConfidence !== undefined && kAfterConfidence !== 0)
    ? adjustedK / kAfterConfidence
    : undefined;
  const hasProtectionInfo = opponentMatchCount !== undefined && protectionMultiplier !== undefined;
  const isNewVsNewModerated = hasProtectionInfo &&
    matchCount !== undefined &&
    matchCount <= 4 &&
    opponentMatchCount !== undefined &&
    opponentMatchCount <= 4;
  const kExpression = (() => {
    if (baseK !== undefined && confidenceMultiplier !== undefined && protectionMultiplier !== undefined) {
      return `${baseK.toFixed(1)} × ${confidenceMultiplier.toFixed(3)} × ${protectionMultiplier.toFixed(3)}`;
    }
    if (baseK !== undefined && confidenceMultiplier !== undefined) {
      return `${baseK.toFixed(1)} × ${confidenceMultiplier.toFixed(3)}`;
    }
    return `${adjustedK.toFixed(1)}`;
  })();
  const hasCompositeBreakdown =
    matchK !== undefined &&
    matchRatingChange !== undefined &&
    scoreRatingChange !== undefined;
  const hasScoreShareInputs = actualScoreShare !== null && actualScoreShare !== undefined && expectedScoreShare !== null && expectedScoreShare !== undefined;
  const scoreDelta = hasScoreShareInputs ? (actualScoreShare - expectedScoreShare) : null;
  const derivedScoreK = (scoreK !== undefined)
    ? scoreK
    : (scoreDelta !== null && Math.abs(scoreDelta) > 1e-9
      ? scoreRatingChange! / scoreDelta
      : 0);
  const expectedSeriesOutcomes = getExpectedSeriesOutcomes(expectedWin, bestOf, mapsPlayed);
  const calculation = `${adjustedK.toFixed(1)} × (${actualResult} - ${expectedWin.toFixed(3)}) = ${formatRankingPoints(ratingChange)}`;

  return (
    <div className="text-left space-y-1 max-w-xs text-foreground">
      <div className="font-semibold mb-1 border-b border-border pb-1">{typeLabel} Rating Change Calculation</div>
      <div className="text-xs space-y-1">
        {isCombo ? (
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            {comboCombinedRatings ? (
              <>
                <div className="text-blue-400 font-medium">{subjectName}vsX:</div>
                <div className="text-right">{formatRankingPoints(comboCombinedRatings.subjectRating)}</div>

                <div className="text-red-400 font-medium">{opponentName}vsX:</div>
                <div className="text-right">{formatRankingPoints(comboCombinedRatings.opponentRating)}</div>

                <div className="text-primary font-medium border-t border-border pt-1 col-span-2">Matchup</div>
                <div className="text-purple-400 font-medium">{subjectName}vs{opponentName}:</div>
                <div className="text-right">{formatRankingPoints(ratingBefore)}</div>
              </>
            ) : (
              <>
                <div className="text-blue-400 font-medium">{subjectName}vs{opponentName}:</div>
                <div className="text-right">{formatRankingPoints(ratingBefore)}</div>
              </>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5">
            <div className="text-blue-400 font-medium">{subjectName}:</div>
            <div className="text-right">{formatRankingPoints(ratingBefore)}</div>

            <div className="text-red-400 font-medium">{opponentName}:</div>
            <div className="text-right">{formatRankingPoints(opponentRating)}</div>
          </div>
        )}

        <div className="pt-1 border-t border-border mt-1">
          <div><span className="text-muted-foreground">Expected Win:</span> {expectedWinPercent}% ({expectedWin.toFixed(3)})</div>
          <div><span className="text-muted-foreground">Actual Result:</span> {isDraw ? 'Draw' : (won ? 'Win' : 'Loss')} ({actualResult})</div>
          <div className="text-muted-foreground italic">
            Performance: {isDraw && expectedWin >= 0.4 && expectedWin <= 0.6 ? 'Met expectations' :
              (actualResult > expectedWin ? 'Outperformed' : 'Underperformed')} by {Math.abs(actualResult - expectedWin).toFixed(3)}
          </div>
        </div>
        {expectedSeriesOutcomes.length > 0 && (
          <div className="pt-1 border-t border-border mt-1">
            <div className="text-muted-foreground mb-0.5">Expected Series Scorelines:</div>
            <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-[11px]">
              {expectedSeriesOutcomes.map((outcome) => (
                [
                  <div key={`${outcome.score}-label`} className="text-muted-foreground">{outcome.score}:</div>,
                  <div key={`${outcome.score}-value`} className="text-right">{(outcome.probability * 100).toFixed(1)}%</div>
                ]
              ))}
            </div>
          </div>
        )}
        {baseK !== undefined && (
          <div className="pt-1 border-t border-border mt-1 grid grid-cols-2 gap-x-2">
            <div><span className="text-muted-foreground">Base K:</span> {baseK.toFixed(1)}</div>
            {adjustedK !== undefined && adjustedK !== baseK && (
              <div><span className="text-muted-foreground">Adj K:</span> {adjustedK.toFixed(1)}</div>
            )}
            {confidenceMultiplier !== undefined && (
              <div className="text-muted-foreground">Conf Mult: {confidenceMultiplier.toFixed(3)}x</div>
            )}
            {hasProtectionInfo && (
              <div className="text-muted-foreground">Protect vs New: {protectionMultiplier!.toFixed(3)}x</div>
            )}
            {isNewVsNewModerated && (
              <div className="text-muted-foreground col-span-2">
                New vs New: protection is moderated so both ratings can calibrate early.
              </div>
            )}
            {confidence !== undefined && (
              <div className="text-muted-foreground">Conf: {Math.round(confidence)}%</div>
            )}
            {matchCount !== undefined && (
              <div className="text-muted-foreground">Matches: {matchCount}</div>
            )}
            {opponentMatchCount !== undefined && (
              <div className="text-muted-foreground">Opp Matches: {Math.round(opponentMatchCount)}</div>
            )}
          </div>
        )}
        {hasCompositeBreakdown ? (
          <div className="pt-1 border-t border-border mt-1 space-y-1">
            <div className="text-muted-foreground mb-0.5">Calculation:</div>
            <div className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-1 rounded border border-border space-y-0.5">
              <div><span className="font-semibold">1) Adjusted K</span> (base for both terms)</div>
              <div className="font-mono">Adj K = {kExpression} = {adjustedK.toFixed(3)}</div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-1 rounded border border-border space-y-0.5">
              <div><span className="font-semibold">2) Match term</span> (result only)</div>
              {outcomeSeriesMultiplier !== undefined && (
                <div className="font-mono">
                  Match K = Adj K × Result series factor = {adjustedK.toFixed(3)} × {outcomeSeriesMultiplier.toFixed(3)} = {matchK!.toFixed(3)}
                </div>
              )}
              <div className="font-mono">
                Result delta = Actual - Expected = {actualResult.toFixed(3)} - {expectedWin.toFixed(3)} = {(actualResult - expectedWin).toFixed(3)}
              </div>
              <div className="font-mono">
                Match term = {matchK!.toFixed(3)} × {(actualResult - expectedWin).toFixed(3)} = {matchRatingChange!.toFixed(3)}
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-1 rounded border border-border space-y-0.5">
              <div><span className="font-semibold">3) Scoreline term</span> (map margin)</div>
              {hasScoreShareInputs && (
                <>
                  <div className="font-mono">
                    Score share = maps won / maps played = {actualScoreShare!.toFixed(3)}
                  </div>
                  <div className="font-mono">
                    Score delta = Actual - Expected score share = {actualScoreShare!.toFixed(3)} - {expectedScoreShare!.toFixed(3)} = {(actualScoreShare! - expectedScoreShare!).toFixed(3)}
                  </div>
                </>
              )}
              {(seriesScoreMultiplier !== undefined || scoreReliabilityMultiplier !== undefined || scoreWeight !== undefined) && (
                <div className="font-mono">
                  Score weight = 0.55 × Margin series factor ({seriesScoreMultiplier?.toFixed(3) ?? '-'}) × Reliability ({scoreReliabilityMultiplier?.toFixed(3) ?? '-'}) = {scoreWeight?.toFixed(3) ?? '-'}
                </div>
              )}
              <div className="font-mono">
                Score K = Adj K × Score weight = {adjustedK.toFixed(3)} × {scoreWeight?.toFixed(3) ?? '-'} = {derivedScoreK.toFixed(3)}
              </div>
              {hasScoreShareInputs && (
                <div className="font-mono">
                  Score term = {derivedScoreK.toFixed(3)} × {(actualScoreShare! - expectedScoreShare!).toFixed(3)} = {scoreRatingChange!.toFixed(3)}
                </div>
              )}
              {!scoreSignalUsed && (
                <div className="italic">No extra scoreline signal used for this series format.</div>
              )}
            </div>
            {(bestOf !== null && bestOf !== undefined || mapsPlayed !== null && mapsPlayed !== undefined) && (
              <div className="text-[10px] text-muted-foreground text-center">
                {bestOf !== null && bestOf !== undefined ? `BO${bestOf}` : 'Series'}{mapsPlayed !== null && mapsPlayed !== undefined ? ` • ${mapsPlayed} map${mapsPlayed === 1 ? '' : 's'}` : ''}
              </div>
            )}
            <div className="font-mono text-xs bg-muted px-1.5 py-1 rounded border border-border text-center">
              Total change = Match term + Scoreline term = {matchRatingChange!.toFixed(3)} + {scoreRatingChange!.toFixed(3)} = {ratingChange.toFixed(3)}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5 text-center italic">
              Display rounding may differ slightly from internal decimals.
            </div>
          </div>
        ) : (
          <div className="pt-1 border-t border-border mt-1">
            <div className="text-muted-foreground mb-0.5">Final Calculation:</div>
            <div className="font-mono text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded border border-border text-center mb-1">
              K = {kExpression} = {adjustedK.toFixed(1)}
            </div>
            <div className="font-mono text-xs bg-muted px-1.5 py-1 rounded border border-border text-center">
              {calculation}
            </div>
            <div className="text-muted-foreground text-[10px] mt-0.5 text-center italic">
              K-factor × (Actual - Expected) = Change
            </div>
          </div>
        )}
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
  comboRankings = {},
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
    const beforeRank = parseRank(impact?.rankBefore);
    const afterRank = parseRank(impact?.rankAfter);
    const fallbackRank = currentRankObj?.rank;

    const resolvedBefore = beforeRank ?? fallbackRank;
    const resolvedAfter = afterRank ?? resolvedBefore;

    if (!resolvedBefore && !resolvedAfter) return null;

    return {
      beforeRank: resolvedBefore,
      afterRank: resolvedAfter,
      beforeConfidence: impact?.rankBeforeConfidence ?? currentRankObj?.confidence,
      afterConfidence: impact?.rankAfterConfidence ?? currentRankObj?.confidence
    };
  };

  const displayTeam1Rank = resolveTeamRank(shouldSwap ? team2Rank : team1Rank, team1Impact);
  const displayTeam2Rank = resolveTeamRank(shouldSwap ? team1Rank : team2Rank, team2Impact);

  const team1Players = [team1Data.player1, team1Data.player2].filter(Boolean);
  const team2Players = [team2Data.player1, team2Data.player2].filter(Boolean);
  const isDraw = team1Score === team2Score;
  const team1Won = team1Score > team2Score;

  const resolvePlayerRank = (playerName: string, impact: PlayerImpact | null) => {
    const fallback = playerRankings[playerName]?.rank;
    const rankAfter = parseRank(impact?.rankAfter);
    const rankBefore = parseRank(impact?.rankBefore);
    return rankAfter ?? rankBefore ?? fallback;
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
              <span className="font-bold text-foreground">
                {displayTeam1Rank.beforeRank && displayTeam1Rank.afterRank && displayTeam1Rank.beforeRank !== displayTeam1Rank.afterRank
                  ? `T#${displayTeam1Rank.beforeRank}→#${displayTeam1Rank.afterRank}`
                  : `T#${displayTeam1Rank.afterRank || displayTeam1Rank.beforeRank}`}
              </span>
              <span className={cn(
                "font-semibold",
                (displayTeam1Rank.afterConfidence || 0) >= 70 ? "text-primary" : (displayTeam1Rank.afterConfidence || 0) >= 40 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {Math.round(displayTeam1Rank.afterConfidence || 0)}%
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
              const raceAbbr = getPlayerRaceInMatch(playerName, team1Data, playerRaces);
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-1 shrink-0">
                  {idx > 0 && <span className="text-muted-foreground">+</span>}
                  <span className={isHighlighted ? "text-primary font-bold" : "text-foreground"}>{playerName}</span>
                  {raceAbbr && <span className="text-xs text-muted-foreground">({raceAbbr})</span>}
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
              const raceAbbr = getPlayerRaceInMatch(playerName, team2Data, playerRaces);
              const isHighlighted = highlightPlayers.includes(playerName);
              return (
                <div key={playerName} className="flex items-center gap-1 shrink-0 flex-row-reverse">
                  <span className={isHighlighted ? "text-primary font-bold" : "text-foreground"}>{playerName}</span>
                  {raceAbbr && <span className="text-xs text-muted-foreground">({raceAbbr})</span>}
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
                (displayTeam2Rank.afterConfidence || 0) >= 70 ? "text-primary" : (displayTeam2Rank.afterConfidence || 0) >= 40 ? "text-yellow-500" : "text-muted-foreground"
              )}>
                {Math.round(displayTeam2Rank.afterConfidence || 0)}%
              </span>
              <span className="font-bold text-foreground">
                {displayTeam2Rank.beforeRank && displayTeam2Rank.afterRank && displayTeam2Rank.beforeRank !== displayTeam2Rank.afterRank
                  ? `T#${displayTeam2Rank.beforeRank}→#${displayTeam2Rank.afterRank}`
                  : `T#${displayTeam2Rank.afterRank || displayTeam2Rank.beforeRank}`}
              </span>
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
          {/* Race Impact Logic */}
          {(match.race_impacts || (showRaceInfo && raceInfo) || (extractRaceChanges && extractRaceChanges(match)?.length)) && (
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground/60 mr-2">Race Impact:</span>
              <div className="flex items-center gap-3 flex-wrap">
                {match.race_impacts && Object.entries(match.race_impacts).map(([key, impact]) => (
                  <Tooltip key={key} content={getRatingChangeTooltip(impact, impact.race1, impact.race2, 'race')}>
                    <span className={cn("font-mono font-medium cursor-help hover:underline", impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {impact.race1}v{impact.race2}: {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                    </span>
                  </Tooltip>
                ))}
                {!match.race_impacts && extractRaceChanges && extractRaceChanges(match)?.map(rc => (
                  <span key={rc.race} className={cn("font-mono font-medium", rc.change >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {rc.race}: {rc.change >= 0 ? '+' : ''}{formatRankingPoints(rc.change)}
                  </span>
                ))}
                {!match.race_impacts && !extractRaceChanges && showRaceInfo && raceInfo && (
                  <span className={cn("font-mono font-medium", raceInfo.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                    {raceInfo.race1}: {raceInfo.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(raceInfo.ratingChange)}
                  </span>
                )}
              </div>
            </div>
          )}
          {/* Team Race Combo Impact Logic */}
          {match.combo_impacts && Object.keys(match.combo_impacts).length > 0 && (() => {
            // Get both combos
            const combos = Object.keys(match.combo_impacts);
            if (combos.length === 0) return null;

            // Determine which combo to display from (prefer highlighted combo, otherwise team1)
            let primaryCombo = combos[0];
            let secondaryCombo = combos[1] || 'opponent';

            // Check if there's a highlighted combo and swap if needed
            if (highlightCombo && combos.includes(highlightCombo)) {
              primaryCombo = highlightCombo;
              secondaryCombo = combos.find(c => c !== highlightCombo) || 'opponent';
            }

            const impact = match.combo_impacts[primaryCombo];
            if (!impact) return null;

            const matchupLabel = `${primaryCombo}vs${secondaryCombo}`;

            // Get combined ratings for both combos
            const comboCombinedRatings = comboRankings[primaryCombo] && comboRankings[secondaryCombo] ? {
              subjectRating: comboRankings[primaryCombo].points,
              opponentRating: comboRankings[secondaryCombo].points
            } : undefined;

            return (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground/60 mr-2">Team Combo Impact:</span>
                <div className="flex items-center gap-3 flex-wrap">
                  <Tooltip content={getRatingChangeTooltip(impact, primaryCombo, secondaryCombo, 'team', true, comboCombinedRatings)}>
                    <span className={cn("font-mono font-medium cursor-help hover:underline", impact.ratingChange >= 0 ? "text-emerald-500" : "text-rose-500")}>
                      {matchupLabel}: {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
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
