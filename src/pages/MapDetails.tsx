import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2, ArrowLeft, Map, Trophy, BarChart3, BarChart2, Swords, ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { RaceBadge } from '../components/ui/RaceBadge';
import { CountryFlag } from '../components/ui/CountryFlag';
import { formatTournamentName } from '../lib/display';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { getPlayerCountries } from '../lib/playerCountries';
import { getRaceAbbr } from '../lib/utils';
import { Race } from '../types/tournament';

interface TournamentAppearance {
  name: string;
  slug: string | null;
  date: string | null;
  plays: number;
}

interface MapMatchEntry {
  tournamentName: string;
  tournamentSlug: string | null;
  tournamentDate: string | null;
  matchId: string | null;
  round: string | null;
  team1Player1: string | null;
  team1Player2: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  team1Score: number | null;
  team2Score: number | null;
  gameIndex: number;
  totalGames: number;
  winner: number | null;
}

interface MapDetailsData {
  name: string;
  fullName: string;
  totalPlays: number;
  eligibleMatches: number;
  pickRate: number | null;
  tournamentCount: number;
  tournaments: TournamentAppearance[];
  matchHistory: MapMatchEntry[];
}

interface MatchDetail {
  matchId: string | null;
  round: string | null;
  team1Player1: string | null;
  team1Player2: string | null;
  team2Player1: string | null;
  team2Player2: string | null;
  team1Score: number | null;
  team2Score: number | null;
  games: { gameIndex: number; map: string | null; winner: number | null }[];
}

interface MapDetailsProps {
  mapName: string;
  onBack?: () => void;
  onNavigateToPlayer?: (name: string) => void;
  onNavigateToTeam?: (p1: string, p2: string) => void;
  onNavigateToTournament?: (slug: string) => void;
}

function formatPercent(value: number) {
  return `${value.toFixed(1)}%`;
}

function liquipediaImageUrl(mapFullName: string) {
  // Liquipedia File: image redirect — works for most SC2 maps
  const slug = mapFullName.replace(/\s+/g, '_');
  return `https://liquipedia.net/starcraft2/Special:Redirect/file/${encodeURIComponent(slug)}.jpg`;
}

function liquipediaMapUrl(mapFullName: string) {
  const slug = mapFullName.replace(/\s+/g, '_');
  return `https://liquipedia.net/starcraft2/${slug}`;
}

export function MapDetails({ mapName, onBack, onNavigateToPlayer, onNavigateToTeam, onNavigateToTournament }: MapDetailsProps) {
  const [data, setData] = useState<MapDetailsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [imgFailed, setImgFailed] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState('all');
  const [historyTournament, setHistoryTournament] = useState('all');
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [playerCountries, setPlayerCountries] = useState<Record<string, string>>({});
  const [expandedMatches, setExpandedMatches] = useState<Set<string>>(new Set());
  const [matchDetailCache, setMatchDetailCache] = useState<Record<string, MatchDetail | null>>({});
  const [matchDetailLoading, setMatchDetailLoading] = useState<Set<string>>(new Set());
  const [hideMirror, setHideMirror] = useState(false);
  const [showAllHistory, setShowAllHistory] = useState(false);
  const [showAllTournaments, setShowAllTournaments] = useState(false);
  const [comboSort, setComboSort] = useState<{ col: 'total' | 'winRate'; dir: 'asc' | 'desc' }>({ col: 'total', dir: 'desc' });
  const [h2hSort, setH2hSort] = useState<{ col: 'total' | 'c1WinRate'; dir: 'asc' | 'desc' }>({ col: 'total', dir: 'desc' });

  useEffect(() => {
    getPlayerDefaults().then(setPlayerRaces).catch(() => {});
    getPlayerCountries().then(setPlayerCountries).catch(() => {});
  }, []);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setImgFailed(false);
    setHistoryPlayer('all');
    setHistoryTournament('all');
    setExpandedMatches(new Set());
    setMatchDetailCache({});
    setMatchDetailLoading(new Set());
    setShowAllHistory(false);
    setShowAllTournaments(false);
    fetch(`/api/map-details/${encodeURIComponent(mapName)}`)
      .then(r => {
        if (!r.ok) throw new Error('Failed to load map details');
        return r.json();
      })
      .then(setData)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load map details'))
      .finally(() => setIsLoading(false));
  }, [mapName]);

  const tournamentOptions = useMemo(() => {
    const seen = new Set<string>();
    return (data?.matchHistory ?? [])
      .map(e => e.tournamentName)
      .filter(n => { if (seen.has(n)) return false; seen.add(n); return true; })
      .sort();
  }, [data?.matchHistory]);

  const playerOptions = useMemo(() => {
    const seen = new Set<string>();
    for (const e of (data?.matchHistory ?? [])) {
      for (const p of [e.team1Player1, e.team1Player2, e.team2Player1, e.team2Player2]) {
        if (p) seen.add(p);
      }
    }
    return Array.from(seen).sort();
  }, [data?.matchHistory]);

  const filteredHistory = useMemo(() => {
    if (!data) return [];
    return data.matchHistory.filter(e => {
      if (historyTournament !== 'all' && e.tournamentName !== historyTournament) return false;
      if (historyPlayer !== 'all') {
        const players = [e.team1Player1, e.team1Player2, e.team2Player1, e.team2Player2];
        if (!players.includes(historyPlayer)) return false;
      }
      return true;
    });
  }, [data, historyPlayer, historyTournament]);

  function isMirrorCombo(races: Race[]): boolean {
    const abbrs = races.map(r => getRaceAbbr(r));
    return abbrs.length === 2 && abbrs[0] === abbrs[1];
  }

  const raceCompositionStats = useMemo(() => {
    const stats: Record<string, { races: Race[]; wins: number; losses: number }> = {};
    for (const entry of data?.matchHistory ?? []) {
      if (entry.winner === null) continue;
      const team1Won = entry.winner === 1;
      const addTeam = (p1: string | null, p2: string | null, won: boolean) => {
        const races = [p1, p2]
          .filter((player): player is string => Boolean(player))
          .map(player => playerRaces[player])
          .filter((race): race is Race => Boolean(race));
        const sorted = [...races].sort((a, b) => getRaceAbbr(a).localeCompare(getRaceAbbr(b)));
        const key = sorted.map(race => getRaceAbbr(race)).join('');
        if (!key) return;
        const current = stats[key] ?? { races: sorted, wins: 0, losses: 0 };
        if (won) current.wins += 1;
        else current.losses += 1;
        stats[key] = current;
      };
      addTeam(entry.team1Player1, entry.team1Player2, team1Won);
      addTeam(entry.team2Player1, entry.team2Player2, !team1Won);
    }
    return Object.values(stats)
      .map(record => ({
        races: record.races,
        wins: record.wins,
        losses: record.losses,
        total: record.wins + record.losses,
        winRate: (record.wins / (record.wins + record.losses)) * 100,
      }))
      .filter(row => !hideMirror || !isMirrorCombo(row.races))
      .sort((a, b) => {
        const mul = comboSort.dir === 'asc' ? 1 : -1;
        return (a[comboSort.col] - b[comboSort.col]) * mul;
      });
  }, [data?.matchHistory, playerRaces, hideMirror, comboSort]);

  const comboMatchups = useMemo(() => {
    const stats: Record<string, { combo1Key: string; combo2Key: string; combo1Races: Race[]; combo2Races: Race[]; combo1Wins: number; combo2Wins: number }> = {};
    for (const entry of data?.matchHistory ?? []) {
      if (entry.winner === null) continue;
      const team1Won = entry.winner === 1;
      const getCombo = (p1: string | null, p2: string | null): { key: string; races: Race[] } | null => {
        const races = [p1, p2]
          .filter((p): p is string => Boolean(p))
          .map(p => playerRaces[p])
          .filter((r): r is Race => Boolean(r));
        const sorted = [...races].sort((a, b) => getRaceAbbr(a).localeCompare(getRaceAbbr(b)));
        const key = sorted.map(r => getRaceAbbr(r)).join('');
        return key ? { key, races: sorted } : null;
      };
      const c1 = getCombo(entry.team1Player1, entry.team1Player2);
      const c2 = getCombo(entry.team2Player1, entry.team2Player2);
      if (!c1 || !c2) continue;
      // Skip same-combo matchups – wins would be arbitrary (team1 always "combo1")
      if (c1.key === c2.key) continue;
      const [keyCombo1, keyCombo2, races1, races2] = c1.key <= c2.key
        ? [c1.key, c2.key, c1.races, c2.races]
        : [c2.key, c1.key, c2.races, c1.races];
      const key = `${keyCombo1}|${keyCombo2}`;
      const current = stats[key] ?? { combo1Key: keyCombo1, combo2Key: keyCombo2, combo1Races: races1, combo2Races: races2, combo1Wins: 0, combo2Wins: 0 };
      if (c1.key === keyCombo1) {
        if (team1Won) current.combo1Wins += 1;
        else current.combo2Wins += 1;
      } else {
        if (team1Won) current.combo2Wins += 1;
        else current.combo1Wins += 1;
      }
      stats[key] = current;
    }
    return Object.values(stats)
      .map(s => ({
        ...s,
        total: s.combo1Wins + s.combo2Wins,
        c1WinRate: s.combo1Wins + s.combo2Wins > 0 ? (s.combo1Wins / (s.combo1Wins + s.combo2Wins)) * 100 : 50,
      }))
      .filter(row => {
        if (!hideMirror) return true;
        return !isMirrorCombo(row.combo1Races) && !isMirrorCombo(row.combo2Races);
      })
      .sort((a, b) => {
        const mul = h2hSort.dir === 'asc' ? 1 : -1;
        return (a[h2hSort.col] - b[h2hSort.col]) * mul;
      });
  }, [data?.matchHistory, playerRaces, hideMirror, h2hSort]);

  function toggleMatch(tournamentSlug: string, matchId: string) {
    const key = `${tournamentSlug}/${matchId}`;
    setExpandedMatches(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
        if (!(key in matchDetailCache) && !matchDetailLoading.has(key)) {
          setMatchDetailLoading(prev2 => new Set(prev2).add(key));
          fetch(`/api/match-detail/${encodeURIComponent(tournamentSlug)}/${encodeURIComponent(matchId)}`)
            .then(r => r.ok ? r.json() : null)
            .then((detail: MatchDetail | null) => {
              setMatchDetailCache(prev2 => ({ ...prev2, [key]: detail }));
            })
            .catch(() => setMatchDetailCache(prev2 => ({ ...prev2, [key]: null })))
            .finally(() => setMatchDetailLoading(prev2 => { const s = new Set(prev2); s.delete(key); return s; }));
        }
      }
      return next;
    });
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
        <p className="text-muted-foreground">Loading map details...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <Card className="border-destructive/50 bg-destructive/10">
        <CardContent className="pt-6">
          <div className="flex flex-col items-center text-center space-y-2">
            <p className="text-destructive font-semibold">{error || 'Map details unavailable'}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const imgUrl = liquipediaImageUrl(data.fullName);
  const mapPageUrl = liquipediaMapUrl(data.fullName);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col gap-4">
        {onBack && (
          <Button variant="ghost" size="sm" onClick={onBack} className="w-fit -ml-2 text-muted-foreground">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Map Data
          </Button>
        )}
        <div className="flex flex-col sm:flex-row sm:items-start gap-6">
          {/* Map Image */}
          <div className="flex-shrink-0">
            {!imgFailed ? (
              <a href={mapPageUrl} target="_blank" rel="noopener noreferrer">
                <img
                  src={imgUrl}
                  alt={data.fullName}
                  className="w-48 h-32 object-cover rounded-lg border border-border shadow-sm"
                  onError={() => setImgFailed(true)}
                />
              </a>
            ) : (
              <div className="w-48 h-32 rounded-lg border border-border bg-muted flex items-center justify-center">
                <Map className="h-10 w-10 text-muted-foreground/40" />
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2">
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <Map className="h-8 w-8 text-primary" />
              {data.fullName}
            </h1>
            <p className="text-muted-foreground text-sm">
              In pool for {data.tournamentCount} tournament{data.tournamentCount !== 1 ? 's' : ''}.
              {' '}
              <a
                href={mapPageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View on Liquipedia ↗
              </a>
            </p>
          </div>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Times Played</CardDescription>
            <CardTitle className="text-3xl">{data.totalPlays}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Recorded non-early-round games on this map.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Eligible Matches</CardDescription>
            <CardTitle className="text-3xl">{data.eligibleMatches}</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Recorded non-early matches where this map was in the pool.
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pick Rate</CardDescription>
            <CardTitle className="text-3xl">
              {data.pickRate !== null ? formatPercent(data.pickRate) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Share of eligible matches where this map was chosen.
          </CardContent>
        </Card>
      </div>

      {/* Race Statistics */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Race Combo Win Rates */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <BarChart2 className="h-5 w-5 text-primary" />
                  Race Combo Win Rates
                </CardTitle>
                <CardDescription className="mt-1">Win rate per race composition on this map.</CardDescription>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideMirror}
                  onChange={e => setHideMirror(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Hide mirrors
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {raceCompositionStats.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No race data available yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Composition</TableHead>
                      <TableHead
                        className="text-right w-16 cursor-pointer select-none"
                        onClick={() => setComboSort(s => ({ col: 'total', dir: s.col === 'total' ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Games
                          {comboSort.col === 'total' ? (comboSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                        </span>
                      </TableHead>
                      <TableHead className="text-right w-12">W</TableHead>
                      <TableHead className="text-right w-12">L</TableHead>
                      <TableHead
                        className="text-right w-20 cursor-pointer select-none"
                        onClick={() => setComboSort(s => ({ col: 'winRate', dir: s.col === 'winRate' ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Win%
                          {comboSort.col === 'winRate' ? (comboSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {raceCompositionStats.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {row.races.map((race, j) => (
                              <RaceBadge key={j} race={race} className="h-5 px-1.5 text-xs shrink-0" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.total}</TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">{row.wins}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.losses}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.winRate >= 55 ? 'default' : row.winRate <= 45 ? 'destructive' : 'secondary'}>
                            {formatPercent(row.winRate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Combo Head-to-Head */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Swords className="h-5 w-5 text-primary" />
                  Combo Head-to-Head
                </CardTitle>
                <CardDescription className="mt-1">Wins when specific race combos face each other on this map.</CardDescription>
              </div>
              <label className="flex items-center gap-1.5 text-xs text-muted-foreground whitespace-nowrap pt-1 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hideMirror}
                  onChange={e => setHideMirror(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border"
                />
                Hide mirrors
              </label>
            </div>
          </CardHeader>
          <CardContent>
            {comboMatchups.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No matchup data available yet.</p>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Matchup</TableHead>
                      <TableHead
                        className="text-right w-16 cursor-pointer select-none"
                        onClick={() => setH2hSort(s => ({ col: 'total', dir: s.col === 'total' ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Games
                          {h2hSort.col === 'total' ? (h2hSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                        </span>
                      </TableHead>
                      <TableHead className="text-right w-20">Score</TableHead>
                      <TableHead
                        className="text-right w-20 cursor-pointer select-none"
                        onClick={() => setH2hSort(s => ({ col: 'c1WinRate', dir: s.col === 'c1WinRate' ? (s.dir === 'desc' ? 'asc' : 'desc') : 'desc' }))}
                      >
                        <span className="inline-flex items-center justify-end gap-1">
                          Win%
                          {h2hSort.col === 'c1WinRate' ? (h2hSort.dir === 'desc' ? <ArrowDown className="h-3 w-3" /> : <ArrowUp className="h-3 w-3" />) : <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />}
                        </span>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {comboMatchups.map((row, i) => (
                      <TableRow key={i}>
                        <TableCell>
                          <div className="flex items-center gap-1 flex-wrap">
                            {row.combo1Races.map((race, j) => (
                              <RaceBadge key={j} race={race} className="h-5 px-1.5 text-xs shrink-0" />
                            ))}
                            <span className="text-muted-foreground text-xs mx-0.5">vs</span>
                            {row.combo2Races.map((race, j) => (
                              <RaceBadge key={j} race={race} className="h-5 px-1.5 text-xs shrink-0" />
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-muted-foreground">{row.total}</TableCell>
                        <TableCell className="text-right">
                          <span className="text-sm font-medium tabular-nums">
                            <span className={row.c1WinRate > 50 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>{row.combo1Wins}</span>
                            <span className="text-muted-foreground mx-1">–</span>
                            <span className={row.c1WinRate < 50 ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}>{row.combo2Wins}</span>
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={row.c1WinRate >= 55 ? 'default' : row.c1WinRate <= 45 ? 'destructive' : 'secondary'}>
                            {formatPercent(row.c1WinRate)}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tournament Appearances + Game History */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tournament appearances */}
        <Card className="flex flex-col">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Trophy className="h-5 w-5 text-primary" />
                Tournament Appearances
              </CardTitle>
              <span className="text-xs text-muted-foreground">{data.tournamentCount} tournament{data.tournamentCount !== 1 ? 's' : ''}</span>
            </div>
          </CardHeader>
          <CardContent className="flex-1">
            <div className="rounded-md border divide-y">
              {(showAllTournaments ? data.tournaments : data.tournaments.slice(0, 6)).map((t) => (
                <div key={t.slug ?? t.name} className="flex items-center justify-between gap-2 py-2 px-3">
                  <div className="min-w-0">
                    <div
                      className={`text-sm truncate ${t.slug && onNavigateToTournament ? 'font-medium text-primary cursor-pointer hover:underline' : 'font-medium'}`}
                      onClick={() => t.slug && onNavigateToTournament?.(t.slug)}
                    >
                      {formatTournamentName(t.name)}
                    </div>
                    {t.date && (
                      <div className="text-xs text-muted-foreground">{t.date}</div>
                    )}
                  </div>
                  <div className="shrink-0">
                    {t.plays > 0
                      ? <Badge variant="secondary">{t.plays}</Badge>
                      : <span className="text-muted-foreground text-xs">—</span>
                    }
                  </div>
                </div>
              ))}
            </div>
            {data.tournaments.length > 6 && (
              <Button
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-muted-foreground"
                onClick={() => setShowAllTournaments(v => !v)}
              >
                {showAllTournaments ? 'Show less' : `Show all ${data.tournaments.length} tournaments`}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Game History */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Game History
            </CardTitle>
            <CardDescription>
              {data.matchHistory.length} game{data.matchHistory.length !== 1 ? 's' : ''} recorded{filteredHistory.length !== data.matchHistory.length ? ` · ${filteredHistory.length} shown` : ''}.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 space-y-4">
            <div className="flex flex-col gap-2">
              <Select value={historyPlayer} onValueChange={setHistoryPlayer}>
                <SelectTrigger>
                  <SelectValue placeholder="All players" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All players</SelectItem>
                  {playerOptions.map(p => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={historyTournament} onValueChange={setHistoryTournament}>
                <SelectTrigger>
                  <SelectValue placeholder="All tournaments" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All tournaments</SelectItem>
                  {tournamentOptions.map(t => (
                    <SelectItem key={t} value={t}>{formatTournamentName(t)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          {filteredHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {data.matchHistory.length === 0 ? 'No recorded games yet.' : 'No games match the current filters.'}
            </p>
          ) : (
            <>
            <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-36">Event</TableHead>
                      <TableHead>Match</TableHead>
                      <TableHead className="text-center w-20">Result</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {(showAllHistory ? filteredHistory : filteredHistory.slice(0, 5)).map((entry, i) => {
                      const team1Won = entry.winner === 1;
                      const team2Won = entry.winner === 2;

                      const renderPlayer = (name: string | null, won: boolean) => {
                        if (!name) return null;
                        return (
                          <span className="inline-flex items-center gap-1 min-w-0">
                            <CountryFlag country={playerCountries[name]} />
                            <RaceBadge race={playerRaces[name]} className="h-4 px-1 text-[10px] shrink-0" />
                            <span
                              className={`truncate ${won ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${onNavigateToPlayer ? 'cursor-pointer hover:underline hover:text-primary' : ''}`}
                              onClick={() => onNavigateToPlayer?.(name)}
                            >
                              {name}
                            </span>
                          </span>
                        );
                      };

                      const p1 = entry.team1Player1;
                      const p2 = entry.team1Player2;
                      const p3 = entry.team2Player1;
                      const p4 = entry.team2Player2;

                      const canNavToMatch = !!(entry.tournamentSlug && entry.matchId);
                      const matchKey = canNavToMatch ? `${entry.tournamentSlug}/${entry.matchId}` : null;
                      const isExpanded = matchKey ? expandedMatches.has(matchKey) : false;
                      const matchDetail = matchKey ? matchDetailCache[matchKey] : undefined;
                      const isLoadingDetail = matchKey ? matchDetailLoading.has(matchKey) : false;

                      return (
                        <Fragment key={i}>
                          <TableRow className={isExpanded ? 'bg-muted/10' : undefined}>
                            <TableCell className="text-xs align-top">
                              <div className="flex flex-col gap-0.5">
                                <span
                                  className={entry.tournamentSlug && onNavigateToTournament ? 'text-primary cursor-pointer hover:underline font-medium' : 'text-muted-foreground font-medium'}
                                  onClick={() => entry.tournamentSlug && onNavigateToTournament?.(entry.tournamentSlug)}
                                >
                                  {formatTournamentName(entry.tournamentName)}
                                </span>
                                <span className="text-muted-foreground">
                                  {[entry.round, `G${entry.gameIndex}/${entry.totalGames}`].filter(Boolean).join(' · ')}
                                </span>
                              </div>
                            </TableCell>
                            <TableCell className="text-sm p-0">
                              <div className="h-full flex flex-col min-w-0">
                                <div className="flex-1 flex flex-col gap-0.5 p-2 pb-1 min-w-0">
                                  {renderPlayer(p1, team1Won)}
                                  {renderPlayer(p2, team1Won)}
                                  {onNavigateToTeam && p1 && p2 && (
                                    <button
                                      className="text-[10px] text-muted-foreground hover:text-primary hover:underline text-left"
                                      onClick={() => onNavigateToTeam(p1, p2)}
                                    >
                                      Team page →
                                    </button>
                                  )}
                                </div>
                                <div className="flex-1 flex flex-col gap-0.5 p-2 pt-1 border-t border-border/50 min-w-0">
                                  {renderPlayer(p3, team2Won)}
                                  {renderPlayer(p4, team2Won)}
                                  {onNavigateToTeam && p3 && p4 && (
                                    <button
                                      className="text-[10px] text-muted-foreground hover:text-primary hover:underline text-left"
                                      onClick={() => onNavigateToTeam(p3, p4)}
                                    >
                                      Team page →
                                    </button>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="p-0 w-20">
                              <div
                                className={`h-full flex flex-col text-sm ${canNavToMatch ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}`}
                                onClick={() => canNavToMatch && toggleMatch(entry.tournamentSlug!, entry.matchId!)}
                              >
                                <div className="flex-1 flex items-center justify-center gap-1 px-2">
                                  <span className={`font-semibold ${team1Won ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    {entry.winner !== null ? (team1Won ? 'W' : 'L') : '—'}
                                  </span>
                                  {entry.team1Score !== null && (
                                    <span className="text-xs text-muted-foreground">{entry.team1Score}</span>
                                  )}
                                </div>
                                <div className="flex-1 flex items-center justify-center gap-1 px-2 border-t border-border/50">
                                  <span className={`font-semibold ${team2Won ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                    {entry.winner !== null ? (team2Won ? 'W' : 'L') : '—'}
                                  </span>
                                  {entry.team2Score !== null && (
                                    <span className="text-xs text-muted-foreground">{entry.team2Score}</span>
                                  )}
                                </div>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && (
                            <TableRow className="bg-muted/10 hover:bg-muted/10">
                              <TableCell colSpan={3} className="py-3 px-4">
                                {isLoadingDetail ? (
                                  <div className="flex items-center justify-center gap-2 py-2">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span className="text-xs text-muted-foreground">Loading match details...</span>
                                  </div>
                                ) : !matchDetail ? (
                                  <p className="text-xs text-muted-foreground text-center py-1">Match details unavailable.</p>
                                ) : (
                                  <div className="space-y-1">
                                    <p className="text-xs font-medium text-muted-foreground mb-2">
                                      {[matchDetail.team1Player1, matchDetail.team1Player2].filter(Boolean).join(' & ')} vs {[matchDetail.team2Player1, matchDetail.team2Player2].filter(Boolean).join(' & ')}
                                      {matchDetail.team1Score !== null && matchDetail.team2Score !== null && (
                                        <span className="ml-2 text-foreground font-semibold">{matchDetail.team1Score}–{matchDetail.team2Score}</span>
                                      )}
                                    </p>
                                    {matchDetail.games.map(g => {
                                      const gT1Won = g.winner === 1;
                                      const gT2Won = g.winner === 2;
                                      return (
                                        <div key={g.gameIndex} className="flex items-center gap-3 text-xs py-0.5">
                                          <span className="text-muted-foreground w-5 shrink-0">G{g.gameIndex}</span>
                                          <span className={`w-3 font-semibold shrink-0 ${gT1Won ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                            {g.winner !== null ? (gT1Won ? 'W' : 'L') : '—'}
                                          </span>
                                          <span className="flex-1 text-center font-medium">{g.map ?? '—'}</span>
                                          <span className={`w-3 font-semibold shrink-0 text-right ${gT2Won ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                                            {g.winner !== null ? (gT2Won ? 'W' : 'L') : '—'}
                                          </span>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </TableCell>
                            </TableRow>
                          )}
                        </Fragment>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredHistory.length > 5 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-muted-foreground"
                  onClick={() => setShowAllHistory(v => !v)}
                >
                  {showAllHistory ? `Show less` : `Show all ${filteredHistory.length} games`}
                </Button>
              )}
            </>
          )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
