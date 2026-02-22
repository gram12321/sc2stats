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

  const getTeamRaces = (team: any) => {
    const raceMap: Record<string, Race> = { P: 'Protoss', T: 'Terran', Z: 'Zerg', R: 'Random' };
    const race1 = team?.player1_race ? (raceMap[team.player1_race] || playerRaces[team.player1] || null) : (playerRaces[team?.player1] || null);
    const race2 = team?.player2_race
      ? (raceMap[team.player2_race] || playerRaces[team.player2] || null)
      : (team?.player2 ? (playerRaces[team.player2] || null) : null);
    return { race1, race2 };
  };

  const resolvePerspectiveTeams = (match: any): { ourTeam: any; opponentTeam: any } | null => {
    if (playerNames.length === 1) {
      const target = playerNames[0];
      const team1HasPlayer = match.team1?.player1 === target || match.team1?.player2 === target;
      const team2HasPlayer = match.team2?.player1 === target || match.team2?.player2 === target;
      if (team1HasPlayer) return { ourTeam: match.team1, opponentTeam: match.team2 };
      if (team2HasPlayer) return { ourTeam: match.team2, opponentTeam: match.team1 };
      return null;
    }

    if (playerNames.length === 2) {
      const ourPlayers = [...playerNames].filter(Boolean).sort().join('+');
      const team1Players = [match.team1?.player1, match.team1?.player2].filter(Boolean).sort().join('+');
      const team2Players = [match.team2?.player1, match.team2?.player2].filter(Boolean).sort().join('+');
      if (team1Players === ourPlayers) return { ourTeam: match.team1, opponentTeam: match.team2 };
      if (team2Players === ourPlayers) return { ourTeam: match.team2, opponentTeam: match.team1 };
      return null;
    }

    return null;
  };

  const getOpponentMatchupKey = (opponentTeam: any): string | null => {
    const { race1, race2 } = getTeamRaces(opponentTeam);
    if (!race1) return null;
    if (opponentTeam?.player2 && !race2) return null;
    if (opponentTeam?.player2 && race2) {
      const races = [getRaceAbbr(race1), getRaceAbbr(race2)].sort();
      return races.join('');
    }
    return getRaceAbbr(race1);
  };

  const getBackendRaceImpactDelta = (match: any, ourTeam: any, opponentTeam: any): number | null => {
    const raceImpacts = match.race_impacts;
    if (!raceImpacts) return null;

    const ourRaces = Object.values(getTeamRaces(ourTeam)).filter(Boolean) as Race[];
    const opponentRaces = Object.values(getTeamRaces(opponentTeam)).filter(Boolean) as Race[];
    if (ourRaces.length === 0 || opponentRaces.length === 0) return null;

    let totalDelta = 0;
    let hasImpact = false;

    for (const ourRace of ourRaces) {
      for (const oppRace of opponentRaces) {
        const ourAbbr = getRaceAbbr(ourRace);
        const oppAbbr = getRaceAbbr(oppRace);
        if (!ourAbbr || !oppAbbr || ourAbbr === oppAbbr) continue;
        const impact = raceImpacts[`${ourAbbr}v${oppAbbr}`];
        if (impact && typeof impact.ratingChange === 'number') {
          totalDelta += impact.ratingChange;
          hasImpact = true;
        }
      }
    }

    return hasImpact ? totalDelta : null;
  };

  const getMatchResult = (match: any, ourTeam: any): { won: boolean; isDraw: boolean } => {
    const isDraw = typeof match.isDraw === 'boolean'
      ? match.isDraw
      : match.team1_score === match.team2_score;
    if (isDraw) return { won: false, isDraw: true };

    if (typeof match.won === 'boolean') {
      return { won: match.won, isDraw: false };
    }

    const ourIsTeam1 = ourTeam?.player1 === match.team1?.player1 && ourTeam?.player2 === match.team1?.player2;
    if (ourIsTeam1) {
      return { won: (match.team1_score || 0) > (match.team2_score || 0), isDraw: false };
    }
    return { won: (match.team2_score || 0) > (match.team1_score || 0), isDraw: false };
  };

  // Calculate matchup statistics with ratings
  const calculateMatchups = (): RaceMatchupData[] => {
    const matchupMap = new Map<string, { 
      wins: number; 
      losses: number; 
      draws: number;
      rating: number;
    }>();

    // Sort matches chronologically to process ratings in order
    const sortedMatches = [...matchHistory].sort((a, b) => {
      const dateA = new Date(a.tournament_date || a.match_date || 0).getTime();
      const dateB = new Date(b.tournament_date || b.match_date || 0).getTime();
      return dateA - dateB;
    });

    sortedMatches.forEach(match => {
      const perspective = resolvePerspectiveTeams(match);
      if (!perspective) return;
      const matchupKey = getOpponentMatchupKey(perspective.opponentTeam);
      if (!matchupKey) return;
      const backendRaceDelta = getBackendRaceImpactDelta(match, perspective.ourTeam, perspective.opponentTeam);
      if (backendRaceDelta === null) return;

      if (!matchupMap.has(matchupKey)) {
        matchupMap.set(matchupKey, { 
          wins: 0, 
          losses: 0, 
          draws: 0,
          rating: 0
        });
      }

      const stats = matchupMap.get(matchupKey)!;
      stats.rating += backendRaceDelta;

      const { won, isDraw } = getMatchResult(match, perspective.ourTeam);
      if (isDraw) {
        stats.draws++;
      } else if (won) {
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
      
      matchups.push({
        matchup,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        total,
        winRate,
        rating: stats.rating,
        ratingChange: stats.rating
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
      const perspective = resolvePerspectiveTeams(match);
      if (!perspective) return false;
      const matchupKey = getOpponentMatchupKey(perspective.opponentTeam);
      if (!matchupKey) return false;
      const backendRaceDelta = getBackendRaceImpactDelta(match, perspective.ourTeam, perspective.opponentTeam);
      if (backendRaceDelta === null) return false;
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
