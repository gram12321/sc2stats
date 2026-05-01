import { Fragment, useEffect, useMemo, useState } from 'react';
import { Loader2, ArrowLeft, Map, Trophy, BarChart3, Calendar } from 'lucide-react';
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Tournament appearances */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Trophy className="h-5 w-5 text-primary" />
              Tournament Appearances
            </CardTitle>
            <CardDescription>Tournaments where this map was in the pool.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tournament</TableHead>
                    <TableHead className="text-right w-20">Plays</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.tournaments.map((t) => (
                    <TableRow key={t.slug ?? t.name}>
                      <TableCell className="text-sm">
                        <div
                          className={t.slug && onNavigateToTournament ? 'font-medium text-primary cursor-pointer hover:underline' : 'font-medium'}
                          onClick={() => t.slug && onNavigateToTournament?.(t.slug)}
                        >
                          {formatTournamentName(t.name)}
                        </div>
                        {t.date && (
                          <div className="text-xs text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {t.date}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {t.plays > 0
                          ? <Badge variant="secondary">{t.plays}</Badge>
                          : <span className="text-muted-foreground text-xs">—</span>
                        }
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* Match history */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <BarChart3 className="h-5 w-5 text-primary" />
              Game History
            </CardTitle>
            <CardDescription>
              Recorded games played on this map ({data.matchHistory.length} total{filteredHistory.length !== data.matchHistory.length ? `, ${filteredHistory.length} shown` : ''}).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-2">
              <Select value={historyPlayer} onValueChange={setHistoryPlayer}>
                <SelectTrigger className="flex-1">
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
                <SelectTrigger className="sm:w-56">
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
                    {filteredHistory.map((entry, i) => {
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
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
