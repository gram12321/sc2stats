import { useState, useEffect } from 'react';
import { Match, Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';
import { getRaceAbbr } from '../lib/utils';

interface MatchBoxProps {
  match: Match;
  onClick: (e: React.MouseEvent) => void;
  teamRankings?: Record<string, number>;
}

export function MatchBox({ match, onClick, teamRankings }: MatchBoxProps) {
  const [defaults, setDefaults] = useState<Record<string, Race>>({});
  const [mapsExpanded, setMapsExpanded] = useState(false);
  const recordedGames = match.games
    .map((game) => ({
      map: String(game?.map || '').trim(),
      winner: game?.winner
    }))
    .filter((game) => game.map);

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

  useEffect(() => {
    setMapsExpanded(false);
  }, [match.match_id]);
  
  // Get race from match or default
  const getRace = (playerName: string, matchRace?: Race): Race | null => {
    return matchRace || defaults[playerName] || null;
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
      className="w-[230px] bg-white border border-gray-300 rounded cursor-pointer hover:border-blue-500 hover:shadow-md transition-all"
    >
      {/* Team 1 */}
      <div className={`px-3 py-2 ${team1Won ? 'bg-blue-50 font-semibold' : ''}`}>
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="text-sm text-gray-900 truncate">
              {match.team1.player1.name}
              {getRace(match.team1.player1.name, match.team1.player1.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbr(getRace(match.team1.player1.name, match.team1.player1.race))})
                </span>
              )}
            </div>
            <div className="text-sm text-gray-900 truncate">
              {match.team1.player2.name}
              {getRace(match.team1.player2.name, match.team1.player2.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbr(getRace(match.team1.player2.name, match.team1.player2.race))})
                </span>
              )}
            </div>
          </div>
          <div className="ml-2 flex flex-col items-end gap-1">
            {team1Ranking && (
              <div className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                #{team1Ranking}
              </div>
            )}
            {match.team1_score !== null && (
              <div className="text-lg font-bold text-gray-900">
                {match.team1_score}
              </div>
            )}
          </div>
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
                  ({getRaceAbbr(getRace(match.team2.player1.name, match.team2.player1.race))})
                </span>
              )}
            </div>
            <div className="text-sm text-gray-900 truncate">
              {match.team2.player2.name}
              {getRace(match.team2.player2.name, match.team2.player2.race) && (
                <span className="ml-1 text-xs text-gray-500">
                  ({getRaceAbbr(getRace(match.team2.player2.name, match.team2.player2.race))})
                </span>
              )}
            </div>
          </div>
          <div className="ml-2 flex flex-col items-end gap-1">
            {team2Ranking && (
              <div className="text-[10px] font-semibold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded whitespace-nowrap">
                #{team2Ranking}
              </div>
            )}
            {match.team2_score !== null && (
              <div className="text-lg font-bold text-gray-900">
                {match.team2_score}
              </div>
            )}
          </div>
        </div>
      </div>

      {recordedGames.length > 0 && (
        <>
          <div className="h-px bg-gray-300"></div>
          <div className="px-3 py-2 bg-gray-50">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setMapsExpanded((prev) => !prev);
              }}
              className="w-full flex items-center justify-between text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500 hover:text-gray-700"
              aria-expanded={mapsExpanded}
              aria-label={`${mapsExpanded ? 'Collapse' : 'Expand'} maps`}
            >
              <span>Maps ({recordedGames.length})</span>
              <span className="text-[11px]">{mapsExpanded ? '-' : '+'}</span>
            </button>
            {mapsExpanded && (
              <div className="mt-1 space-y-1">
                {recordedGames.map((game, index) => {
                  const team1WonMap = game.winner === 1;
                  const team2WonMap = game.winner === 2;
                  return (
                    <div key={`${match.match_id}-map-${index}`} className="grid grid-cols-[16px_1fr_16px] items-center gap-1">
                      <span
                        className={`text-[10px] text-center rounded px-0.5 ${
                          team1WonMap
                            ? 'bg-green-100 text-green-700'
                            : team2WonMap
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {team1WonMap ? 'W' : team2WonMap ? 'L' : '-'}
                      </span>
                      <span className="text-[11px] text-gray-700 truncate text-center" title={game.map}>
                        {game.map}
                      </span>
                      <span
                        className={`text-[10px] text-center rounded px-0.5 ${
                          team2WonMap
                            ? 'bg-green-100 text-green-700'
                            : team1WonMap
                              ? 'bg-red-100 text-red-700'
                              : 'bg-gray-100 text-gray-500'
                        }`}
                      >
                        {team2WonMap ? 'W' : team1WonMap ? 'L' : '-'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
