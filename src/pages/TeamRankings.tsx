import { useState, useEffect } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { formatRankingPoints } from '../lib/utils';

interface TeamRanking {
  player1: string;
  player2: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
}

interface TeamRankingsProps {
  onBack?: () => void;
}

export function TeamRankings({ onBack, onNavigateToTeam }: TeamRankingsProps) {
  const [rankings, setRankings] = useState<TeamRanking[]>([]);
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadRankings();
    loadPlayerRaces();
  }, []);

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/team-rankings');
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data = await response.json();
      setRankings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team rankings');
    } finally {
      setIsLoading(false);
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

  const filteredRankings = rankings.filter(team => {
    const searchLower = searchTerm.toLowerCase();
    return (
      team.player1.toLowerCase().includes(searchLower) ||
      team.player2.toLowerCase().includes(searchLower)
    );
  });

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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Team Rankings</h1>
              <p className="text-gray-600 mt-1">
                Ranking by team (same two players). Each player can appear in multiple teams.
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
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading team rankings...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadRankings}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Search */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
              <input
                type="text"
                placeholder="Search teams by player name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 text-sm text-gray-600">
                Showing {filteredRankings.length} of {rankings.length} teams
              </div>
            </div>

            {/* Rankings Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Team
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Matches
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Wins
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Losses
                      </th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Points
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRankings.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                          {searchTerm ? 'No teams found matching your search' : 'No team rankings available'}
                        </td>
                      </tr>
                    ) : (
                      filteredRankings.map((team, index) => {
                        const rank = rankings.findIndex(t => 
                          t.player1 === team.player1 && t.player2 === team.player2
                        ) + 1;
                        const player1Race = playerRaces[team.player1];
                        const player2Race = playerRaces[team.player2];
                        return (
                          <tr
                            key={`${team.player1}+${team.player2}`}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                <span className="text-sm font-medium text-gray-900">
                                  {rank}
                                </span>
                                {rank <= 3 && (
                                  <span className="ml-2 text-lg">
                                    {rank === 1 && '🥇'}
                                    {rank === 2 && '🥈'}
                                    {rank === 3 && '🥉'}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {onNavigateToTeam ? (
                                    <button
                                      onClick={() => onNavigateToTeam(team.player1, team.player2)}
                                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {team.player1}
                                    </button>
                                  ) : (
                                    <span className="text-sm font-medium text-gray-900">
                                      {team.player1}
                                    </span>
                                  )}
                                  {player1Race && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRaceBadgeColor(player1Race)}`}>
                                      {player1Race}
                                    </span>
                                  )}
                                </div>
                                <span className="text-gray-400">+</span>
                                <div className="flex items-center gap-2">
                                  {onNavigateToTeam ? (
                                    <button
                                      onClick={() => onNavigateToTeam(team.player1, team.player2)}
                                      className="text-sm font-medium text-blue-600 hover:text-blue-800 hover:underline"
                                    >
                                      {team.player2}
                                    </button>
                                  ) : (
                                    <span className="text-sm font-medium text-gray-900">
                                      {team.player2}
                                    </span>
                                  )}
                                  {player2Race && (
                                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getRaceBadgeColor(player2Race)}`}>
                                      {player2Race}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-900">{team.matches}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-green-600">
                                {team.wins}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-red-600">
                                {team.losses}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`text-sm font-bold ${
                                  team.points > 0
                                    ? 'text-green-600'
                                    : team.points < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                {team.points > 0 ? '+' : ''}{formatRankingPoints(team.points)}
                              </span>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Stats Summary */}
            <div className="mt-6 grid grid-cols-4 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Teams</div>
                <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Matches</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rankings.reduce((sum, t) => sum + t.matches, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Positive Points</div>
                <div className="text-2xl font-bold text-green-600">
                  {rankings.filter(t => t.points > 0).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Negative Points</div>
                <div className="text-2xl font-bold text-red-600">
                  {rankings.filter(t => t.points < 0).length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
