import { useState, useEffect, useMemo } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { formatRankingPoints, getRaceAbbr } from '../lib/utils';
import { getIntermediateTeamBlendWeight } from '../lib/intermediateTeamRating';
import { formatTournamentName } from '../lib/display';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { getPlayerCountries } from '../lib/playerCountries';
import { MatchHistoryItem } from '../components/MatchHistoryItem';
import { RatingChart } from '../components/RatingChart';
import { RaceMatchupStats } from '../components/RaceMatchupStats';
import { RankingFilters } from '../components/RankingFilters';
import { CountryFlag } from '../components/ui/CountryFlag';
import { Tooltip } from '../components/ui/tooltip';

interface TeamMatch {
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
  ratingChange: number;
  won: boolean;
  isDraw?: boolean;
  opponentRating: number;
  team_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    rankBefore?: number | string;
    rankAfter?: number | string;
    confidence?: number;
    populationStdDev?: number;
  }>;
  player_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
  }>;
  race_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    race1: string;
    race2: string;
  }>;
}

interface PlayerRanking {
  name: string;
  points: number;
  confidence: number;
}

interface TeamRanking {
  player1: string;
  player2: string;
  points: number;
  confidence: number;
}

interface TeamDetails {
  name: string;
  player1: string;
  player2: string;
  matches: number;
  wins: number;
  losses: number;
  draws?: number;
  points: number;
  confidence: number;
  intermediateBlendWeight?: number;
  matchHistory: TeamMatch[];
}

interface TeamDetailsProps {
  player1: string;
  player2: string;
  onBack?: () => void;
}

export function TeamDetails({ player1, player2, onBack }: TeamDetailsProps) {
  const [team, setTeam] = useState<TeamDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerRankings, setPlayerRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [teamRankings, setTeamRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [playerRankPrefixCounts, setPlayerRankPrefixCounts] = useState<number[]>([0]);
  const [playerRankListSize, setPlayerRankListSize] = useState(0);
  const [playerIsRankedMap, setPlayerIsRankedMap] = useState<Record<string, boolean>>({});
  const [teamRankPrefixCounts, setTeamRankPrefixCounts] = useState<number[]>([0]);
  const [teamRankListSize, setTeamRankListSize] = useState(0);
  const [teamIsRankedMap, setTeamIsRankedMap] = useState<Record<string, boolean>>({});
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [playerCountries, setPlayerCountries] = useState<Record<string, string>>({});
  const [comboRankings, setComboRankings] = useState<Record<string, { points: number }>>({});
  const [chartMode, setChartMode] = useState<'rating' | 'rank'>('rating');
  const { seasons, mainCircuitOnly, useSeededRankings, useIntermediateTeamRating } = useRankingSettings();

  useEffect(() => {
    loadTeamDetails();
    loadPlayerRankings();
    loadTeamRankings();
    loadAllPlayerRaces();
    loadAllPlayerCountries();
    loadComboRankings();
  }, [player1, player2, useSeededRankings, seasons, mainCircuitOnly, useIntermediateTeamRating]);

  const loadTeamDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (useSeededRankings) params.append('useSeeds', 'true');
      if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
      if (useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const response = await fetch(`/api/team/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Team not found');
        }
        throw new Error('Failed to load team details');
      }
      const data = await response.json();
      setTeam(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayerRankings = async () => {
    try {
      const params = new URLSearchParams();
      if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
      if (useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const endpoint = useSeededRankings ? '/api/seeded-player-rankings' : '/api/player-rankings';
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load player rankings');
      const data: PlayerRanking[] = await response.json();
      const averageConfidence = data.length > 0
        ? data.reduce((sum, row) => sum + (row.confidence || 0), 0) / data.length
        : 0;

      const prefixCounts = [0];
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      const rankedByName: Record<string, boolean> = {};

      data.forEach((row, index) => {
        const confidence = row.confidence || 0;
        const isRanked = confidence >= averageConfidence;
        rankedByName[row.name] = isRanked;
        prefixCounts[index + 1] = prefixCounts[index] + (isRanked ? 1 : 0);

        if (!isRanked) return;

        rankMap[row.name] = {
          rank: prefixCounts[index + 1],
          points: row.points,
          confidence
        };
      });

      setPlayerRankPrefixCounts(prefixCounts);
      setPlayerRankListSize(data.length);
      setPlayerIsRankedMap(rankedByName);
      setPlayerRankings(rankMap);
    } catch (err) {
      console.error('Error loading player rankings:', err);
    }
  };

  const loadTeamRankings = async () => {
    try {
      const params = new URLSearchParams();
      if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
      if (useIntermediateTeamRating) params.append('useIntermediateTeamRating', 'true');
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const endpoint = useSeededRankings ? '/api/seeded-team-rankings' : '/api/team-rankings';
      const response = await fetch(`${endpoint}?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data: TeamRanking[] = await response.json();
      const averageConfidence = data.length > 0
        ? data.reduce((sum, row) => sum + (row.confidence || 0), 0) / data.length
        : 0;

      const prefixCounts = [0];
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      const rankedByTeamKey: Record<string, boolean> = {};

      data.forEach((teamRow, index) => {
        const teamKey = normalizeTeamKey(teamRow.player1, teamRow.player2);
        const confidence = teamRow.confidence || 0;
        const isRanked = confidence >= averageConfidence;
        rankedByTeamKey[teamKey] = isRanked;
        prefixCounts[index + 1] = prefixCounts[index] + (isRanked ? 1 : 0);

        if (!isRanked) return;

        rankMap[teamKey] = {
          rank: prefixCounts[index + 1],
          points: teamRow.points,
          confidence
        };
      });

      setTeamRankPrefixCounts(prefixCounts);
      setTeamRankListSize(data.length);
      setTeamIsRankedMap(rankedByTeamKey);
      setTeamRankings(rankMap);
    } catch (err) {
      console.error('Error loading team rankings:', err);
    }
  };

  const loadAllPlayerRaces = async () => {
    try {
      const defaults = await getPlayerDefaults();
      setPlayerRaces(defaults);
    } catch (err) {
      console.error('Error loading player races:', err);
    }
  };

  const loadAllPlayerCountries = async () => {
    try {
      const countries = await getPlayerCountries();
      setPlayerCountries(countries);
    } catch (err) {
      console.error('Error loading player countries:', err);
    }
  };

  const loadComboRankings = async () => {
    try {
      const params = new URLSearchParams();
      if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const response = await fetch(`/api/team-race-rankings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load combo rankings');
      const data = await response.json();

      // Extract combinedRankings
      const combinedRankings = data.combinedRankings || [];
      const comboMap: Record<string, { points: number }> = {};
      combinedRankings.forEach((ranking: any) => {
        comboMap[ranking.combo1] = { points: ranking.points };
      });
      setComboRankings(comboMap);
    } catch (err) {
      console.error('Error loading combo rankings:', err);
    }
  };

  const normalizeTeamKey = (p1: string, p2: string): string => {
    return [p1, p2].filter(Boolean).sort().join('+');
  };

  const convertAbsoluteRankToDisplay = (
    rawRank: number | string | undefined,
    prefixCounts: number[],
    listSize: number
  ): number | undefined => {
    if (rawRank === undefined || rawRank === null) return undefined;
    const parsed = typeof rawRank === 'number' ? rawRank : parseInt(String(rawRank), 10);
    if (!Number.isFinite(parsed) || parsed < 1 || listSize < 1) return undefined;
    const clamped = Math.min(Math.floor(parsed), listSize);
    const displayRank = prefixCounts[clamped] ?? 0;
    return displayRank > 0 ? displayRank : undefined;
  };

  const getTeamRank = (p1: string, p2: string) => {
    const teamKey = normalizeTeamKey(p1, p2);
    return teamRankings[teamKey] || null;
  };

  const getTeamImpact = (match: any, p1: string, p2: string) => {
    if (!match.team_impacts) return null;
    const teamKey = normalizeTeamKey(p1, p2);
    const impact = match.team_impacts[teamKey];
    if (!impact) return null;

    if (!teamIsRankedMap[teamKey]) {
      return {
        ...impact,
        rankBefore: undefined,
        rankAfter: undefined
      };
    }

    return {
      ...impact,
      rankBefore: convertAbsoluteRankToDisplay(impact.rankBefore, teamRankPrefixCounts, teamRankListSize),
      rankAfter: convertAbsoluteRankToDisplay(impact.rankAfter, teamRankPrefixCounts, teamRankListSize)
    };
  };

  const getPlayerImpact = (match: any, playerName: string) => {
    const impact = match.player_impacts?.[playerName];
    if (!impact) return null;

    if (!playerIsRankedMap[playerName]) {
      return {
        ...impact,
        rankBefore: undefined,
        rankAfter: undefined
      };
    }

    return {
      ...impact,
      rankBefore: convertAbsoluteRankToDisplay(impact.rankBefore, playerRankPrefixCounts, playerRankListSize),
      rankAfter: convertAbsoluteRankToDisplay(impact.rankAfter, playerRankPrefixCounts, playerRankListSize)
    };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
  };

  // Extract race changes from match data
  const extractRaceChanges = (match: any) => {
    if (!match.race_impacts) return null;
    const raceChanges: Array<{ race: string; change: number }> = [];
    const seenRaces = new Set<string>();

    Object.values(match.race_impacts).forEach((impact: any) => {
      const race1Abbr = getRaceAbbr(impact.race1);
      const race2Abbr = getRaceAbbr(impact.race2);

      if (!seenRaces.has(race1Abbr)) {
        raceChanges.push({ race: race1Abbr, change: impact.ratingChange });
        seenRaces.add(race1Abbr);
      }
      if (!seenRaces.has(race2Abbr)) {
        raceChanges.push({ race: race2Abbr, change: -impact.ratingChange });
        seenRaces.add(race2Abbr);
      }
    });

    return raceChanges.length > 0 ? raceChanges : null;
  };

  // Backend returns team.matchHistory in chronological processing order (oldest -> newest).
  const chronologicalMatchHistory = team?.matchHistory ? [...team.matchHistory] : [];
  const sortedMatchHistory = chronologicalMatchHistory.length > 0
    ? [...chronologicalMatchHistory].reverse()
    : [];

  const chartData = useMemo(() => {
    if (!chronologicalMatchHistory.length) return [];
    const myTeamKey = normalizeTeamKey(player1, player2);
    const dataPoints = chronologicalMatchHistory.map(match => {
      const impact = getTeamImpact(match, player1, player2);

      // Determine rank
      let rank: number | undefined;
      const rVal = impact?.rankAfter ?? impact?.rankBefore;
      if (rVal && rVal !== '-') {
        rank = Number(rVal);
      }

      const rating = impact ? impact.ratingBefore + impact.ratingChange : 0;

      let confidenceRange: [number, number] | undefined;
      if (impact && typeof impact.confidence === 'number') {
        const conf = impact.confidence;
        const stdDev = impact.populationStdDev || 350;
        const margin = stdDev * (1 - conf / 100);
        confidenceRange = [rating - margin, rating + margin];
      }

      // Determine opponent team name
      let opponentName = 'Unknown';
      const team1Key = normalizeTeamKey(match.team1.player1, match.team1.player2);

      if (team1Key === myTeamKey) {
        opponentName = match.team2.player1;
        if (match.team2.player2) opponentName += ` & ${match.team2.player2}`;
      } else {
        opponentName = match.team1.player1;
        if (match.team1.player2) opponentName += ` & ${match.team1.player2}`;
      }

      return {
        date: match.match_date || match.tournament_date || '',
        dateLabel: formatDate(match.match_date || match.tournament_date),
        rating: rating,
        rank: rank,
        confidenceRange,
        confidence: impact?.confidence,
        matchId: match.match_id,
        matchNum: 0,
        tournamentName: formatTournamentName(match.tournament_slug),
        opponent: opponentName
      };
    }).filter(d => d.rating !== 0);

    const currentTeamRank = getTeamRank(player1, player2);
    const currentRankValue = currentTeamRank?.rank;
    const currentRatingValue = Number.isFinite(team?.points) ? Number(team?.points ?? NaN) : null;

    if (
      dataPoints.length > 0
      && typeof currentRankValue === 'number'
      && currentRatingValue !== null
    ) {
      const lastPoint = dataPoints[dataPoints.length - 1];
      const lastRank = typeof lastPoint.rank === 'number' ? lastPoint.rank : null;
      const shouldAppendCurrentSnapshot = lastRank === null || lastRank !== currentRankValue;

      if (shouldAppendCurrentSnapshot) {
        dataPoints.push({
          ...lastPoint,
          date: new Date().toISOString(),
          dateLabel: 'Current',
          rating: currentRatingValue,
          rank: currentRankValue,
          confidence: typeof team?.confidence === 'number' ? team.confidence : lastPoint.confidence,
          confidenceRange: undefined,
          matchId: `${lastPoint.matchId}-current`,
          tournamentName: 'Current global ranking',
          opponent: ''
        });
      }
    }

    return dataPoints;
  }, [chronologicalMatchHistory, player1, player2, teamIsRankedMap, teamRankPrefixCounts, teamRankListSize, teamRankings, team?.points, team?.confidence]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading team details...</p>
        </div>
      </div>
    );
  }

  if (error || !team) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Team not found'}</p>
            {onBack && (
              <button
                onClick={onBack}
                className="mt-4 px-4 py-2 text-red-700 bg-red-100 rounded-md hover:bg-red-200"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const intermediateBlendWeight = useIntermediateTeamRating
    ? (
      typeof team.intermediateBlendWeight === 'number'
        ? Math.max(0, Math.min(1, team.intermediateBlendWeight))
        : getIntermediateTeamBlendWeight(team.matches)
    )
    : 0;
  const intermediatePlayerShare = Math.round(intermediateBlendWeight * 100);
  const currentTeamRank = getTeamRank(team.player1, team.player2);

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground inline-flex items-center gap-2">
                <CountryFlag country={playerCountries[team.player1]} />
                <span>{team.player1}</span>
                <span className="text-muted-foreground">+</span>
                <CountryFlag country={playerCountries[team.player2]} />
                <span>{team.player2}</span>
              </h1>
            </div>
            <div className="flex items-center gap-4">
              <RankingFilters
                showSeeded={true}
                showMainCircuit={true}
                showIntermediateTeamRating={true}
                showConfidence={false}
              />
              {onBack && (
                <button
                  onClick={onBack}
                  className="px-4 py-2 text-muted-foreground bg-muted rounded-md hover:bg-muted/80 focus:outline-none focus:ring-2 focus:ring-muted-foreground"
                >
                  ← Back
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-5 gap-4 mb-6">
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Total Matches</div>
            <div className="text-2xl font-bold text-foreground">{team.matches}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Wins</div>
            <div className="text-2xl font-bold text-green-600">{team.wins}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Losses</div>
            <div className="text-2xl font-bold text-red-600">{team.losses}</div>
          </div>
          {team.draws !== undefined && (
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-sm text-muted-foreground">Draws</div>
              <div className="text-2xl font-bold text-muted-foreground">{team.draws}</div>
            </div>
          )}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground inline-flex items-center gap-1">
              <span>Ranking Points</span>
              {intermediateBlendWeight > 0 && (
                <Tooltip
                  content={
                    <div className="space-y-1">
                      <div className="font-semibold">Intermediate Team Rating Active</div>
                      <div className="text-xs text-muted-foreground">
                        {intermediatePlayerShare}% player-derived + {100 - intermediatePlayerShare}% direct team rating.
                      </div>
                    </div>
                  }
                >
                  <span className="cursor-help rounded border border-amber-400/60 bg-amber-100 px-1 text-[10px] font-semibold text-amber-800">
                    ITR
                  </span>
                </Tooltip>
              )}
            </div>
            <div className={`text-2xl font-bold ${team.points > 0 ? 'text-green-600' : team.points < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {team.points > 0 ? '+' : ''}{formatRankingPoints(team.points)}
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Confidence</div>
            <div className={`text-2xl font-bold ${(team.confidence || 0) >= 70 ? 'text-blue-600' : (team.confidence || 0) >= 40 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
              {Math.round(team.confidence || 0)}%
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Current Rank</div>
            <div className="text-2xl font-bold text-foreground">
              {currentTeamRank?.rank ? `#${currentTeamRank.rank}` : '—'}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          {/* Rating Chart */}
          <div className="relative">
            <div className="absolute top-4 right-4 z-10 flex bg-gray-100 rounded-lg p-1 border border-gray-200">
              <button
                onClick={() => setChartMode('rating')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartMode === 'rating' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Rating
              </button>
              <button
                onClick={() => setChartMode('rank')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${chartMode === 'rank' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
              >
                Rank
              </button>
            </div>
            <RatingChart data={chartData} showRank={chartMode === 'rank'} />
          </div>

          {/* Race Matchup Statistics */}
          <RaceMatchupStats
            matchHistory={sortedMatchHistory}
            playerNames={[player1, player2]}
            playerRaces={playerRaces}
            isTeam={true}
            playerRankings={playerRankings}
            teamRankings={teamRankings}
            normalizeTeamKey={normalizeTeamKey}
            getTeamImpact={(match, player1, player2) => getTeamImpact(match as TeamMatch, player1, player2)}
            getPlayerImpact={(match, playerName) => getPlayerImpact(match as TeamMatch, playerName)}
            formatDate={formatDate}
          />

          {/* Match History */}
          <div className="bg-card rounded-lg border border-border shadow-sm">
            <div className="px-6 py-4 border-b border-border">
              <h2 className="text-lg font-semibold text-foreground">Match History</h2>
            </div>
            <div className="divide-y divide-border">
              {sortedMatchHistory.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  No matches found
                </div>
              ) : (
                sortedMatchHistory.map((match) => {
                  const teamKey = normalizeTeamKey(team.player1, team.player2);
                  const team1Rank = getTeamRank(match.team1.player1, match.team1.player2);
                  const team2Rank = getTeamRank(match.team2.player1, match.team2.player2);

                  // Calculate the combo for the highlighted team
                  const highlightedCombo = [team.player1, team.player2]
                    .map(p => {
                      const r = playerRaces[p];
                      return r === 'Random' ? 'R' : (r ? r[0] : '');
                    })
                    .filter(Boolean)
                    .sort()
                    .join('');

                  // Convert player rankings to the format expected by component
                  const playerRankingsMap: Record<string, { rank: number; points: number; confidence: number }> = {};
                  Object.keys(playerRankings).forEach(name => {
                    const ranking = playerRankings[name];
                    if (ranking) {
                      playerRankingsMap[name] = {
                        rank: ranking.rank,
                        points: ranking.points,
                        confidence: ranking.confidence
                      };
                    }
                  });

                  return (
                    <MatchHistoryItem
                      key={`${match.tournament_slug}-${match.match_id}`}
                      match={match}
                      team1Rank={team1Rank ? { rank: team1Rank.rank, points: team1Rank.points, confidence: team1Rank.confidence } : null}
                      team2Rank={team2Rank ? { rank: team2Rank.rank, points: team2Rank.points, confidence: team2Rank.confidence } : null}
                      playerRankings={playerRankingsMap}
                      playerRaces={playerRaces}
                      playerCountries={playerCountries}
                      highlightPlayers={[team.player1, team.player2]}
                      highlightTeamKey={teamKey}
                      highlightCombo={highlightedCombo}
                      showWinLoss={true}
                      winLossValue={match.won}
                      isDrawValue={match.isDraw}
                      showRatingBreakdown={true}
                      comboRankings={comboRankings}
                      extractRaceChanges={(match) => extractRaceChanges(match as TeamMatch)}
                      normalizeTeamKey={normalizeTeamKey}
                      getTeamImpact={(match, player1, player2) => getTeamImpact(match as TeamMatch, player1, player2)}
                      getPlayerImpact={(match, playerName) => getPlayerImpact(match as TeamMatch, playerName)}
                      formatDate={formatDate}
                    />
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
