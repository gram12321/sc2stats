import { useState, useEffect } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { MatchHistoryItem } from '../components/MatchHistoryItem';

interface MatchHistory {
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
  player_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    expectedWin?: number;
    baseK?: number;
    adjustedK?: number;
    confidence?: number;
    matchCount?: number;
  }>;
  team_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
    expectedWin?: number;
    baseK?: number;
    adjustedK?: number;
    confidence?: number;
    matchCount?: number;
  }>;
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

interface Tournament {
  filename: string;
  name: string;
  slug: string;
  date: string | null;
  matchCount: number;
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

interface MatchesListProps {
  onBack?: () => void;
}

export function MatchesList({ onBack }: MatchesListProps) {
  const [matches, setMatches] = useState<MatchHistory[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playerRankings, setPlayerRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [teamRankings, setTeamRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});

  useEffect(() => {
    loadTournaments();
    loadMatches();
    loadPlayerRankings();
    loadTeamRankings();
    loadPlayerRaces();
  }, []);

  useEffect(() => {
    loadMatches();
  }, [selectedTournament]);

  const loadTournaments = async () => {
    try {
      const response = await fetch('/api/tournaments');
      if (!response.ok) throw new Error('Failed to load tournaments');
      const data = await response.json();
      setTournaments(data);
    } catch (err) {
      console.error('Error loading tournaments:', err);
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

  const loadPlayerRaces = async () => {
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

  const loadMatches = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const url = selectedTournament 
        ? `/api/match-history?tournament=${encodeURIComponent(selectedTournament)}`
        : '/api/match-history';
      const response = await fetch(url);
      if (!response.ok) throw new Error('Failed to load matches');
      const data = await response.json();
      setMatches(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load matches');
    } finally {
      setIsLoading(false);
    }
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
  const extractRaceChanges = (match: MatchHistory) => {
    if (!match.race_impacts) return null;
    const raceChanges: Array<{ race: string; change: number }> = [];
    const seenRaces = new Set<string>();
    
    Object.values(match.race_impacts).forEach(impact => {
      // Get race abbreviations
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

  const getPlayerImpact = (match: MatchHistory, playerName: string) => {
    return match.player_impacts?.[playerName] || null;
  };

  const getTeamRank = (player1: string, player2: string) => {
    const teamKey = normalizeTeamKey(player1, player2);
    return teamRankings[teamKey] || null;
  };

  const getTeamImpact = (match: MatchHistory, player1: string, player2: string) => {
    if (!match.team_impacts) return null;
    const teamKey = normalizeTeamKey(player1, player2);
    return match.team_impacts[teamKey] || null;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-gray-900">Match History</h1>
            </div>
            {onBack && (
              <button
                onClick={onBack}
                className="px-3 py-1.5 text-sm text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
              >
                ← Back
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-3 mb-3 shadow-sm">
          <div className="flex items-center gap-3">
            <label className="text-xs font-medium text-gray-700">Tournament:</label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tournaments</option>
              {tournaments.map(tournament => (
                <option key={tournament.slug} value={tournament.slug}>
                  {tournament.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-gray-600 ml-auto">
              {matches.length} matches
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
            <p className="mt-2 text-sm text-gray-600">Loading matches...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-800">{error}</p>
            <button
              onClick={loadMatches}
              className="mt-2 text-xs text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-6 text-center">
            <p className="text-sm text-gray-500">No matches found</p>
          </div>
        ) : (
          <div className="space-y-1">
            {matches.map((match) => {
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
                    showRatingBreakdown={true}
                    extractRaceChanges={(matchData) => extractRaceChanges(matchData as MatchHistory)}
                    normalizeTeamKey={normalizeTeamKey}
                    getTeamImpact={(matchData, player1, player2) => getTeamImpact(matchData as MatchHistory, player1, player2)}
                    getPlayerImpact={(matchData, playerName) => getPlayerImpact(matchData as MatchHistory, playerName)}
                    formatDate={formatDate}
                  />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
