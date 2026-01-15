import { useState } from 'react';
import { TournamentEditor } from './pages/TournamentEditor';
import { PlayerManager } from './pages/PlayerManager';

type View = 'tournaments' | 'players';

export function App() {
  const [currentView, setCurrentView] = useState<View>('tournaments');

  if (currentView === 'players') {
    return <PlayerManager onBack={() => setCurrentView('tournaments')} />;
  }

  return <TournamentEditor onNavigateToPlayers={() => setCurrentView('players')} />;
}
