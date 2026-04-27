import { ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, HelpCircle, Loader2, Shuffle, Swords, Target, Users } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import { Input } from './ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from './ui/select';
import { Tooltip } from './ui/tooltip';
import { cn } from '../lib/utils';

interface PlayerRankingRow {
  name: string;
  points: number;
  matches: number;
  confidence: number;
}

interface TeamPredictionDetails {
  key: string;
  player1: string;
  player2: string;
  matches: number;
  wins: number;
  losses: number;
  draws: number;
  confidence: number;
  directRating: number;
  effectiveRating: number;
  intermediateTeamRating: number | null;
  intermediateBlendWeight: number;
  source: 'team-rating' | 'player-average';
  isExistingTeam: boolean;
  playerRatingsUsed: number;
  playerMatches?: number[];
}

interface MatchPredictionResponse {
  generatedAt: string;
  prediction: {
    rawExpectedWinTeam1: number;
    expectedWinTeam1: number;
    expectedWinTeam2: number;
    favorite: 'team1' | 'team2';
  };
  population: {
    mean: number;
    stdDev: number;
  };
  team1: TeamPredictionDetails;
  team2: TeamPredictionDetails;
  seriesOutcomes: Array<{
    scoreline: string;
    team1WinsSeries: boolean;
    probability: number;
  }>;
}

interface MatchPredictorPanelProps {
  useSeededRankings: boolean;
  mainCircuitOnly: boolean;
  useIntermediateTeamRating: boolean;
  seasons: string[];
}

interface PlayerFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  datalistId: string;
  disabled: boolean;
  placeholder: string;
  playerInfo: PlayerRankingRow | null;
}

function normalizeTeamKey(player1: string, player2: string): string {
  return [player1, player2].filter(Boolean).sort().join('+');
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return `${(value * 100).toFixed(digits)}%`;
}

function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return 'n/a';
  return value.toFixed(1);
}

function formatBlend(weight: number | null | undefined): string {
  if (weight === null || weight === undefined || !Number.isFinite(weight)) return 'n/a';
  if (weight <= 0) return '0%';
  return `${(Math.max(0, Math.min(1, weight)) * 100).toFixed(0)}%`;
}

function buildSharedParams({
  useSeededRankings,
  mainCircuitOnly,
  useIntermediateTeamRating,
  seasons
}: MatchPredictorPanelProps): URLSearchParams {
  const params = new URLSearchParams();
  if (useSeededRankings) params.append('useSeeds', 'true');
  if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
  if (useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
  if (seasons.length > 0) params.append('seasons', seasons.join(','));
  return params;
}

function predictionWidth(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const pct = Math.max(0, Math.min(100, value * 100));
  return `${pct.toFixed(1)}%`;
}

function outcomeWidth(value: number): string {
  if (!Number.isFinite(value)) return '0%';
  const pct = Math.max(3, Math.min(100, value * 100));
  return `${pct.toFixed(1)}%`;
}

function HelpLabel({ label, content }: { label: string; content: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1">
      <span>{label}</span>
      <Tooltip content={<div className="max-w-xs leading-relaxed text-gray-700">{content}</div>} side="top">
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground" />
      </Tooltip>
    </span>
  );
}

function PlayerField({
  label,
  value,
  onChange,
  datalistId,
  disabled,
  placeholder,
  playerInfo
}: PlayerFieldProps) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        list={datalistId}
        disabled={disabled}
        placeholder={placeholder}
        autoComplete="off"
        className="h-9"
      />
      <div className="min-h-4 text-[11px] text-muted-foreground">
        {playerInfo ? `${playerInfo.matches} matches, rating ${formatRating(playerInfo.points)}` : ' '}
      </div>
    </div>
  );
}

function sourceLabel(team: TeamPredictionDetails): string {
  return team.isExistingTeam ? 'Team history' : 'New team';
}

function sourceDescription(team: TeamPredictionDetails): string {
  if (team.isExistingTeam) {
    return 'Uses the direct team rating, blended with ITR when that setting is active.';
  }

  return team.intermediateBlendWeight > 0
    ? 'No direct team history. Uses the average of the two player ratings with 100% ITR blend.'
    : 'No direct team history. ITR is off, so the direct team rating starts at 0.';
}

function teamLabel(team: TeamPredictionDetails): string {
  return `${team.player1} + ${team.player2}`;
}

function RatingInputRow({ label, team }: { label: string; team: TeamPredictionDetails }) {
  return (
    <div className="grid grid-cols-2 gap-3 rounded-md border bg-background p-3 text-sm lg:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.8fr] lg:items-center">
      <div className="col-span-2 min-w-0 lg:col-span-1">
        <div className="font-medium">{label}</div>
        <div className="truncate text-xs text-muted-foreground">{teamLabel(team)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Effective</div>
        <div className="font-medium">{formatRating(team.effectiveRating)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Direct</div>
        <div className="font-medium">{formatRating(team.directRating)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">ITR blend</div>
        <div className="font-medium">{formatBlend(team.intermediateBlendWeight)}</div>
      </div>
      <div>
        <div className="text-[10px] uppercase text-muted-foreground">Matches</div>
        <div className="font-medium">{team.matches}</div>
      </div>
      <div className="col-span-2 lg:col-span-5">
        <Badge variant={team.isExistingTeam ? 'secondary' : 'outline'}>
          {sourceLabel(team)}
        </Badge>
        <span className="ml-2 text-xs text-muted-foreground">{sourceDescription(team)}</span>
      </div>
    </div>
  );
}

export function MatchPredictorPanel(props: MatchPredictorPanelProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [playerRowsByName, setPlayerRowsByName] = useState<Record<string, PlayerRankingRow>>({});
  const [teammatesByPlayer, setTeammatesByPlayer] = useState<Record<string, string[]>>({});
  const [playersLoading, setPlayersLoading] = useState(true);
  const [playersError, setPlayersError] = useState<string | null>(null);

  const [team1Player1, setTeam1Player1] = useState('');
  const [team1Player2, setTeam1Player2] = useState('');
  const [team2Player1, setTeam2Player1] = useState('');
  const [team2Player2, setTeam2Player2] = useState('');
  const [autoTeam1Teammate, setAutoTeam1Teammate] = useState<string | null>(null);
  const [autoTeam2Teammate, setAutoTeam2Teammate] = useState<string | null>(null);
  const [bestOf, setBestOf] = useState<string>('3');

  const [prediction, setPrediction] = useState<MatchPredictionResponse | null>(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const [predictionError, setPredictionError] = useState<string | null>(null);

  const playerNameByLower = useMemo(() => {
    return new Map(players.map((player) => [player.toLowerCase(), player]));
  }, [players]);

  const resolvePlayerName = useCallback((value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    return playerNameByLower.get(trimmed.toLowerCase()) || trimmed;
  }, [playerNameByLower]);

  const getPlayerInfo = useCallback((value: string) => {
    const resolved = resolvePlayerName(value);
    return resolved ? playerRowsByName[resolved] || null : null;
  }, [playerRowsByName, resolvePlayerName]);

  const getLikelyTeammate = useCallback((playerName: string, blockedNames: string[] = []) => {
    const resolved = resolvePlayerName(playerName);
    if (!resolved) return '';

    const blocked = new Set(
      blockedNames
        .map((name) => resolvePlayerName(name).toLowerCase())
        .filter(Boolean)
    );
    blocked.add(resolved.toLowerCase());

    return (teammatesByPlayer[resolved] || [])
      .map(resolvePlayerName)
      .find((teammate) => teammate && !blocked.has(teammate.toLowerCase())) || '';
  }, [resolvePlayerName, teammatesByPlayer]);

  useEffect(() => {
    let cancelled = false;

    const loadPlayers = async () => {
      setPlayersLoading(true);
      setPlayersError(null);
      setPrediction(null);
      setPredictionError(null);

      try {
        const params = buildSharedParams(props);
        const [rankingsResponse, teammatesResponse] = await Promise.all([
          fetch(`/api/player-rankings?${params.toString()}`),
          fetch(`/api/player-teammates?${params.toString()}`)
        ]);

        if (!rankingsResponse.ok) {
          throw new Error('Failed to load players for predictor');
        }
        if (!teammatesResponse.ok) {
          throw new Error('Failed to load teammate suggestions');
        }

        const rankingRows: PlayerRankingRow[] = await rankingsResponse.json();
        const teammatePayload: { teammates?: Record<string, string[]> } = await teammatesResponse.json();
        const sortedRows = [...(rankingRows || [])].sort((a, b) => {
          if (b.matches !== a.matches) return b.matches - a.matches;
          return a.name.localeCompare(b.name);
        });
        const nextPlayers = sortedRows.map((row) => row.name);
        const nextRowsByName = Object.fromEntries(sortedRows.map((row) => [row.name, row]));
        const nextTeammates = teammatePayload.teammates || {};

        if (cancelled) return;

        setPlayers(nextPlayers);
        setPlayerRowsByName(nextRowsByName);
        setTeammatesByPlayer(nextTeammates);

        if (!team1Player1 && !team1Player2 && !team2Player1 && !team2Player2) {
          const used = new Set<string>();
          const firstPrimary = nextPlayers.find((player) => (nextTeammates[player] || []).length > 0) || nextPlayers[0] || '';
          const firstMate = (nextTeammates[firstPrimary] || []).find((name) => name !== firstPrimary) || nextPlayers.find((name) => name !== firstPrimary) || '';
          if (firstPrimary) used.add(firstPrimary.toLowerCase());
          if (firstMate) used.add(firstMate.toLowerCase());

          const secondPrimary = nextPlayers.find((player) => {
            if (used.has(player.toLowerCase())) return false;
            return (nextTeammates[player] || []).some((name) => !used.has(String(name).toLowerCase()));
          }) || nextPlayers.find((player) => !used.has(player.toLowerCase())) || '';
          const secondMate = (nextTeammates[secondPrimary] || []).find((name) => !used.has(String(name).toLowerCase()) && name !== secondPrimary)
            || nextPlayers.find((name) => !used.has(name.toLowerCase()) && name !== secondPrimary)
            || '';

          setTeam1Player1(firstPrimary);
          setTeam1Player2(firstMate);
          setTeam2Player1(secondPrimary);
          setTeam2Player2(secondMate);
          setAutoTeam1Teammate(firstMate || null);
          setAutoTeam2Teammate(secondMate || null);
        }
      } catch (err) {
        if (!cancelled) {
          setPlayers([]);
          setPlayerRowsByName({});
          setTeammatesByPlayer({});
          setPlayersError(err instanceof Error ? err.message : 'Failed to load players');
        }
      } finally {
        if (!cancelled) {
          setPlayersLoading(false);
        }
      }
    };

    loadPlayers();

    return () => {
      cancelled = true;
    };
  }, [props.mainCircuitOnly, props.seasons, props.useIntermediateTeamRating, props.useSeededRankings]);

  const sortedPlayersForDatalist = useMemo(() => {
    return players.slice(0, 250);
  }, [players]);

  const setPrimaryPlayer = (
    side: 'team1' | 'team2',
    value: string
  ) => {
    const blocked = side === 'team1'
      ? [team2Player1, team2Player2]
      : [team1Player1, team1Player2];
    const suggestedTeammate = getLikelyTeammate(value, blocked);

    setPrediction(null);
    setPredictionError(null);

    if (side === 'team1') {
      setTeam1Player1(value);
      if (!team1Player2.trim() || team1Player2 === autoTeam1Teammate) {
        setTeam1Player2(suggestedTeammate);
        setAutoTeam1Teammate(suggestedTeammate || null);
      }
      return;
    }

    setTeam2Player1(value);
    if (!team2Player2.trim() || team2Player2 === autoTeam2Teammate) {
      setTeam2Player2(suggestedTeammate);
      setAutoTeam2Teammate(suggestedTeammate || null);
    }
  };

  const setTeammatePlayer = (
    side: 'team1' | 'team2',
    value: string
  ) => {
    setPrediction(null);
    setPredictionError(null);

    if (side === 'team1') {
      setTeam1Player2(value);
      setAutoTeam1Teammate(null);
      return;
    }

    setTeam2Player2(value);
    setAutoTeam2Teammate(null);
  };

  const team1SuggestedTeammate = getLikelyTeammate(team1Player1, [team2Player1, team2Player2]);
  const team2SuggestedTeammate = getLikelyTeammate(team2Player1, [team1Player1, team1Player2]);

  const runPrediction = useCallback(async () => {
    const playersForPrediction = [
      team1Player1,
      team1Player2,
      team2Player1,
      team2Player2
    ].map(resolvePlayerName);

    if (playersForPrediction.some((name) => !name)) {
      setPredictionError('Enter two players for each team.');
      setPrediction(null);
      return;
    }

    const uniqueNames = new Set(playersForPrediction.map((name) => name.toLowerCase()));
    if (uniqueNames.size !== playersForPrediction.length) {
      setPredictionError('A player can only appear once in the predicted match.');
      setPrediction(null);
      return;
    }

    const nextTeam1Key = normalizeTeamKey(playersForPrediction[0], playersForPrediction[1]);
    const nextTeam2Key = normalizeTeamKey(playersForPrediction[2], playersForPrediction[3]);

    if (nextTeam1Key === nextTeam2Key) {
      setPredictionError('Choose two different teams to run a prediction.');
      setPrediction(null);
      return;
    }

    setPredictionLoading(true);
    setPredictionError(null);

    try {
      const params = buildSharedParams(props);
      params.append('team1Key', nextTeam1Key);
      params.append('team2Key', nextTeam2Key);
      params.append('bestOf', bestOf);

      const response = await fetch(`/api/match-predict?${params.toString()}`);
      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.error || 'Failed to run match prediction');
      }

      const payload: MatchPredictionResponse = await response.json();
      setPrediction(payload);
    } catch (err) {
      setPrediction(null);
      setPredictionError(err instanceof Error ? err.message : 'Failed to run match prediction');
    } finally {
      setPredictionLoading(false);
    }
  }, [bestOf, props, resolvePlayerName, team1Player1, team1Player2, team2Player1, team2Player2]);

  const swapTeams = () => {
    setTeam1Player1(team2Player1);
    setTeam1Player2(team2Player2);
    setTeam2Player1(team1Player1);
    setTeam2Player2(team1Player2);
    setAutoTeam1Teammate(null);
    setAutoTeam2Teammate(null);
    setPrediction(null);
    setPredictionError(null);
  };

  const bestOfOptions = ['1', '3', '5', '7'];
  const canPredict = [team1Player1, team1Player2, team2Player1, team2Player2].every((value) => value.trim());

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-xl">
          <Swords className="h-5 w-5 text-primary" />
          Match Predictor
        </CardTitle>
        <CardDescription>
          Type player names to build two teams. Existing teams use team history; new teams can use player ratings through ITR.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <datalist id="prediction-player-options">
          {sortedPlayersForDatalist.map((player) => (
            <option key={player} value={player} />
          ))}
        </datalist>

        {playersError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            {playersError}
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_auto_1fr_auto_auto] xl:items-end">
          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                Team 1
              </div>
              {team1SuggestedTeammate && team1Player2 !== team1SuggestedTeammate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTeammatePlayer('team1', team1SuggestedTeammate)}
                >
                  Use {team1SuggestedTeammate}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <PlayerField
                label="Player"
                value={team1Player1}
                onChange={(value) => setPrimaryPlayer('team1', value)}
                datalistId="prediction-player-options"
                disabled={playersLoading}
                placeholder="Type a player"
                playerInfo={getPlayerInfo(team1Player1)}
              />
              <PlayerField
                label="Teammate"
                value={team1Player2}
                onChange={(value) => setTeammatePlayer('team1', value)}
                datalistId="prediction-player-options"
                disabled={playersLoading}
                placeholder="Auto-filled when possible"
                playerInfo={getPlayerInfo(team1Player2)}
              />
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={swapTeams}
            disabled={!canPredict || playersLoading}
            aria-label="Swap teams"
            className="mx-auto xl:mb-8"
          >
            <Shuffle className="h-4 w-4" />
          </Button>

          <div className="rounded-md border bg-muted/20 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Users className="h-4 w-4 text-primary" />
                Team 2
              </div>
              {team2SuggestedTeammate && team2Player2 !== team2SuggestedTeammate && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setTeammatePlayer('team2', team2SuggestedTeammate)}
                >
                  Use {team2SuggestedTeammate}
                </Button>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <PlayerField
                label="Player"
                value={team2Player1}
                onChange={(value) => setPrimaryPlayer('team2', value)}
                datalistId="prediction-player-options"
                disabled={playersLoading}
                placeholder="Type a player"
                playerInfo={getPlayerInfo(team2Player1)}
              />
              <PlayerField
                label="Teammate"
                value={team2Player2}
                onChange={(value) => setTeammatePlayer('team2', value)}
                datalistId="prediction-player-options"
                disabled={playersLoading}
                placeholder="Auto-filled when possible"
                playerInfo={getPlayerInfo(team2Player2)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>
              <HelpLabel
                label="Best of"
                content="The win chance comes from ratings. The scoreline diagram converts that win chance into likely series scores for the selected match length."
              />
            </Label>
            <Select value={bestOf} onValueChange={setBestOf}>
              <SelectTrigger className="w-[96px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {bestOfOptions.map((value) => (
                  <SelectItem key={value} value={value}>
                    BO{value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            type="button"
            onClick={runPrediction}
            disabled={playersLoading || predictionLoading || !canPredict}
            className="min-w-[110px]"
          >
            {predictionLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Predicting
              </>
            ) : (
              <>
                <Target className="mr-2 h-4 w-4" />
                Predict
              </>
            )}
          </Button>
        </div>

        {(playersLoading || predictionLoading) && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {playersLoading ? 'Loading players and teammate suggestions...' : 'Running prediction...'}
          </div>
        )}

        {predictionError && (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <span>{predictionError}</span>
            </div>
          </div>
        )}

        {!playersLoading && players.length < 4 && !playersError && (
          <div className="rounded-md border border-border bg-muted/30 p-3 text-sm text-muted-foreground">
            At least four players are required in the current filter scope to run a prediction.
          </div>
        )}

        {prediction && (
          <div className="space-y-5">
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <div className={cn(
                'rounded-md border bg-background p-4',
                prediction.prediction.favorite === 'team1' && 'border-emerald-400/60 bg-emerald-50/40'
              )}>
                <div className="text-base font-medium">{teamLabel(prediction.team1)}</div>
                <div className="text-sm text-muted-foreground">Win probability</div>
                <div className="mt-2 text-3xl font-semibold text-emerald-700">
                  {formatPercent(prediction.prediction.expectedWinTeam1)}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-emerald-500 transition-all"
                    style={{ width: predictionWidth(prediction.prediction.expectedWinTeam1) }}
                  />
                </div>
              </div>

              <div className={cn(
                'rounded-md border bg-background p-4',
                prediction.prediction.favorite === 'team2' && 'border-blue-400/60 bg-blue-50/40'
              )}>
                <div className="text-base font-medium">{teamLabel(prediction.team2)}</div>
                <div className="text-sm text-muted-foreground">Win probability</div>
                <div className="mt-2 text-3xl font-semibold text-blue-700">
                  {formatPercent(prediction.prediction.expectedWinTeam2)}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted">
                  <div
                    className="h-2 rounded-full bg-blue-500 transition-all"
                    style={{ width: predictionWidth(prediction.prediction.expectedWinTeam2) }}
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_1.1fr]">
              <div className="rounded-md border bg-muted/20 p-4">
                <div className="mb-3">
                  <div className="text-base font-medium">Rating Inputs</div>
                  <div className="text-sm text-muted-foreground">
                    Effective rating is what the prediction uses. New teams get 100% ITR when ITR is active.
                  </div>
                </div>
                <div className="space-y-3">
                  <RatingInputRow label="Team 1" team={prediction.team1} />
                  <RatingInputRow label="Team 2" team={prediction.team2} />
                </div>
                <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">Population std dev: {formatRating(prediction.population.stdDev)}</Badge>
                  <Badge variant="outline">Raw Team 1 win: {formatPercent(prediction.prediction.rawExpectedWinTeam1)}</Badge>
                  <Badge variant="outline">Calibrated Team 1 win: {formatPercent(prediction.prediction.expectedWinTeam1)}</Badge>
                </div>
              </div>

              <div className="rounded-md border bg-muted/20 p-4">
                <div className="mb-4">
                  <div className="text-base font-medium">Expected Series Outcomes</div>
                  <div className="text-sm text-muted-foreground">
                    Likely final scorelines for Team 1 vs Team 2 at BO{bestOf}.
                  </div>
                </div>
                <div className="space-y-3">
                  {prediction.seriesOutcomes.slice(0, 8).map((row) => {
                    const winningTeam = row.team1WinsSeries ? 'Team 1' : 'Team 2';
                    const barClass = row.team1WinsSeries ? 'bg-emerald-500' : 'bg-blue-500';
                    const textClass = row.team1WinsSeries ? 'text-emerald-700' : 'text-blue-700';

                    return (
                      <div key={`${row.scoreline}-${winningTeam}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <div className="min-w-0">
                            <span className="font-medium">{row.scoreline}</span>
                            <span className="ml-2 text-xs text-muted-foreground">{winningTeam} wins</span>
                          </div>
                          <div className={cn('font-medium', textClass)}>{formatPercent(row.probability)}</div>
                        </div>
                        <div className="h-3 rounded-full bg-background">
                          <div
                            className={cn('h-3 rounded-full transition-all', barClass)}
                            style={{ width: outcomeWidth(row.probability) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
