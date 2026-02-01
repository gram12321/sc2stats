import { useState } from 'react';
import { RankingSettingsProvider } from './context/RankingSettingsContext';
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
import { Header } from './components/Header';

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

  const renderContent = () => {
    if (navState.view === 'players') {
      return <PlayerManager />;
    }

    if (navState.view === 'player-rankings') {
      return <PlayerRankings onNavigateToPlayer={(name) => navigate('player-details', { playerName: name })} />;
    }

    if (navState.view === 'team-rankings') {
      return <TeamRankings onNavigateToTeam={(p1, p2) => navigate('team-details', { teamPlayer1: p1, teamPlayer2: p2 })} />;
    }

    if (navState.view === 'race-rankings') {
      return <RaceRankings />;
    }

    if (navState.view === 'team-race-rankings') {
      return <TeamRaceRankings />;
    }

    if (navState.view === 'matches') {
      return <MatchesList />;
    }

    if (navState.view === 'player-details' && navState.playerName) {
      return <PlayerDetails playerName={navState.playerName} onBack={() => navigate('player-rankings')} />;
    }

    if (navState.view === 'team-details' && navState.teamPlayer1 && navState.teamPlayer2) {
      return <TeamDetails player1={navState.teamPlayer1} player2={navState.teamPlayer2} onBack={() => navigate('team-rankings')} />;
    }

    if (navState.view === 'info') {
      return <Info />;
    }

    return <TournamentEditor />;
  };

  return (
    <div className="min-h-screen bg-background text-foreground font-sans antialiased selection:bg-primary/20 selection:text-primary">
      <RankingSettingsProvider>
        <Header onNavigate={(view) => navigate(view as View)} currentView={navState.view} />
        <main className="container max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          {renderContent()}
        </main>
      </RankingSettingsProvider>
    </div>
  );
}
