import { useState, useEffect, useMemo } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults, setPlayerDefault, clearPlayerDefaults } from '../lib/playerDefaults';

const RACES: Exclude<Race, null>[] = ['Terran', 'Zerg', 'Protoss', 'Random'];

interface PlayerManagerProps {
  onBack?: () => void;
}

export function PlayerManager({ onBack }: PlayerManagerProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Record<string, Race>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hideWithDefaults, setHideWithDefaults] = useState(true);

  useEffect(() => {
    loadPlayers();
    loadDefaults();
  }, []);

  const loadPlayers = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/players');
      if (!response.ok) throw new Error('Failed to load players');
      const data = await response.json();
      setPlayers(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load players');
    } finally {
      setIsLoading(false);
    }
  };

  const loadDefaults = async () => {
    try {
      const loaded = await getPlayerDefaults();
      setDefaults(loaded);
    } catch (err) {
      console.error('Error loading defaults:', err);
    }
  };

  const handleRaceChange = async (playerName: string, race: Race) => {
    const newDefaults = { ...defaults };
    if (race === null) {
      delete newDefaults[playerName];
    } else {
      newDefaults[playerName] = race;
    }
    setDefaults(newDefaults);
    try {
      await setPlayerDefault(playerName, race);
    } catch (err) {
      console.error('Error saving default:', err);
      // Revert on error
      loadDefaults();
    }
  };

  const handleBulkSet = async (race: Race) => {
    const newDefaults = { ...defaults };
    filtered.forEach(player => {
      newDefaults[player] = race;
    });
    setDefaults(newDefaults);
    try {
      // Save each individually
      await Promise.all(filtered.map(player => setPlayerDefault(player, race)));
    } catch (err) {
      console.error('Error saving bulk defaults:', err);
      loadDefaults();
    }
  };

  const handleClearAll = async () => {
    if (confirm('Are you sure you want to clear all player defaults?')) {
      try {
        await clearPlayerDefaults();
        setDefaults({});
      } catch (err) {
        console.error('Error clearing defaults:', err);
      }
    }
  };

  const filtered = useMemo(() => {
    let result = players;
    
    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.toLowerCase().includes(term));
    }
    
    // Filter out players with defaults if toggle is on
    if (hideWithDefaults) {
      result = result.filter(p => !defaults[p]);
    }
    
    return result;
  }, [players, searchTerm, hideWithDefaults, defaults]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Player Manager</h1>
              <p className="text-gray-600 mt-1">
                Set default races for players ({players.length} total players)
              </p>
            </div>
            <button
              onClick={onBack}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              ← Back to Tournaments
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-6">
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-gray-600">Loading players...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadPlayers}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Search and Bulk Actions */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-4">
                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideWithDefaults}
                      onChange={(e) => setHideWithDefaults(e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <span>Hide players with defaults</span>
                  </label>
                  <div className="text-sm text-gray-600">
                    Showing {filtered.length} of {players.length} players
                  </div>
                </div>
              </div>
              
              {filtered.length > 0 && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200">
                  <span className="text-sm text-gray-700">Bulk set for filtered players:</span>
                  {RACES.map((race) => (
                    <button
                      key={race}
                      onClick={() => handleBulkSet(race)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                    >
                      Set {race}
                    </button>
                  ))}
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 ml-auto"
                  >
                    Clear All Defaults
                  </button>
                </div>
              )}
            </div>

            {/* Player List */}
            <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
              <div className="divide-y divide-gray-200">
                {filtered.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    {searchTerm ? 'No players found matching your search' : 'No players found'}
                  </div>
                ) : (
                  filtered.map((player) => (
                    <div
                      key={player}
                      className="p-4 hover:bg-gray-50 flex items-center justify-between"
                    >
                      <div className="flex-1">
                        <h3 className="text-lg font-medium text-gray-900">{player}</h3>
                        {defaults[player] && (
                          <span className="text-sm text-gray-500">
                            Default: {defaults[player]}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={defaults[player] || ''}
                          onChange={(e) =>
                            handleRaceChange(player, (e.target.value || null) as Race)
                          }
                          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">No default</option>
                          {RACES.map((race) => (
                            <option key={race} value={race}>
                              {race}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Total Players</div>
                <div className="text-2xl font-bold text-gray-900">{players.length}</div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">With Defaults</div>
                <div className="text-2xl font-bold text-gray-900">
                  {Object.keys(defaults).length}
                </div>
              </div>
              <div className="bg-white rounded-lg border border-gray-200 p-4">
                <div className="text-sm text-gray-600">Without Defaults</div>
                <div className="text-2xl font-bold text-gray-900">
                  {players.length - Object.keys(defaults).length}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
