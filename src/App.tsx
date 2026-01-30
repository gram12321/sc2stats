import { useState } from 'react';
import { TournamentEditor } from './pages/TournamentEditor';
import { PlayerManager } from './pages/PlayerManager';
import { PlayerRankings } from './pages/PlayerRankings';
import { TeamRankings } from './pages/TeamRankings';
import { RaceRankings } from './pages/RaceRankings';
import { TeamRaceRankings } from './pages/TeamRaceRankings';
import { MatchesList } from './pages/MatchesList';
import { PlayerDetails } from './pages/PlayerDetails';
import { TeamDetails } from './pages/TeamDetails';
import { Info } from './pages/Info';

type View =
  | 'tournaments'
  | 'players'
  | 'player-rankings'
  | 'team-rankings'
  | 'race-rankings'
  | 'team-race-rankings'
  | 'matches'
  | 'player-details'
  | 'team-details'
  | 'info';

interface NavigationState {
  view: View;
  playerName?: string;
  teamPlayer1?: string;
  teamPlayer2?: string;
}

export function App() {
  const [navState, setNavState] = useState<NavigationState>({ view: 'tournaments' });

  const navigate = (view: View, params?: { playerName?: string; teamPlayer1?: string; teamPlayer2?: string }) => {
    setNavState({ view, ...params });
  };

  if (navState.view === 'players') {
    return <PlayerManager onBack={() => navigate('tournaments')} />;
  }

  if (navState.view === 'player-rankings') {
    return <PlayerRankings onBack={() => navigate('tournaments')} onNavigateToPlayer={(name) => navigate('player-details', { playerName: name })} />;
  }

  if (navState.view === 'team-rankings') {
    return <TeamRankings onBack={() => navigate('tournaments')} onNavigateToTeam={(p1, p2) => navigate('team-details', { teamPlayer1: p1, teamPlayer2: p2 })} />;
  }

  if (navState.view === 'race-rankings') {
    return <RaceRankings onBack={() => navigate('tournaments')} />;
  }

  if (navState.view === 'team-race-rankings') {
    return <TeamRaceRankings onBack={() => navigate('tournaments')} />;
  }

  if (navState.view === 'matches') {
    return <MatchesList onBack={() => navigate('tournaments')} />;
  }

  if (navState.view === 'player-details' && navState.playerName) {
    return <PlayerDetails playerName={navState.playerName} onBack={() => navigate('player-rankings')} />;
  }

  if (navState.view === 'team-details' && navState.teamPlayer1 && navState.teamPlayer2) {
    return <TeamDetails player1={navState.teamPlayer1} player2={navState.teamPlayer2} onBack={() => navigate('team-rankings')} />;
  }

  if (navState.view === 'info') {
    return <Info onBack={() => navigate('tournaments')} />;
  }

  return (
    <TournamentEditor
      onNavigateToPlayers={() => navigate('players')}
      onNavigateToPlayerRankings={() => navigate('player-rankings')}
      onNavigateToTeamRankings={() => navigate('team-rankings')}
      onNavigateToRaceRankings={() => navigate('race-rankings')}
      onNavigateToTeamRaceRankings={() => navigate('team-race-rankings')}
      onNavigateToMatches={() => navigate('matches')}
      onNavigateToInfo={() => navigate('info')}
    />
  );
}
