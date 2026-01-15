import { useState, useEffect } from 'react';
import { formatRankingPoints } from '../lib/utils';

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
}

interface TeamDetails {
  name: string;
  player1: string;
  player2: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
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

  useEffect(() => {
    loadTeamDetails();
  }, [player1, player2]);

  const loadTeamDetails = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/team/${encodeURIComponent(player1)}/${encodeURIComponent(player2)}`);
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
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

      <div className="max-w-7xl mx-auto p-6">
        {/* Stats Summary */}
        <div className="grid grid-cols-4 gap-4 mb-6">
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
                const team1Players = [match.team1.player1, match.team1.player2].filter(Boolean).join(' + ');
                const team2Players = [match.team2.player1, match.team2.player2].filter(Boolean).join(' + ');
                const isTeam1 = [match.team1.player1, match.team1.player2].sort().join('+') === [team.player1, team.player2].sort().join('+');
                const teamScore = isTeam1 ? match.team1_score : match.team2_score;
                const opponentScore = isTeam1 ? match.team2_score : match.team1_score;
                const opponent = isTeam1 ? team2Players : team1Players;

                return (
                  <div key={`${match.tournament_slug}-${match.match_id}`} className="p-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${match.won ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                            {match.won ? 'W' : 'L'}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {teamScore} - {opponentScore}
                          </span>
                          <span className="text-sm text-gray-600">vs {opponent}</span>
                        </div>
                        <div className="text-xs text-gray-500">
                          {match.tournament_slug} • {match.round} • {formatDate(match.match_date || match.tournament_date)}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-bold ${match.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {match.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(match.ratingChange)}
                        </div>
                        <div className="text-xs text-gray-500">
                          Opponent: {formatRankingPoints(match.opponentRating)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
