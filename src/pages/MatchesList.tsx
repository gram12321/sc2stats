import { useState, useEffect } from 'react';
import { formatRankingPoints } from '../lib/utils';

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
  player_impacts: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    opponentRating: number;
  }>;
}

interface Tournament {
  filename: string;
  name: string;
  slug: string;
  date: string | null;
  matchCount: number;
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

  useEffect(() => {
    loadTournaments();
    loadMatches();
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

  const getPlayerImpact = (match: MatchHistory, playerName: string) => {
    return match.player_impacts?.[playerName];
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Match History</h1>
              <p className="text-gray-600 mt-1">
                All matches with ranking point changes
              </p>
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
        {/* Filters */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700">Tournament:</label>
            <select
              value={selectedTournament}
              onChange={(e) => setSelectedTournament(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Tournaments</option>
              {tournaments.map(tournament => (
                <option key={tournament.slug} value={tournament.slug}>
                  {tournament.name}
                </option>
              ))}
            </select>
            <div className="text-sm text-gray-600">
              Showing {matches.length} matches
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading matches...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadMatches}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : matches.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <p className="text-gray-500">No matches found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match) => {
              const team1Players = [match.team1.player1, match.team1.player2].filter(Boolean).join(' + ');
              const team2Players = [match.team2.player1, match.team2.player2].filter(Boolean).join(' + ');
              const team1Won = match.team1_score > match.team2_score;
              
              return (
                <div
                  key={`${match.tournament_slug}-${match.match_id}`}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden"
                >
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-sm text-gray-500">
                          {match.tournament_slug} • {match.round}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          {formatDate(match.match_date || match.tournament_date)}
                        </div>
                      </div>
                      <div className="text-sm font-medium text-gray-700">
                        {match.match_id}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      {/* Team 1 */}
                      <div className={`p-3 rounded ${team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="font-medium text-gray-900 mb-2">{team1Players}</div>
                        <div className="text-2xl font-bold text-gray-900 mb-2">
                          {match.team1_score} - {match.team2_score}
                        </div>
                        <div className="space-y-1 text-xs">
                          {[match.team1.player1, match.team1.player2].filter(Boolean).map(playerName => {
                            const impact = getPlayerImpact(match, playerName);
                            if (!impact) return null;
                            return (
                              <div key={playerName} className="flex justify-between">
                                <span className="text-gray-600">{playerName}:</span>
                                <span className={`font-medium ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Team 2 */}
                      <div className={`p-3 rounded ${!team1Won ? 'bg-green-50 border border-green-200' : 'bg-gray-50 border border-gray-200'}`}>
                        <div className="font-medium text-gray-900 mb-2">{team2Players}</div>
                        <div className="text-2xl font-bold text-gray-900 mb-2">
                          {match.team2_score} - {match.team1_score}
                        </div>
                        <div className="space-y-1 text-xs">
                          {[match.team2.player1, match.team2.player2].filter(Boolean).map(playerName => {
                            const impact = getPlayerImpact(match, playerName);
                            if (!impact) return null;
                            return (
                              <div key={playerName} className="flex justify-between">
                                <span className="text-gray-600">{playerName}:</span>
                                <span className={`font-medium ${impact.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                  {impact.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(impact.ratingChange)}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
