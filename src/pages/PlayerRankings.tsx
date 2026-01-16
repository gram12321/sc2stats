import { useState, useEffect } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { formatRankingPoints } from '../lib/utils';

interface PlayerRanking {
  name: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
}

interface PlayerRankingsProps {
  onBack?: () => void;
  onNavigateToPlayer?: (playerName: string) => void;
}

export function PlayerRankings({ onBack, onNavigateToPlayer }: PlayerRankingsProps) {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
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
      const response = await fetch('/api/player-rankings');
      if (!response.ok) throw new Error('Failed to load rankings');
      const data = await response.json();
      setRankings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load rankings');
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

  const filteredRankings = rankings.filter(player =>
    player.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRaceAbbr = (race: Race | null | undefined): string => {
    if (!race) return '';
    switch (race) {
      case 'Terran': return 'T';
      case 'Zerg': return 'Z';
      case 'Protoss': return 'P';
      case 'Random': return 'R';
      default: return '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Player Rankings</h1>
              <p className="text-gray-600 mt-1">
                Simple ranking system: +1 point for win, -1 point for loss
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

      <div className="max-w-6xl mx-auto p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading rankings...</p>
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
                placeholder="Search players..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="mt-2 text-sm text-gray-600">
                Showing {filteredRankings.length} of {rankings.length} players
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
                        Player
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Race
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
                        <td colSpan={7} className="px-6 py-8 text-center text-gray-500">
                          {searchTerm ? 'No players found matching your search' : 'No rankings available'}
                        </td>
                      </tr>
                    ) : (
                      filteredRankings.map((player) => {
                        const rank = rankings.findIndex(p => p.name === player.name) + 1;
                        const race = playerRaces[player.name];
                        return (
                          <tr
                            key={player.name}
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
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm font-medium text-gray-900">
                                {onNavigateToPlayer ? (
                                  <button
                                    onClick={() => onNavigateToPlayer(player.name)}
                                    className="text-blue-600 hover:text-blue-800 hover:underline"
                                  >
                                    {player.name}
                                    {race && <span className="text-gray-500 ml-1">({getRaceAbbr(race)})</span>}
                                  </button>
                                ) : (
                                  <>
                                    {player.name}
                                    {race && <span className="text-gray-500 ml-1">({getRaceAbbr(race)})</span>}
                                  </>
                                )}
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="text-xs text-gray-400">—</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-900">{player.matches}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-green-600">
                                {player.wins}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-red-600">
                                {player.losses}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`text-sm font-bold ${
                                  player.points > 0
                                    ? 'text-green-600'
                                    : player.points < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                {player.points > 0 ? '+' : ''}{formatRankingPoints(player.points)}
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
                <div className="text-sm text-gray-600">Total Players</div>
                <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Matches</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rankings.reduce((sum, p) => sum + p.matches, 0) / 2}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Positive Points</div>
                <div className="text-2xl font-bold text-green-600">
                  {rankings.filter(p => p.points > 0).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Negative Points</div>
                <div className="text-2xl font-bold text-red-600">
                  {rankings.filter(p => p.points < 0).length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
