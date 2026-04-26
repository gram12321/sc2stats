import { Trophy, Info, LayoutDashboard, Crown, Users, Swords, Map, Sparkles, Medal, Flag, Target } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

export type Section = 'circuit' | 'rankings' | 'info';
export type HeaderNavView =
  | 'tournaments'
  | 'matches'
  | 'map-data'
  | 'highlights'
  | 'prediction-quality'
  | 'player-rankings'
  | 'team-rankings'
  | 'race-rankings'
  | 'team-race-rankings'
  | 'players'
  | 'info'
  | 'player-details'
  | 'team-details';

interface HeaderProps {
  onNavigateSection: (section: Section) => void;
  onNavigateView: (view: HeaderNavView) => void;
  currentSection: Section;
  currentView: HeaderNavView;
}

const sectionItems = [
  { section: 'circuit' as Section, icon: LayoutDashboard, label: 'Results' },
  { section: 'rankings' as Section, icon: Crown, label: 'Rankings' },
  { section: 'info' as Section, icon: Info, label: 'Stats & Info' }
];

const lowerRowItems: Record<Section, { view: HeaderNavView; icon: any; label: string }[]> = {
  circuit: [
    { view: 'tournaments', icon: LayoutDashboard, label: 'Tournaments' },
    { view: 'matches', icon: Swords, label: 'Matches' },
    { view: 'map-data', icon: Map, label: 'Maps' }
  ],
  rankings: [
    { view: 'player-rankings', icon: Crown, label: 'Player' },
    { view: 'team-rankings', icon: Users, label: 'Team' },
    { view: 'race-rankings', icon: Medal, label: 'Race' },
    { view: 'team-race-rankings', icon: Flag, label: 'Team Race' }
  ],
  info: [
    { view: 'info', icon: Info, label: 'Info' },
    { view: 'prediction-quality', icon: Target, label: 'Predictions' },
    { view: 'highlights', icon: Sparkles, label: 'Highlights' }
  ]
};

export function Header({ onNavigateSection, onNavigateView, currentSection, currentView }: HeaderProps) {
  const isSectionActive = (section: Section) => currentSection === section;
  const isLowerActive = (view: HeaderNavView) => {
    if (currentView === view) return true;
    if (view === 'player-rankings' && currentView === 'player-details') return true;
    if (view === 'team-rankings' && currentView === 'team-details') return true;
    return false;
  };

  return (
    <div className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto max-w-7xl px-4 py-2 sm:px-8">
        <div className="relative flex items-start justify-center">
          <div
            className="absolute left-0 top-1 hidden cursor-pointer items-center space-x-2 transition-opacity hover:opacity-80 md:flex"
            onClick={() => onNavigateSection('circuit')}
          >
            <div className="rounded-lg bg-primary/10 p-1">
              <Trophy className="h-6 w-6 text-primary" />
            </div>
            <div className="flex flex-col">
              <span className="hidden text-lg font-bold tracking-tight xl:inline-block">SC2 Stats</span>
              <span className="text-[10px] uppercase leading-none tracking-widest text-muted-foreground">Pro Circuit</span>
            </div>
          </div>

          <div className="flex min-w-0 flex-col items-center gap-1">
            <div className="flex flex-wrap items-center justify-center gap-1">
              {sectionItems.map(({ section, icon: Icon, label }) => (
                <Button
                  key={section}
                  variant={isSectionActive(section) ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => onNavigateSection(section)}
                  className={cn(
                    'shrink-0 gap-2 px-3 transition-all duration-200',
                    isSectionActive(section) ? 'shadow-md shadow-primary/20' : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{label}</span>
                </Button>
              ))}
            </div>

            <div className="flex w-fit max-w-full flex-wrap items-center justify-center gap-1 rounded-lg bg-muted/60 p-1">
            {lowerRowItems[currentSection].map(({ view, icon: Icon, label }) => (
              <Button
                key={view}
                variant={isLowerActive(view) ? 'default' : 'ghost'}
                size="sm"
                onClick={() => onNavigateView(view)}
                className={cn(
                  'gap-2',
                  isLowerActive(view) ? 'shadow-sm shadow-primary/20' : 'hover:bg-accent hover:text-accent-foreground'
                )}
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Button>
            ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
