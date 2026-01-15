import { useState } from 'react';
import { TournamentData, Match } from '../types/tournament';
import { MatchBox } from './MatchBox';
import { MatchEditor } from './MatchEditor';

interface BracketViewProps {
  data: TournamentData;
  onDataChange?: (updatedData: TournamentData) => void;
}

export function BracketView({ data, onDataChange }: BracketViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
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
    setSelectedMatch(null);
  };

  // Group matches by round and order them
  const rounds = ['Round of 16', 'Quarterfinals', 'Semifinals', 'Grand Final'];
  const groupedMatches = rounds.reduce((acc, round) => {
    const matches = tournamentData.matches.filter(m => m.round === round);
    if (matches.length > 0) {
      acc[round] = matches.sort((a, b) => {
        // Sort by match_id to maintain order
        return a.match_id.localeCompare(b.match_id);
      });
    }
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {tournamentData.tournament.name}
              </h1>
              <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                {tournamentData.tournament.date && (
                  <span>Date: {tournamentData.tournament.date}</span>
                )}
                {tournamentData.tournament.prize_pool && (
                  <span>Prize Pool: ${tournamentData.tournament.prize_pool.toLocaleString()}</span>
                )}
                <span>{tournamentData.matches.length} matches</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={downloadJSON}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Download JSON
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bracket */}
      <div className="max-w-full overflow-x-auto py-6">
        <div className="inline-flex gap-8 px-6">
          {rounds.map((round, roundIndex) => {
            const matches = groupedMatches[round] || [];
            if (matches.length === 0) return null;

            return (
              <div key={round} className="flex flex-col">
                {/* Round Header */}
                <div className="mb-4 text-center">
                  <h2 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                    {round}
                  </h2>
                </div>

                {/* Matches */}
                <div className="flex flex-col gap-4 justify-center min-h-[400px]">
                  {matches.map((match, matchIndex) => (
                    <div key={match.match_id} className="relative">
                      <MatchBox
                        match={match}
                        onClick={() => setSelectedMatch(match)}
                      />
                      
                      {/* Connecting line to next round */}
                      {roundIndex < rounds.length - 1 && (
                        <div className="absolute top-1/2 -right-4 w-4 h-px bg-gray-400"></div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Edit Modal */}
      {selectedMatch && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => setSelectedMatch(null)}
        >
          <div
            className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Edit Match</h3>
              <button
                onClick={() => setSelectedMatch(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              <MatchEditor
                match={selectedMatch}
                onUpdate={handleMatchUpdate}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
