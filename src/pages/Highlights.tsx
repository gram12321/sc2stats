import { useEffect, useMemo, useState } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { RankingFilters } from '../components/RankingFilters';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Checkbox } from '../components/ui/checkbox';
import { Label } from '../components/ui/label';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { getRaceAbbr } from '../lib/utils';
import { Race } from '../types/tournament';

interface Team {
  player1: string;
  player2: string;
  player1_race?: string;
  player2_race?: string;
}

interface RatingImpact {
  ratingBefore: number;
  ratingChange: number;
  expectedWin?: number;
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
  player_impacts?: Record<string, RatingImpact>;
  team_impacts?: Record<string, RatingImpact>;
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

interface PeakEntry {
  key: string;
  label: string;
  rating: number;
  match: MatchHistory;
  race?: string;
  combo?: string;
}

interface HighlightsProps {
  onNavigateToMatch?: (tournamentSlug: string, matchId: string) => void;
  onNavigateToPlayer?: (playerName: string) => void;
  onNavigateToTeam?: (player1: string, player2: string) => void;
}

type SortDirection = 'asc' | 'desc';
interface SortState {
  column: string;
  direction: SortDirection;
}

const RACE_ORDER = ['P', 'T', 'Z', 'R'];
const RACE_ORDER_MAP = new Map(RACE_ORDER.map((race, index) => [race, index]));
const COMBO_ORDER = ['PP', 'PT', 'PZ', 'PR', 'TT', 'TZ', 'TR', 'ZZ', 'ZR', 'RR'];
const COMBO_ORDER_MAP = new Map(COMBO_ORDER.map((combo, index) => [combo, index]));

function normalizeTeamKey(player1: string, player2: string): string {
  return [player1, player2].filter(Boolean).sort().join('+');
}

function normalizeCombo(race1: string, race2: string): string {
  return [race1, race2].filter(Boolean).sort().join('');
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString();
  } catch {
    return dateStr;
  }
}

function formatPlayerWithRace(playerName: string, race: string): string {
  return race ? `${playerName} (${race})` : playerName;
}

function sortString(a: string, b: string, direction: SortDirection): number {
  const result = a.localeCompare(b);
  return direction === 'asc' ? result : -result;
}

function sortNumber(a: number, b: number, direction: SortDirection): number {
  const result = a - b;
  return direction === 'asc' ? result : -result;
}

function sortDate(a: string | null, b: string | null, direction: SortDirection): number {
  const aTime = a ? new Date(a).getTime() : 0;
  const bTime = b ? new Date(b).getTime() : 0;
  return sortNumber(aTime, bTime, direction);
}

export function Highlights({ onNavigateToMatch, onNavigateToPlayer, onNavigateToTeam }: HighlightsProps) {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [playerDefaults, setPlayerDefaults] = useState<Record<string, Race>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [playerSort, setPlayerSort] = useState<SortState>({ column: 'rating', direction: 'desc' });
  const [teamSort, setTeamSort] = useState<SortState>({ column: 'rating', direction: 'desc' });
  const [raceSort, setRaceSort] = useState<SortState>({ column: 'race', direction: 'asc' });
  const [comboSort, setComboSort] = useState<SortState>({ column: 'combo', direction: 'asc' });

  const { seasons, useSeededRankings, mainCircuitOnly, hideRandom, setHideRandom } = useRankingSettings();

  useEffect(() => {
    getPlayerDefaults()
      .then(setPlayerDefaults)
      .catch(() => setPlayerDefaults({}));
  }, []);

  useEffect(() => {
    const loadMatches = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const params = new URLSearchParams();
        if (useSeededRankings) params.append('useSeeds', 'true');
        if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
        if (hideRandom) params.append('hideRandom', 'true');
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
  }, [useSeededRankings, mainCircuitOnly, hideRandom, seasons]);

  const resolveRaceAbbr = (rawRace: string | undefined, playerName: string): string => {
    if (rawRace) {
      const abbr = getRaceAbbr(rawRace);
      if (abbr) return abbr;
    }

    const defaultRace = playerDefaults[playerName];
    if (defaultRace) {
      return getRaceAbbr(defaultRace) || '';
    }

    return '';
  };

  const findPlayerRaceInMatch = (match: MatchHistory, playerName: string): string => {
    if (match.team1.player1 === playerName) return resolveRaceAbbr(match.team1.player1_race, playerName);
    if (match.team1.player2 === playerName) return resolveRaceAbbr(match.team1.player2_race, playerName);
    if (match.team2.player1 === playerName) return resolveRaceAbbr(match.team2.player1_race, playerName);
    if (match.team2.player2 === playerName) return resolveRaceAbbr(match.team2.player2_race, playerName);
    return resolveRaceAbbr(undefined, playerName);
  };

  const getTeamDisplayWithRaces = (team: Team): string => {
    const p1Race = resolveRaceAbbr(team.player1_race, team.player1);
    const p2Race = resolveRaceAbbr(team.player2_race, team.player2);
    return `${formatPlayerWithRace(team.player1, p1Race)} + ${formatPlayerWithRace(team.player2, p2Race)}`;
  };

  const toggleSort = (
    setter: React.Dispatch<React.SetStateAction<SortState>>,
    column: string,
    defaultDirection: SortDirection = 'asc'
  ) => {
    setter((prev) => {
      if (prev.column === column) {
        return { column, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      }
      return { column, direction: defaultDirection };
    });
  };

  const sortIndicator = (state: SortState, column: string): string => {
    if (state.column !== column) return '';
    return state.direction === 'asc' ? ' ▲' : ' ▼';
  };

  const highlights = useMemo(() => {
    let biggestUpset: HighlightResult | null = null;
    let biggestUpsetScore = -1;

    let mostExpectedResult: HighlightResult | null = null;
    let highestFavoriteProb = -1;

    let biggestRatingGain: RatingGainResult | null = null;
    let highestRatingGain = -1;

    const playerPeakByName = new Map<string, PeakEntry>();
    const teamPeakByKey = new Map<string, PeakEntry>();
    const bestPlayerByRace = new Map<string, PeakEntry>();
    const bestTeamByCombo = new Map<string, PeakEntry>();
    const playerRaceCounts = new Map<string, Map<string, number>>();
    const teamComboCounts = new Map<string, Map<string, number>>();

    const updatePeak = (map: Map<string, PeakEntry>, key: string, entry: PeakEntry) => {
      const existing = map.get(key);
      if (!existing || entry.rating > existing.rating) {
        map.set(key, entry);
      }
    };

    const addRaceCount = (player: string, race: string) => {
      if (!player || !race) return;
      const current = playerRaceCounts.get(player) || new Map<string, number>();
      current.set(race, (current.get(race) || 0) + 1);
      playerRaceCounts.set(player, current);
    };

    const addComboCount = (teamKey: string, combo: string) => {
      if (!teamKey || !combo) return;
      const current = teamComboCounts.get(teamKey) || new Map<string, number>();
      current.set(combo, (current.get(combo) || 0) + 1);
      teamComboCounts.set(teamKey, current);
    };

    for (const match of matches) {
      addRaceCount(match.team1.player1, resolveRaceAbbr(match.team1.player1_race, match.team1.player1));
      addRaceCount(match.team1.player2, resolveRaceAbbr(match.team1.player2_race, match.team1.player2));
      addRaceCount(match.team2.player1, resolveRaceAbbr(match.team2.player1_race, match.team2.player1));
      addRaceCount(match.team2.player2, resolveRaceAbbr(match.team2.player2_race, match.team2.player2));

      const team1Race1 = resolveRaceAbbr(match.team1.player1_race, match.team1.player1);
      const team1Race2 = resolveRaceAbbr(match.team1.player2_race, match.team1.player2);
      const team2Race1 = resolveRaceAbbr(match.team2.player1_race, match.team2.player1);
      const team2Race2 = resolveRaceAbbr(match.team2.player2_race, match.team2.player2);

      if (team1Race1 && team1Race2) {
        addComboCount(
          normalizeTeamKey(match.team1.player1, match.team1.player2),
          normalizeCombo(team1Race1, team1Race2)
        );
      }

      if (team2Race1 && team2Race2) {
        addComboCount(
          normalizeTeamKey(match.team2.player1, match.team2.player2),
          normalizeCombo(team2Race1, team2Race2)
        );
      }
    }

    const isRandomPrimary = (player: string): boolean => {
      const counts = playerRaceCounts.get(player);
      if (!counts) return false;
      const randomCount = counts.get('R') || 0;
      if (randomCount === 0) return false;
      const maxCount = Math.max(...Array.from(counts.values()));
      return randomCount === maxCount;
    };

    const isRandomComboPrimary = (teamKey: string, combo: string): boolean => {
      if (!combo.includes('R')) return true;

      const counts = teamComboCounts.get(teamKey);
      if (!counts) return false;

      const comboCount = counts.get(combo) || 0;
      if (comboCount === 0) return false;

      const maxCount = Math.max(...Array.from(counts.values()));
      return comboCount === maxCount;
    };

    for (const match of matches) {
      if (match.team1_score !== match.team2_score) {
        const team1Key = normalizeTeamKey(match.team1.player1, match.team1.player2);
        const team2Key = normalizeTeamKey(match.team2.player1, match.team2.player2);
        const team1Expected = match.team_impacts?.[team1Key]?.expectedWin;
        const team2Expected = match.team_impacts?.[team2Key]?.expectedWin;

        if (typeof team1Expected === 'number' && typeof team2Expected === 'number') {
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
          const winnerRatingGain = match.team_impacts?.[winnerTeamKey]?.ratingChange;

          if (typeof winnerRatingGain === 'number' && winnerRatingGain > highestRatingGain) {
            highestRatingGain = winnerRatingGain;
            biggestRatingGain = {
              match,
              winnerSide,
              ratingGain: winnerRatingGain,
            };
          }

          const upsetScore = 1 - winnerExpected;
          if (upsetScore > biggestUpsetScore) {
            biggestUpsetScore = upsetScore;
            biggestUpset = currentResult;
          }

          if (winnerSide === favoriteSide && favoriteExpected > highestFavoriteProb) {
            highestFavoriteProb = favoriteExpected;
            mostExpectedResult = currentResult;
          }
        }
      }

      Object.entries(match.player_impacts || {}).forEach(([player, impact]) => {
        const race = findPlayerRaceInMatch(match, player);
        if (!race) return;
        if (hideRandom && race === 'R') return;

        const ratingAfter = impact.ratingBefore + impact.ratingChange;
        const playerEntry: PeakEntry = {
          key: player,
          label: formatPlayerWithRace(player, race),
          rating: ratingAfter,
          match,
          race,
        };

        updatePeak(playerPeakByName, player, playerEntry);

        if (race === 'R' && !isRandomPrimary(player)) {
          return;
        }

        updatePeak(bestPlayerByRace, race, playerEntry);
      });

      const addTeamPeak = (team: Team) => {
        const teamKey = normalizeTeamKey(team.player1, team.player2);
        const impact = match.team_impacts?.[teamKey];
        if (!impact) return;

        const ratingAfter = impact.ratingBefore + impact.ratingChange;
        const race1 = resolveRaceAbbr(team.player1_race, team.player1);
        const race2 = resolveRaceAbbr(team.player2_race, team.player2);

        const teamEntry: PeakEntry = {
          key: teamKey,
          label: getTeamDisplayWithRaces(team),
          rating: ratingAfter,
          match,
          combo: race1 && race2 ? normalizeCombo(race1, race2) : undefined,
        };

        updatePeak(teamPeakByKey, teamKey, teamEntry);

        if (!race1 || !race2) return;
        const combo = normalizeCombo(race1, race2);
        if (hideRandom && combo.includes('R')) return;
        if (!isRandomComboPrimary(teamKey, combo)) return;

        updatePeak(bestTeamByCombo, combo, {
          ...teamEntry,
          combo,
        });
      };

      addTeamPeak(match.team1);
      addTeamPeak(match.team2);
    }

    const top5PlayerPeaks = Array.from(playerPeakByName.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const top5TeamPeaks = Array.from(teamPeakByKey.values())
      .sort((a, b) => b.rating - a.rating)
      .slice(0, 5);

    const peakPlayerByRace = Array.from(bestPlayerByRace.entries())
      .map(([race, entry]) => ({ race, ...entry }))
      .sort((a, b) => (RACE_ORDER_MAP.get(a.race) ?? 999) - (RACE_ORDER_MAP.get(b.race) ?? 999));

    const peakTeamByCombo = Array.from(bestTeamByCombo.entries())
      .map(([combo, entry]) => ({ combo, ...entry }))
      .sort((a, b) => (COMBO_ORDER_MAP.get(a.combo) ?? 999) - (COMBO_ORDER_MAP.get(b.combo) ?? 999));

    return {
      biggestUpset,
      mostExpectedResult,
      biggestRatingGain,
      top5PlayerPeaks,
      top5TeamPeaks,
      peakPlayerByRace,
      peakTeamByCombo,
    };
  }, [matches, playerDefaults, hideRandom]);

  const sortedPlayers = useMemo(() => {
    const rows = [...highlights.top5PlayerPeaks];
    rows.sort((a, b) => {
      switch (playerSort.column) {
        case 'player':
          return sortString(a.label, b.label, playerSort.direction);
        case 'race':
          return sortNumber(RACE_ORDER_MAP.get(a.race || '') ?? 999, RACE_ORDER_MAP.get(b.race || '') ?? 999, playerSort.direction);
        case 'date':
          return sortDate(a.match.match_date || a.match.tournament_date, b.match.match_date || b.match.tournament_date, playerSort.direction);
        case 'event':
          return sortString(a.match.tournament_slug, b.match.tournament_slug, playerSort.direction);
        case 'rating':
        default:
          return sortNumber(a.rating, b.rating, playerSort.direction);
      }
    });
    return rows;
  }, [highlights.top5PlayerPeaks, playerSort]);

  const sortedTeams = useMemo(() => {
    const rows = [...highlights.top5TeamPeaks];
    rows.sort((a, b) => {
      switch (teamSort.column) {
        case 'team':
          return sortString(a.label, b.label, teamSort.direction);
        case 'date':
          return sortDate(a.match.match_date || a.match.tournament_date, b.match.match_date || b.match.tournament_date, teamSort.direction);
        case 'event':
          return sortString(a.match.tournament_slug, b.match.tournament_slug, teamSort.direction);
        case 'rating':
        default:
          return sortNumber(a.rating, b.rating, teamSort.direction);
      }
    });
    return rows;
  }, [highlights.top5TeamPeaks, teamSort]);

  const sortedRacePeaks = useMemo(() => {
    const rows = [...highlights.peakPlayerByRace];
    rows.sort((a, b) => {
      switch (raceSort.column) {
        case 'player':
          return sortString(a.label, b.label, raceSort.direction);
        case 'date':
          return sortDate(a.match.match_date || a.match.tournament_date, b.match.match_date || b.match.tournament_date, raceSort.direction);
        case 'event':
          return sortString(a.match.tournament_slug, b.match.tournament_slug, raceSort.direction);
        case 'rating':
          return sortNumber(a.rating, b.rating, raceSort.direction);
        case 'race':
        default:
          return sortNumber(RACE_ORDER_MAP.get(a.race) ?? 999, RACE_ORDER_MAP.get(b.race) ?? 999, raceSort.direction);
      }
    });
    return rows;
  }, [highlights.peakPlayerByRace, raceSort]);

  const sortedComboPeaks = useMemo(() => {
    const rows = [...highlights.peakTeamByCombo];
    rows.sort((a, b) => {
      switch (comboSort.column) {
        case 'team':
          return sortString(a.label, b.label, comboSort.direction);
        case 'date':
          return sortDate(a.match.match_date || a.match.tournament_date, b.match.match_date || b.match.tournament_date, comboSort.direction);
        case 'event':
          return sortString(a.match.tournament_slug, b.match.tournament_slug, comboSort.direction);
        case 'rating':
          return sortNumber(a.rating, b.rating, comboSort.direction);
        case 'combo':
        default:
          return sortNumber(COMBO_ORDER_MAP.get(a.combo) ?? 999, COMBO_ORDER_MAP.get(b.combo) ?? 999, comboSort.direction);
      }
    });
    return rows;
  }, [highlights.peakTeamByCombo, comboSort]);

  const renderTeamAndPlayersCompact = (team: Team) => {
    const p1Race = resolveRaceAbbr(team.player1_race, team.player1);
    const p2Race = resolveRaceAbbr(team.player2_race, team.player2);

    return (
      <div className="space-y-1">
        <button
          type="button"
          onClick={() => onNavigateToTeam?.(team.player1, team.player2)}
          className="text-xs font-medium text-foreground hover:text-primary transition-colors"
        >
          {formatPlayerWithRace(team.player1, p1Race)} + {formatPlayerWithRace(team.player2, p2Race)}
        </button>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => onNavigateToPlayer?.(team.player1)}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            {formatPlayerWithRace(team.player1, p1Race)}
          </button>
          <button
            type="button"
            onClick={() => onNavigateToPlayer?.(team.player2)}
            className="text-[11px] text-muted-foreground hover:text-primary transition-colors underline-offset-2 hover:underline"
          >
            {formatPlayerWithRace(team.player2, p2Race)}
          </button>
        </div>
      </div>
    );
  };

  const renderOpenMatchButton = (match: MatchHistory) => (
    <Button
      size="sm"
      variant="outline"
      className="h-7 px-2 text-xs"
      onClick={() => onNavigateToMatch?.(match.tournament_slug, match.match_id)}
    >
      Open Match
    </Button>
  );

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
          <CardHeader className="py-3">
            <CardTitle className="text-base">{title}</CardTitle>
            <p className="text-xs text-muted-foreground">{subtitle}</p>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">No qualifying matches in current filter selection.</p>
          </CardContent>
        </Card>
      );
    }

    const { match, winnerSide, winnerExpectedWin, favoriteExpectedWin } = result;

    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">{title}</CardTitle>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </CardHeader>
        <CardContent className="pt-0 space-y-2 text-xs">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">
              {winnerSide === 'team1' ? getTeamDisplayWithRaces(match.team1) : getTeamDisplayWithRaces(match.team2)}
            </div>
            <Badge variant="secondary" className="text-[11px] px-2 py-0.5">{match.team1_score} - {match.team2_score}</Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Winner Team</div>
              {winnerSide === 'team1' ? renderTeamAndPlayersCompact(match.team1) : renderTeamAndPlayersCompact(match.team2)}
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground mb-1">Opponent Team</div>
              {winnerSide === 'team1' ? renderTeamAndPlayersCompact(match.team2) : renderTeamAndPlayersCompact(match.team1)}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            <div><span className="text-muted-foreground">Date:</span> {formatDate(match.match_date || match.tournament_date)}</div>
            <div><span className="text-muted-foreground">Round:</span> {match.round || '—'}</div>
            <div><span className="text-muted-foreground">Favorite Expected:</span> {(favoriteExpectedWin * 100).toFixed(1)}%</div>
            <div><span className="text-muted-foreground">Winner Expected:</span> {(winnerExpectedWin * 100).toFixed(1)}%</div>
            <div className="md:col-span-2"><span className="text-muted-foreground">{metricLabel}:</span> {metricValue}</div>
            <div className="md:col-span-2 truncate" title={match.tournament_slug}><span className="text-muted-foreground">Event:</span> {match.tournament_slug}</div>
          </div>

          {renderOpenMatchButton(match)}
        </CardContent>
      </Card>
    );
  };

  const renderRatingGainHighlight = (result: RatingGainResult | null) => {
    if (!result) {
      return (
        <Card>
          <CardHeader className="py-3">
            <CardTitle className="text-base">Biggest Rating Gain</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <p className="text-xs text-muted-foreground">No qualifying matches in current filter selection.</p>
          </CardContent>
        </Card>
      );
    }

    const { match, winnerSide, ratingGain } = result;
    const winnerTeam = winnerSide === 'team1' ? match.team1 : match.team2;

    return (
      <Card>
        <CardHeader className="py-3">
          <CardTitle className="text-base">Biggest Rating Gain</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-1 text-xs">
          <div><span className="text-muted-foreground">Team:</span> {getTeamDisplayWithRaces(winnerTeam)}</div>
          <div><span className="text-muted-foreground">Gain:</span> +{ratingGain.toFixed(2)}</div>
          <div><span className="text-muted-foreground">Date:</span> {formatDate(match.match_date || match.tournament_date)}</div>
          <div className="truncate" title={match.tournament_slug}><span className="text-muted-foreground">Event:</span> {match.tournament_slug}</div>
          {renderOpenMatchButton(match)}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Highlights</h1>
            <p className="text-sm text-muted-foreground mt-1">Expected-win highlights and peak-rating records from current filter scope.</p>
          </div>
          <div className="flex flex-col items-start md:items-end gap-3">
            <RankingFilters showSeeded={true} showMainCircuit={true} showConfidence={false} />
            <div className="flex items-center space-x-2">
              <Checkbox
                id="highlights-hide-random"
                checked={hideRandom}
                onCheckedChange={(checked) => setHideRandom(checked === true)}
              />
              <Label htmlFor="highlights-hide-random" className="text-sm font-medium cursor-pointer">
                Exclude Random
              </Label>
            </div>
          </div>
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
          <Tabs defaultValue="highlights" className="w-full">
            <TabsList>
              <TabsTrigger value="highlights">Highlights</TabsTrigger>
              <TabsTrigger value="highest-ratings">Highest Ratings</TabsTrigger>
            </TabsList>

            <TabsContent value="highlights">
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
              </div>
            </TabsContent>

            <TabsContent value="highest-ratings">
              <div className="grid grid-cols-1 gap-4">
                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Top 5 Individual Peak Ratings</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">#</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setPlayerSort, 'player')}>Player{sortIndicator(playerSort, 'player')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setPlayerSort, 'race')}>Race{sortIndicator(playerSort, 'race')}</TableHead>
                          <TableHead className="h-9 px-2 text-right cursor-pointer" onClick={() => toggleSort(setPlayerSort, 'rating', 'desc')}>Peak{sortIndicator(playerSort, 'rating')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setPlayerSort, 'date')}>Date{sortIndicator(playerSort, 'date')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setPlayerSort, 'event')}>Event{sortIndicator(playerSort, 'event')}</TableHead>
                          <TableHead className="h-9 px-2 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedPlayers.map((peak, index) => (
                          <TableRow key={`${peak.key}-${index}`}>
                            <TableCell className="p-2 text-xs">{index + 1}</TableCell>
                            <TableCell className="p-2 text-xs">
                              <button type="button" onClick={() => onNavigateToPlayer?.(peak.key)} className="font-medium hover:text-primary transition-colors">
                                {peak.label}
                              </button>
                            </TableCell>
                            <TableCell className="p-2 text-xs">{peak.race || '—'}</TableCell>
                            <TableCell className="p-2 text-xs text-right font-mono">{peak.rating.toFixed(2)}</TableCell>
                            <TableCell className="p-2 text-xs">{formatDate(peak.match.match_date || peak.match.tournament_date)}</TableCell>
                            <TableCell className="p-2 text-xs max-w-[18rem] truncate" title={peak.match.tournament_slug}>{peak.match.tournament_slug}</TableCell>
                            <TableCell className="p-2 text-xs text-right">{renderOpenMatchButton(peak.match)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Top 5 Team Peak Ratings</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2">#</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setTeamSort, 'team')}>Team{sortIndicator(teamSort, 'team')}</TableHead>
                          <TableHead className="h-9 px-2 text-right cursor-pointer" onClick={() => toggleSort(setTeamSort, 'rating', 'desc')}>Peak{sortIndicator(teamSort, 'rating')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setTeamSort, 'date')}>Date{sortIndicator(teamSort, 'date')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setTeamSort, 'event')}>Event{sortIndicator(teamSort, 'event')}</TableHead>
                          <TableHead className="h-9 px-2 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedTeams.map((peak, index) => {
                          const [p1 = '', p2 = ''] = peak.key.split('+');
                          return (
                            <TableRow key={`${peak.key}-${index}`}>
                              <TableCell className="p-2 text-xs">{index + 1}</TableCell>
                              <TableCell className="p-2 text-xs">
                                <button type="button" onClick={() => onNavigateToTeam?.(p1, p2)} className="font-medium hover:text-primary transition-colors">
                                  {peak.label}
                                </button>
                              </TableCell>
                              <TableCell className="p-2 text-xs text-right font-mono">{peak.rating.toFixed(2)}</TableCell>
                              <TableCell className="p-2 text-xs">{formatDate(peak.match.match_date || peak.match.tournament_date)}</TableCell>
                              <TableCell className="p-2 text-xs max-w-[18rem] truncate" title={peak.match.tournament_slug}>{peak.match.tournament_slug}</TableCell>
                              <TableCell className="p-2 text-xs text-right">{renderOpenMatchButton(peak.match)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Peak-Rated Player of Each Race</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setRaceSort, 'race')}>Race{sortIndicator(raceSort, 'race')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setRaceSort, 'player')}>Player{sortIndicator(raceSort, 'player')}</TableHead>
                          <TableHead className="h-9 px-2 text-right cursor-pointer" onClick={() => toggleSort(setRaceSort, 'rating', 'desc')}>Peak{sortIndicator(raceSort, 'rating')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setRaceSort, 'date')}>Date{sortIndicator(raceSort, 'date')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setRaceSort, 'event')}>Event{sortIndicator(raceSort, 'event')}</TableHead>
                          <TableHead className="h-9 px-2 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedRacePeaks.map((entry) => (
                          <TableRow key={`race-${entry.race}-${entry.key}`}>
                            <TableCell className="p-2 text-xs font-medium">{entry.race}</TableCell>
                            <TableCell className="p-2 text-xs">
                              <button type="button" onClick={() => onNavigateToPlayer?.(entry.key)} className="font-medium hover:text-primary transition-colors">
                                {entry.label}
                              </button>
                            </TableCell>
                            <TableCell className="p-2 text-xs text-right font-mono">{entry.rating.toFixed(2)}</TableCell>
                            <TableCell className="p-2 text-xs">{formatDate(entry.match.match_date || entry.match.tournament_date)}</TableCell>
                            <TableCell className="p-2 text-xs max-w-[18rem] truncate" title={entry.match.tournament_slug}>{entry.match.tournament_slug}</TableCell>
                            <TableCell className="p-2 text-xs text-right">{renderOpenMatchButton(entry.match)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="py-3">
                    <CardTitle className="text-base">Peak-Rated Team of Each Combination</CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setComboSort, 'combo')}>Combo{sortIndicator(comboSort, 'combo')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setComboSort, 'team')}>Team{sortIndicator(comboSort, 'team')}</TableHead>
                          <TableHead className="h-9 px-2 text-right cursor-pointer" onClick={() => toggleSort(setComboSort, 'rating', 'desc')}>Peak{sortIndicator(comboSort, 'rating')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setComboSort, 'date')}>Date{sortIndicator(comboSort, 'date')}</TableHead>
                          <TableHead className="h-9 px-2 cursor-pointer" onClick={() => toggleSort(setComboSort, 'event')}>Event{sortIndicator(comboSort, 'event')}</TableHead>
                          <TableHead className="h-9 px-2 text-right">Action</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sortedComboPeaks.map((entry) => {
                          const [p1 = '', p2 = ''] = entry.key.split('+');
                          return (
                            <TableRow key={`combo-${entry.combo}-${entry.key}`}>
                              <TableCell className="p-2 text-xs font-medium">{entry.combo}</TableCell>
                              <TableCell className="p-2 text-xs">
                                <button type="button" onClick={() => onNavigateToTeam?.(p1, p2)} className="font-medium hover:text-primary transition-colors">
                                  {entry.label}
                                </button>
                              </TableCell>
                              <TableCell className="p-2 text-xs text-right font-mono">{entry.rating.toFixed(2)}</TableCell>
                              <TableCell className="p-2 text-xs">{formatDate(entry.match.match_date || entry.match.tournament_date)}</TableCell>
                              <TableCell className="p-2 text-xs max-w-[18rem] truncate" title={entry.match.tournament_slug}>{entry.match.tournament_slug}</TableCell>
                              <TableCell className="p-2 text-xs text-right">{renderOpenMatchButton(entry.match)}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}
