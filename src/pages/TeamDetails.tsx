import { useState, useEffect } from 'react';
import { formatRankingPoints } from '../lib/utils';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { MatchHistoryItem } from '../components/MatchHistoryItem';

const ROUND_ORDER: Record<string, number> = {
  'Round of 16': 1,
  'Round of 8': 2,
  'Quarterfinals': 3,
  'Semifinals': 4,
  'Final': 5,
  'Grand Final': 5
};

interface TeamMatch {
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
  opponentRating: number;
  team_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
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
  points: number;
  confidence: number;
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
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [useSeededRankings, setUseSeededRankings] = useState(false);

  useEffect(() => {
    loadTeamDetails();
    loadPlayerRankings();
    loadTeamRankings();
    loadTeamRankings();
    loadAllPlayerRaces();
  }, [player1, player2, useSeededRankings]);

  const loadTeamDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const seedParam = useSeededRankings ? '?useSeeds=true' : '';
      const response = await fetch(`/api/team/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}${seedParam}`);
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
      const response = await fetch('/api/player-rankings');
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
      const response = await fetch('/api/team-rankings');
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data: TeamRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((teamRank, index) => {
        const teamKey = normalizeTeamKey(teamRank.player1, teamRank.player2);
        rankMap[teamKey] = {
          rank: index + 1,
          points: teamRank.points,
          confidence: teamRank.confidence || 0
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

  const normalizeTeamKey = (p1: string, p2: string): string => {
    return [p1, p2].filter(Boolean).sort().join('+');
  };

  const getTeamRank = (p1: string, p2: string) => {
    const teamKey = normalizeTeamKey(p1, p2);
    return teamRankings[teamKey] || null;
  };

  const getTeamImpact = (match: any, p1: string, p2: string) => {
    if (!match.team_impacts) return null;
    const teamKey = normalizeTeamKey(p1, p2);
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
      const getRaceAbbrev = (race: string) => {
        if (race === 'Random') return 'R';
        return race[0];
      };

      const race1Abbr = getRaceAbbrev(impact.race1);
      const race2Abbr = getRaceAbbrev(impact.race2);

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
  const sortedMatchHistory = team?.matchHistory ? [...team.matchHistory].sort((a, b) => {
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

    // Then by round order (higher round first = newest first)
    const roundA = ROUND_ORDER[a.round] || 0;
    const roundB = ROUND_ORDER[b.round] || 0;
    if (roundA !== roundB) {
      return roundB - roundA;
    }

    // Finally by match_id (reverse)
    return (b.match_id || '').localeCompare(a.match_id || '');
  }) : [];

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

  const teamName = `${team.player1} + ${team.player2}`;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{teamName}</h1>
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
                  <span className="text-sm text-gray-700">Use Initial Seeds (Average of Pass 1 & 2)</span>
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
                  className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
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
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Total Matches</div>
            <div className="text-2xl font-bold text-gray-900">{team.matches}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Wins</div>
            <div className="text-2xl font-bold text-green-600">{team.wins}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Losses</div>
            <div className="text-2xl font-bold text-red-600">{team.losses}</div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Ranking Points</div>
            <div className={`text-2xl font-bold ${team.points > 0 ? 'text-green-600' : team.points < 0 ? 'text-red-600' : 'text-gray-600'}`}>
              {team.points > 0 ? '+' : ''}{formatRankingPoints(team.points)}
            </div>
          </div>
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="text-sm text-gray-600">Confidence</div>
            <div className={`text-2xl font-bold ${(team.confidence || 0) >= 70 ? 'text-blue-600' : (team.confidence || 0) >= 40 ? 'text-yellow-600' : 'text-gray-500'}`}>
              {Math.round(team.confidence || 0)}%
            </div>
          </div>
        </div>

        {/* Match History */}
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Match History</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {sortedMatchHistory.length === 0 ? (
              <div className="p-8 text-center text-gray-500">
                No matches found
              </div>
            ) : (
              sortedMatchHistory.map((match) => {
                const teamKey = normalizeTeamKey(team.player1, team.player2);
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
                    highlightPlayers={[team.player1, team.player2]}
                    highlightTeamKey={teamKey}
                    showWinLoss={true}
                    winLossValue={match.won}
                    showRatingBreakdown={true}
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
  );
}
