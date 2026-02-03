import { Race } from '../types/tournament';

interface RaceMatchupData {
  matchup: string;
  wins: number;
  losses: number;
  draws: number;
  total: number;
  winRate: number;
}

interface RaceMatchupStatsProps {
  matchHistory: any[];
  playerNames?: string[];
  playerRaces: Record<string, Race>;
  isTeam?: boolean;
}

export function RaceMatchupStats({ matchHistory, playerNames = [], playerRaces, isTeam = false }: RaceMatchupStatsProps) {
  // Calculate matchup statistics
  const calculateMatchups = (): RaceMatchupData[] => {
    const matchupMap = new Map<string, { wins: number; losses: number; draws: number }>();

    matchHistory.forEach(match => {
      // Determine if our player/team is team1 or team2
      let isTeam1 = false;
      let opponentTeam: { player1: string; player2: string };

      if (playerNames.length === 1) {
        // Single player
        if (match.team1.player1 === playerNames[0] || match.team1.player2 === playerNames[0]) {
          isTeam1 = true;
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else if (playerNames.length === 2) {
        // Team
        const team1Players = [match.team1.player1, match.team1.player2].filter(Boolean).sort().join('+');
        const ourPlayers = [...playerNames].sort().join('+');
        if (team1Players === ourPlayers) {
          isTeam1 = true;
          opponentTeam = match.team2;
        } else {
          opponentTeam = match.team1;
        }
      } else {
        return;
      }

      // Get opponent races
      const opp1Race = playerRaces[opponentTeam.player1];
      const opp2Race = opponentTeam.player2 ? playerRaces[opponentTeam.player2] : null;

      // Skip if we don't have race data for opponent team
      if (!opp1Race) return;
      if (opponentTeam.player2 && !opp2Race) return; // Skip if player2 exists but no race data

      // Create matchup string (e.g., "TP", "ZZ", "P")
      const getRaceAbbrev = (race: Race | null) => {
        if (!race) return '';
        if (race === 'Random') return 'R';
        return race[0];
      };

      let matchupKey: string;
      if (opponentTeam.player2 && opp2Race) {
        // 2v2 matchup - sort races alphabetically for consistency
        const races = [getRaceAbbrev(opp1Race), getRaceAbbrev(opp2Race)].sort();
        matchupKey = races.join('');
      } else if (!opponentTeam.player2) {
        // 1v1 or partner-less opponent
        matchupKey = getRaceAbbrev(opp1Race);
      } else {
        return; // Skip if inconsistent data
      }

      if (!matchupMap.has(matchupKey)) {
        matchupMap.set(matchupKey, { wins: 0, losses: 0, draws: 0 });
      }

      const stats = matchupMap.get(matchupKey)!;
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
      matchups.push({
        matchup,
        wins: stats.wins,
        losses: stats.losses,
        draws: stats.draws,
        total,
        winRate
      });
    });

    // Sort by total games (most common matchups first)
    return matchups.sort((a, b) => b.winRate - a.winRate || b.total - a.total);
  };

  const matchups = calculateMatchups();

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
        <p className="text-sm text-muted-foreground mt-1">Performance against different race combinations</p>
      </div>
      <div className="p-6">
        <div className="space-y-3">
          {matchups.map(matchup => (
            <div key={matchup.matchup} className="flex items-center gap-4">
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
