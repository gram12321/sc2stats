import { useState } from 'react';
import { Race } from '../types/tournament';
import { MatchHistoryItem } from './MatchHistoryItem';
import { getRaceAbbr, formatRankingPoints } from '../lib/utils';

interface RaceMatchupData {
  matchup: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
  rating: number;
  ratingChange: number;
}

interface RaceMatchupStatsProps {
  matchHistory: any[];
  playerNames?: string[];
  playerRaces: Record<string, Race>;
  isTeam?: boolean;
  playerRankings?: Record<string, { rank: number; points: number; confidence: number }>;
  teamRankings?: Record<string, { rank: number; points: number; confidence: number }>;
  normalizeTeamKey?: (p1: string, p2: string) => string;
  getTeamImpact?: (match: any, p1: string, p2: string) => any;
  getPlayerImpact?: (match: any, playerName: string) => any;
  formatDate?: (dateStr: string | null) => string;
}

export function RaceMatchupStats({ 
  matchHistory, 
  playerNames = [], 
  playerRaces,
  playerRankings = {},
  teamRankings = {},
  normalizeTeamKey = (p1, p2) => [p1, p2].filter(Boolean).sort().join('+'),
  getTeamImpact = () => null,
  getPlayerImpact = () => null,
  formatDate = (dateStr) => dateStr ? new Date(dateStr).toLocaleDateString() : '—'
}: RaceMatchupStatsProps) {
  const [selectedMatchup, setSelectedMatchup] = useState<string | null>(null);
  const [filteredMatches, setFilteredMatches] = useState<any[]>([]);

  // Helper function to get actual races used in a match
  const getMatchRaces = (match: any, teamPlayers: { player1: string; player2: string }) => {
    // Determine which team in the match corresponds to our team
    let matchTeam = null;
    
    // Check if our team is team1
    const team1Players = [match.team1?.player1, match.team1?.player2].filter(Boolean).sort().join('+');
    const ourPlayers = [teamPlayers.player1, teamPlayers.player2].filter(Boolean).sort().join('+');
    
    if (team1Players === ourPlayers) {
      matchTeam = match.team1;
    } else {
      matchTeam = match.team2;
    }
    
    if (!matchTeam) {
      // Fallback: check individual player names
      if (match.team1?.player1 === teamPlayers.player1 || match.team1?.player2 === teamPlayers.player1) {
        matchTeam = match.team1;
      } else {
        matchTeam = match.team2;
      }
    }
    
    // Get races from the team object - check for race fields added by backend
    let race1: Race | null = null;
    let race2: Race | null = null;
    
    // Check if team has player1_race and player2_race fields (from backend)
    if (matchTeam?.player1_race) {
      const raceMap: Record<string, Race> = { 'P': 'Protoss', 'T': 'Terran', 'Z': 'Zerg', 'R': 'Random' };
      race1 = raceMap[matchTeam.player1_race] || playerRaces[matchTeam.player1] || null;
    } else {
      race1 = playerRaces[teamPlayers.player1] || null;
    }
    
    if (matchTeam?.player2_race) {
      const raceMap: Record<string, Race> = { 'P': 'Protoss', 'T': 'Terran', 'Z': 'Zerg', 'R': 'Random' };
      race2 = raceMap[matchTeam.player2_race] || playerRaces[matchTeam.player2] || null;
    } else if (teamPlayers.player2) {
      race2 = playerRaces[teamPlayers.player2] || null;
    }
    
    return { race1, race2 };
  };
  
  // Helper functions for rating calculations (similar to other parts of codebase)
  const predictWinProbability = (rating1: number, rating2: number, populationStdDev: number = 350): number => {
    const ratingDiff = rating2 - rating1;
    return 1 / (1 + Math.pow(3, ratingDiff / populationStdDev));
  };

  const getKFactor = (matchCount: number): number => {
    if (matchCount <= 2) return 80;
    if (matchCount <= 4) return 40;
    if (matchCount <= 8) return 50;
    const adaptiveK = 32 + (100 / matchCount);
    return Math.min(50, adaptiveK);
  };

  const calculateRatingChange = (expectedWin: number, actualWin: boolean, kFactor: number, isDraw: boolean = false): number => {
    const actualResult = isDraw ? 0.5 : (actualWin ? 1 : 0);
    return kFactor * (actualResult - expectedWin);
  };

  // Calculate matchup statistics with ratings
  const calculateMatchups = (): RaceMatchupData[] => {
    const matchupMap = new Map<string, { 
      wins: number; 
      losses: number; 
      draws: number;
      rating: number;
      matchCount: number;
    }>();

    // Sort matches chronologically to process ratings in order
    const sortedMatches = [...matchHistory].sort((a, b) => {
      const dateA = new Date(a.tournament_date || a.match_date || 0).getTime();
      const dateB = new Date(b.tournament_date || b.match_date || 0).getTime();
      return dateA - dateB;
    });

    sortedMatches.forEach(match => {
      // Determine if our player/team is team1 or team2
      let opponentTeam: { player1: string; player2: string };

      if (playerNames.length === 1) {
        // Single player
        if (match.team1.player1 === playerNames[0] || match.team1.player2 === playerNames[0]) {
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else if (playerNames.length === 2) {
        // Team
        const team1Players = [match.team1.player1, match.team1.player2].filter(Boolean).sort().join('+');
        const ourPlayers = [...playerNames].sort().join('+');
        if (team1Players === ourPlayers) {
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else {
        return;
      }

      // Get opponent races - use actual races from match data if available
      const opponentRaces = getMatchRaces(match, opponentTeam);
      const opp1Race = opponentRaces.race1;
      const opp2Race = opponentRaces.race2;

      // Skip if we don't have race data for opponent team
      if (!opp1Race) return;
      if (opponentTeam.player2 && !opp2Race) return; // Skip if player2 exists but no race data

      // Create matchup string (e.g., "TP", "ZZ", "P")
      let matchupKey: string;
      if (opponentTeam.player2 && opp2Race) {
        // 2v2 matchup - sort races alphabetically for consistency
        const races = [getRaceAbbr(opp1Race), getRaceAbbr(opp2Race)].sort();
        matchupKey = races.join('');
      } else if (!opponentTeam.player2) {
        // 1v1 or partner-less opponent
        matchupKey = getRaceAbbr(opp1Race);
      } else {
        return; // Skip if inconsistent data
      }

      if (!matchupMap.has(matchupKey)) {
        matchupMap.set(matchupKey, { 
          wins: 0, 
          losses: 0, 
          draws: 0,
          rating: 0,
          matchCount: 0
        });
      }

      const stats = matchupMap.get(matchupKey)!;
      
      // Calculate rating change for this matchup
      const allMatchups = Array.from(matchupMap.values());
      const populationMean = allMatchups.length > 0 
        ? allMatchups.reduce((sum, s) => sum + s.rating, 0) / allMatchups.length 
        : 0;
      const populationVariance = allMatchups.length > 0
        ? allMatchups.reduce((sum, s) => sum + Math.pow(s.rating - populationMean, 2), 0) / allMatchups.length
        : 0;
      const populationStdDev = Math.max(Math.sqrt(populationVariance), 50);
      
      // Compare against neutral baseline (0) - absolute matchup strength
      const opponentRating = 0;
      const expectedWin = predictWinProbability(stats.rating, opponentRating, populationStdDev);
      const kFactor = getKFactor(stats.matchCount + 1);
      const ratingChange = calculateRatingChange(expectedWin, match.won, kFactor, match.isDraw);
      
      // Update stats
      stats.rating += ratingChange;
      stats.matchCount++;
      
      if (match.isDraw) {
        stats.draws++;
      } else if (match.won) {
        stats.wins++;
      } else {
        stats.losses++;
      }
    });

    // Convert to array and calculate win rates
    const matchups: RaceMatchupData[] = [];
    matchupMap.forEach((stats, matchup) => {
      const total = stats.wins + stats.losses + stats.draws;
      const winRate = total > 0 ? (stats.wins / total) * 100 : 0;
      
      // Calculate overall rating change (final rating from initial 0)
      const ratingChange = stats.rating;
      
      matchups.push({
        matchup,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        total,
        winRate,
        rating: stats.rating,
        ratingChange
      });
    });

    // Sort by rating (highest first), then by win rate
    return matchups.sort((a, b) => b.rating - a.rating || b.winRate - a.winRate);
  };

  const matchups = calculateMatchups();

  const handleMatchupClick = (matchup: string) => {
    setSelectedMatchup(matchup);
    
    // Filter match history for this specific matchup
    const filtered = matchHistory.filter(match => {
      let opponentTeam: { player1: string; player2: string };
      
      if (playerNames.length === 1) {
        // Single player
        if (match.team1.player1 === playerNames[0] || match.team1.player2 === playerNames[0]) {
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else if (playerNames.length === 2) {
        // Team
        const team1Players = [match.team1.player1, match.team1.player2].filter(Boolean).sort().join('+');
        const ourPlayers = [...playerNames].sort().join('+');
        if (team1Players === ourPlayers) {
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else {
        return false;
      }
      
      // Get opponent races - use actual races from match data if available
      const opponentRaces = getMatchRaces(match, opponentTeam);
      const opp1Race = opponentRaces.race1;
      const opp2Race = opponentRaces.race2;
      
      if (!opp1Race) return false;
      if (opponentTeam.player2 && !opp2Race) return false;
      
      let matchupKey: string;
      if (opponentTeam.player2 && opp2Race) {
        const races = [getRaceAbbr(opp1Race), getRaceAbbr(opp2Race)].sort();
        matchupKey = races.join('');
      } else if (!opponentTeam.player2) {
        matchupKey = getRaceAbbr(opp1Race);
      } else {
        return false;
      }
      
      return matchupKey === matchup;
    });
    
    setFilteredMatches(filtered);
  };

  const getTeamRank = (p1: string, p2: string) => {
    const teamKey = normalizeTeamKey(p1, p2);
    return teamRankings[teamKey] || null;
  };

  if (matchups.length === 0) {
    return null;
  }

  const getRaceColor = (matchup: string) => {
    // For 2-character matchups, use a generic color
    if (matchup.length === 2) {
      return 'bg-gray-100 text-gray-700';
    }
    // For single race
    switch (matchup[0]) {
      case 'T': return 'bg-blue-100 text-blue-800';
      case 'Z': return 'bg-purple-100 text-purple-800';
      case 'P': return 'bg-yellow-100 text-yellow-800';
      case 'R': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="bg-card rounded-lg border border-border shadow-sm">
      <div className="px-6 py-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground">Race Matchup Statistics</h2>
        <p className="text-sm text-muted-foreground mt-1">Performance and rating against different race combinations</p>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {matchups.map(matchup => (
            <div 
              key={matchup.matchup} 
              className="flex items-center gap-4 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
              onClick={() => handleMatchupClick(matchup.matchup)}
            >
              {/* Matchup Label */}
              <div className="w-16 flex-shrink-0">
                <span className={`inline-flex items-center justify-center px-2 py-1 rounded text-xs font-medium ${getRaceColor(matchup.matchup)}`}>
                  vs {matchup.matchup}
                </span>
              </div>

              {/* Progress Bar */}
              <div className="flex-1 min-w-0">
                <div className="relative h-6 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      matchup.winRate >= 60 
                        ? 'bg-gradient-to-r from-green-500 to-green-600' 
                        : matchup.winRate >= 40 
                        ? 'bg-gradient-to-r from-yellow-500 to-yellow-600' 
                        : 'bg-gradient-to-r from-red-500 to-red-600'
                    }`}
                    style={{ width: `${matchup.winRate}%` }}
                  />
                  {/* Center text overlay */}
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs font-medium text-gray-700 drop-shadow-sm">
                      {matchup.wins}/{matchup.total}
                    </span>
                  </div>
                </div>
              </div>

              {/* Win Rate */}
              <div className="w-16 flex-shrink-0 text-right">
                <span className={`text-sm font-bold ${
                  matchup.winRate >= 60 ? 'text-green-600' : 
                  matchup.winRate >= 40 ? 'text-yellow-600' : 
                  'text-red-600'
                }`}>
                  {matchup.winRate.toFixed(0)}%
                </span>
              </div>
              
              {/* Rating */}
              <div className="w-24 flex-shrink-0 text-right">
                <div className="text-sm font-semibold text-foreground">
                  {formatRankingPoints(matchup.rating)}
                </div>
                <div className={`text-xs ${matchup.ratingChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {matchup.ratingChange >= 0 ? '+' : ''}{formatRankingPoints(matchup.ratingChange)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      
      {/* Match History Modal */}
      {selectedMatchup && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setSelectedMatchup(null);
              setFilteredMatches([]);
            }
          }}
        >
          <div
            className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <div>
                <h3 className="text-lg font-semibold">Match History: vs {selectedMatchup}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {filteredMatches.length} total matches
                </p>
              </div>
              <button
                onClick={() => {
                  setSelectedMatchup(null);
                  setFilteredMatches([]);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {filteredMatches.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No matches found for this matchup
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredMatches.map((match) => {
                    const team1Rank = getTeamRank(match.team1.player1, match.team1.player2);
                    const team2Rank = getTeamRank(match.team2.player1, match.team2.player2);

                    return (
                      <MatchHistoryItem
                        key={`${match.tournament_slug}-${match.match_id}`}
                        match={match}
                        team1Rank={team1Rank ? { rank: team1Rank.rank, points: team1Rank.points, confidence: team1Rank.confidence } : null}
                        team2Rank={team2Rank ? { rank: team2Rank.rank, points: team2Rank.points, confidence: team2Rank.confidence } : null}
                        playerRankings={playerRankings}
                        playerRaces={playerRaces}
                        highlightPlayers={playerNames}
                        showWinLoss={true}
                        winLossValue={match.won}
                        isDrawValue={match.isDraw}
                        showRatingBreakdown={true}
                        normalizeTeamKey={normalizeTeamKey}
                        getTeamImpact={getTeamImpact}
                        getPlayerImpact={getPlayerImpact}
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
