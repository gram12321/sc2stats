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
  confidence?: number;
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
  const [useSeededRankings, setUseSeededRankings] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof PlayerRanking | 'rank' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [filterLowConfidence, setFilterLowConfidence] = useState(false);

  useEffect(() => {
    loadRankings();
    loadPlayerRaces();
  }, [useSeededRankings]);

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const endpoint = useSeededRankings ? '/api/seeded-player-rankings' : '/api/player-rankings';
      const response = await fetch(endpoint);
      if (!response.ok) {
        if (response.status === 404 && useSeededRankings) {
          throw new Error('Seeded rankings not found. Please run: node tools/runSeededRankings.js');
        }
        throw new Error('Failed to load rankings');
      }
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

  const handleSort = (column: keyof PlayerRanking | 'rank') => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortColumn(column);
      setSortDirection('desc');
    }
  };

  // Calculate average confidence and threshold (2/3 of average)
  const averageConfidence = rankings.length > 0
    ? rankings.reduce((sum, p) => sum + (p.confidence || 0), 0) / rankings.length
    : 0;
  const confidenceThreshold = (averageConfidence * 4) / 4;

  // Apply confidence filter: if filter is ON, hide items below threshold completely
  const confidenceFilteredRankings = filterLowConfidence
    ? filteredRankings.filter(player => (player.confidence || 0) >= confidenceThreshold)
    : filteredRankings;

  const sortedRankings = [...confidenceFilteredRankings].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    if (sortColumn === 'rank') {
      aValue = rankings.findIndex(p => p.name === a.name) + 1;
      bValue = rankings.findIndex(p => p.name === b.name) + 1;
    } else {
      aValue = a[sortColumn];
      bValue = b[sortColumn];
    }

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) aValue = sortColumn === 'name' ? '' : 0;
    if (bValue === undefined || bValue === null) bValue = sortColumn === 'name' ? '' : 0;

    // String comparison for name
    if (sortColumn === 'name') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Numeric comparison
    const comparison = (aValue as number) - (bValue as number);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  // Apply confidence filter and re-rank based on original points order
  // First, get players sorted by points (original ranking order)
  const pointsSortedRankings = [...rankings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  const rankedRankings = sortedRankings.map((player) => {
    const playerConfidence = player.confidence || 0;
    const meetsThreshold = playerConfidence >= confidenceThreshold;

    if (!filterLowConfidence) {
      // When not filtering, show all players but only rank those above threshold
      if (meetsThreshold) {
        // Calculate rank based on points order, counting only players above threshold
        const pointsIndex = pointsSortedRankings.findIndex(p => p.name === player.name);
        let rank = 1;
        for (let i = 0; i < pointsIndex; i++) {
          const prevConfidence = pointsSortedRankings[i].confidence || 0;
          if (prevConfidence >= confidenceThreshold) {
            rank++;
          }
        }
        return { ...player, displayRank: rank };
      } else {
        // Below threshold: no rank
        return { ...player, displayRank: null };
      }
    }

    // When filtering is ON, all shown players meet threshold, so rank them normally
    // Find position in points-sorted list and count how many players above also meet threshold
    const pointsIndex = pointsSortedRankings.findIndex(p => p.name === player.name);
    let rank = 1;
    for (let i = 0; i < pointsIndex; i++) {
      const prevConfidence = pointsSortedRankings[i].confidence || 0;
      if (prevConfidence >= confidenceThreshold) {
        rank++;
      }
    }
    return { ...player, displayRank: rank };
  });

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
                {useSeededRankings
                  ? 'Seeded rankings (three-pass seeding system)'
                  : 'Enhanced ranking system with provisional ratings and confidence tracking'}
              </p>
            </div>
            <div className="flex items-center gap-4">
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
                    <div className="invisible group-hover:visible absolute top-full left-1/2 transform -translate-x-1/2 mt-2 w-64 p-2 bg-gray-800 text-white text-xs rounded shadow-lg z-10">
                      When checked, rankings start from a seed value derived from a preliminary analysis of all matches. Without this, everyone starts at 0.
                    </div>
                  </div>
                </div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filterLowConfidence}
                    onChange={(e) => setFilterLowConfidence(e.target.checked)}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">
                    Filter Low Confidence ({confidenceThreshold.toFixed(1)}% threshold)
                  </span>
                </label>
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
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('rank')}
                      >
                        <div className="flex items-center gap-1">
                          Rank
                          {sortColumn === 'rank' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('name')}
                      >
                        <div className="flex items-center gap-1">
                          Player
                          {sortColumn === 'name' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Race
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('matches')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Matches
                          {sortColumn === 'matches' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('wins')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Wins
                          {sortColumn === 'wins' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('losses')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Losses
                          {sortColumn === 'losses' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('points')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Points
                          {sortColumn === 'points' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('confidence')}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Confidence
                          {sortColumn === 'confidence' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {rankedRankings.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-6 py-8 text-center text-gray-500">
                          {searchTerm
                            ? 'No players found matching your search'
                            : filterLowConfidence
                              ? 'No players meet the confidence threshold'
                              : 'No rankings available'}
                        </td>
                      </tr>
                    ) : (
                      rankedRankings.map((player) => {
                        const displayRank = player.displayRank;
                        const race = playerRaces[player.name];
                        return (
                          <tr
                            key={player.name}
                            className="hover:bg-gray-50 transition-colors"
                          >
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {displayRank !== null ? (
                                  <>
                                    <span className="text-sm font-medium text-gray-900">
                                      {displayRank}
                                    </span>
                                    {displayRank <= 3 && (
                                      <span className="ml-2 text-lg">
                                        {displayRank === 1 && '🥇'}
                                        {displayRank === 2 && '🥈'}
                                        {displayRank === 3 && '🥉'}
                                      </span>
                                    )}
                                  </>
                                ) : (
                                  <span className="text-sm text-gray-400">—</span>
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
                                className={`text-sm font-bold ${player.points > 0
                                  ? 'text-green-600'
                                  : player.points < 0
                                    ? 'text-red-600'
                                    : 'text-gray-600'
                                  }`}
                              >
                                {player.points > 0 ? '+' : ''}{formatRankingPoints(player.points)}
                              </span>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-center">
                              <span className="text-sm text-gray-700">
                                {typeof player.confidence === 'number'
                                  ? `${Math.round(player.confidence)}%`
                                  : '—'}
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
                <div className="text-sm text-gray-600">
                  {filterLowConfidence ? 'Displayed Players' : 'Total Players'}
                </div>
                <div className="text-2xl font-bold text-gray-900">{rankedRankings.length}</div>
                {filterLowConfidence && (
                  <div className="text-xs text-gray-500 mt-1">
                    of {rankings.length} total
                  </div>
                )}
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Matches</div>
                <div className="text-2xl font-bold text-gray-900">
                  {rankedRankings.reduce((sum, p) => sum + p.matches, 0) / 2}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Positive Points</div>
                <div className="text-2xl font-bold text-green-600">
                  {rankedRankings.filter(p => p.points > 0).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Negative Points</div>
                <div className="text-2xl font-bold text-red-600">
                  {rankedRankings.filter(p => p.points < 0).length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
