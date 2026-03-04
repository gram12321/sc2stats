import { useEffect, useMemo, useState } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { RankingFilters } from '../components/RankingFilters';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

interface Team {
  player1: string;
  player2: string;
}

interface TeamImpact {
  expectedWin?: number;
  ratingChange?: number;
}

interface MatchHistory {
  match_id: string;
  tournament_slug: string;
  tournament_date: string | null;
  match_date: string | null;
  round: string;
  team1: Team;
  team2: Team;
  team1_score: number;
  team2_score: number;
  team_impacts?: Record<string, TeamImpact>;
}

interface HighlightResult {
  match: MatchHistory;
  winnerSide: 'team1' | 'team2';
  favoriteSide: 'team1' | 'team2';
  winnerExpectedWin: number;
  favoriteExpectedWin: number;
}

interface RatingGainResult {
  match: MatchHistory;
  winnerSide: 'team1' | 'team2';
  ratingGain: number;
}

interface LopsidedScoreResult {
  match: MatchHistory;
  winnerSide: 'team1' | 'team2';
  mapDiff: number;
}

interface HighlightsProps {
  onNavigateToMatch?: (tournamentSlug: string, matchId: string) => void;
  onNavigateToPlayer?: (playerName: string) => void;
  onNavigateToTeam?: (player1: string, player2: string) => void;
}

function normalizeTeamKey(player1: string, player2: string): string {
  return [player1, player2].filter(Boolean).sort().join('+');
}

function getTeamLabel(team: Team): string {
  return `${team.player1} + ${team.player2}`;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

export function Highlights({ onNavigateToMatch, onNavigateToPlayer, onNavigateToTeam }: HighlightsProps) {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { seasons, useSeededRankings, mainCircuitOnly } = useRankingSettings();

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (useSeededRankings) params.append('useSeeds', 'true');
        if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
        if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

        const response = await fetch(`/api/match-history?${params.toString()}`);
        if (!response.ok) throw new Error('Failed to load match history');
        const data = await response.json();
        setMatches(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load highlights');
      } finally {
        setIsLoading(false);
      }
    };

    loadMatches();
  }, [useSeededRankings, mainCircuitOnly, seasons]);

  const highlights = useMemo(() => {
    let biggestUpset: HighlightResult | null = null;
    let biggestUpsetScore = -1;

    let mostExpectedResult: HighlightResult | null = null;
    let highestFavoriteProb = -1;

    let biggestRatingGain: RatingGainResult | null = null;
    let highestRatingGain = -1;

    let mostLopsidedScore: LopsidedScoreResult | null = null;
    let highestMapDiff = -1;

    for (const match of matches) {
      if (match.team1_score === match.team2_score) continue;

      const team1Key = normalizeTeamKey(match.team1.player1, match.team1.player2);
      const team2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
      const team1Expected = match.team_impacts?.[team1Key]?.expectedWin;
      const team2Expected = match.team_impacts?.[team2Key]?.expectedWin;

      if (typeof team1Expected !== 'number' || typeof team2Expected !== 'number') {
        continue;
      }

      const winnerSide: 'team1' | 'team2' = match.team1_score > match.team2_score ? 'team1' : 'team2';
      const winnerExpected = winnerSide === 'team1' ? team1Expected : team2Expected;

      const favoriteSide: 'team1' | 'team2' = team1Expected >= team2Expected ? 'team1' : 'team2';
      const favoriteExpected = Math.max(team1Expected, team2Expected);

      const currentResult: HighlightResult = {
        match,
        winnerSide,
        favoriteSide,
        winnerExpectedWin: winnerExpected,
        favoriteExpectedWin: favoriteExpected,
      };

      const winnerTeam = winnerSide === 'team1' ? match.team1 : match.team2;
      const winnerTeamKey = normalizeTeamKey(winnerTeam.player1, winnerTeam.player2);
      const winnerTeamImpact = match.team_impacts?.[winnerTeamKey];
      const winnerRatingGain = winnerTeamImpact?.ratingChange;

      if (typeof winnerRatingGain === 'number' && winnerRatingGain > highestRatingGain) {
        highestRatingGain = winnerRatingGain;
        biggestRatingGain = {
          match,
          winnerSide,
          ratingGain: winnerRatingGain,
        };
      }

      const mapDiff = Math.abs(match.team1_score - match.team2_score);
      if (mapDiff > highestMapDiff) {
        highestMapDiff = mapDiff;
        mostLopsidedScore = {
          match,
          winnerSide,
          mapDiff,
        };
      }

      const upsetScore = 1 - winnerExpected;
      if (upsetScore > biggestUpsetScore) {
        biggestUpsetScore = upsetScore;
        biggestUpset = currentResult;
      }

      const favoriteWon = winnerSide === favoriteSide;
      if (favoriteWon && favoriteExpected > highestFavoriteProb) {
        highestFavoriteProb = favoriteExpected;
        mostExpectedResult = currentResult;
      }
    }

    if (!mostExpectedResult) {
      for (const match of matches) {
        const team1Key = normalizeTeamKey(match.team1.player1, match.team1.player2);
        const team2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
        const team1Expected = match.team_impacts?.[team1Key]?.expectedWin;
        const team2Expected = match.team_impacts?.[team2Key]?.expectedWin;

        if (typeof team1Expected !== 'number' || typeof team2Expected !== 'number') {
          continue;
        }
        if (match.team1_score === match.team2_score) continue;

        const winnerSide: 'team1' | 'team2' = match.team1_score > match.team2_score ? 'team1' : 'team2';
        const favoriteSide: 'team1' | 'team2' = team1Expected >= team2Expected ? 'team1' : 'team2';
        const favoriteExpected = Math.max(team1Expected, team2Expected);

        if (favoriteExpected > highestFavoriteProb) {
          highestFavoriteProb = favoriteExpected;
          mostExpectedResult = {
            match,
            winnerSide,
            favoriteSide,
            winnerExpectedWin: winnerSide === 'team1' ? team1Expected : team2Expected,
            favoriteExpectedWin: favoriteExpected,
          };
        }
      }
    }

    return { biggestUpset, mostExpectedResult, biggestRatingGain, mostLopsidedScore };
  }, [matches]);

  const renderTeamAndPlayers = (team: Team) => {
    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onNavigateToTeam?.(team.player1, team.player2)}
          className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
        >
          {getTeamLabel(team)}
        </button>
        <div className="flex gap-2 flex-wrap">
          {[team.player1, team.player2].map((player) => (
            <button
              key={player}
              type="button"
              onClick={() => onNavigateToPlayer?.(player)}
              className="text-xs text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
            >
              {player}
            </button>
          ))}
        </div>
      </div>
    );
  };

  const renderMatchActions = (match: MatchHistory) => {
    return (
      <div className="pt-1">
        <Button
          size="sm"
          variant="outline"
          onClick={() => onNavigateToMatch?.(match.tournament_slug, match.match_id)}
        >
          Open Match
        </Button>
      </div>
    );
  };

  const renderHighlight = (
    title: string,
    subtitle: string,
    result: HighlightResult | null,
    metricLabel: string,
    metricValue: string
  ) => {
    if (!result) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>{title}</CardTitle>
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No qualifying matches in current filter selection.</p>
          </CardContent>
        </Card>
      );
    }

    const { match, winnerSide, favoriteSide, winnerExpectedWin, favoriteExpectedWin } = result;
    const winnerLabel = winnerSide === 'team1' ? getTeamLabel(match.team1) : getTeamLabel(match.team2);
    const loserLabel = winnerSide === 'team1' ? getTeamLabel(match.team2) : getTeamLabel(match.team1);
    const favoriteLabel = favoriteSide === 'team1' ? getTeamLabel(match.team1) : getTeamLabel(match.team2);

    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">{winnerLabel}</div>
            <Badge variant="secondary">{match.team1_score} - {match.team2_score}</Badge>
            <div className="text-sm text-muted-foreground text-right">vs {loserLabel}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Winner Team</div>
              {winnerSide === 'team1' ? renderTeamAndPlayers(match.team1) : renderTeamAndPlayers(match.team2)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opponent Team</div>
              {winnerSide === 'team1' ? renderTeamAndPlayers(match.team2) : renderTeamAndPlayers(match.team1)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div>
              <span className="text-muted-foreground">Event:</span> {match.tournament_slug}
            </div>
            <div>
              <span className="text-muted-foreground">Round:</span> {match.round || '—'}
            </div>
            <div>
              <span className="text-muted-foreground">Date:</span> {formatDate(match.match_date || match.tournament_date)}
            </div>
            <div>
              <span className="text-muted-foreground">Favorite:</span> {favoriteLabel} ({(favoriteExpectedWin * 100).toFixed(1)}%)
            </div>
            <div>
              <span className="text-muted-foreground">Winner Expected Win:</span> {(winnerExpectedWin * 100).toFixed(1)}%
            </div>
            <div>
              <span className="text-muted-foreground">{metricLabel}:</span> {metricValue}
            </div>
          </div>

          {renderMatchActions(match)}
        </CardContent>
      </Card>
    );
  };

  const renderRatingGainHighlight = (result: RatingGainResult | null) => {
    if (!result) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Biggest Rating Gain</CardTitle>
            <p className="text-sm text-muted-foreground">Largest single-match team rating increase for a winner.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No qualifying matches in current filter selection.</p>
          </CardContent>
        </Card>
      );
    }

    const { match, winnerSide, ratingGain } = result;
    const winnerTeam = winnerSide === 'team1' ? match.team1 : match.team2;
    const loserTeam = winnerSide === 'team1' ? match.team2 : match.team1;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Biggest Rating Gain</CardTitle>
          <p className="text-sm text-muted-foreground">Largest single-match team rating increase for a winner.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">{getTeamLabel(winnerTeam)}</div>
            <Badge variant="secondary">{match.team1_score} - {match.team2_score}</Badge>
            <div className="text-sm text-muted-foreground text-right">vs {getTeamLabel(loserTeam)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Event:</span> {match.tournament_slug}</div>
            <div><span className="text-muted-foreground">Round:</span> {match.round || '—'}</div>
            <div><span className="text-muted-foreground">Date:</span> {formatDate(match.match_date || match.tournament_date)}</div>
            <div><span className="text-muted-foreground">Rating Gain:</span> +{ratingGain.toFixed(2)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Winner Team</div>
              {renderTeamAndPlayers(winnerTeam)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opponent Team</div>
              {renderTeamAndPlayers(loserTeam)}
            </div>
          </div>

          {renderMatchActions(match)}
        </CardContent>
      </Card>
    );
  };

  const renderLopsidedHighlight = (result: LopsidedScoreResult | null) => {
    if (!result) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>Most Lopsided Scoreline</CardTitle>
            <p className="text-sm text-muted-foreground">Largest map-score difference in a single match.</p>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">No qualifying matches in current filter selection.</p>
          </CardContent>
        </Card>
      );
    }

    const { match, winnerSide, mapDiff } = result;
    const winnerTeam = winnerSide === 'team1' ? match.team1 : match.team2;
    const loserTeam = winnerSide === 'team1' ? match.team2 : match.team1;

    return (
      <Card>
        <CardHeader>
          <CardTitle>Most Lopsided Scoreline</CardTitle>
          <p className="text-sm text-muted-foreground">Largest map-score difference in a single match.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-foreground">{getTeamLabel(winnerTeam)}</div>
            <Badge variant="secondary">{match.team1_score} - {match.team2_score}</Badge>
            <div className="text-sm text-muted-foreground text-right">vs {getTeamLabel(loserTeam)}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
            <div><span className="text-muted-foreground">Event:</span> {match.tournament_slug}</div>
            <div><span className="text-muted-foreground">Round:</span> {match.round || '—'}</div>
            <div><span className="text-muted-foreground">Date:</span> {formatDate(match.match_date || match.tournament_date)}</div>
            <div><span className="text-muted-foreground">Map Differential:</span> {mapDiff}</div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <div>
              <div className="text-xs text-muted-foreground mb-1">Winner Team</div>
              {renderTeamAndPlayers(winnerTeam)}
            </div>
            <div>
              <div className="text-xs text-muted-foreground mb-1">Opponent Team</div>
              {renderTeamAndPlayers(loserTeam)}
            </div>
          </div>

          {renderMatchActions(match)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Highlights</h1>
            <p className="text-muted-foreground mt-1">Fun facts based on expected win probabilities.</p>
            <p className="text-xs text-muted-foreground mt-1">
              Expected-win values are recalculated from the active filters, so rankings can change when toggling Main Circuit or Seasons.
            </p>
          </div>
          <RankingFilters showSeeded={true} showMainCircuit={true} showConfidence={false} />
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-muted-foreground">Loading highlights...</CardContent>
          </Card>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-sm text-destructive">{error}</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {renderHighlight(
              'Biggest Upset',
              'Lowest pre-match expected win among actual winners.',
              highlights.biggestUpset,
              'Upset Size',
              highlights.biggestUpset ? `${((1 - highlights.biggestUpset.winnerExpectedWin) * 100).toFixed(1)}%` : '—'
            )}

            {renderHighlight(
              'Largest Skill Difference',
              'Most expected result where the strongest favorite won.',
              highlights.mostExpectedResult,
              'Expected Win (Favorite)',
              highlights.mostExpectedResult ? `${(highlights.mostExpectedResult.favoriteExpectedWin * 100).toFixed(1)}%` : '—'
            )}

            {renderRatingGainHighlight(highlights.biggestRatingGain)}

            {renderLopsidedHighlight(highlights.mostLopsidedScore)}
          </div>
        )}
      </div>
    </div>
  );
}
