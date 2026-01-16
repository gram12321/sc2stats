import { useState, useMemo, useEffect } from 'react';
import { TournamentData, Match } from '../types/tournament';
import { MatchBox } from './MatchBox';
import { MatchEditor } from './MatchEditor';

interface BracketViewProps {
  data: TournamentData;
  filename: string;
  onDataChange?: (updatedData: TournamentData) => void;
}

export function BracketView({ data, filename, onDataChange }: BracketViewProps) {
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [tournamentData, setTournamentData] = useState<TournamentData>(data);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  
  // Separate group stage matches from bracket matches
  const { groupStageMatches, bracketMatches, groupNames } = useMemo(() => {
    const groups: Match[] = [];
    const bracket: Match[] = [];
    const groupSet = new Set<string>();
    
    tournamentData.matches.forEach(match => {
      if (match.round.startsWith('Group ')) {
        groups.push(match);
        groupSet.add(match.round);
      } else {
        bracket.push(match);
      }
    });
    
    return {
      groupStageMatches: groups,
      bracketMatches: bracket,
      groupNames: Array.from(groupSet).sort()
    };
  }, [tournamentData.matches]);
  
  // Default to groups if no bracket matches, otherwise playoffs
  const [activeTab, setActiveTab] = useState<'playoffs' | 'groups'>('playoffs');
  
  // Update active tab when data changes
  useEffect(() => {
    if (bracketMatches.length === 0 && groupStageMatches.length > 0) {
      setActiveTab('groups');
    } else if (bracketMatches.length > 0) {
      setActiveTab('playoffs');
    }
  }, [bracketMatches.length, groupStageMatches.length]);

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

  // Separate rounds into upper bracket and lower bracket
  // Lower bracket rounds are explicitly named "Lower Bracket", everything else is upper bracket
  const { upperBracketRounds, lowerBracketRounds } = useMemo(() => {
    const uniqueRounds = Array.from(new Set(bracketMatches.map(m => m.round)));
    
    // Define round order for upper bracket (single-elimination or upper bracket of double-elimination)
    const upperBracketOrder = [
      'Round of 16',
      'Upper Bracket Semifinals',
      'Quarterfinals',
      'Upper Bracket Final',
      'Semifinals',
      'Grand Final'
    ];
    
    // Define round order for lower bracket
    const lowerBracketOrder = [
      'Lower Bracket Quarterfinals',
      'Lower Bracket Semifinals',
      'Lower Bracket Final'
    ];
    
    const upperRounds: string[] = [];
    const lowerRounds: string[] = [];
    
    uniqueRounds.forEach(round => {
      if (round.includes('Lower Bracket')) {
        lowerRounds.push(round);
      } else {
        upperRounds.push(round);
      }
    });
    
    // Sort upper bracket rounds
    const sortedUpper = upperRounds.sort((a, b) => {
      const aIndex = upperBracketOrder.indexOf(a);
      const bIndex = upperBracketOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    // Sort lower bracket rounds
    const sortedLower = lowerRounds.sort((a, b) => {
      const aIndex = lowerBracketOrder.indexOf(a);
      const bIndex = lowerBracketOrder.indexOf(b);
      if (aIndex !== -1 && bIndex !== -1) return aIndex - bIndex;
      if (aIndex !== -1) return -1;
      if (bIndex !== -1) return 1;
      return a.localeCompare(b);
    });
    
    return {
      upperBracketRounds: sortedUpper,
      lowerBracketRounds: sortedLower
    };
  }, [bracketMatches]);

  const groupedMatches = useMemo(() => {
    const allRounds = [...upperBracketRounds, ...lowerBracketRounds];
    return allRounds.reduce((acc, round) => {
      const matches = bracketMatches.filter(m => m.round === round);
      if (matches.length > 0) {
        acc[round] = matches.sort((a, b) => {
          // Sort by match_id to maintain order
          return a.match_id.localeCompare(b.match_id);
        });
      }
      return acc;
    }, {} as Record<string, Match[]>);
  }, [bracketMatches, upperBracketRounds, lowerBracketRounds]);

  const groupedByGroup = useMemo(() => {
    return groupNames.reduce((acc, groupName) => {
      acc[groupName] = groupStageMatches
        .filter(m => m.round === groupName)
        .sort((a, b) => a.match_id.localeCompare(b.match_id));
      return acc;
    }, {} as Record<string, Match[]>);
  }, [groupStageMatches, groupNames]);
  
  const isDoubleElimination = lowerBracketRounds.length > 0;

  const saveTournament = async () => {
    try {
      setIsSaving(true);
      setSaveMessage(null);
      const response = await fetch(`/api/tournaments/${encodeURIComponent(filename)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(tournamentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(errorData.error || `Failed to save tournament (${response.status})`);
      }
      
      setSaveMessage('Tournament saved successfully!');
      setTimeout(() => setSaveMessage(null), 3000);
    } catch (err) {
      setSaveMessage(err instanceof Error ? err.message : 'Failed to save tournament');
    } finally {
      setIsSaving(false);
    }
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
              {saveMessage && (
                <span className={`text-sm px-3 py-1 rounded ${
                  saveMessage.includes('success') 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {saveMessage}
                </span>
              )}
              <button
                onClick={saveTournament}
                disabled={isSaving}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {isSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs for Group Stage vs Playoffs */}
      {groupStageMatches.length > 0 && (
        <div className="bg-white border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-6">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('playoffs')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'playoffs'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Playoffs ({bracketMatches.length})
              </button>
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${
                  activeTab === 'groups'
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                Group Stage ({groupStageMatches.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Group Stage View */}
      {activeTab === 'groups' && groupStageMatches.length > 0 && (
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="space-y-8">
            {groupNames.map((groupName) => (
              <div key={groupName} className="bg-white rounded-lg border border-gray-200 shadow-sm">
                <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                  <h2 className="text-xl font-bold text-gray-900">{groupName}</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    {groupedByGroup[groupName]?.length || 0} matches
                  </p>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {groupedByGroup[groupName]?.map((match) => (
                      <MatchBox
                        key={match.match_id}
                        match={match}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch(match);
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Bracket/Playoffs View */}
      {activeTab === 'playoffs' && bracketMatches.length > 0 && (
      <div className="max-w-full overflow-x-auto py-6">
        {isDoubleElimination ? (
          // Double-elimination: Show upper and lower brackets side by side
          <div className="flex gap-12 px-6">
            {/* Upper Bracket */}
            <div className="flex-shrink-0">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-bold text-gray-900 bg-blue-100 px-4 py-2 rounded">
                  Upper Bracket
                </h2>
              </div>
              <div className="inline-flex gap-8">
                {upperBracketRounds
                  .filter(round => round !== 'Grand Final')
                  .map((round, roundIndex) => {
                    const matches = groupedMatches[round] || [];
                    if (matches.length === 0) return null;
                    const filteredRounds = upperBracketRounds.filter(r => r !== 'Grand Final');

                    return (
                      <div key={round} className="flex flex-col">
                        {/* Round Header */}
                        <div className="mb-4 text-center">
                          <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                            {round}
                          </h3>
                        </div>

                        {/* Matches */}
                        <div className="flex flex-col gap-4 justify-center min-h-[400px]">
                          {matches.map((match) => (
                            <div key={match.match_id} className="relative">
                              <MatchBox
                                match={match}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedMatch(match);
                                }}
                              />
                              
                              {/* Connecting line to next round */}
                              {roundIndex < filteredRounds.length - 1 && (
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

            {/* Lower Bracket */}
            <div className="flex-shrink-0">
              <div className="mb-4 text-center">
                <h2 className="text-lg font-bold text-gray-900 bg-red-100 px-4 py-2 rounded">
                  Lower Bracket
                </h2>
              </div>
              <div className="inline-flex gap-8">
                {lowerBracketRounds.map((round, roundIndex) => {
                  const matches = groupedMatches[round] || [];
                  if (matches.length === 0) return null;

                  return (
                    <div key={round} className="flex flex-col">
                      {/* Round Header */}
                      <div className="mb-4 text-center">
                        <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                          {round}
                        </h3>
                      </div>

                      {/* Matches */}
                      <div className="flex flex-col gap-4 justify-center min-h-[400px]">
                        {matches.map((match) => (
                          <div key={match.match_id} className="relative">
                            <MatchBox
                              match={match}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatch(match);
                              }}
                            />
                            
                            {/* Connecting line to next round */}
                            {roundIndex < lowerBracketRounds.length - 1 && (
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

            {/* Grand Final (if exists) - shown separately after lower bracket */}
            {upperBracketRounds.includes('Grand Final') && (
              <div className="flex-shrink-0">
                <div className="mb-4 text-center">
                  <h2 className="text-lg font-bold text-gray-900 bg-yellow-100 px-4 py-2 rounded">
                    Grand Final
                  </h2>
                </div>
                <div className="flex flex-col">
                  {groupedMatches['Grand Final']?.map((match) => (
                    <div key={match.match_id}>
                      <MatchBox
                        match={match}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedMatch(match);
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          // Single-elimination: Show all rounds in a single row
          <div className="inline-flex gap-8 px-6">
            {upperBracketRounds.map((round, roundIndex) => {
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
                    {matches.map((match) => (
                      <div key={match.match_id} className="relative">
                        <MatchBox
                          match={match}
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedMatch(match);
                          }}
                        />
                        
                        {/* Connecting line to next round */}
                        {roundIndex < upperBracketRounds.length - 1 && (
                          <div className="absolute top-1/2 -right-4 w-4 h-px bg-gray-400"></div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {/* Edit Modal */}
      {selectedMatch && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={(e) => {
            // Only close if clicking directly on the backdrop, not on child elements
            if (e.target === e.currentTarget) {
              setSelectedMatch(null);
            }
          }}
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
