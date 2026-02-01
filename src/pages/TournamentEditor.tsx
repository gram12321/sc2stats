import { useState, useEffect } from 'react';
import { TournamentData } from '../types/tournament';
import { BracketView } from '../components/BracketView';

interface TournamentInfo {
  filename: string;
  name: string;
  slug: string;
  date: string | null;
  matchCount: number;
}

interface TournamentEditorProps {
  // no props needed for now
}

export function TournamentEditor({ }: TournamentEditorProps) {
  const [tournaments, setTournaments] = useState<TournamentInfo[]>([]);
  const [selectedTournament, setSelectedTournament] = useState<TournamentData | null>(null);
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingTournament, setIsLoadingTournament] = useState(false);

  useEffect(() => {
    loadTournaments();
  }, []);

  const loadTournaments = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/tournaments');
      if (!response.ok) throw new Error('Failed to load tournaments');
      const data = await response.json();
      // Filter out non-tournament files
      const filtered = data.filter((t: TournamentInfo) =>
        !t.filename.startsWith('seeded_') && t.filename !== 'player_defaults.json'
      );
      // Sort by date descending (newest first), then by name if no date
      const sorted = filtered.sort((a: TournamentInfo, b: TournamentInfo) => {
        if (a.date && b.date) {
          return new Date(b.date).getTime() - new Date(a.date).getTime();
        }
        if (a.date && !b.date) return -1;
        if (!a.date && b.date) return 1;
        return a.name.localeCompare(b.name);
      });
      setTournaments(sorted);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournaments');
    } finally {
      setIsLoading(false);
    }
  };

  const loadTournament = async (filename: string) => {
    try {
      setIsLoadingTournament(true);
      setError(null);
      const response = await fetch(`/api/tournaments/${filename}`);
      if (!response.ok) throw new Error('Failed to load tournament');
      const data = await response.json() as TournamentData;

      // Validate data structure
      if (!data.tournament || !data.matches) {
        throw new Error('Invalid tournament data format');
      }

      setSelectedTournament(data);
      setSelectedFilename(filename);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament');
    } finally {
      setIsLoadingTournament(false);
    }
  };

  const handleDataChange = (updatedData: TournamentData) => {
    setSelectedTournament(updatedData);
  };

  const handleBack = () => {
    setSelectedTournament(null);
    setSelectedFilename(null);
  };

  if (selectedTournament && selectedFilename) {
    return (
      <div>
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
            <button
              onClick={handleBack}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500"
            >
              ← Back to Tournament List
            </button>
          </div>
        </div>
        <BracketView
          data={selectedTournament}
          filename={selectedFilename}
          onDataChange={handleDataChange}
        />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-foreground">Tournaments</h1>
          <p className="text-muted-foreground mt-1">
            Select a tournament to view details and edit player races
          </p>
        </div>
        {isLoading ? (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            <p className="mt-4 text-muted-foreground">Loading tournaments...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-red-800">{error}</p>
            <button
              onClick={loadTournaments}
              className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
            >
              Retry
            </button>
          </div>
        ) : tournaments.length === 0 ? (
          <div className="bg-card rounded-lg border border-border p-8 shadow-sm text-center">
            <div className="mb-4">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              No Tournaments Found
            </h2>
            <p className="text-muted-foreground mb-6">
              Run the scraper to generate tournament JSON files
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h3 className="text-sm font-semibold text-blue-900 mb-2">
                How to get started:
              </h3>
              <ol className="list-decimal list-inside space-y-1 text-sm text-blue-800">
                <li>Run the scraper: <code className="bg-blue-100 px-1 rounded">node tools/scraper.js &lt;url&gt;</code></li>
                <li>Start the API server: <code className="bg-blue-100 px-1 rounded">npm run api</code></li>
                <li>Refresh this page to see available tournaments</li>
              </ol>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">
                Available Tournaments ({tournaments.length})
              </h2>
              <button
                onClick={loadTournaments}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh
              </button>
            </div>

            {tournaments.map((tournament) => (
              <div
                key={tournament.filename}
                onClick={() => loadTournament(tournament.filename)}
                className="bg-card rounded-lg border border-border p-4 hover:border-primary hover:shadow-md cursor-pointer transition-all"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-gray-900">
                      {tournament.name}
                    </h3>
                    <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                      {tournament.date && <span>{tournament.date}</span>}
                      <span>{tournament.matchCount} matches</span>
                    </div>
                  </div>
                  <div className="ml-4">
                    <svg
                      className="w-5 h-5 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoadingTournament && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <p className="mt-4 text-gray-600">Loading tournament...</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
