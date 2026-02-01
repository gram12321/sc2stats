import { useState, useEffect } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { RankingFilters } from '../components/RankingFilters';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { formatRankingPoints } from '../lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '../components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Trophy,
  Users,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Swords,
  Crown
} from 'lucide-react';
import { cn } from '../lib/utils';

interface PlayerRanking {
  name: string;
  matches: number;
  wins: number;
  losses: number;
  points: number;
  confidence?: number;
}

interface PlayerRankingsProps {
  onNavigateToPlayer?: (playerName: string) => void;
}

export function PlayerRankings({ onNavigateToPlayer }: PlayerRankingsProps) {
  const [rankings, setRankings] = useState<PlayerRanking[]>([]);
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [sortColumn, setSortColumn] = useState<keyof PlayerRanking | 'rank' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const {
    useSeededRankings,
    filterLowConfidence,
    mainCircuitOnly,
    seasons,
  } = useRankingSettings();

  useEffect(() => {
    loadRankings();
    loadPlayerRaces();
  }, [useSeededRankings, mainCircuitOnly, seasons]);

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const endpoint = useSeededRankings ? '/api/seeded-player-rankings' : '/api/player-rankings';
      const queryParams = new URLSearchParams();
      if (mainCircuitOnly) queryParams.append('mainCircuitOnly', 'true');
      if (seasons.length > 0) queryParams.append('seasons', seasons.join(','));

      const response = await fetch(`${endpoint}?${queryParams.toString()}`);
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

  const averageConfidence = rankings.length > 0
    ? rankings.reduce((sum, p) => sum + (p.confidence || 0), 0) / rankings.length
    : 0;
  const confidenceThreshold = (averageConfidence * 4) / 4;

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

    if (aValue === undefined || aValue === null) aValue = sortColumn === 'name' ? '' : 0;
    if (bValue === undefined || bValue === null) bValue = sortColumn === 'name' ? '' : 0;

    if (sortColumn === 'name') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    const comparison = (aValue as number) - (bValue as number);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const pointsSortedRankings = [...rankings].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.wins !== a.wins) return b.wins - a.wins;
    return a.name.localeCompare(b.name);
  });

  const rankedRankings = sortedRankings.map((player) => {
    const playerConfidence = player.confidence || 0;
    const meetsThreshold = playerConfidence >= confidenceThreshold;

    if (!filterLowConfidence && !meetsThreshold) {
      return { ...player, displayRank: null };
    }

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

  const getRaceBadgeColor = (race: Race | null | undefined) => {
    switch (race) {
      case 'Terran': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'Zerg': return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
      case 'Protoss': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      case 'Random': return 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const getRaceAbbr = (race: Race | null | undefined) => {
    if (!race) return '';
    return race.charAt(0);
  };

  const SortIcon = ({ column }: { column: keyof PlayerRanking | 'rank' }) => {
    if (sortColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Trophy className="h-8 w-8 text-primary" />
            Player Rankings
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            {useSeededRankings
              ? 'Performance tracking using a three-pass seeding system for maximum accuracy.'
              : 'Global rankings with dynamic confidence adjustments and biological matchmaking ratings.'}
          </p>
        </div>
        <RankingFilters
          showSeeded={true}
          showConfidence={true}
          showMainCircuit={true}
          confidenceThreshold={confidenceThreshold}
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Analyzing match telemetry...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-2">
              <p className="text-destructive font-semibold">{error}</p>
              <button
                onClick={loadRankings}
                className="text-sm underline hover:text-destructive/80"
              >
                Retry Connection
              </button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  {filterLowConfidence ? 'Active Players' : 'Total Players'}
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{rankedRankings.length}</div>
                {filterLowConfidence && (
                  <p className="text-xs text-muted-foreground mt-1">
                    of {rankings.length} tracked
                  </p>
                )}
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Matches</CardTitle>
                <Swords className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {Math.floor(rankedRankings.reduce((sum, p) => sum + p.matches, 0) / 2)}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Positive</CardTitle>
                <TrendingUp className="h-4 w-4 text-emerald-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-emerald-500">
                  {rankedRankings.filter(p => p.points > 0).length}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 backdrop-blur-sm hover:bg-card/80 transition-colors">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Net Negative</CardTitle>
                <TrendingDown className="h-4 w-4 text-rose-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-rose-500">
                  {rankedRankings.filter(p => p.points < 0).length}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="overflow-hidden border-border/50 shadow-xl bg-card/40 backdrop-blur-sm">
            <div className="p-4 border-b border-border/50">
              <div className="relative max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search player name..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9 bg-background/50 border-border/50 focus:bg-background transition-all"
                />
              </div>
            </div>

            <div className="rounded-md">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent border-border/50">
                    <TableHead className="w-[80px] cursor-pointer" onClick={() => handleSort('rank')}>
                      <div className="flex items-center">Rank<SortIcon column="rank" /></div>
                    </TableHead>
                    <TableHead className="cursor-pointer" onClick={() => handleSort('name')}>
                      <div className="flex items-center">Player<SortIcon column="name" /></div>
                    </TableHead>
                    <TableHead>Race</TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort('matches')}>
                      <div className="flex items-center justify-center">Matches<SortIcon column="matches" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort('wins')}>
                      <div className="flex items-center justify-center">Win<SortIcon column="wins" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort('losses')}>
                      <div className="flex items-center justify-center">Loss<SortIcon column="losses" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort('points')}>
                      <div className="flex items-center justify-center">Rating<SortIcon column="points" /></div>
                    </TableHead>
                    <TableHead className="text-center cursor-pointer" onClick={() => handleSort('confidence')}>
                      <div className="flex items-center justify-center">Conf.<SortIcon column="confidence" /></div>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rankedRankings.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-32 text-center">
                        <div className="flex flex-col items-center justify-center text-muted-foreground">
                          <Target className="h-8 w-8 mb-2 opacity-50" />
                          <p>No players found</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    rankedRankings.map((player) => {
                      const displayRank = player.displayRank;
                      const race = playerRaces[player.name];
                      const isPositive = player.points > 0;

                      return (
                        <TableRow key={player.name} className="hover:bg-muted/30 border-border/50">
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {displayRank ? (
                                <span className={cn(
                                  "flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold",
                                  displayRank === 1 ? "bg-yellow-500/20 text-yellow-600 dark:text-yellow-400" :
                                    displayRank === 2 ? "bg-slate-300/20 text-slate-600 dark:text-slate-400" :
                                      displayRank === 3 ? "bg-amber-700/20 text-amber-700 dark:text-amber-500" :
                                        "text-muted-foreground"
                                )}>
                                  {displayRank <= 3 ? <Crown className="h-3 w-3" /> : displayRank}
                                </span>
                              ) : <Minus className="h-3 w-3 text-muted-foreground/30" />}
                            </div>
                          </TableCell>

                          <TableCell>
                            <button
                              onClick={() => onNavigateToPlayer && onNavigateToPlayer(player.name)}
                              className="font-semibold text-foreground hover:text-primary transition-colors hover:underline decoration-primary/50 underline-offset-4"
                            >
                              {player.name}
                            </button>
                          </TableCell>

                          <TableCell>
                            {race && (
                              <Badge variant="outline" className={cn("border-0 font-medium", getRaceBadgeColor(race))}>
                                {race}
                              </Badge>
                            )}
                          </TableCell>

                          <TableCell className="text-center text-muted-foreground">{player.matches}</TableCell>
                          <TableCell className="text-center font-medium text-emerald-500 dark:text-emerald-400">{player.wins}</TableCell>
                          <TableCell className="text-center font-medium text-rose-500 dark:text-rose-400">{player.losses}</TableCell>

                          <TableCell className="text-center">
                            <span className={cn(
                              "font-bold font-mono tracking-tight",
                              isPositive ? "text-emerald-500 dark:text-emerald-400" :
                                player.points < 0 ? "text-rose-500 dark:text-rose-400" : "text-muted-foreground"
                            )}>
                              {isPositive ? '+' : ''}{formatRankingPoints(player.points)}
                            </span>
                          </TableCell>

                          <TableCell className="text-center">
                            {typeof player.confidence === 'number' ? (
                              <div className="flex items-center justify-center gap-1">
                                <div className="h-1.5 w-12 bg-muted rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${player.confidence}%` }}
                                  />
                                </div>
                                <span className="text-xs text-muted-foreground w-8 text-right">{Math.round(player.confidence)}%</span>
                              </div>
                            ) : <span className="text-muted-foreground">-</span>}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}


