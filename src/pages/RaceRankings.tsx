import { useState, useEffect } from 'react';
import { formatRankingPoints } from '../lib/utils';

interface RaceRanking {
  name: string; // e.g., "PvZ", "TvP"
  race1: string; // e.g., "Protoss", "Terran"
  race2: string; // e.g., "Zerg", "Protoss"
  matches: number;
  wins: number;
  losses: number;
  points: number;
}

interface RaceRankingsProps {
  onBack?: () => void;
}

export function RaceRankings({ onBack }: RaceRankingsProps) {
  const [rankings, setRankings] = useState<RaceRanking[]>([]);
  const [combinedRankings, setCombinedRankings] = useState<RaceRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideRandom, setHideRandom] = useState(false);

  useEffect(() => {
    loadRankings();
  }, []);

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch('/api/race-rankings');
      if (!response.ok) throw new Error('Failed to load race rankings');
      const data = await response.json();
      // Handle both old format (array) and new format (object with rankings and combinedRankings)
      if (Array.isArray(data)) {
        setRankings(data);
        setCombinedRankings([]);
      } else {
        setRankings(data.rankings || []);
        setCombinedRankings(data.combinedRankings || []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load race rankings');
    } finally {
      setIsLoading(false);
    }
  };

  const filteredRankings = rankings.filter(matchup => {
    // Filter out Random matchups if hideRandom is enabled
    if (hideRandom && (matchup.race1 === 'Random' || matchup.race2 === 'Random')) {
      return false;
    }
    
    // Apply search filter
    const searchLower = searchTerm.toLowerCase();
    return (
      matchup.name.toLowerCase().includes(searchLower) ||
      matchup.race1.toLowerCase().includes(searchLower) ||
      matchup.race2.toLowerCase().includes(searchLower)
    );
  });

  const getRaceBadgeColor = (race: string) => {
    switch (race) {
      case 'Terran': return 'bg-blue-100 text-blue-800';
      case 'Zerg': return 'bg-purple-100 text-purple-800';
      case 'Protoss': return 'bg-yellow-100 text-yellow-800';
      case 'Random': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };

  const getFullRaceName = (abbr: string) => {
    const raceMap: Record<string, string> = {
      'P': 'Protoss',
      'T': 'Terran',
      'Z': 'Zerg',
      'R': 'Random'
    };
    return raceMap[abbr] || abbr;
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Race Statistics</h1>
              <p className="text-gray-600 mt-1">
                Race vs race matchup statistics using the same ranking calculations as players/teams
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
            <p className="mt-4 text-gray-600">Loading race statistics...</p>
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
            {/* Combined Race Statistics */}
            {combinedRankings.length > 0 && (
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden mb-6">
                <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                  <h2 className="text-lg font-semibold text-gray-900">Combined Race Statistics</h2>
                  <p className="text-sm text-gray-600 mt-1">Overall performance for each race against all opponents</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rank
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
                      {combinedRankings.map((matchup, index) => (
                        <tr
                          key={matchup.name}
                          className="hover:bg-gray-50 transition-colors"
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">
                                {index + 1}
                              </span>
                              {index < 3 && (
                                <span className="ml-2 text-lg">
                                  {index === 0 && '🥇'}
                                  {index === 1 && '🥈'}
                                  {index === 2 && '🥉'}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRaceBadgeColor(matchup.race1)}`}>
                                {matchup.race1}
                              </span>
                              <span className="text-gray-400 font-medium">vs</span>
                              <span className="text-sm text-gray-600 font-medium">All</span>
                              <span className="text-sm text-gray-500 ml-2">({matchup.name})</span>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm text-gray-900">{matchup.matches}</span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-green-600">
                              {matchup.wins}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span className="text-sm font-medium text-red-600">
                              {matchup.losses}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-center">
                            <span
                              className={`text-sm font-bold ${
                                matchup.points > 0
                                  ? 'text-green-600'
                                  : matchup.points < 0
                                  ? 'text-red-600'
                                  : 'text-gray-600'
                              }`}
                            >
                              {matchup.points > 0 ? '+' : ''}{formatRankingPoints(matchup.points)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Search and Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <input
                  type="text"
                  placeholder="Search race matchups..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={hideRandom}
                    onChange={(e) => setHideRandom(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">Hide Random matchups</span>
                </label>
              </div>
              <div className="text-sm text-gray-600">
                Showing {filteredRankings.length} of {rankings.length} race matchups
              </div>
            </div>

            {/* Individual Matchups Table */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-900">Individual Matchups</h2>
                <p className="text-sm text-gray-600 mt-1">Detailed race vs race matchup statistics</p>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Rank
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Matchup
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
                          {searchTerm ? 'No race matchups found matching your search' : 'No race statistics available'}
                        </td>
                      </tr>
                    ) : (
                      filteredRankings.map((matchup, index) => {
                        const rank = rankings.findIndex(m => m.name === matchup.name) + 1;
                        return (
                          <tr
                            key={matchup.name}
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
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRaceBadgeColor(matchup.race1)}`}>
                                  {matchup.race1}
                                </span>
                                <span className="text-gray-400 font-medium">vs</span>
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRaceBadgeColor(matchup.race2)}`}>
                                  {matchup.race2}
                                </span>
                                <span className="text-sm text-gray-500 ml-2">({matchup.name})</span>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-900">{matchup.matches}</span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-green-600">
                                {matchup.wins}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm font-medium text-red-600">
                                {matchup.losses}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span
                                className={`text-sm font-bold ${
                                  matchup.points > 0
                                    ? 'text-green-600'
                                    : matchup.points < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                                }`}
                              >
                                {matchup.points > 0 ? '+' : ''}{formatRankingPoints(matchup.points)}
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
                <div className="text-sm text-gray-600">Total Matchups</div>
                <div className="text-2xl font-bold text-gray-900">{rankings.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Matches</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rankings.reduce((sum, m) => sum + m.matches, 0)}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Positive Points</div>
                <div className="text-2xl font-bold text-green-600">
                  {rankings.filter(m => m.points > 0).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Negative Points</div>
                <div className="text-2xl font-bold text-red-600">
                  {rankings.filter(m => m.points < 0).length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
