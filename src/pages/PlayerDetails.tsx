import { useState, useEffect, useMemo } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { formatRankingPoints, getRaceAbbr } from '../lib/utils';
import { MatchHistoryItem } from '../components/MatchHistoryItem';
import { RatingChart } from '../components/RatingChart';
import { RaceMatchupStats } from '../components/RaceMatchupStats';

interface PlayerMatch {
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
  ratingChange: number;
  won: boolean;
  isDraw?: boolean;
  opponentRating: number;
  team_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
  }>;
  player_impacts?: Record<string, {
    ratingBefore: number;
    rankBefore?: number | string;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    confidence?: number;
    populationStdDev?: number;
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

interface PlayerDetails {
  name: string;
  matches: number;
  wins: number;
  losses: number;
  draws?: number;
  points: number;
  confidence: number;
  matchHistory: PlayerMatch[];
}

interface PlayerDetailsData extends PlayerDetails { }

interface PlayerDetailsProps {
  playerName: string;
  onBack?: () => void;
}

export function PlayerDetails({ playerName, onBack }: PlayerDetailsProps) {
  const [player, setPlayer] = useState<PlayerDetailsData | null>(null);
  const [playerRace, setPlayerRace] = useState<Race | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerRankings, setPlayerRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [teamRankings, setTeamRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [useSeededRankings, setUseSeededRankings] = useState(false);
  const [chartMode, setChartMode] = useState<'rating' | 'rank'>('rating');
  const { seasons } = useRankingSettings();

  useEffect(() => {
    loadPlayerDetails();
    loadPlayerRace();
    loadPlayerRankings();
    loadTeamRankings();
    loadAllPlayerRaces();
  }, [playerName, useSeededRankings, seasons]);

  const loadPlayerDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const params = new URLSearchParams();
      if (useSeededRankings) params.append('useSeeds', 'true');
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const response = await fetch(`/api/player/${encodeURIComponent(playerName)}?${params.toString()}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Player not found');
        }
        throw new Error('Failed to load player details');
      }
      const data = await response.json();
      setPlayer(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load player details');
    } finally {
      setIsLoading(false);
    }
  };

  const loadPlayerRace = async () => {
    try {
      const defaults = await getPlayerDefaults();
      setPlayerRace(defaults[playerName] || null);
    } catch (err) {
      console.error('Error loading player race:', err);
    }
  };

  const loadPlayerRankings = async () => {
    try {
      const params = new URLSearchParams();
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const response = await fetch(`/api/player-rankings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load player rankings');
      const data: PlayerRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((player, index) => {
        rankMap[player.name] = {
          rank: index + 1,
          points: player.points,
          confidence: player.confidence || 0
        };
      });
      setPlayerRankings(rankMap);
    } catch (err) {
      console.error('Error loading player rankings:', err);
    }
  };

  const loadTeamRankings = async () => {
    try {
      const params = new URLSearchParams();
      if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

      const response = await fetch(`/api/team-rankings?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data: TeamRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((team, index) => {
        const teamKey = normalizeTeamKey(team.player1, team.player2);
        rankMap[teamKey] = {
          rank: index + 1,
          points: team.points,
          confidence: team.confidence || 0
        };
      });
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

  const normalizeTeamKey = (player1: string, player2: string): string => {
    return [player1, player2].filter(Boolean).sort().join('+');
  };

  const getTeamRank = (player1: string, player2: string) => {
    const teamKey = normalizeTeamKey(player1, player2);
    return teamRankings[teamKey] || null;
  };

  const getTeamImpact = (match: any, player1: string, player2: string) => {
    if (!match.team_impacts) return null;
    const teamKey = normalizeTeamKey(player1, player2);
    return match.team_impacts[teamKey] || null;
  };

  const getPlayerImpact = (match: any, playerName: string) => {
    return match.player_impacts?.[playerName] || null;
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

  // Sort match history by newest first
  const sortedMatchHistory = player?.matchHistory ? [...player.matchHistory].sort((a, b) => {
    // First by tournament date (newest first)
    if (a.tournament_date && b.tournament_date) {
      const dateA = new Date(a.tournament_date);
      const dateB = new Date(b.tournament_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
    }
    // Then by match date (newest first)
    if (a.match_date && b.match_date) {
      const dateA = new Date(a.match_date);
      const dateB = new Date(b.match_date);
      if (dateA.getTime() !== dateB.getTime()) {
        return dateB.getTime() - dateA.getTime();
      }
    }
    // Finally by match_id (reverse)
    return (b.match_id || '').localeCompare(a.match_id || '');
  }) : [];

  const getRaceBadgeColor = (race: Race | null | undefined) => {
    if (!race) return 'bg-gray-100 text-gray-600';
    switch (race) {
      case 'Terran': return 'bg-blue-100 text-blue-800';
      case 'Zerg': return 'bg-purple-100 text-purple-800';
      case 'Protoss': return 'bg-yellow-100 text-yellow-800';
      case 'Random': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const chartData = useMemo(() => {
    if (!sortedMatchHistory.length) return [];

    // Create a copy and reverse to get oldest -> newest
    const chronoMatches = [...sortedMatchHistory].reverse();

    return chronoMatches.map(match => {
      const impact = getPlayerImpact(match, player?.name || '');

      // Determine rank
      let rank: number | undefined;
      // rankBefore comes as string ('-' or number) or number.
      // processRankings.js: rankBefore = rankMap.get(playerName) || '-'; (rankMap uses 1-based index)
      const rVal = impact?.rankBefore;
      if (rVal && rVal !== '-') {
        rank = Number(rVal);
      }

      const rating = impact ? impact.ratingBefore + impact.ratingChange : 0;

      // Calculate confidence interval if data exists
      let confidenceRange: [number, number] | undefined;
      // impact.confidence is the confidence AFTER the match (0-100)
      // impact.populationStdDev is the std dev used (default 350)
      if (impact && typeof impact.confidence === 'number') {
        const conf = impact.confidence;
        const stdDev = impact.populationStdDev || 350; // Fallback
        // Heuristic: Margin = stdDev * (1 - confidence/100)
        // 0% confidence -> +/- 1 std dev
        // 100% confidence -> +/- 0
        const margin = stdDev * (1 - conf / 100);
        confidenceRange = [rating - margin, rating + margin];
      }

      // Determine opponent name
      let opponentName = 'Unknown';
      if (player && (match.team1.player1 === player.name || match.team1.player2 === player.name)) {
        // Player is in Team 1
        opponentName = match.team2.player1;
        if (match.team2.player2) opponentName += ` & ${match.team2.player2}`;
      } else {
        // Player is in Team 2
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
        tournamentName: match.tournament_slug.replace(/-/g, ' '),
        opponent: opponentName
      };
    }).filter(point => point.rating !== 0); // Basic filter to ensure valid points
  }, [sortedMatchHistory, player]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading player details...</p>
        </div>
      </div>
    );
  }

  if (error || !player) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto p-6">
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error || 'Player not found'}</p>
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

  return (
    <div className="min-h-screen bg-background">
      <div className="bg-card border-b border-border shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-foreground">{player.name}</h1>
              {playerRace && (
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium mt-2 ${getRaceBadgeColor(playerRace)}`}>
                  {playerRace}
                </span>
              )}
            </div>
            <div className="flex items-center gap-4">
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useSeededRankings}
                    onChange={(e) => setUseSeededRankings(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-muted-foreground">Use Initial Seeds (Average of Pass 1 & 2)</span>
                </label>
                <div className="ml-2 group relative">
                  <span className="cursor-help text-gray-400 text-xs border border-gray-400 rounded-full w-4 h-4 inline-flex items-center justify-center">?</span>
                  <div className="invisible group-hover:visible absolute top-full right-0 mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                    When checked, rankings start from a seed value derived from a preliminary analysis of all matches. Without this, everyone starts at 0.
                  </div>
                </div>
              </div>
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
            <div className="text-2xl font-bold text-foreground">{player.matches}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Wins</div>
            <div className="text-2xl font-bold text-green-600">{player.wins}</div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Losses</div>
            <div className="text-2xl font-bold text-red-600">{player.losses}</div>
          </div>
          {player.draws !== undefined && (
            <div className="bg-card rounded-lg border border-border p-4">
              <div className="text-sm text-muted-foreground">Draws</div>
              <div className="text-2xl font-bold text-muted-foreground">{player.draws}</div>
            </div>
          )}
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Ranking Points</div>
            <div className={`text-2xl font-bold ${player.points > 0 ? 'text-green-600' : player.points < 0 ? 'text-red-600' : 'text-muted-foreground'}`}>
              {player.points > 0 ? '+' : ''}{formatRankingPoints(player.points)}
            </div>
          </div>
          <div className="bg-card rounded-lg border border-border p-4">
            <div className="text-sm text-muted-foreground">Confidence</div>
            <div className={`text-2xl font-bold ${(player.confidence || 0) >= 70 ? 'text-blue-600' : (player.confidence || 0) >= 40 ? 'text-yellow-600' : 'text-muted-foreground'}`}>
              {Math.round(player.confidence || 0)}%
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
            playerNames={[playerName]}
            playerRaces={playerRaces}
            isTeam={false}
            playerRankings={playerRankings}
            teamRankings={teamRankings}
            normalizeTeamKey={normalizeTeamKey}
            getTeamImpact={(match, player1, player2) => getTeamImpact(match as PlayerMatch, player1, player2)}
            getPlayerImpact={(match, playerName) => getPlayerImpact(match as PlayerMatch, playerName)}
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
                const team1Rank = getTeamRank(match.team1.player1, match.team1.player2);
                const team2Rank = getTeamRank(match.team2.player1, match.team2.player2);

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
                    highlightPlayers={[playerName]}
                    showWinLoss={true}
                    winLossValue={match.won}
                    isDrawValue={match.isDraw}
                    showRatingBreakdown={true}
                    extractRaceChanges={(match) => extractRaceChanges(match as PlayerMatch)}
                    normalizeTeamKey={normalizeTeamKey}
                    getTeamImpact={(match, player1, player2) => getTeamImpact(match as PlayerMatch, player1, player2)}
                    getPlayerImpact={(match, playerName) => getPlayerImpact(match as PlayerMatch, playerName)}
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
