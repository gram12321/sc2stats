import { useState, useEffect, useMemo } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults, setPlayerDefault, clearPlayerDefaults, renamePlayerName } from '../lib/playerDefaults';

const RACES: Exclude<Race, null>[] = ['Terran', 'Zerg', 'Protoss', 'Random'];

interface PlayerManagerProps { }

interface SimilarNamePair {
  nameA: string;
  nameB: string;
}

const normalizeNameForSimilarity = (name: string) =>
  name.toLowerCase().replace(/[^a-z0-9]/g, '');

const levenshteinDistance = (a: string, b: string): number => {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const matrix: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j += 1) matrix[0][j] = j;

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
};

const isLikelySamePlayerName = (left: string, right: string): boolean => {
  if (!left || !right || left === right) return false;

  if (left.toLowerCase() === right.toLowerCase()) return true;

  const normalizedLeft = normalizeNameForSimilarity(left);
  const normalizedRight = normalizeNameForSimilarity(right);

  if (!normalizedLeft || !normalizedRight || normalizedLeft === normalizedRight) {
    return normalizedLeft === normalizedRight;
  }

  const minLength = Math.min(normalizedLeft.length, normalizedRight.length);
  const threshold = minLength >= 8 ? 2 : 1;
  return levenshteinDistance(normalizedLeft, normalizedRight) <= threshold;
};

export function PlayerManager({ }: PlayerManagerProps) {
  const [players, setPlayers] = useState<string[]>([]);
  const [defaults, setDefaults] = useState<Record<string, Race>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [hideWithDefaults, setHideWithDefaults] = useState(true);
  const [filterRace, setFilterRace] = useState<Race | 'All'>('All');
  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameFeedback, setRenameFeedback] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);

  useEffect(() => {
    loadPlayers();
    loadDefaults();
  }, []);

  useEffect(() => {
    if (!players.length) {
      setRenameFrom('');
      return;
    }

    if (!renameFrom || !players.includes(renameFrom)) {
      setRenameFrom(players[0]);
    }
  }, [players, renameFrom]);

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

  const similarNamePairs = useMemo<SimilarNamePair[]>(() => {
    const pairs: SimilarNamePair[] = [];

    for (let i = 0; i < players.length; i += 1) {
      for (let j = i + 1; j < players.length; j += 1) {
        const nameA = players[i];
        const nameB = players[j];
        if (isLikelySamePlayerName(nameA, nameB)) {
          pairs.push({ nameA, nameB });
        }
      }
    }

    return pairs.slice(0, 25);
  }, [players]);

  const handleRenamePlayer = async () => {
    const fromName = renameFrom;
    const toName = renameTo.trim();

    setRenameFeedback(null);
    setRenameError(null);

    if (!fromName || !toName) {
      setRenameError('Please select a player and provide a new name.');
      return;
    }

    if (fromName === toName) {
      setRenameError('Old and new name are identical.');
      return;
    }

    const existingMatch = players.find((player) => player === toName && player !== fromName);
    if (existingMatch) {
      const mergeConfirmed = window.confirm(
        `"${toName}" already exists. Continue and merge all "${fromName}" records into "${toName}"?`
      );
      if (!mergeConfirmed) {
        return;
      }
    }

    const similarExisting = players
      .filter((player) => player !== fromName && player !== toName)
      .filter((player) => isLikelySamePlayerName(toName, player))
      .slice(0, 5);

    if (similarExisting.length > 0) {
      const confirmSimilar = window.confirm(
        `The new name "${toName}" looks very similar to: ${similarExisting.join(', ')}.\n\nConfirm this is intended for the same player?`
      );
      if (!confirmSimilar) {
        return;
      }
    }

    setIsRenaming(true);
    try {
      await renamePlayerName(fromName, toName);
      await Promise.all([loadPlayers(), loadDefaults()]);
      setRenameFeedback(`Renamed "${fromName}" to "${toName}" successfully.`);
      setRenameTo('');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to rename player';
      setRenameError(message);
    } finally {
      setIsRenaming(false);
    }
  };

  const prefillRenameFromSuggestion = (fromName: string, toName: string) => {
    setRenameFrom(fromName);
    setRenameTo(toName);
    setRenameFeedback(null);
    setRenameError(null);
  };

  const filtered = useMemo(() => {
    let result = players;

    // Filter by search term
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(p => p.toLowerCase().includes(term));
    }

    // Filter by race
    if (filterRace !== 'All') {
      result = result.filter(p => defaults[p] === filterRace);
    }

    // Filter out players with defaults if toggle is on
    // Only apply this if we are NOT filtering by a specific race,
    // because if we filter by "Zerg", we likely want to see the Zergs whether they have defaults or not (they inherently have defaults if they match the race).
    // Actually, if filterRace is set, it implies they have a default (since defaults map player -> race).
    // So 'hideWithDefaults' and 'filterRace' conflict logically if 'filterRace' is anything other than 'All'.
    // If I select 'Zerg', I see only players with default=Zerg. 'Hide with defaults' would hide them all.
    // So if filterRace is set, we should probably ignore hideWithDefaults or disable it.
    if (hideWithDefaults && filterRace === 'All') {
      result = result.filter(p => !defaults[p]);
    }

    return result;
  }, [players, searchTerm, hideWithDefaults, defaults, filterRace]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Player Manager</h1>
          <p className="text-gray-600 mt-1">
            Set default races for players ({players.length} total players)
          </p>
        </div>
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
              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
                <div className="flex-1">
                  <input
                    type="text"
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-4 flex-wrap">
                  <select
                    value={filterRace || 'All'}
                    onChange={(e) => setFilterRace((e.target.value as Race | 'All'))}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="All">All Races</option>
                    {RACES.map((race) => (
                      <option key={race} value={race}>
                        {race}
                      </option>
                    ))}
                  </select>

                  <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hideWithDefaults}
                      onChange={(e) => setHideWithDefaults(e.target.checked)}
                      disabled={filterRace !== 'All'}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                    <span className={filterRace !== 'All' ? 'text-gray-400' : ''}>Hide players with defaults</span>
                  </label>
                  <div className="text-sm text-gray-600 whitespace-nowrap">
                    Showing {filtered.length} of {players.length}
                  </div>
                </div>
              </div>

              {filtered.length > 0 && (
                <div className="flex items-center gap-2 pt-4 border-t border-gray-200 overflow-x-auto">
                  <span className="text-sm text-gray-700 whitespace-nowrap">Bulk set for filtered players:</span>
                  {RACES.map((race) => (
                    <button
                      key={race}
                      onClick={() => handleBulkSet(race)}
                      className="px-3 py-1 text-sm bg-gray-100 text-gray-700 rounded hover:bg-gray-200 whitespace-nowrap"
                    >
                      Set {race}
                    </button>
                  ))}
                  <button
                    onClick={handleClearAll}
                    className="px-3 py-1 text-sm bg-red-100 text-red-700 rounded hover:bg-red-200 ml-auto whitespace-nowrap"
                  >
                    Clear All Defaults
                  </button>
                </div>
              )}

              <div className="pt-4 mt-4 border-t border-gray-200 space-y-3">
                <div>
                  <h2 className="text-sm font-semibold text-gray-900">Rename player</h2>
                  <p className="text-xs text-gray-600 mt-1">
                    Use this when a player changed nickname or has a typo/case mismatch.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    value={renameFrom}
                    onChange={(e) => setRenameFrom(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {players.map((player) => (
                      <option key={player} value={player}>
                        {player}
                      </option>
                    ))}
                  </select>

                  <input
                    type="text"
                    value={renameTo}
                    onChange={(e) => setRenameTo(e.target.value)}
                    placeholder="New player name"
                    className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />

                  <button
                    onClick={handleRenamePlayer}
                    disabled={isRenaming || !renameFrom || !renameTo.trim()}
                    className="px-4 py-2 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isRenaming ? 'Renaming...' : 'Rename Player'}
                  </button>
                </div>

                {renameFeedback && (
                  <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md px-3 py-2">
                    {renameFeedback}
                  </div>
                )}

                {renameError && (
                  <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
                    {renameError}
                  </div>
                )}

                <div>
                  <div className="text-xs font-medium text-gray-700 mb-2">
                    Auto-detected similar names ({similarNamePairs.length})
                  </div>
                  {similarNamePairs.length === 0 ? (
                    <div className="text-xs text-gray-500">No obvious duplicates detected.</div>
                  ) : (
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {similarNamePairs.map((pair) => (
                        <div
                          key={`${pair.nameA}-${pair.nameB}`}
                          className="flex items-center justify-between gap-3 text-xs border border-amber-200 bg-amber-50 rounded-md px-3 py-2"
                        >
                          <span className="text-gray-700">{pair.nameA} ↔ {pair.nameB}</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => prefillRenameFromSuggestion(pair.nameA, pair.nameB)}
                              className="text-blue-700 hover:text-blue-900 underline"
                            >
                              Use {pair.nameA} → {pair.nameB}
                            </button>
                            <button
                              onClick={() => prefillRenameFromSuggestion(pair.nameB, pair.nameA)}
                              className="text-blue-700 hover:text-blue-900 underline"
                            >
                              Use {pair.nameB} → {pair.nameA}
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
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
