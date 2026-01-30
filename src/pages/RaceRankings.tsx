import { useState, useEffect } from 'react';
import { formatRankingPoints } from '../lib/utils';
import { Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { MatchHistoryItem } from '../components/MatchHistoryItem';

const ROUND_ORDER: Record<string, number> = {
  'Round of 16': 1,
  'Round of 8': 2,
  'Quarterfinals': 3,
  'Semifinals': 4,
  'Final': 5,
  'Grand Final': 5
};

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
    opponentRating: number;
  }>;
  player_impacts?: Record<string, {
    ratingBefore: number;
    ratingChange: number;
    won: boolean;
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

export function RaceRankings({ onBack }: RaceRankingsProps) {
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

  useEffect(() => {
    loadRankings();
    loadPlayerRankings();
    loadTeamRankings();
    loadAllPlayerRaces();
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

  const sortedRankings = [...filteredRankings].sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: any;
    let bValue: any;

    if (sortColumn === 'rank') {
      aValue = rankings.findIndex(m => m.name === a.name) + 1;
      bValue = rankings.findIndex(m => m.name === b.name) + 1;
    } else if (sortColumn === 'name' || sortColumn === 'race1' || sortColumn === 'race2') {
      aValue = a[sortColumn];
      bValue = b[sortColumn];
    } else {
      aValue = a[sortColumn];
      bValue = b[sortColumn];
    }

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) aValue = (sortColumn === 'name' || sortColumn === 'race1' || sortColumn === 'race2') ? '' : 0;
    if (bValue === undefined || bValue === null) bValue = (sortColumn === 'name' || sortColumn === 'race1' || sortColumn === 'race2') ? '' : 0;

    // String comparison
    if (sortColumn === 'name' || sortColumn === 'race1' || sortColumn === 'race2') {
      return sortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Numeric comparison
    const comparison = (aValue as number) - (bValue as number);
    return sortDirection === 'asc' ? comparison : -comparison;
  });

  const filteredCombinedRankings = combinedRankings.filter(matchup => {
    // Filter out Random matchups if hideRandom is enabled
    if (hideRandom && matchup.race1 === 'Random') {
      return false;
    }
    return true;
  });

  const sortedCombinedRankings = [...filteredCombinedRankings].sort((a, b) => {
    if (!combinedSortColumn) return 0;

    let aValue: any;
    let bValue: any;

    if (combinedSortColumn === 'rank') {
      aValue = combinedRankings.findIndex(m => m.name === a.name) + 1;
      bValue = combinedRankings.findIndex(m => m.name === b.name) + 1;
    } else if (combinedSortColumn === 'name' || combinedSortColumn === 'race1' || combinedSortColumn === 'race2') {
      aValue = a[combinedSortColumn];
      bValue = b[combinedSortColumn];
    } else {
      aValue = a[combinedSortColumn];
      bValue = b[combinedSortColumn];
    }

    // Handle undefined/null values
    if (aValue === undefined || aValue === null) aValue = (combinedSortColumn === 'name' || combinedSortColumn === 'race1' || combinedSortColumn === 'race2') ? '' : 0;
    if (bValue === undefined || bValue === null) bValue = (combinedSortColumn === 'name' || combinedSortColumn === 'race1' || combinedSortColumn === 'race2') ? '' : 0;

    // String comparison
    if (combinedSortColumn === 'name' || combinedSortColumn === 'race1' || combinedSortColumn === 'race2') {
      return combinedSortDirection === 'asc'
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    // Numeric comparison
    const comparison = (aValue as number) - (bValue as number);
    return combinedSortDirection === 'asc' ? comparison : -comparison;
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

  const loadMatchHistory = async (matchup: RaceRanking, isCombined: boolean = false) => {
    try {
      setIsLoadingMatches(true);
      let response;
      if (isCombined) {
        // For combined stats, fetch all matches involving this race
        response = await fetch(`/api/race-combo/${encodeURIComponent(matchup.race1)}`);
      } else {
        // For individual matchups, fetch matches for this specific matchup
        response = await fetch(`/api/race-matchup/${encodeURIComponent(matchup.race1)}/${encodeURIComponent(matchup.race2)}`);
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
    loadMatchHistory(matchup, isCombined);
  };

  const loadPlayerRankings = async () => {
    try {
      const response = await fetch('/api/player-rankings');
      if (!response.ok) throw new Error('Failed to load player rankings');
      const data: PlayerRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((player, index) => {
        rankMap[player.name] = {
          rank: index + 1,
          points: player.points,
          confidence: player.confidence || 0
        };
      });
      setPlayerRankings(rankMap);
    } catch (err) {
      console.error('Error loading player rankings:', err);
    }
  };

  const loadTeamRankings = async () => {
    try {
      const response = await fetch('/api/team-rankings');
      if (!response.ok) throw new Error('Failed to load team rankings');
      const data: TeamRanking[] = await response.json();
      const rankMap: Record<string, { rank: number; points: number; confidence: number }> = {};
      data.forEach((team, index) => {
        const teamKey = normalizeTeamKey(team.player1, team.player2);
        rankMap[teamKey] = {
          rank: index + 1,
          points: team.points,
          confidence: team.confidence || 0
        };
      });
      setTeamRankings(rankMap);
    } catch (err) {
      console.error('Error loading team rankings:', err);
    }
  };

  const loadAllPlayerRaces = async () => {
    try {
      const defaults = await getPlayerDefaults();
      setPlayerRaces(defaults);
    } catch (err) {
      console.error('Error loading player races:', err);
    }
  };

  const normalizeTeamKey = (player1: string, player2: string): string => {
    return [player1, player2].filter(Boolean).sort().join('+');
  };

  const getTeamRank = (player1: string | null, player2: string | null) => {
    if (!player1 || !player2) return null;
    const teamKey = normalizeTeamKey(player1, player2);
    return teamRankings[teamKey] || null;
  };

  const getTeamImpact = (match: any, player1: string | null, player2: string | null) => {
    if (!match.team_impacts || !player1 || !player2) return null;
    const teamKey = normalizeTeamKey(player1, player2);
    return match.team_impacts[teamKey] || null;
  };

  const getPlayerImpact = (match: any, playerName: string | null) => {
    if (!match.player_impacts || !playerName) return null;
    return match.player_impacts[playerName] || null;
  };

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
      team_impacts: match.team_impacts,
      race_impacts: match.race_impacts
    };
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString();
    } catch {
      return dateStr;
    }
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
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('rank', true)}
                        >
                          <div className="flex items-center gap-1">
                            Rank
                            {combinedSortColumn === 'rank' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('race1', true)}
                        >
                          <div className="flex items-center gap-1">
                            Race
                            {combinedSortColumn === 'race1' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('matches', true)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Matches
                            {combinedSortColumn === 'matches' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('wins', true)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Wins
                            {combinedSortColumn === 'wins' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('losses', true)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Losses
                            {combinedSortColumn === 'losses' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                        <th
                          className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                          onClick={() => handleSort('points', true)}
                        >
                          <div className="flex items-center justify-center gap-1">
                            Points
                            {combinedSortColumn === 'points' && (
                              <span>{combinedSortDirection === 'asc' ? '↑' : '↓'}</span>
                            )}
                          </div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {sortedCombinedRankings.map((matchup, index) => (
                        <tr
                          key={matchup.name}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => handleMatchupClick(matchup, true)}
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
                              className={`text-sm font-bold ${matchup.points > 0
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
                      <th
                        className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('rank', false)}
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
                        onClick={() => handleSort('name', false)}
                      >
                        <div className="flex items-center gap-1">
                          Matchup
                          {sortColumn === 'name' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                      <th
                        className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                        onClick={() => handleSort('matches', false)}
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
                        onClick={() => handleSort('wins', false)}
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
                        onClick={() => handleSort('losses', false)}
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
                        onClick={() => handleSort('points', false)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          Points
                          {sortColumn === 'points' && (
                            <span>{sortDirection === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
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
                      sortedRankings.map((matchup) => {
                        const rank = rankings.findIndex(m => m.name === matchup.name) + 1;
                        return (
                          <tr
                            key={matchup.name}
                            className="hover:bg-gray-50 transition-colors cursor-pointer"
                            onClick={() => handleMatchupClick(matchup, false)}
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
                                className={`text-sm font-bold ${matchup.points > 0
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

      {/* Match History Modal */}
      {selectedMatchup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedMatchup(null);
              setIsCombinedStats(false);
              setMatchHistory([]);
            }
          }}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold">
                  Match History: {isCombinedStats ? `${selectedMatchup.race1} vs All` : selectedMatchup.name}
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  {matchHistory.length} total matches
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMatchup(null);
                  setIsCombinedStats(false);
                  setMatchHistory([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {isLoadingMatches ? (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Loading matches...</p>
                </div>
              ) : matchHistory.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No matches found for this {isCombinedStats ? 'race' : 'matchup'}
                </div>
              ) : (
                <div className="space-y-3">
                  {matchHistory
                    .sort((a, b) => {
                      // Sort by date (newest first)
                      const dateA = a.match_date || a.tournament_date || '';
                      const dateB = b.match_date || b.tournament_date || '';
                      if (dateA && dateB) {
                        const timeA = new Date(dateA).getTime();
                        const timeB = new Date(dateB).getTime();
                        if (timeA !== timeB) {
                          return timeB - timeA;
                        }
                      }

                      // Fallback to round order (higher round first = newest first)
                      const roundA = ROUND_ORDER[a.round] || 0;
                      const roundB = ROUND_ORDER[b.round] || 0;
                      if (roundA !== roundB) {
                        return roundB - roundA;
                      }

                      return 0;
                    })
                    .map((match) => {
                      // Determine win/loss and rating change based on matchup type
                      let won = false;
                      let ratingChange = 0;
                      let displayedRace1 = selectedMatchup.race1;
                      let displayedRace2 = selectedMatchup.race2;

                      if (isCombinedStats) {
                        // For combined stats, check if the race appears in winning team
                        const race1InTeam1 = match.team1_races.includes(selectedMatchup.race1);
                        won = race1InTeam1
                          ? match.team1_score > match.team2_score
                          : match.team2_score > match.team1_score;

                        // Find the first race_impact involving this race
                        const raceImpacts = match.race_impacts || {};
                        for (const [, impact] of Object.entries(raceImpacts)) {
                          if (impact.race1 === selectedMatchup.race1 || impact.race2 === selectedMatchup.race1) {
                            ratingChange = impact.race1 === selectedMatchup.race1 ? impact.ratingChange : -impact.ratingChange;
                            break;
                          }
                        }
                      } else {
                        // For individual matchups, find the specific matchup impact
                        const matchupKey = selectedMatchup.name; // e.g., "PvT"
                        const impact = match.race_impacts?.[matchupKey];
                        if (impact) {
                          won = impact.won;
                          ratingChange = impact.ratingChange;
                        }
                      }

                      const convertedMatch = convertMatchForComponent(match);
                      const team1Rank = getTeamRank(match.team1_player1, match.team1_player2);
                      const team2Rank = getTeamRank(match.team2_player1, match.team2_player2);

                      // Convert player rankings to the format expected by component
                      const playerRankingsMap: Record<string, { rank: number; points: number; confidence: number }> = {};
                      Object.keys(playerRankings).forEach(name => {
                        const ranking = playerRankings[name];
                        if (ranking) {
                          playerRankingsMap[name] = {
                            rank: ranking.rank,
                            points: ranking.points,
                            confidence: ranking.confidence
                          };
                        }
                      });

                      // Build race info for component
                      const raceInfo = isCombinedStats ? {
                        race1: selectedMatchup.race1,
                        race2: '',
                        ratingChange,
                        isCombinedStats: true
                      } : {
                        race1: displayedRace1,
                        race2: displayedRace2,
                        ratingChange: 0,
                        isCombinedStats: false,
                        matchupKey: selectedMatchup.name
                      };

                      return (
                        <MatchHistoryItem
                          key={`${match.tournament_slug}-${match.match_id}`}
                          match={convertedMatch}
                          team1Rank={team1Rank ? { rank: team1Rank.rank, points: team1Rank.points, confidence: team1Rank.confidence } : null}
                          team2Rank={team2Rank ? { rank: team2Rank.rank, points: team2Rank.points, confidence: team2Rank.confidence } : null}
                          playerRankings={playerRankingsMap}
                          playerRaces={playerRaces}
                          showWinLoss={true}
                          winLossValue={won}
                          showRatingBreakdown={true}
                          showRaceInfo={true}
                          raceInfo={raceInfo}
                          highlightRace={selectedMatchup.race1}
                          normalizeTeamKey={normalizeTeamKey}
                          getTeamImpact={(match, player1, player2) => getTeamImpact(match as any, player1, player2)}
                          getPlayerImpact={(match, playerName) => getPlayerImpact(match as any, playerName)}
                          formatDate={formatDate}
                        />
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


