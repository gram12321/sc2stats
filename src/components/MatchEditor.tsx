import { useState, useEffect } from 'react';
import { Match, Race } from '../types/tournament';
import { getPlayerDefaults } from '../lib/playerDefaults';

interface MatchEditorProps {
  match: Match;
  onUpdate: (updatedMatch: Match) => void;
}

const RACES: Exclude<Race, null>[] = ['Terran', 'Zerg', 'Protoss', 'Random'];

export function MatchEditor({ match, onUpdate }: MatchEditorProps) {
  const [editedMatch, setEditedMatch] = useState<Match>(match);

  // Update editedMatch when match prop changes
  useEffect(() => {
    setEditedMatch(match);
  }, [match]);

  // Apply default races on mount
  useEffect(() => {
    const applyDefaults = async () => {
      const updated = { ...match };
      let changed = false;

      // Load all defaults once (more efficient than individual calls)
      const defaults = await getPlayerDefaults();

      if (!updated.team1.player1.race && defaults[updated.team1.player1.name]) {
        updated.team1.player1.race = defaults[updated.team1.player1.name];
        changed = true;
      }
      if (!updated.team1.player2.race && defaults[updated.team1.player2.name]) {
        updated.team1.player2.race = defaults[updated.team1.player2.name];
        changed = true;
      }
      if (!updated.team2.player1.race && defaults[updated.team2.player1.name]) {
        updated.team2.player1.race = defaults[updated.team2.player1.name];
        changed = true;
      }
      if (!updated.team2.player2.race && defaults[updated.team2.player2.name]) {
        updated.team2.player2.race = defaults[updated.team2.player2.name];
        changed = true;
      }

      if (changed) {
        setEditedMatch(updated);
        onUpdate(updated);
      }
    };

    applyDefaults();
  }, [match]);

  const updatePlayerRace = (
    team: 'team1' | 'team2',
    player: 'player1' | 'player2',
    race: Race
  ) => {
    const updated = {
      ...editedMatch,
      [team]: {
        ...editedMatch[team],
        [player]: {
          ...editedMatch[team][player],
          race
        }
      }
    };
    setEditedMatch(updated);
    onUpdate(updated);
  };

  const updateScore = (team: 'team1' | 'team2', score: number | null) => {
    const updated = {
      ...editedMatch,
      [`${team}_score`]: score === null || isNaN(score) ? null : score
    };
    setEditedMatch(updated);
    onUpdate(updated);
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{match.round}</h3>
          <p className="text-sm text-gray-500">{match.match_id}</p>
        </div>
        {match.date && (
          <span className="text-sm text-gray-500">{match.date}</span>
        )}
      </div>

      {/* Score Section */}
      <div className="mb-4 pb-4 border-b border-gray-200">
        <div className="flex items-center justify-center gap-4">
          <div className="flex-1 text-right">
            <label className="block text-sm font-medium text-gray-700 mb-1">Team 1 Score</label>
            <input
              type="number"
              min="0"
              value={editedMatch.team1_score ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                updateScore('team1', value);
              }}
              placeholder="-"
              className="w-20 px-3 py-2 text-xl font-bold text-gray-900 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div className="text-2xl font-bold text-gray-400">:</div>
          <div className="flex-1 text-left">
            <label className="block text-sm font-medium text-gray-700 mb-1">Team 2 Score</label>
            <input
              type="number"
              min="0"
              value={editedMatch.team2_score ?? ''}
              onChange={(e) => {
                const value = e.target.value === '' ? null : parseInt(e.target.value, 10);
                updateScore('team2', value);
              }}
              placeholder="-"
              className="w-20 px-3 py-2 text-xl font-bold text-gray-900 border border-gray-300 rounded text-center focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>
        <div className="text-center mt-2">
          <span className="text-xs text-gray-500">Best of {match.best_of}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Team 1 */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <span className="font-medium text-gray-700">Team 1</span>
          </div>
          
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editedMatch.team1.player1.name}
              </label>
              <select
                value={editedMatch.team1.player1.race || ''}
                onChange={(e) =>
                  updatePlayerRace(
                    'team1',
                    'player1',
                    e.target.value as Race
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Race</option>
                {RACES.map((race) => (
                  <option key={race} value={race}>
                    {race}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editedMatch.team1.player2.name}
              </label>
              <select
                value={editedMatch.team1.player2.race || ''}
                onChange={(e) =>
                  updatePlayerRace(
                    'team1',
                    'player2',
                    e.target.value as Race
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Race</option>
                {RACES.map((race) => (
                  <option key={race} value={race}>
                    {race}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Team 2 */}
        <div className="border border-gray-200 rounded-lg p-4">
          <div className="mb-3">
            <span className="font-medium text-gray-700">Team 2</span>
          </div>
          
          <div className="space-y-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editedMatch.team2.player1.name}
              </label>
              <select
                value={editedMatch.team2.player1.race || ''}
                onChange={(e) =>
                  updatePlayerRace(
                    'team2',
                    'player1',
                    e.target.value as Race
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Race</option>
                {RACES.map((race) => (
                  <option key={race} value={race}>
                    {race}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {editedMatch.team2.player2.name}
              </label>
              <select
                value={editedMatch.team2.player2.race || ''}
                onChange={(e) =>
                  updatePlayerRace(
                    'team2',
                    'player2',
                    e.target.value as Race
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Race</option>
                {RACES.map((race) => (
                  <option key={race} value={race}>
                    {race}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {match.games.length > 0 && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Games</h4>
          <div className="space-y-1">
            {match.games.map((game, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-sm text-gray-600"
              >
                <span>{game.map}</span>
                <span className="font-medium">
                  Winner: Team {game.winner}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
