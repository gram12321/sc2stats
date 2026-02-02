import { useState, useEffect } from 'react';
import { useRankingSettings } from '../context/RankingSettingsContext';
import { RankingFilters } from '../components/RankingFilters';
import { formatRankingPoints } from '../lib/utils';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { MatchHistoryItem } from '../components/MatchHistoryItem';
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
import { Button } from '../components/ui/button';
import {
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Loader2,
  Trophy,
  Swords,
  Crown,
  Minus
} from 'lucide-react';
import { cn } from '../lib/utils';

interface RaceRanking {
  name: string; // e.g., "PvZ", "TvP"
  race1: string; // e.g., "Protoss", "Terran"
  race2: string; // e.g., "Zerg", "Protoss"
  matches: number;
  wins: number;
  losses: number;
  draws?: number;
  points: number;
}

interface RaceRankingsProps { }

interface MatchHistoryEntry {
  match_id: string;
  tournament_slug: string;
  tournament_date: string | null;
  match_date: string | null;
  round: string;
  team1_races: string[];
  team2_races: string[];
  team1_score: number;
  team2_score: number;
  race_impacts: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    isDraw?: boolean;
    opponentRating: number;
    race1: string;
    race2: string;
  }>;
  team1_player1: string | null;
  team1_player1_race: string | null;
  team1_player2: string | null;
  team1_player2_race: string | null;
  team2_player1: string | null;
  team2_player1_race: string | null;
  team2_player2: string | null;
  team2_player2_race: string | null;
  team_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    isDraw?: boolean;
    opponentRating: number;
  }>;
  player_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
    isDraw?: boolean;
    opponentRating: number;
  }>;
}

interface PlayerRanking {
  name: string;
  points: number;
  confidence: number;
}

interface TeamRanking {
  player1: string;
  player2: string;
  points: number;
  confidence: number;
}

export function RaceRankings({ }: RaceRankingsProps) {
  const [rankings, setRankings] = useState<RaceRanking[]>([]);
  const [combinedRankings, setCombinedRankings] = useState<RaceRanking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [hideRandom, setHideRandom] = useState(false);
  const [selectedMatchup, setSelectedMatchup] = useState<RaceRanking | null>(null);
  const [isCombinedStats, setIsCombinedStats] = useState(false);
  const [sortColumn, setSortColumn] = useState<keyof RaceRanking | 'rank' | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [combinedSortColumn, setCombinedSortColumn] = useState<keyof RaceRanking | 'rank' | null>(null);
  const [combinedSortDirection, setCombinedSortDirection] = useState<'asc' | 'desc'>('desc');
  const [matchHistory, setMatchHistory] = useState<MatchHistoryEntry[]>([]);
  const [isLoadingMatches, setIsLoadingMatches] = useState(false);
  const [playerRankings, setPlayerRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [teamRankings, setTeamRankings] = useState<Record<string, { rank: number; points: number; confidence: number }>>({});
  const [playerRaces, setPlayerRaces] = useState<Record<string, Race>>({});
  const { mainCircuitOnly, seasons } = useRankingSettings();

  useEffect(() => {
    loadRankings();
    loadPlayerRankings();
    loadTeamRankings();
    loadAllPlayerRaces();
  }, [mainCircuitOnly, seasons]);

  const loadRankings = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const queryParams = new URLSearchParams();
      if (mainCircuitOnly) queryParams.append('mainCircuitOnly', 'true');
      if (seasons.length > 0) queryParams.append('seasons', seasons.join(','));
      const response = await fetch(`/api/race-rankings?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load race rankings');
      const data = await response.json();
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
    if (hideRandom && (matchup.race1 === 'Random' || matchup.race2 === 'Random')) {
      return false;
    }
    const searchLower = searchTerm.toLowerCase();
    return (
      matchup.name.toLowerCase().includes(searchLower) ||
      matchup.race1.toLowerCase().includes(searchLower) ||
      matchup.race2.toLowerCase().includes(searchLower)
    );
  });

  const handleSort = (column: keyof RaceRanking | 'rank', isCombined: boolean = false) => {
    if (isCombined) {
      if (combinedSortColumn === column) {
        setCombinedSortDirection(combinedSortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setCombinedSortColumn(column);
        setCombinedSortDirection('desc');
      }
    } else {
      if (sortColumn === column) {
        setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      } else {
        setSortColumn(column);
        setSortDirection('desc');
      }
    }
  };

  const sortData = (data: RaceRanking[], column: keyof RaceRanking | 'rank' | null, direction: 'asc' | 'desc') => {
    const sorted = [...data].sort((a, b) => {
      if (!column) return 0;

      let aValue: any;
      let bValue: any;

      if (column === 'rank') {
        // For logic simplicity, assuming original order or points determines rank for now
        aValue = a.points;
        bValue = b.points;
        // Invert logic for points so higher is better (desc default)
        // Actually, let's stick to the generic sorter
        if (data === combinedRankings) {
          aValue = combinedRankings.findIndex(m => m.name === a.name);
          bValue = combinedRankings.findIndex(m => m.name === b.name);
        } else {
          aValue = rankings.findIndex(m => m.name === a.name);
          bValue = rankings.findIndex(m => m.name === b.name);
        }
      } else {
        aValue = a[column];
        bValue = b[column];
      }

      if (aValue === undefined || aValue === null) aValue = 0;
      if (bValue === undefined || bValue === null) bValue = 0;

      // String comparison
      if (typeof aValue === 'string') {
        return direction === 'asc' ? aValue.localeCompare(bValue) : bValue.localeCompare(aValue);
      }

      // Numeric comparison
      const comparison = (aValue as number) - (bValue as number);
      return direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  };

  const sortedRankings = sortData(filteredRankings, sortColumn, sortDirection);

  const filteredCombinedRankings = combinedRankings.filter(matchup => {
    if (hideRandom && matchup.race1 === 'Random') {
      return false;
    }
    return true;
  });

  const sortedCombinedRankings = sortData(filteredCombinedRankings, combinedSortColumn, combinedSortDirection);


  const getRaceBadgeColor = (race: string) => {
    switch (race) {
      case 'Terran': return 'bg-blue-500/10 text-blue-500 hover:bg-blue-500/20';
      case 'Zerg': return 'bg-purple-500/10 text-purple-500 hover:bg-purple-500/20';
      case 'Protoss': return 'bg-yellow-500/10 text-yellow-500 hover:bg-yellow-500/20';
      case 'Random': return 'bg-gray-500/10 text-gray-400 hover:bg-gray-500/20';
      default: return 'bg-gray-500/10 text-gray-400';
    }
  };

  const loadMatchHistory = async (matchup: RaceRanking, isCombined: boolean = false) => {
    try {
      setIsLoadingMatches(true);
      let response;
      const queryParams = new URLSearchParams();
      if (mainCircuitOnly) queryParams.append('mainCircuitOnly', 'true');
      if (seasons.length > 0) queryParams.append('seasons', seasons.join(','));

      if (isCombined) {
        response = await fetch(`/api/race-combo/${encodeURIComponent(matchup.race1)}?${queryParams.toString()}`);
      } else {
        response = await fetch(`/api/race-matchup/${encodeURIComponent(matchup.race1)}/${encodeURIComponent(matchup.race2)}?${queryParams.toString()}`);
      }
      if (!response.ok) throw new Error('Failed to load match history');
      const data = await response.json();
      setMatchHistory(data);
    } catch (err) {
      console.error('Error loading match history:', err);
      setMatchHistory([]);
    } finally {
      setIsLoadingMatches(false);
    }
  };

  const handleMatchupClick = (matchup: RaceRanking, isCombined: boolean = false) => {
    setSelectedMatchup(matchup);
    setIsCombinedStats(isCombined);
    setMatchHistory([]);
    loadMatchHistory(matchup, isCombined);
    // Scroll to match history
    setTimeout(() => {
      document.getElementById('match-history-section')?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // ... Loaders for Player/Team Rankings etc ... (Simplified for brevity, same as TeamRankings)
  const loadPlayerRankings = async () => { /* ... same code ... */
    // Re-implementing strictly to avoid TS errors
    try {
      const queryParams = new URLSearchParams();
      if (mainCircuitOnly) queryParams.append('mainCircuitOnly', 'true');
      if (seasons.length > 0) queryParams.append('seasons', seasons.join(','));
      const response = await fetch(`/api/player-rankings?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load player rankings');
      const data: PlayerRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((player, index) => {
        rankMap[player.name] = { rank: index + 1, points: player.points, confidence: player.confidence || 0 };
      });
      setPlayerRankings(rankMap);
    } catch (err) { console.error(err); }
  };
  const loadTeamRankings = async () => { /* ... same code ... */
    try {
      const queryParams = new URLSearchParams();
      if (mainCircuitOnly) queryParams.append('mainCircuitOnly', 'true');
      if (seasons.length > 0) queryParams.append('seasons', seasons.join(','));
      const response = await fetch(`/api/team-rankings?${queryParams.toString()}`);
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data: TeamRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((team, index) => {
        const key = [team.player1, team.player2].filter(Boolean).sort().join('+');
        rankMap[key] = { rank: index + 1, points: team.points, confidence: team.confidence || 0 };
      });
      setTeamRankings(rankMap);
    } catch (err) { console.error(err); }
  };
  const loadAllPlayerRaces = async () => {
    try {
      const defaults = await getPlayerDefaults();
      setPlayerRaces(defaults);
    } catch (e) { console.error(e); }
  };

  const normalizeTeamKey = (player1: string, player2: string) => [player1, player2].filter(Boolean).sort().join('+');
  const getTeamRank = (p1: string | null, p2: string | null) => { if (!p1 || !p2) return null; return teamRankings[normalizeTeamKey(p1, p2)] || null; };
  const getTeamImpact = (match: any, p1: string | null, p2: string | null) => { if (!match.team_impacts || !p1 || !p2) return null; return match.team_impacts[normalizeTeamKey(p1, p2)] || null; };
  const getPlayerImpact = (match: any, name: string | null) => { if (!match.player_impacts || !name) return null; return match.player_impacts[name] || null; };

  // Convert MatchHistoryEntry to format expected by MatchHistoryItem
  const convertMatchForComponent = (match: MatchHistoryEntry) => {
    return {
      match_id: match.match_id,
      tournament_slug: match.tournament_slug,
      tournament_date: match.tournament_date,
      match_date: match.match_date,
      round: match.round,
      team1: {
        player1: match.team1_player1 || '',
        player2: match.team1_player2 || ''
      },
      team2: {
        player1: match.team2_player1 || '',
        player2: match.team2_player2 || ''
      },
      team1_score: match.team1_score,
      team2_score: match.team2_score,
      player_impacts: match.player_impacts,
      team_impacts: match.team_impacts
    };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try { return new Date(dateStr).toLocaleDateString(); } catch { return dateStr; }
  };

  const SortIcon = ({ column, currentColumn, direction }: { column: keyof RaceRanking | 'rank', currentColumn: any, direction: any }) => {
    if (currentColumn !== column) return <ArrowUpDown className="ml-1 h-3 w-3 text-muted-foreground" />;
    return direction === 'asc'
      ? <ArrowUp className="ml-1 h-3 w-3 text-primary" />
      : <ArrowDown className="ml-1 h-3 w-3 text-primary" />;
  };

  const renderTableHeaders = (isCombined: boolean) => (
    <TableRow className="hover:bg-transparent border-border/50">
      <TableHead className="w-[80px] cursor-pointer" onClick={() => handleSort('rank', isCombined)}>
        <div className="flex items-center">Rank<SortIcon column="rank" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="cursor-pointer" onClick={() => handleSort(isCombined ? 'race1' : 'name', isCombined)}>
        <div className="flex items-center">{isCombined ? 'Race' : 'Matchup'}<SortIcon column="name" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="text-center cursor-pointer" onClick={() => handleSort('matches', isCombined)}>
        <div className="flex items-center justify-center">Matches<SortIcon column="matches" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="text-center cursor-pointer" onClick={() => handleSort('wins', isCombined)}>
        <div className="flex items-center justify-center">Wins<SortIcon column="wins" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="text-center cursor-pointer" onClick={() => handleSort('losses', isCombined)}>
        <div className="flex items-center justify-center">Losses<SortIcon column="losses" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="text-center cursor-pointer" onClick={() => handleSort('draws', isCombined)}>
        <div className="flex items-center justify-center">Draws<SortIcon column="draws" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
      <TableHead className="text-center cursor-pointer" onClick={() => handleSort('points', isCombined)}>
        <div className="flex items-center justify-center">Rating<SortIcon column="points" currentColumn={isCombined ? combinedSortColumn : sortColumn} direction={isCombined ? combinedSortDirection : sortDirection} /></div>
      </TableHead>
    </TableRow>
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Swords className="h-8 w-8 text-primary" />
            Race Statistics
          </h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">
            Comparisons and win rates between different races.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row items-end gap-4">
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              id="hideRandom"
              checked={hideRandom}
              onChange={(e) => setHideRandom(e.target.checked)}
              className="h-4 w-4 rounded border-border bg-background text-primary focus:ring-primary"
            />
            <label htmlFor="hideRandom" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
              Hide Random
            </label>
          </div>
          <RankingFilters showMainCircuit={true} />
        </div>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-24 space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
          <p className="text-muted-foreground animate-pulse">Analyzing race data...</p>
        </div>
      ) : error ? (
        <Card className="border-destructive/50 bg-destructive/10">
          <CardContent className="pt-6">
            <p className="text-destructive text-center">{error}</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Matchups</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{rankings.length}</div></CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Total Matches</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{rankings.reduce((sum, m) => sum + m.matches, 0)}</div></CardContent>
            </Card>
            <Card className="bg-card/50 backdrop-blur-sm">
              <CardHeader className="pb-2"><CardTitle className="text-xs uppercase text-muted-foreground">Positive Spread</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold text-emerald-500">{rankings.filter(m => m.points > 0).length}</div></CardContent>
            </Card>
          </div>

          {combinedRankings.length > 0 && (
            <Card className="overflow-hidden border-border/50 shadow-xl bg-card/40 backdrop-blur-sm">
              <div className="p-4 border-b border-border/50">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Trophy className="h-5 w-5 text-yellow-500" />
                  Combined Race Performance
                </h2>
              </div>
              <Table>
                <TableHeader>{renderTableHeaders(true)}</TableHeader>
                <TableBody>
                  {sortedCombinedRankings.map((matchup, index) => (
                    <TableRow
                      key={matchup.name}
                      className={cn("hover:bg-muted/30 cursor-pointer border-border/50", selectedMatchup?.name === matchup.name && isCombinedStats && "bg-muted/50")}
                      onClick={() => handleMatchupClick(matchup, true)}
                    >
                      <TableCell className="font-medium text-center">{index + 1}</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("border-0", getRaceBadgeColor(matchup.race1))}>{matchup.race1}</Badge>
                          <span className="text-muted-foreground text-xs">vs All</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{matchup.matches}</TableCell>
                      <TableCell className="text-center text-emerald-500">{matchup.wins}</TableCell>
                      <TableCell className="text-center text-rose-500">{matchup.losses}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{matchup.draws || 0}</TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        <span className={matchup.points > 0 ? "text-emerald-500" : matchup.points < 0 ? "text-rose-500" : "text-muted-foreground"}>
                          {matchup.points > 0 ? '+' : ''}{formatRankingPoints(matchup.points)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}

          <Card className="overflow-hidden border-border/50 shadow-xl bg-card/40 backdrop-blur-sm">
            <div className="p-4 border-b border-border/50">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Swords className="h-5 w-5 text-primary" />
                  Individual Matchups
                </h2>
                <div className="relative w-64">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    type="search"
                    placeholder="Search race..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9 h-9"
                  />
                </div>
              </div>
            </div>
            <Table>
              <TableHeader>{renderTableHeaders(false)}</TableHeader>
              <TableBody>
                {sortedRankings.map((matchup) => {
                  const rank = rankings.findIndex(m => m.name === matchup.name) + 1;
                  return (
                    <TableRow
                      key={matchup.name}
                      className={cn("hover:bg-muted/30 cursor-pointer border-border/50", selectedMatchup?.name === matchup.name && !isCombinedStats && "bg-muted/50")}
                      onClick={() => handleMatchupClick(matchup, false)}
                    >
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {rank <= 3 && <Crown className={cn("h-3 w-3", rank === 1 ? "text-yellow-500" : rank === 2 ? "text-slate-400" : "text-amber-700")} />}
                          <span className="text-sm">{rank}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={cn("border-0", getRaceBadgeColor(matchup.race1))}>{matchup.race1}</Badge>
                          <span className="text-muted-foreground text-xs">vs</span>
                          <Badge variant="outline" className={cn("border-0", getRaceBadgeColor(matchup.race2))}>{matchup.race2}</Badge>
                        </div>
                      </TableCell>
                      <TableCell className="text-center text-muted-foreground">{matchup.matches}</TableCell>
                      <TableCell className="text-center text-emerald-500">{matchup.wins}</TableCell>
                      <TableCell className="text-center text-rose-500">{matchup.losses}</TableCell>
                      <TableCell className="text-center text-muted-foreground">{matchup.draws || 0}</TableCell>
                      <TableCell className="text-center font-mono font-bold">
                        <span className={matchup.points > 0 ? "text-emerald-500" : matchup.points < 0 ? "text-rose-500" : "text-muted-foreground"}>
                          {matchup.points > 0 ? '+' : ''}{formatRankingPoints(matchup.points)}
                        </span>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </Card>

          {/* Match History Section */}
          <div id="match-history-section" className="scroll-mt-24">
            {selectedMatchup && (
              <Card className="overflow-hidden border-border/50 shadow-xl bg-card/40 backdrop-blur-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                <CardHeader className="border-b border-border/50 bg-muted/20">
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Swords className="h-5 w-5 text-primary" />
                      <span>
                        Match History: {isCombinedStats ? `${selectedMatchup.race1} vs All` : `${selectedMatchup.race1} vs ${selectedMatchup.race2}`}
                      </span>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setSelectedMatchup(null)} className="h-8 w-8 p-0">
                      <Minus className="h-4 w-4" />
                    </Button>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  {isLoadingMatches ? (
                    <div className="py-12 flex justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
                  ) : matchHistory.length > 0 ? (
                    <div className="divide-y divide-border/50">
                      {matchHistory.map((match) => (
                        <MatchHistoryItem
                          key={`${match.tournament_slug}-${match.match_id}`}
                          match={convertMatchForComponent(match)}
                          team1Rank={getTeamRank(match.team1_player1, match.team1_player2) || undefined}
                          team2Rank={getTeamRank(match.team2_player1, match.team2_player2) || undefined}
                          playerRankings={playerRankings}
                          playerRaces={playerRaces}
                          showRatingBreakdown={true}
                          highlightPlayers={[]}
                          showWinLoss={true}
                          winLossValue={match.team1_score > match.team2_score}
                          isDrawValue={match.team1_score === match.team2_score}
                          getTeamImpact={getTeamImpact}
                          getPlayerImpact={getPlayerImpact}
                          normalizeTeamKey={normalizeTeamKey}
                          formatDate={formatDate}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">No matches found for this selection.</div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>

        </>
      )}
    </div>
  );
}
