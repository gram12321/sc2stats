import { useState, useEffect } from 'react';
import { Match, Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';

interface MatchBoxProps {
  match: Match;
  onClick: (e: React.MouseEvent) => void;
  teamRankings?: Record<string, number>;
}

export function MatchBox({ match, onClick, teamRankings }: MatchBoxProps) {
  const [defaults, setDefaults] = useState<Record<string, Race>>({});

  useEffect(() => {
    // Load all defaults once (more efficient than individual calls)
    const loadDefaults = async () => {
      try {
        const allDefaults = await getPlayerDefaults();
        // Only keep defaults for players in this match
        const matchPlayers = [
          match.team1.player1.name,
          match.team1.player2.name,
          match.team2.player1.name,
          match.team2.player2.name
        ];
        
        const matchDefaults: Record<string, Race> = {};
        matchPlayers.forEach(player => {
          if (allDefaults[player]) {
            matchDefaults[player] = allDefaults[player];
          }
        });
        setDefaults(matchDefaults);
      } catch (err) {
        console.error('Error loading defaults:', err);
      }
    };
    
    loadDefaults();
  }, [match]);
  
  // Get race from match or default
  const getRace = (playerName: string, matchRace?: Race): Race | null => {
    return matchRace || defaults[playerName] || null;
  };
  
  const getRaceAbbrev = (race: Race | null | undefined): string => {
    if (!race) return '';
    // Random gets 'R', others get first letter
    return race === 'Random' ? 'R' : race[0];
  };
  
  // Get team ranking key (alphabetically sorted players)
  const getTeamKey = (player1: string, player2: string): string => {
    return [player1, player2].sort().join('+');
  };
  
  const team1Key = getTeamKey(match.team1.player1.name, match.team1.player2.name);
  const team2Key = getTeamKey(match.team2.player1.name, match.team2.player2.name);
  const team1Ranking = teamRankings?.[team1Key];
  const team2Ranking = teamRankings?.[team2Key];
  
  const team1Won = match.team1_score !== null && match.team2_score !== null && 
                   match.team1_score > match.team2_score;
  const team2Won = match.team1_score !== null && match.team2_score !== null && 
                   match.team2_score > match.team1_score;

  return (
    <div
      onClick={onClick}
      className="bg-white border border-gray-300 rounded cursor-pointer hover:border-blue-500 hover:shadow-md transition-all min-w-[200px]"
    >
      {/* Team 1 */}
      <div className={`px-3 py-2 ${team1Won ? 'bg-blue-50 font-semibold' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {match.team1.player1.name}
              {getRace(match.team1.player1.name, match.team1.player1.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbrev(getRace(match.team1.player1.name, match.team1.player1.race))})
                </span>
              )}
            </div>
            <div className="text-sm text-gray-900 truncate">
              {match.team1.player2.name}
              {getRace(match.team1.player2.name, match.team1.player2.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbrev(getRace(match.team1.player2.name, match.team1.player2.race))})
                </span>
              )}
              {team1Ranking && (
                <span className="ml-1 text-xs font-semibold text-blue-600">
                  ({team1Ranking})
                </span>
              )}
            </div>
          </div>
          {match.team1_score !== null && (
            <div className="ml-2 text-lg font-bold text-gray-900">
              {match.team1_score}
            </div>
          )}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-gray-300"></div>

      {/* Team 2 */}
      <div className={`px-3 py-2 ${team2Won ? 'bg-blue-50 font-semibold' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {match.team2.player1.name}
              {getRace(match.team2.player1.name, match.team2.player1.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbrev(getRace(match.team2.player1.name, match.team2.player1.race))})
                </span>
              )}
            </div>
            <div className="text-sm text-gray-900 truncate">
              {match.team2.player2.name}
              {getRace(match.team2.player2.name, match.team2.player2.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbrev(getRace(match.team2.player2.name, match.team2.player2.race))})
                </span>
              )}
              {team2Ranking && (
                <span className="ml-1 text-xs font-semibold text-blue-600">
                  ({team2Ranking})
                </span>
              )}
            </div>
          </div>
          {match.team2_score !== null && (
            <div className="ml-2 text-lg font-bold text-gray-900">
              {match.team2_score}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
