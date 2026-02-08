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
  const [teamRankings, setTeamRankings] = useState<Record<string, number>>({});
  const [allPlayers, setAllPlayers] = useState<string[]>([]);
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [selectedEarlyRound, setSelectedEarlyRound] = useState<string>('Early Round 1');
  const [emptyEarlyRounds, setEmptyEarlyRounds] = useState<string[]>([]);
  const [newMatch, setNewMatch] = useState<Partial<Match>>({
    round: 'Early Round 1',
    team1: { player1: { name: '' }, player2: { name: '' } },
    team2: { player1: { name: '' }, player2: { name: '' } },
    team1_score: null,
    team2_score: null,
    best_of: 3,
    date: tournamentData.tournament.date,
    games: []
  });

  // Load team rankings and all players
  useEffect(() => {
    const loadTeamRankings = async () => {
      try {
        const response = await fetch('/api/team-rankings');
        if (!response.ok) return;
        const data = await response.json();
        // Create a map of team key (sorted players) -> rank
        const rankMap: Record<string, number> = {};
        data.forEach((team: any, index: number) => {
          const teamKey = [team.player1, team.player2].sort().join('+');
          rankMap[teamKey] = index + 1;
        });
        setTeamRankings(rankMap);
      } catch (err) {
        console.error('Error loading team rankings:', err);
      }
    };
    
    const loadPlayers = async () => {
      try {
        const response = await fetch('/api/players');
        if (!response.ok) return;
        const data = await response.json();
        // API returns an array of player name strings, already sorted
        setAllPlayers(data);
      } catch (err) {
        console.error('Error loading players:', err);
      }
    };
    
    loadTeamRankings();
    loadPlayers();
  }, []);

  // Update effect to handle prop changes and auto-detection
  useEffect(() => {
    const updatedTournament = { ...data.tournament };
    let hasChanges = false;

    // Auto-detect Main Circuit
    // Check if filename starts with variations of "Uthermal" (case insensitive for safety)
    if (updatedTournament.is_main_circuit === undefined) {
      const lowerFilename = filename.toLowerCase();
      if (lowerFilename.startsWith('utermal_2v2_circuit') || lowerFilename.startsWith('uthermal_2v2_circuit')) {
        updatedTournament.is_main_circuit = true;
        hasChanges = true;
      } else {
        updatedTournament.is_main_circuit = false;
        hasChanges = true;
      }
    }

    // Auto-detect Season
    if (updatedTournament.season === undefined && updatedTournament.date) {
      const year = new Date(updatedTournament.date).getFullYear();
      if (!isNaN(year)) {
        updatedTournament.season = year;
        hasChanges = true;
      }
    }

    if (hasChanges) {
      const newData = {
        ...data,
        tournament: updatedTournament
      };
      setTournamentData(newData);
      // Propagate changes to parent so they persist if we navigate away or save
      onDataChange?.(newData);
    } else {
      setTournamentData(data);
    }
  }, [data, filename, onDataChange]);


  // Separate group stage matches from bracket matches
  const { groupStageMatches, bracketMatches, earlyRoundsMatches, earlyRoundNames, groupNames } = useMemo(() => {
    const groups: Match[] = [];
    const bracket: Match[] = [];
    const earlyRounds: Match[] = [];
    const groupSet = new Set<string>();
    const earlyRoundSet = new Set<string>();

    tournamentData.matches.forEach(match => {
      if (match.round.startsWith('Early Round ')) {
        earlyRounds.push(match);
        earlyRoundSet.add(match.round);
      } else if (match.round.startsWith('Group ')) {
        groups.push(match);
        groupSet.add(match.round);
      } else {
        bracket.push(match);
      }
    });

    // Combine rounds from matches and empty rounds
    const allEarlyRounds = new Set([...earlyRoundSet, ...emptyEarlyRounds]);

    // Sort early rounds by number (Early Round 1, Early Round 2, etc.)
    const sortedEarlyRounds = Array.from(allEarlyRounds).sort((a, b) => {
      const numA = parseInt(a.replace('Early Round ', ''));
      const numB = parseInt(b.replace('Early Round ', ''));
      return numA - numB;
    });

    return {
      groupStageMatches: groups,
      bracketMatches: bracket,
      earlyRoundsMatches: earlyRounds,
      earlyRoundNames: sortedEarlyRounds,
      groupNames: Array.from(groupSet).sort()
    };
  }, [tournamentData.matches, emptyEarlyRounds]);

  // Default to groups if no bracket matches, otherwise playoffs
  const [activeTab, setActiveTab] = useState<'playoffs' | 'groups' | 'early'>('playoffs');

  // Update active tab when data changes
  useEffect(() => {
    if (bracketMatches.length === 0 && groupStageMatches.length > 0) {
      setActiveTab('groups');
    } else if (bracketMatches.length > 0) {
      setActiveTab('playoffs');
    }
  }, [bracketMatches.length, groupStageMatches.length]);

  // Ensure selectedEarlyRound is always valid
  useEffect(() => {
    if (earlyRoundNames.length > 0 && !earlyRoundNames.includes(selectedEarlyRound)) {
      setSelectedEarlyRound(earlyRoundNames[0]);
    }
  }, [earlyRoundNames, selectedEarlyRound]);

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

  const handleAddMatch = () => {
    // Validate that all player names are filled
    if (!newMatch.team1?.player1.name || !newMatch.team1?.player2.name ||
        !newMatch.team2?.player1.name || !newMatch.team2?.player2.name) {
      alert('Please fill in all player names');
      return;
    }

    // Remove the round from empty rounds list since it now has a match
    if (emptyEarlyRounds.includes(selectedEarlyRound)) {
      setEmptyEarlyRounds(emptyEarlyRounds.filter(r => r !== selectedEarlyRound));
    }

    // Generate unique match ID
    const timestamp = Date.now();
    const matchId = `early_${timestamp}`;

    const completeMatch: Match = {
      match_id: matchId,
      round: selectedEarlyRound,
      team1: {
        player1: { name: newMatch.team1!.player1.name, race: newMatch.team1!.player1.race || null },
        player2: { name: newMatch.team1!.player2.name, race: newMatch.team1!.player2.race || null }
      },
      team2: {
        player1: { name: newMatch.team2!.player1.name, race: newMatch.team2!.player1.race || null },
        player2: { name: newMatch.team2!.player2.name, race: newMatch.team2!.player2.race || null }
      },
      team1_score: newMatch.team1_score ?? null,
      team2_score: newMatch.team2_score ?? null,
      best_of: newMatch.best_of || 3,
      date: tournamentData.tournament.date,
      games: [],
      tournament_slug: tournamentData.tournament.liquipedia_slug
    };

    const updatedData = {
      ...tournamentData,
      matches: [...tournamentData.matches, completeMatch]
    };

    setTournamentData(updatedData);
    onDataChange?.(updatedData);
    setIsAddingMatch(false);
    
    // Reset form
    setNewMatch({
      round: selectedEarlyRound,
      team1: { player1: { name: '' }, player2: { name: '' } },
      team2: { player1: { name: '' }, player2: { name: '' } },
      team1_score: null,
      team2_score: null,
      best_of: 3,
      date: tournamentData.tournament.date,
      games: []
    });

    setSaveMessage('Match added! Remember to save the tournament.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleDeleteMatch = (matchId: string) => {
    if (!confirm('Are you sure you want to delete this match?')) return;

    const updatedData = {
      ...tournamentData,
      matches: tournamentData.matches.filter(m => m.match_id !== matchId)
    };

    setTournamentData(updatedData);
    onDataChange?.(updatedData);
    setSaveMessage('Match deleted! Remember to save the tournament.');
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleDeleteRound = (roundName: string) => {
    const matchesInRound = tournamentData.matches.filter(m => m.round === roundName).length;
    
    let confirmMessage = `Are you sure you want to delete "${roundName}"?`;
    if (matchesInRound > 0) {
      confirmMessage = `Are you sure you want to delete "${roundName}" and all ${matchesInRound} match(es) in it?`;
    }
    
    if (!confirm(confirmMessage)) return;

    // Remove all matches in this round
    const updatedData = {
      ...tournamentData,
      matches: tournamentData.matches.filter(m => m.round !== roundName)
    };

    // Remove from empty rounds if it's there
    setEmptyEarlyRounds(emptyEarlyRounds.filter(r => r !== roundName));
    
    setTournamentData(updatedData);
    onDataChange?.(updatedData);
    setSaveMessage(`${roundName} deleted! Remember to save the tournament.`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const handleAddEarlyRound = () => {
    // Find the highest existing early round number
    let maxRoundNum = 0;
    earlyRoundNames.forEach(roundName => {
      const num = parseInt(roundName.replace('Early Round ', ''));
      if (num > maxRoundNum) maxRoundNum = num;
    });
    
    const newRoundName = `Early Round ${maxRoundNum + 1}`;
    setEmptyEarlyRounds([...emptyEarlyRounds, newRoundName]);
    setSelectedEarlyRound(newRoundName);
    setSaveMessage(`${newRoundName} created! Add matches to it.`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const groupedEarlyRounds = useMemo(() => {
    return earlyRoundNames.reduce((acc, roundName) => {
      acc[roundName] = earlyRoundsMatches
        .filter(m => m.round === roundName)
        .sort((a, b) => a.match_id.localeCompare(b.match_id));
      return acc;
    }, {} as Record<string, Match[]>);
  }, [earlyRoundsMatches, earlyRoundNames]);

  // Separate rounds into upper bracket and lower bracket
  // Lower bracket rounds are explicitly named "Lower Bracket", everything else is upper bracket
  const { upperBracketRounds, lowerBracketRounds } = useMemo(() => {
    const uniqueRounds = Array.from(new Set(bracketMatches.map(m => m.round)));

    // Define round order for upper bracket (single-elimination or upper bracket of double-elimination)
    const upperBracketOrder = [
      'Round of 16',
      'Upper Bracket Quarterfinals',
      'Quarterfinals',
      'Upper Bracket Semifinals',
      'Semifinals',
      'Upper Bracket Final',
      'Grand Final'
    ];

    // Define round order for lower bracket
    const lowerBracketOrder = [
      'Lower Bracket Round 1',
      'Lower Bracket Round 2',
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
              <div className="flex items-center gap-4 mt-2">
                <label className="flex items-center gap-2 cursor-pointer bg-gray-50 px-3 py-1 rounded border border-gray-200 hover:bg-gray-100">
                  <input
                    type="checkbox"
                    checked={tournamentData.tournament.is_main_circuit || false}
                    onChange={(e) => {
                      const newData = {
                        ...tournamentData,
                        tournament: {
                          ...tournamentData.tournament,
                          is_main_circuit: e.target.checked
                        }
                      };
                      setTournamentData(newData);
                      onDataChange?.(newData);
                    }}
                    className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">Main Circuit</span>
                </label>

                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-700">Season:</span>
                  <input
                    type="number"
                    value={tournamentData.tournament.season || ''}
                    placeholder="Year"
                    onChange={(e) => {
                      const val = parseInt(e.target.value);
                      const newData = {
                        ...tournamentData,
                        tournament: {
                          ...tournamentData.tournament,
                          season: isNaN(val) ? undefined : val
                        }
                      };
                      setTournamentData(newData);
                      onDataChange?.(newData);
                    }}
                    className="w-20 px-2 py-1 text-sm border border-gray-300 rounded focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {saveMessage && (
                <span className={`text-sm px-3 py-1 rounded ${saveMessage.includes('success')
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

      {/* Tabs for Early Rounds, Group Stage, and Playoffs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex gap-1">
            <button
              onClick={() => setActiveTab('early')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'early'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Early Rounds ({earlyRoundsMatches.length})
            </button>
            {groupStageMatches.length > 0 && (
              <button
                onClick={() => setActiveTab('groups')}
                className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'groups'
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
                  }`}
              >
                Group Stage ({groupStageMatches.length})
              </button>
            )}
            <button
              onClick={() => setActiveTab('playoffs')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === 'playoffs'
                ? 'text-blue-600 border-b-2 border-blue-600'
                : 'text-gray-600 hover:text-gray-900'
                }`}
            >
              Playoffs ({bracketMatches.length})
            </button>
          </div>
        </div>
      </div>

      {/* Early Rounds View */}
      {activeTab === 'early' && (
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-6 mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Early Rounds</h2>
              <p className="text-sm text-gray-600 mt-1">
                Manually add matches that occurred before the main bracket
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleAddEarlyRound}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                + Add Round
              </button>
              {earlyRoundNames.length > 0 && (
                <button
                  onClick={() => {
                    // Ensure selectedEarlyRound is valid before opening form
                    if (!earlyRoundNames.includes(selectedEarlyRound) && earlyRoundNames.length > 0) {
                      setSelectedEarlyRound(earlyRoundNames[0]);
                    }
                    setIsAddingMatch(!isAddingMatch);
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {isAddingMatch ? 'Cancel' : '+ Add Match'}
                </button>
              )}
            </div>
          </div>
          
          {/* Add Match Form */}
          {isAddingMatch && (
            <div className="max-w-7xl mx-auto px-6 mb-6">
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">New Match</h3>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700">Add to:</label>
                    <select
                      value={selectedEarlyRound}
                      onChange={(e) => {
                        const newRound = e.target.value;
                        setSelectedEarlyRound(newRound);
                      }}
                      className="px-3 py-1 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                      {earlyRoundNames.map(roundName => (
                        <option key={roundName} value={roundName}>{roundName}</option>
                      ))}
                    </select>
                  </div>
                </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Team 1 */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Team 1</h4>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 1 Name</label>
                        <input
                          type="text"
                          list="player-suggestions"
                          value={newMatch.team1?.player1.name || ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team1: {
                              ...newMatch.team1!,
                              player1: { ...newMatch.team1!.player1, name: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 2 Name</label>
                        <input
                          type="text"
                          list="player-suggestions"
                          value={newMatch.team1?.player2.name || ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team1: {
                              ...newMatch.team1!,
                              player2: { ...newMatch.team1!.player2, name: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Team 1 Score</label>
                        <input
                          type="number"
                          min="0"
                          value={newMatch.team1_score ?? ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team1_score: e.target.value ? parseInt(e.target.value) : null
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Score"
                        />
                      </div>
                    </div>

                    {/* Team 2 */}
                    <div className="space-y-3">
                      <h4 className="font-medium text-gray-700">Team 2</h4>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 1 Name</label>
                        <input
                          type="text"
                          list="player-suggestions"
                          value={newMatch.team2?.player1.name || ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team2: {
                              ...newMatch.team2!,
                              player1: { ...newMatch.team2!.player1, name: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 2 Name</label>
                        <input
                          type="text"
                          list="player-suggestions"
                          value={newMatch.team2?.player2.name || ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team2: {
                              ...newMatch.team2!,
                              player2: { ...newMatch.team2!.player2, name: e.target.value }
                            }
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Team 2 Score</label>
                        <input
                          type="number"
                          min="0"
                          value={newMatch.team2_score ?? ''}
                          onChange={(e) => setNewMatch({
                            ...newMatch,
                            team2_score: e.target.value ? parseInt(e.target.value) : null
                          })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Score"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      onClick={handleAddMatch}
                      className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      Add Match
                    </button>
                    <button
                      onClick={() => setIsAddingMatch(false)}
                      className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                    >
                      Cancel
                    </button>
                  </div>
                </div>

                {/* Player suggestions datalist */}
                <datalist id="player-suggestions">
                  {allPlayers.map(playerName => (
                    <option key={playerName} value={playerName} />
                  ))}
                </datalist>
              </div>
            )}

          {/* Display early rounds horizontally like bracket */}
          {earlyRoundNames.length > 0 ? (
            <div className="max-w-full overflow-x-auto">
              <div className="inline-flex gap-8 px-6">
                {earlyRoundNames.map((roundName) => (
                  <div key={roundName} className="flex flex-col min-w-[200px]">
                    {/* Round Header */}
                    <div className="mb-4 text-center relative">
                      <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                        {roundName}
                      </h3>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteRound(roundName);
                        }}
                        className="absolute top-0 right-0 p-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500"
                        title={`Delete ${roundName}`}
                      >
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      <p className="text-xs text-gray-500 mt-1">
                        {groupedEarlyRounds[roundName]?.length || 0} matches
                      </p>
                    </div>

                    {/* Matches */}
                    <div className="flex flex-col gap-4 py-4">
                      {groupedEarlyRounds[roundName]?.length > 0 ? (
                        groupedEarlyRounds[roundName].map((match) => (
                          <div key={match.match_id} className="relative">
                            <MatchBox
                              match={match}
                              teamRankings={teamRankings}
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedMatch(match);
                              }}
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteMatch(match.match_id);
                              }}
                              className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-500 z-10"
                              title="Delete match"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-8 text-gray-400 text-sm">
                          <svg className="w-8 h-8 mx-auto mb-2 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          <p>No matches yet</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-7xl mx-auto px-6">
              <div className="bg-white rounded-lg border border-gray-200 shadow-sm p-8 text-center">
                <div className="text-gray-500">
                  <svg className="w-12 h-12 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-lg font-medium mb-2">No early rounds created yet</p>
                  <p className="text-sm mb-4">Click "+ Add Round" to create your first early round</p>
                </div>
              </div>
            </div>
          )}
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
                        teamRankings={teamRankings}
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
                        <div key={round} className="flex flex-col min-w-[200px]">
                          {/* Round Header */}
                          <div className="mb-4 text-center">
                            <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                              {round}
                            </h3>
                          </div>

                          {/* Matches */}
                          <div className="flex flex-col justify-around flex-grow py-4 min-h-[400px]">
                            {matches.map((match) => (
                              <div key={match.match_id} className="relative">
                                <MatchBox
                                  match={match}
                                  teamRankings={teamRankings}
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
                      <div key={round} className="flex flex-col min-w-[200px]">
                        {/* Round Header */}
                        <div className="mb-4 text-center">
                          <h3 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                            {round}
                          </h3>
                        </div>

                        {/* Matches */}
                        <div className="flex flex-col justify-around flex-grow py-4 min-h-[400px]">
                          {matches.map((match) => (
                            <div key={match.match_id} className="relative">
                              <MatchBox
                                match={match}
                                teamRankings={teamRankings}
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
                          teamRankings={teamRankings}
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
                  <div key={round} className="flex flex-col min-w-[200px]">
                    {/* Round Header */}
                    <div className="mb-4 text-center">
                      <h2 className="text-sm font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded">
                        {round}
                      </h2>
                    </div>

                    {/* Matches */}
                    <div className="flex flex-col justify-around flex-grow py-4 min-h-[400px]">
                      {matches.map((match) => (
                        <div key={match.match_id} className="relative">
                          <MatchBox
                            match={match}
                            teamRankings={teamRankings}
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
