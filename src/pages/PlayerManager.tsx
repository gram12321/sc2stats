import { useState, useEffect, useMemo } from 'react';
import { Race } from '../types/tournament';
import { getPlayerDefaults, setPlayerDefault, clearPlayerDefaults, renamePlayerName } from '../lib/playerDefaults';
import { getPlayerCountries, setPlayerCountry } from '../lib/playerCountries';
import { normalizeCountryCode } from '../lib/country';
import { CountryFlag } from '../components/ui/CountryFlag';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';

type PlayerFilter = 'all' | 'missing-any' | 'missing-race' | 'missing-flag' | 'complete';

type PlayerRow = {
  name: string;
  race: Race | null;
  country: string | null;
  matches: number;
  hasRace: boolean;
  hasFlag: boolean;
};

type SortColumn = 'name' | 'matches' | 'race' | 'flag' | 'missing';
type SortDirection = 'asc' | 'desc';

const RACES: Exclude<Race, null>[] = ['Terran', 'Zerg', 'Protoss', 'Random'];
const COMMON_COUNTRY_CODES = [
  'DK', 'NL', 'DE', 'SE', 'NO', 'FI', 'FR', 'ES', 'IT', 'PL', 'CZ', 'UA',
  'GB', 'IE', 'AT', 'CH', 'BE', 'PT', 'HU', 'RO', 'RU',
  'US', 'CA', 'MX', 'BR', 'AR', 'CL', 'PE',
  'KR', 'CN', 'TW', 'JP', 'AU', 'NZ'
] as const;

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
  const [matchCounts, setMatchCounts] = useState<Record<string, number>>({});
  const [defaults, setDefaults] = useState<Record<string, Race>>({});
  const [countries, setCountries] = useState<Record<string, string>>({});

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [filterRace, setFilterRace] = useState<Race | 'All'>('All');
  const [playerFilter, setPlayerFilter] = useState<PlayerFilter>('missing-any');
  const [sortColumn, setSortColumn] = useState<SortColumn>('missing');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const [renameFrom, setRenameFrom] = useState('');
  const [renameTo, setRenameTo] = useState('');
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameFeedback, setRenameFeedback] = useState<string | null>(null);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [countryDrafts, setCountryDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPlayers();
    loadMatchCounts();
    loadDefaults();
    loadCountries();
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
      setError(null);
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

  const loadMatchCounts = async () => {
    try {
      const response = await fetch('/api/player-match-counts');
      if (!response.ok) throw new Error('Failed to load player match counts');
      const data = await response.json();
      setMatchCounts(data || {});
    } catch (err) {
      console.error('Error loading player match counts:', err);
      setMatchCounts({});
    }
  };

  const loadCountries = async () => {
    try {
      const loaded = await getPlayerCountries();
      setCountries(loaded);
    } catch (err) {
      console.error('Error loading countries:', err);
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
      console.error('Error saving race default:', err);
      loadDefaults();
    }
  };

  const handleCountryChange = async (playerName: string, countryInput: string) => {
    const normalized = normalizeCountryCode(countryInput);
    const newCountries = { ...countries };

    if (!normalized) {
      delete newCountries[playerName];
    } else {
      newCountries[playerName] = normalized;
    }

    setCountries(newCountries);

    try {
      await setPlayerCountry(playerName, normalized);
    } catch (err) {
      console.error('Error saving player country:', err);
      loadCountries();
    }
  };

  const handleCountryDraftChange = (playerName: string, value: string) => {
    setCountryDrafts((prev) => ({
      ...prev,
      [playerName]: value.toUpperCase().slice(0, 2)
    }));
  };

  const commitCountryDraft = async (playerName: string) => {
    const draft = countryDrafts[playerName] ?? countries[playerName] ?? '';
    await handleCountryChange(playerName, draft);
  };

  const rows = useMemo<PlayerRow[]>(() => {
    return players.map((name) => {
      const race = defaults[name] ?? null;
      const country = normalizeCountryCode(countries[name]);
      return {
        name,
        race,
        country,
        matches: matchCounts[name] || 0,
        hasRace: !!race,
        hasFlag: !!country
      };
    });
  }, [players, defaults, countries, matchCounts]);

  const countMissingRace = useMemo(() => rows.filter((r) => !r.hasRace).length, [rows]);
  const countMissingFlag = useMemo(() => rows.filter((r) => !r.hasFlag).length, [rows]);
  const countMissingAny = useMemo(() => rows.filter((r) => !r.hasRace || !r.hasFlag).length, [rows]);
  const countComplete = useMemo(() => rows.filter((r) => r.hasRace && r.hasFlag).length, [rows]);

  const filteredRows = useMemo(() => {
    let result = rows;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter((row) => row.name.toLowerCase().includes(term));
    }

    if (filterRace !== 'All') {
      result = result.filter((row) => row.race === filterRace);
    }

    switch (playerFilter) {
      case 'missing-race':
        result = result.filter((row) => !row.hasRace);
        break;
      case 'missing-flag':
        result = result.filter((row) => !row.hasFlag);
        break;
      case 'missing-any':
        result = result.filter((row) => !row.hasRace || !row.hasFlag);
        break;
      case 'complete':
        result = result.filter((row) => row.hasRace && row.hasFlag);
        break;
      default:
        break;
    }

    return [...result].sort((a, b) => {
      let comparison = 0;

      if (sortColumn === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortColumn === 'matches') {
        comparison = a.matches - b.matches;
      } else if (sortColumn === 'race') {
        comparison = (a.race || '').localeCompare(b.race || '');
      } else if (sortColumn === 'flag') {
        comparison = (a.country || '').localeCompare(b.country || '');
      } else if (sortColumn === 'missing') {
        const aMissing = (a.hasRace ? 0 : 1) + (a.hasFlag ? 0 : 1);
        const bMissing = (b.hasRace ? 0 : 1) + (b.hasFlag ? 0 : 1);
        comparison = aMissing - bMissing;
      }

      if (comparison === 0) {
        comparison = a.name.localeCompare(b.name);
      }

      return sortDirection === 'asc' ? comparison : -comparison;
    });
  }, [rows, searchTerm, filterRace, playerFilter, sortColumn, sortDirection]);

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setSortColumn(column);
    setSortDirection(column === 'name' ? 'asc' : 'desc');
  };

  const sortIndicator = (column: SortColumn) => {
    if (sortColumn !== column) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleBulkSetRace = async (race: Race) => {
    const targets = filteredRows.map((row) => row.name);
    if (targets.length === 0) return;

    const newDefaults = { ...defaults };
    targets.forEach((name) => {
      if (race === null) {
        delete newDefaults[name];
      } else {
        newDefaults[name] = race;
      }
    });

    setDefaults(newDefaults);

    try {
      await Promise.all(targets.map((name) => setPlayerDefault(name, race)));
    } catch (err) {
      console.error('Error saving bulk defaults:', err);
      loadDefaults();
    }
  };

  const handleClearAllRaces = async () => {
    if (!confirm('Clear all race defaults?')) return;

    try {
      await clearPlayerDefaults();
      setDefaults({});
    } catch (err) {
      console.error('Error clearing defaults:', err);
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
      await Promise.all([loadPlayers(), loadDefaults(), loadCountries()]);
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

  const statusButtonClass = (active: boolean) =>
    `px-2.5 py-1.5 text-xs rounded-md border transition-colors ${active
      ? 'bg-primary text-primary-foreground border-primary'
      : 'bg-card text-foreground border-border hover:bg-accent'}`;

  return (
    <div className="min-h-screen bg-transparent">
      <div className="max-w-7xl mx-auto p-4 space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Player Manager</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Manage player race defaults and nationality flags in one table.
          </p>
        </div>

        {isLoading ? (
          <div className="text-center py-16">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
            <p className="mt-4 text-gray-600 text-sm">Loading players...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800 text-sm">{error}</p>
            <button
              onClick={loadPlayers}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
              <div className="bg-card rounded-lg border border-border p-2.5">
                <div className="text-[11px] text-muted-foreground">Total</div>
                <div className="text-xl font-bold text-foreground">{players.length}</div>
              </div>
              <button className={statusButtonClass(playerFilter === 'missing-any')} onClick={() => setPlayerFilter('missing-any')}>
                Missing Any ({countMissingAny})
              </button>
              <button className={statusButtonClass(playerFilter === 'missing-race')} onClick={() => setPlayerFilter('missing-race')}>
                Missing Race ({countMissingRace})
              </button>
              <button className={statusButtonClass(playerFilter === 'missing-flag')} onClick={() => setPlayerFilter('missing-flag')}>
                Missing Flag ({countMissingFlag})
              </button>
              <button className={statusButtonClass(playerFilter === 'complete')} onClick={() => setPlayerFilter('complete')}>
                Complete ({countComplete})
              </button>
            </div>

            <Card className="border-border/60">
              <CardContent className="p-3 space-y-3">
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-2">
                <Input
                  type="text"
                  placeholder="Search player..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-sm"
                />

                <select
                  value={filterRace || 'All'}
                  onChange={(e) => setFilterRace(e.target.value as Race | 'All')}
                  className="h-8 px-2 border border-border rounded-md text-sm bg-background"
                >
                  <option value="All">All races</option>
                  {RACES.map((race) => (
                    <option key={race} value={race}>{race}</option>
                  ))}
                </select>

                <select
                  value={playerFilter}
                  onChange={(e) => setPlayerFilter(e.target.value as PlayerFilter)}
                  className="h-8 px-2 border border-border rounded-md text-sm bg-background"
                >
                  <option value="all">All players</option>
                  <option value="missing-any">Missing race or flag</option>
                  <option value="missing-race">Missing race only</option>
                  <option value="missing-flag">Missing flag only</option>
                  <option value="complete">Complete profile</option>
                </select>

                <div className="text-sm text-muted-foreground flex items-center">
                  Showing {filteredRows.length} of {players.length}
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-border">
                <span className="text-xs font-medium text-muted-foreground">Bulk race set (filtered):</span>
                {RACES.map((race) => (
                  <Button
                    key={race}
                    onClick={() => handleBulkSetRace(race)}
                    size="sm"
                    variant="outline"
                    className="h-7 px-2 text-xs"
                  >
                    {race}
                  </Button>
                ))}
                <Button
                  onClick={handleClearAllRaces}
                  size="sm"
                  variant="outline"
                  className="ml-auto h-7 px-2 text-xs"
                >
                  Clear All Race Defaults
                </Button>
              </div>

              <div className="text-xs text-muted-foreground border-t border-border pt-2">
                Country uses ISO 2-letter code (examples: `NL`, `DK`, `DE`, `ES`). Use the common flag dropdown or type a custom code.
              </div>
              </CardContent>
            </Card>

            <Card className="border-border/60">
              <CardHeader className="py-3">
                <CardTitle className="text-base">Players</CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                {filteredRows.length === 0 ? (
                  <div className="py-8 text-center text-sm text-muted-foreground">No players match current filters.</div>
                ) : (
                  <div className="max-h-[34rem] overflow-y-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="h-8 px-2 cursor-pointer" onClick={() => handleSort('name')}>Player{sortIndicator('name')}</TableHead>
                          <TableHead className="h-8 px-2 text-right cursor-pointer" onClick={() => handleSort('matches')}>Matches{sortIndicator('matches')}</TableHead>
                          <TableHead className="h-8 px-2 cursor-pointer" onClick={() => handleSort('race')}>Race{sortIndicator('race')}</TableHead>
                          <TableHead className="h-8 px-2 cursor-pointer" onClick={() => handleSort('flag')}>Country{sortIndicator('flag')}</TableHead>
                          <TableHead className="h-8 px-2 cursor-pointer" onClick={() => handleSort('missing')}>Missing{sortIndicator('missing')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredRows.map((row) => {
                          const missingRace = !row.hasRace;
                          const missingFlag = !row.hasFlag;

                          return (
                            <TableRow key={row.name}>
                              <TableCell className="p-2 text-sm font-medium">{row.name}</TableCell>
                              <TableCell className="p-2 text-sm text-right font-mono">{row.matches}</TableCell>
                              <TableCell className="p-2">
                                <select
                                  value={row.race || ''}
                                  onChange={(e) => handleRaceChange(row.name, (e.target.value || null) as Race)}
                                  className="h-8 w-full max-w-[11rem] px-2 border border-border rounded-md bg-background text-sm"
                                >
                                  <option value="">No default</option>
                                  {RACES.map((race) => (
                                    <option key={race} value={race}>{race}</option>
                                  ))}
                                </select>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex items-center gap-2">
                                  <select
                                    value={row.country && COMMON_COUNTRY_CODES.includes(row.country as (typeof COMMON_COUNTRY_CODES)[number]) ? row.country : ''}
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      if (!value) return;
                                      handleCountryDraftChange(row.name, value);
                                      handleCountryChange(row.name, value);
                                    }}
                                    className="h-8 w-24 px-2 border border-border rounded-md bg-background text-sm"
                                  >
                                    <option value="">Common</option>
                                    {COMMON_COUNTRY_CODES.map((code) => (
                                      <option key={code} value={code}>
                                        {code}
                                      </option>
                                    ))}
                                  </select>
                                  <Input
                                    value={countryDrafts[row.name] ?? row.country ?? ''}
                                    onChange={(e) => handleCountryDraftChange(row.name, e.target.value)}
                                    onBlur={() => commitCountryDraft(row.name)}
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        e.preventDefault();
                                        commitCountryDraft(row.name);
                                      }
                                    }}
                                    placeholder="ISO"
                                    maxLength={2}
                                    className="h-8 w-16 uppercase text-sm"
                                  />
                                  <CountryFlag country={row.country} className="text-foreground" />
                                </div>
                              </TableCell>
                              <TableCell className="p-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {missingRace && <Badge variant="secondary" className="text-[11px]">Race</Badge>}
                                  {missingFlag && <Badge variant="secondary" className="text-[11px]">Flag</Badge>}
                                  {!missingRace && !missingFlag && <Badge className="text-[11px]">Complete</Badge>}
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm space-y-3">
              <div>
                <h2 className="text-sm font-semibold text-gray-900">Rename player</h2>
                <p className="text-xs text-gray-600 mt-1">
                  Use this when a player changed nickname or has typo/case mismatch.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <select
                  value={renameFrom}
                  onChange={(e) => setRenameFrom(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {players.map((player) => (
                    <option key={player} value={player}>{player}</option>
                  ))}
                </select>

                <input
                  type="text"
                  value={renameTo}
                  onChange={(e) => setRenameTo(e.target.value)}
                  placeholder="New player name"
                  className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />

                <button
                  onClick={handleRenamePlayer}
                  disabled={isRenaming || !renameFrom || !renameTo.trim()}
                  className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
          </>
        )}
      </div>
    </div>
  );
}
