import { Trophy, Users, Swords, Info, LayoutDashboard, Crown, Medal, Flag } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '../lib/utils';

interface HeaderProps {
      onNavigate: (view: 'tournaments' | 'players' | 'player-rankings' | 'team-rankings' | 'race-rankings' | 'team-race-rankings' | 'matches' | 'info') => void;
      currentView: string;
}

export function Header({ onNavigate, currentView }: HeaderProps) {
      const isActive = (view: string) => currentView === view;

      const NavButton = ({ view, icon: Icon, label }: { view: string, icon: any, label: string }) => (
            <Button
                  variant={isActive(view) ? "default" : "ghost"}
                  size="sm"
                  onClick={() => onNavigate(view as any)}
                  className={cn(
                        "gap-2 transition-all duration-200",
                        isActive(view) ? "shadow-md shadow-primary/20" : "hover:bg-accent hover:text-accent-foreground"
                  )}
            >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{label}</span>
            </Button>
      );

      return (
            <div className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <div className="container flex h-16 max-w-7xl items-center justify-between px-4 sm:px-8 mx-auto">
                        <div
                              className="mr-4 hidden md:flex cursor-pointer items-center space-x-2 transition-opacity hover:opacity-80"
                              onClick={() => onNavigate('tournaments')}
                        >
                              <div className="rounded-lg bg-primary/10 p-1">
                                    <Trophy className="h-6 w-6 text-primary" />
                              </div>
                              <div className="flex flex-col">
                                    <span className="hidden font-bold sm:inline-block text-lg tracking-tight">SC2 Stats</span>
                                    <span className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">Pro Circuit</span>
                              </div>
                        </div>

                        <div className="flex flex-1 items-center justify-center md:justify-end gap-1 overflow-x-auto scrollbar-hide py-2 md:py-0">
                              <NavButton view="tournaments" icon={LayoutDashboard} label="Tournaments" />
                              <NavButton view="player-rankings" icon={Crown} label="Rankings" />
                              <NavButton view="team-rankings" icon={Users} label="Teams" />
                              <NavButton view="race-rankings" icon={Medal} label="Races" />
                              <NavButton view="team-race-rankings" icon={Flag} label="Team Races" />
                              <NavButton view="players" icon={Users} label="Manage" />
                              <NavButton view="matches" icon={Swords} label="Matches" />
                              <NavButton view="info" icon={Info} label="Info" />
                        </div>
                  </div>
            </div>
      );
}
