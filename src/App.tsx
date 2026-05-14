import { useMemo, useState } from 'react';
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
import { Highlights } from './pages/Highlights';
import { MapData } from './pages/MapData';
import { MapDetails } from './pages/MapDetails';
import { PredictionQuality } from './pages/PredictionQuality';
import { Header, type HeaderNavView, type Section } from './components/Header';
import { Footer } from './components/Footer';

type View =
  | 'tournaments'
  | 'players'
  | 'player-rankings'
  | 'team-rankings'
  | 'race-rankings'
  | 'team-race-rankings'
  | 'matches'
  | 'map-data'
  | 'map-details'
  | 'highlights'
  | 'prediction-quality'
  | 'player-details'
  | 'team-details'
  | 'info';

type CircuitView = 'tournaments' | 'matches' | 'map-data';
type RankingsView = 'player-rankings' | 'team-rankings' | 'race-rankings' | 'team-race-rankings';

interface NavigationState {
  view: View;
  playerName?: string;
  teamPlayer1?: string;
  teamPlayer2?: string;
  mapName?: string;
  matchTournamentSlug?: string;
  matchId?: string;
}

export function App() {
  const [navState, setNavState] = useState<NavigationState>({ view: 'tournaments' });
  const isLocalManageAllowed = useMemo(() => {
    if (typeof window === 'undefined') return false;
    const host = window.location.hostname.toLowerCase();
    return host === 'localhost' || host === '127.0.0.1' || host === '::1';
  }, []);

  const circuitViews: CircuitView[] = ['tournaments', 'matches', 'map-data'];
  const rankingsViews: RankingsView[] = ['player-rankings', 'team-rankings', 'race-rankings', 'team-race-rankings'];

  const navigate = (
    view: View,
    params?: {
      playerName?: string;
      teamPlayer1?: string;
      teamPlayer2?: string;
      mapName?: string;
      matchTournamentSlug?: string;
      matchId?: string;
    }
  ) => {
    if (view === 'players' && !isLocalManageAllowed) {
      setNavState({ view: 'info' });
      return;
    }
    setNavState({ view, ...params });
  };

  const navigateSection = (section: Section) => {
    if (section === 'circuit') navigate('tournaments');
    if (section === 'rankings') navigate('player-rankings');
    if (section === 'info') navigate('info');
  };

  const currentSection: Section = (() => {
    if (circuitViews.includes(navState.view as CircuitView)) return 'circuit';
    if (navState.view === 'map-details') return 'circuit';
    if (rankingsViews.includes(navState.view as RankingsView) || navState.view === 'player-details' || navState.view === 'team-details') return 'rankings';
    return 'info';
  })();

  const renderCircuitContent = (view: CircuitView) => {
    if (view === 'matches') {
      return <MatchesList initialTournament={navState.matchTournamentSlug} focusMatchId={navState.matchId} />;
    }

    if (view === 'map-data') {
      return <MapData onNavigateToMap={(name) => navigate('map-details', { mapName: name })} />;
    }

    return <TournamentEditor />;
  };

  const renderRankingsContent = (view: RankingsView) => {
    if (view === 'team-rankings') {
      return <TeamRankings onNavigateToTeam={(p1, p2) => navigate('team-details', { teamPlayer1: p1, teamPlayer2: p2 })} />;
    }

    if (view === 'race-rankings') {
      return <RaceRankings />;
    }

    if (view === 'team-race-rankings') {
      return <TeamRaceRankings />;
    }

    return <PlayerRankings onNavigateToPlayer={(name) => navigate('player-details', { playerName: name })} />;
  };

  const renderContent = () => {
    if (navState.view === 'player-details' && navState.playerName) {
      return <PlayerDetails playerName={navState.playerName} onBack={() => navigate('player-rankings')} />;
    }

    if (navState.view === 'team-details' && navState.teamPlayer1 && navState.teamPlayer2) {
      return <TeamDetails player1={navState.teamPlayer1} player2={navState.teamPlayer2} onBack={() => navigate('team-rankings')} />;
    }

    if (navState.view === 'map-details' && navState.mapName) {
      return <MapDetails
        mapName={navState.mapName}
        onBack={() => navigate('map-data')}
        onNavigateToPlayer={(name) => navigate('player-details', { playerName: name })}
        onNavigateToTeam={(p1, p2) => navigate('team-details', { teamPlayer1: p1, teamPlayer2: p2 })}
        onNavigateToTournament={(slug) => navigate('matches', { matchTournamentSlug: slug })}
      />;
    }

    if (rankingsViews.includes(navState.view as RankingsView)) {
      return renderRankingsContent(navState.view as RankingsView);
    }

    if (circuitViews.includes(navState.view as CircuitView)) {
      return renderCircuitContent(navState.view as CircuitView);
    }

    if (navState.view === 'highlights') {
      return (
        <Highlights
          onNavigateToMatch={(tournamentSlug, matchId) =>
            navigate('matches', { matchTournamentSlug: tournamentSlug, matchId })
          }
          onNavigateToPlayer={(name) => navigate('player-details', { playerName: name })}
          onNavigateToTeam={(p1, p2) => navigate('team-details', { teamPlayer1: p1, teamPlayer2: p2 })}
        />
      );
    }

    if (navState.view === 'prediction-quality') {
      return <PredictionQuality />;
    }

    if (navState.view === 'players') {
      if (!isLocalManageAllowed) {
        return (
          <div className="rounded-lg border border-border bg-card p-6 text-card-foreground">
            <h2 className="text-lg font-semibold">Manage Is Localhost Only</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              The Manage page is only available when running the app on localhost.
            </p>
          </div>
        );
      }
      return <PlayerManager />;
    }

    if (navState.view === 'info') {
      return <Info />;
    }

    return <Info />;
  };

  return (
    <div className="flex min-h-screen flex-col bg-background text-[15px] text-foreground font-sans antialiased selection:bg-primary/20 selection:text-primary">
      <RankingSettingsProvider>
        <Header
          onNavigateSection={navigateSection}
          onNavigateView={(view) => navigate(view as View)}
          currentSection={currentSection}
          currentView={navState.view as HeaderNavView}
        />
        <main className="container mx-auto max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {renderContent()}
        </main>
        <Footer onNavigateManage={() => navigate('players')} />
      </RankingSettingsProvider>
    </div>
  );
}
