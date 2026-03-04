import { useState, useMemo, useEffect } from 'react';
import { TournamentData, Match } from '../types/tournament';
import { MatchBox } from './MatchBox';
import { MatchEditor } from './MatchEditor';
import { useRankingSettings } from '../context/RankingSettingsContext';

type EarlyRoundType = 'standard' | 'upper' | 'lower';

const EARLY_ROUND_LABELS: Record<EarlyRoundType, string> = {
  standard: 'Round',
  upper: 'Upper Bracket',
  lower: 'Lower Bracket'
};

const EARLY_ROUND_SECTION_TITLES: Record<EarlyRoundType, string> = {
  standard: 'Early Rounds',
  upper: 'Early Upper Bracket',
  lower: 'Early Lower Bracket'
};

const EARLY_ROUND_TYPE_ORDER: Record<EarlyRoundType, number> = {
  standard: 0,
  upper: 1,
  lower: 2
};

const parseEarlyRound = (roundName: string): { type: EarlyRoundType; number: number } | null => {
  const standardMatch = roundName.match(/^Early Round (\d+)$/i);
  if (standardMatch) {
    return {
      type: 'standard',
      number: parseInt(standardMatch[1], 10)
    };
  }

  const upperMatch = roundName.match(/^Early Upper Bracket Round (\d+)$/i);
  if (upperMatch) {
    return {
      type: 'upper',
      number: parseInt(upperMatch[1], 10)
    };
  }

  const lowerMatch = roundName.match(/^Early Lower Bracket Round (\d+)$/i);
  if (lowerMatch) {
    return {
      type: 'lower',
      number: parseInt(lowerMatch[1], 10)
    };
  }

  return null;
};

const formatEarlyRoundName = (type: EarlyRoundType, number: number): string => {
  if (type === 'upper') return `Early Upper Bracket Round ${number}`;
  if (type === 'lower') return `Early Lower Bracket Round ${number}`;
  return `Early Round ${number}`;
};

const getTeamKey = (team?: Match['team1']): string | null => {
  const player1 = team?.player1?.name?.trim() || '';
  const player2 = team?.player2?.name?.trim() || '';
  const names = [player1, player2].filter(Boolean).sort();
  if (names.length < 2) return null;
  return names.join('+');
};

const normalizePlayerName = (name?: string): string => {
  return String(name || '').trim().toLowerCase();
};

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
  const [historicalTeammates, setHistoricalTeammates] = useState<Record<string, string[]>>({});
  const [isAddingMatch, setIsAddingMatch] = useState(false);
  const [selectedEarlyRound, setSelectedEarlyRound] = useState<string>('Early Round 1');
  const [newEarlyRoundType, setNewEarlyRoundType] = useState<EarlyRoundType>('standard');
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
  const { useSeededRankings, mainCircuitOnly, seasons } = useRankingSettings();

  const tournamentTeammates = useMemo(() => {
    const teammateCounts = new Map<string, Map<string, number>>();

    const addTeammate = (playerA?: string, playerB?: string) => {
      const normalizedA = normalizePlayerName(playerA);
      const normalizedB = normalizePlayerName(playerB);
      if (!normalizedA || !normalizedB || normalizedA === normalizedB || !playerB?.trim()) return;

      if (!teammateCounts.has(normalizedA)) {
        teammateCounts.set(normalizedA, new Map<string, number>());
      }

      const currentCount = teammateCounts.get(normalizedA)!.get(playerB.trim()) || 0;
      teammateCounts.get(normalizedA)!.set(playerB.trim(), currentCount + 1);
    };

    tournamentData.matches.forEach((match) => {
      addTeammate(match.team1?.player1?.name, match.team1?.player2?.name);
      addTeammate(match.team1?.player2?.name, match.team1?.player1?.name);
      addTeammate(match.team2?.player1?.name, match.team2?.player2?.name);
      addTeammate(match.team2?.player2?.name, match.team2?.player1?.name);
    });

    const result = new Map<string, string[]>();
    teammateCounts.forEach((counts, playerName) => {
      const sortedTeammates = Array.from(counts.entries())
        .sort((a, b) => {
          if (b[1] !== a[1]) return b[1] - a[1];
          return a[0].localeCompare(b[0]);
        })
        .map(([teammate]) => teammate);
      result.set(playerName, sortedTeammates);
    });

    return result;
  }, [tournamentData.matches]);

  const historicalTeammatesByPlayer = useMemo(() => {
    const byPlayer = new Map<string, string[]>();

    Object.entries(historicalTeammates).forEach(([playerName, teammates]) => {
      const normalized = normalizePlayerName(playerName);
      if (!normalized || !Array.isArray(teammates)) return;
      byPlayer.set(normalized, teammates.filter(Boolean));
    });

    return byPlayer;
  }, [historicalTeammates]);

  const getPrioritizedPlayers = (anchorPlayerName?: string) => {
    const normalizedAnchor = normalizePlayerName(anchorPlayerName);
    if (!normalizedAnchor) return allPlayers;

    const prioritizedPlayers: string[] = [];
    const seen = new Set<string>();

    const addPlayer = (playerName?: string) => {
      const trimmed = String(playerName || '').trim();
      if (!trimmed || seen.has(trimmed)) return;
      seen.add(trimmed);
      prioritizedPlayers.push(trimmed);
    };

    (tournamentTeammates.get(normalizedAnchor) || []).forEach(addPlayer);
    (historicalTeammatesByPlayer.get(normalizedAnchor) || []).forEach(addPlayer);
    allPlayers.forEach(addPlayer);

    return prioritizedPlayers;
  };

  const handleNewMatchPlayerChange = (
    teamKey: 'team1' | 'team2',
    playerKey: 'player1' | 'player2',
    playerName: string
  ) => {
    setNewMatch((previousMatch) => {
      const previousTeam = previousMatch[teamKey] || { player1: { name: '' }, player2: { name: '' } };
      const updatedTeam = {
        player1: { ...previousTeam.player1 },
        player2: { ...previousTeam.player2 }
      };

      updatedTeam[playerKey] = {
        ...updatedTeam[playerKey],
        name: playerName
      };

      if (playerKey === 'player1') {
        const normalizedPlayer = normalizePlayerName(playerName);
        const existingTeammate = normalizePlayerName(updatedTeam.player2.name);
        const suggestedTeammate =
          (tournamentTeammates.get(normalizedPlayer) || [])[0] ||
          (historicalTeammatesByPlayer.get(normalizedPlayer) || [])[0];

        if (!existingTeammate && suggestedTeammate && normalizePlayerName(suggestedTeammate) !== normalizedPlayer) {
          updatedTeam.player2 = {
            ...updatedTeam.player2,
            name: suggestedTeammate
          };
        }
      }

      return {
        ...previousMatch,
        [teamKey]: updatedTeam
      };
    });
  };

  // Load team rankings and all players
  useEffect(() => {
    const loadTeamRankings = async () => {
      try {
        const slug = tournamentData.tournament.liquipedia_slug;
        if (!slug) {
          setTeamRankings({});
          return;
        }

        const params = new URLSearchParams();
        if (useSeededRankings) params.append('useSeeds', 'true');
        if (mainCircuitOnly) params.append('mainCircuitOnly', 'true');
        if (seasons && seasons.length > 0) params.append('seasons', seasons.join(','));

        const tournamentResponse = await fetch(`/api/tournament-team-rankings/${encodeURIComponent(slug)}?${params.toString()}`);

        if (tournamentResponse.ok) {
          const tournamentData = await tournamentResponse.json();
          const rankMap: Record<string, number> = tournamentData?.ranks || {};
          setTeamRankings(rankMap);
          return;
        }

        console.warn(`Tournament rank endpoint unavailable for ${slug}: ${tournamentResponse.status}`);
        setTeamRankings({});
      } catch (err) {
        console.error('Error loading team rankings:', err);
        setTeamRankings({});
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

    const loadHistoricalTeammates = async () => {
      try {
        const response = await fetch('/api/player-teammates');
        if (!response.ok) return;
        const data = await response.json();
        setHistoricalTeammates(data?.teammates || {});
      } catch (err) {
        console.error('Error loading historical teammates:', err);
      }
    };
    
    loadTeamRankings();
    loadPlayers();
    loadHistoricalTeammates();
  }, [tournamentData.tournament.liquipedia_slug, useSeededRankings, mainCircuitOnly, seasons]);

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
      if (parseEarlyRound(match.round)) {
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
      const parsedA = parseEarlyRound(a);
      const parsedB = parseEarlyRound(b);

      if (parsedA && parsedB) {
        const typeOrderDiff = EARLY_ROUND_TYPE_ORDER[parsedA.type] - EARLY_ROUND_TYPE_ORDER[parsedB.type];
        if (typeOrderDiff !== 0) return typeOrderDiff;
        return parsedA.number - parsedB.number;
      }

      if (parsedA) return -1;
      if (parsedB) return 1;
      return a.localeCompare(b);
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
    // Find the highest existing early round number for the selected bracket type
    let maxRoundNum = 0;
    earlyRoundNames.forEach(roundName => {
      const parsedRound = parseEarlyRound(roundName);
      if (parsedRound?.type === newEarlyRoundType && parsedRound.number > maxRoundNum) {
        maxRoundNum = parsedRound.number;
      }
    });

    const newRoundName = formatEarlyRoundName(newEarlyRoundType, maxRoundNum + 1);
    setEmptyEarlyRounds([...emptyEarlyRounds, newRoundName]);
    setSelectedEarlyRound(newRoundName);
    setSaveMessage(`${newRoundName} created! Add matches to it.`);
    setTimeout(() => setSaveMessage(null), 3000);
  };

  const groupedEarlyRounds = useMemo(() => {
    const groupedByRound = earlyRoundNames.reduce((acc, roundName) => {
      acc[roundName] = earlyRoundsMatches
        .filter(m => m.round === roundName)
        .sort((a, b) => a.match_id.localeCompare(b.match_id));
      return acc;
    }, {} as Record<string, Match[]>);

    const orderedByRound: Record<string, Match[]> = { ...groupedByRound };

    (['standard', 'upper', 'lower'] as EarlyRoundType[]).forEach(type => {
      const sectionRounds = earlyRoundNames.filter(roundName => parseEarlyRound(roundName)?.type === type);

      sectionRounds.forEach((roundName, roundIndex) => {
        const currentMatches = groupedByRound[roundName] || [];

        if (roundIndex === 0 || currentMatches.length <= 1) {
          orderedByRound[roundName] = currentMatches;
          return;
        }

        const previousRoundName = sectionRounds[roundIndex - 1];
        const previousMatches = orderedByRound[previousRoundName] || [];
        const previousTeamToSlot = new Map<string, number>();

        previousMatches.forEach((match, index) => {
          const team1Key = getTeamKey(match.team1);
          const team2Key = getTeamKey(match.team2);
          if (team1Key) previousTeamToSlot.set(team1Key, index);
          if (team2Key) previousTeamToSlot.set(team2Key, index);
        });

        orderedByRound[roundName] = [...currentMatches].sort((a, b) => {
          const aTeam1 = getTeamKey(a.team1);
          const aTeam2 = getTeamKey(a.team2);
          const bTeam1 = getTeamKey(b.team1);
          const bTeam2 = getTeamKey(b.team2);

          const aSlots = [aTeam1, aTeam2]
            .map(team => (team ? previousTeamToSlot.get(team) : undefined))
            .filter((slot): slot is number => slot !== undefined);
          const bSlots = [bTeam1, bTeam2]
            .map(team => (team ? previousTeamToSlot.get(team) : undefined))
            .filter((slot): slot is number => slot !== undefined);

          const aMin = aSlots.length > 0 ? Math.min(...aSlots) : Number.POSITIVE_INFINITY;
          const bMin = bSlots.length > 0 ? Math.min(...bSlots) : Number.POSITIVE_INFINITY;

          if (aMin !== bMin) return aMin - bMin;

          const aMax = aSlots.length > 0 ? Math.max(...aSlots) : Number.POSITIVE_INFINITY;
          const bMax = bSlots.length > 0 ? Math.max(...bSlots) : Number.POSITIVE_INFINITY;

          if (aMax !== bMax) return aMax - bMax;

          return (a.match_id || '').localeCompare(b.match_id || '');
        });
      });
    });

    return orderedByRound;
  }, [earlyRoundsMatches, earlyRoundNames]);

  const earlyRoundSections = useMemo(() => {
    const sections: Record<EarlyRoundType, string[]> = {
      standard: [],
      upper: [],
      lower: []
    };

    earlyRoundNames.forEach(roundName => {
      const parsedRound = parseEarlyRound(roundName);
      if (parsedRound) {
        sections[parsedRound.type].push(roundName);
      }
    });

    return (['standard', 'upper', 'lower'] as EarlyRoundType[])
      .filter(type => sections[type].length > 0)
      .map(type => ({
        type,
        title: EARLY_ROUND_SECTION_TITLES[type],
        rounds: sections[type]
      }));
  }, [earlyRoundNames]);

  const earlySectionLayouts = useMemo(() => {
    const MATCH_SPACING = 140;
    const MIN_VERTICAL_GAP = 110;
    const TOP_PADDING = 20;
    const BOTTOM_PADDING = 140;

    const sectionLayouts = new Map<EarlyRoundType, {
      minHeight: number;
      roundMatchTopById: Record<string, Map<string, number>>;
    }>();

    (['standard', 'upper', 'lower'] as EarlyRoundType[]).forEach(type => {
      const section = earlyRoundSections.find(s => s.type === type);
      if (!section) return;

      const roundMatchTopById: Record<string, Map<string, number>> = {};
      let previousTeamToTop = new Map<string, number>();
      let sectionMaxTop = 0;

      section.rounds.forEach((roundName, roundIndex) => {
        const matches = groupedEarlyRounds[roundName] || [];
        const rawTops: number[] = [];
        let fallbackTop = 0;

        matches.forEach((match, matchIndex) => {
          if (roundIndex === 0) {
            rawTops.push(matchIndex * MATCH_SPACING);
            fallbackTop = (matchIndex + 1) * MATCH_SPACING;
            return;
          }

          const feederTops = [getTeamKey(match.team1), getTeamKey(match.team2)]
            .map(teamKey => (teamKey ? previousTeamToTop.get(teamKey) : undefined))
            .filter((top): top is number => top !== undefined);

          if (feederTops.length > 0) {
            const averageTop = feederTops.reduce((sum, top) => sum + top, 0) / feederTops.length;
            rawTops.push(averageTop);
            fallbackTop = Math.max(fallbackTop, averageTop + MATCH_SPACING);
          } else {
            rawTops.push(fallbackTop);
            fallbackTop += MATCH_SPACING;
          }
        });

        const adjustedTops: number[] = [];
        rawTops.forEach((top, index) => {
          if (index === 0) {
            adjustedTops.push(top);
            return;
          }

          const previousTop = adjustedTops[index - 1];
          adjustedTops.push(Math.max(top, previousTop + MIN_VERTICAL_GAP));
        });

        const roundTopMap = new Map<string, number>();
        matches.forEach((match, index) => {
          const absoluteTop = TOP_PADDING + (adjustedTops[index] ?? 0);
          roundTopMap.set(match.match_id, absoluteTop);
          sectionMaxTop = Math.max(sectionMaxTop, absoluteTop);
        });

        roundMatchTopById[roundName] = roundTopMap;

        previousTeamToTop = new Map<string, number>();
        matches.forEach((match) => {
          const top = roundTopMap.get(match.match_id);
          if (top === undefined) return;

          const team1 = getTeamKey(match.team1);
          const team2 = getTeamKey(match.team2);
          if (team1) previousTeamToTop.set(team1, top);
          if (team2) previousTeamToTop.set(team2, top);
        });
      });

      sectionLayouts.set(type, {
        minHeight: Math.max(460, sectionMaxTop + BOTTOM_PADDING),
        roundMatchTopById
      });
    });

    return sectionLayouts;
  }, [earlyRoundSections, groupedEarlyRounds]);

  const earlySectionEntrantsByMatchId = useMemo(() => {
    const entrantsByMatch = new Map<string, Set<string>>();

    (['standard', 'upper', 'lower'] as EarlyRoundType[]).forEach(type => {
      const sectionRounds = earlyRoundNames.filter(roundName => parseEarlyRound(roundName)?.type === type);
      const seenTeams = new Set<string>();

      sectionRounds.forEach((roundName, roundIndex) => {
        const matches = groupedEarlyRounds[roundName] || [];

        matches.forEach(match => {
          const entrants = new Set<string>();
          const team1 = getTeamKey(match.team1);
          const team2 = getTeamKey(match.team2);
          const shouldMarkExternalEntry = type === 'lower' ? true : roundIndex > 0;

          [team1, team2].forEach(team => {
            if (!team) return;

            if (shouldMarkExternalEntry && !seenTeams.has(team)) {
              entrants.add(team);
            }

            seenTeams.add(team);
          });

          if (entrants.size > 0) {
            entrantsByMatch.set(`${type}:${match.match_id}`, entrants);
          }
        });
      });
    });

    return entrantsByMatch;
  }, [earlyRoundNames, groupedEarlyRounds]);

  // Separate rounds into upper bracket and lower bracket
  // Lower bracket rounds are explicitly named "Lower Bracket", everything else is upper bracket
  const { upperBracketRounds, lowerBracketRounds } = useMemo(() => {
    const uniqueRounds = Array.from(new Set(bracketMatches.map(m => m.round)));

    // Define round order for upper bracket (single-elimination or upper bracket of double-elimination)
    const upperBracketOrder = [
      'Round of 32',
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

  const lowerBracketEntrantsByMatchId = useMemo(() => {
    const entrantsByMatch = new Map<string, Set<string>>();
    const seenLowerBracketTeams = new Set<string>();

    lowerBracketRounds.forEach((roundName, roundIndex) => {
      const matches = groupedMatches[roundName] || [];

      matches.forEach(match => {
        const entrants = new Set<string>();
        const team1 = getTeamKey(match.team1);
        const team2 = getTeamKey(match.team2);

        [team1, team2].forEach(team => {
          if (!team) return;

          if (roundIndex > 0 && !seenLowerBracketTeams.has(team)) {
            entrants.add(team);
          }

          seenLowerBracketTeams.add(team);
        });

        if (entrants.size > 0) {
          entrantsByMatch.set(match.match_id, entrants);
        }
      });
    });

    return entrantsByMatch;
  }, [lowerBracketRounds, groupedMatches]);

  const getDisplayMatchWithEntrantOnTop = (match: Match, entrantKeys?: Set<string>): Match => {
    if (!entrantKeys || entrantKeys.size === 0) return match;

    const team1Key = getTeamKey(match.team1);
    const team2Key = getTeamKey(match.team2);

    const team1IsEntrant = !!team1Key && entrantKeys.has(team1Key);
    const team2IsEntrant = !!team2Key && entrantKeys.has(team2Key);

    if (!team1IsEntrant && team2IsEntrant) {
      return {
        ...match,
        team1: match.team2,
        team2: match.team1,
        team1_score: match.team2_score,
        team2_score: match.team1_score
      };
    }

    return match;
  };

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
              <select
                value={newEarlyRoundType}
                onChange={(e) => setNewEarlyRoundType(e.target.value as EarlyRoundType)}
                className="px-3 py-2 border border-gray-300 rounded-md bg-white text-gray-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                title="Type of round to create"
              >
                <option value="standard">Round</option>
                <option value="upper">Upper Bracket</option>
                <option value="lower">Lower Bracket</option>
              </select>
              <button
                onClick={handleAddEarlyRound}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                + Add {EARLY_ROUND_LABELS[newEarlyRoundType]}
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
                          onChange={(e) => handleNewMatchPlayerChange('team1', 'player1', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 2 Name</label>
                        <input
                          type="text"
                          list="team1-player2-suggestions"
                          value={newMatch.team1?.player2.name || ''}
                          onChange={(e) => handleNewMatchPlayerChange('team1', 'player2', e.target.value)}
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
                          onChange={(e) => handleNewMatchPlayerChange('team2', 'player1', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                          placeholder="Select or enter player name"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">Player 2 Name</label>
                        <input
                          type="text"
                          list="team2-player2-suggestions"
                          value={newMatch.team2?.player2.name || ''}
                          onChange={(e) => handleNewMatchPlayerChange('team2', 'player2', e.target.value)}
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

                <datalist id="team1-player2-suggestions">
                  {getPrioritizedPlayers(newMatch.team1?.player1.name).map(playerName => (
                    <option key={`t1p2-${playerName}`} value={playerName} />
                  ))}
                </datalist>

                <datalist id="team2-player2-suggestions">
                  {getPrioritizedPlayers(newMatch.team2?.player1.name).map(playerName => (
                    <option key={`t2p2-${playerName}`} value={playerName} />
                  ))}
                </datalist>
              </div>
            )}

          {/* Display early rounds horizontally like bracket */}
          {earlyRoundNames.length > 0 ? (
            <div className="max-w-full px-6 space-y-8">
              {earlyRoundSections.map((section) => (
                <div key={section.type}>
                  <div className="mb-3 text-center">
                    <h3 className="inline-block text-sm font-semibold text-gray-700 bg-gray-200 px-4 py-1 rounded">
                      {section.title}
                    </h3>
                  </div>
                  <div className="overflow-x-auto">
                    <div className="inline-flex gap-10">
                      {section.rounds.map((roundName, roundIndex) => {
                        const matches = groupedEarlyRounds[roundName] || [];
                        const sectionLayout = earlySectionLayouts.get(section.type);
                        const sectionMinHeight = sectionLayout?.minHeight ?? 460;
                        const roundMatchTopById = sectionLayout?.roundMatchTopById[roundName] ?? new Map<string, number>();

                        return (
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
                              {matches.length} matches
                            </p>
                          </div>

                          {/* Matches */}
                          <div
                            className="relative flex-grow py-4"
                            style={{ minHeight: `${sectionMinHeight}px` }}
                          >
                            {matches.length > 0 ? (
                              matches.map((match) => {
                                const entrantTeams = earlySectionEntrantsByMatchId.get(`${section.type}:${match.match_id}`);
                                const displayMatch = getDisplayMatchWithEntrantOnTop(match, entrantTeams);
                                const top = roundMatchTopById.get(match.match_id) ?? 20;

                                return (
                                <div key={match.match_id} className="absolute left-0 right-0" style={{ top: `${top}px` }}>
                                  {entrantTeams && entrantTeams.size > 0 && (
                                    <>
                                      <div className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-gray-400"></div>
                                      <div className="absolute -top-7 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-gray-400"></div>
                                    </>
                                  )}
                                  <MatchBox
                                    match={displayMatch}
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

                                  {/* Connecting line to next round */}
                                  {roundIndex < section.rounds.length - 1 && (
                                    <div className="absolute top-1/2 -right-4 w-4 h-px bg-gray-400"></div>
                                  )}
                                </div>
                              )})
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
                      )})}
                    </div>
                  </div>
                </div>
              ))}
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
            // Double-elimination: Show upper bracket above lower bracket
            <div className="flex flex-col gap-10 px-6 w-max">
              {/* Upper Bracket */}
              <div>
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
              <div>
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
                          {matches.map((match) => {
                            const entrantTeams = lowerBracketEntrantsByMatchId.get(match.match_id);
                            const displayMatch = getDisplayMatchWithEntrantOnTop(match, entrantTeams);

                            return (
                            <div key={match.match_id} className="relative">
                              {entrantTeams && entrantTeams.size > 0 && (
                                <>
                                  <div className="absolute -top-6 left-1/2 h-6 w-px -translate-x-1/2 bg-gray-400"></div>
                                  <div className="absolute -top-7 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-gray-400"></div>
                                </>
                              )}
                              <MatchBox
                                match={displayMatch}
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
                          )})}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Grand Final (if exists) - shown separately after lower bracket */}
              {upperBracketRounds.includes('Grand Final') && (
                <div>
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
