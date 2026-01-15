// This component is deprecated - use BracketView instead
import { useState } from 'react';
import { TournamentData, Match } from '../types/tournament';
import { MatchEditor } from './MatchEditor';

interface TournamentViewerProps {
  data: TournamentData;
  onDataChange?: (updatedData: TournamentData) => void;
}

export function TournamentViewer({ data, onDataChange }: TournamentViewerProps) {
  const [tournamentData, setTournamentData] = useState<TournamentData>(data);

  const handleMatchUpdate = (updatedMatch: Match) => {
    const updatedMatches = tournamentData.matches.map((m) =>
      m.match_id === updatedMatch.match_id ? updatedMatch : m
    );
    const updatedData = {
      ...tournamentData,
      matches: updatedMatches
    };
    setTournamentData(updatedData);
    onDataChange?.(updatedData);
  };

  const groupedMatches = tournamentData.matches.reduce((acc, match) => {
    if (!acc[match.round]) {
      acc[match.round] = [];
    }
    acc[match.round].push(match);
    return acc;
  }, {} as Record<string, Match[]>);

  const downloadJSON = () => {
    const jsonStr = JSON.stringify(tournamentData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournamentData.tournament.liquipedia_slug.replace(/\//g, '_')}_edited.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Tournament Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {tournamentData.tournament.name}
            </h1>
            <div className="space-y-1 text-gray-600">
              {tournamentData.tournament.date && (
                <p>Date: {tournamentData.tournament.date}</p>
              )}
              {tournamentData.tournament.prize_pool && (
                <p>Prize Pool: ${tournamentData.tournament.prize_pool.toLocaleString()}</p>
              )}
              {tournamentData.tournament.format && (
                <p>Format: {tournamentData.tournament.format}</p>
              )}
            </div>
          </div>
          <button
            onClick={downloadJSON}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Download JSON
          </button>
        </div>

        {tournamentData.tournament.maps.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Maps</h3>
            <div className="flex flex-wrap gap-2">
              {tournamentData.tournament.maps.map((map, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                >
                  {map}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Matches by Round */}
      <div className="space-y-6">
        {Object.entries(groupedMatches).map(([round, matches]) => (
          <div key={round}>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">
              {round} ({matches.length} matches)
            </h2>
            <div className="grid gap-4">
              {matches.map((match) => (
                <MatchEditor
                  key={match.match_id}
                  match={match}
                  onUpdate={handleMatchUpdate}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
