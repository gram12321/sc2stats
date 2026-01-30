
interface HeaderProps {
      onNavigate: (view: 'tournaments' | 'players' | 'player-rankings' | 'team-rankings' | 'race-rankings' | 'team-race-rankings' | 'matches' | 'info') => void;
      currentView: string;
}

export function Header({ onNavigate, currentView }: HeaderProps) {
      const isActive = (view: string) => currentView === view;

      return (
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
                  <div className="max-w-7xl mx-auto px-6 py-4">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                              <div
                                    className="cursor-pointer"
                                    onClick={() => onNavigate('tournaments')}
                              >
                                    <h1 className="text-2xl font-bold text-gray-900">SC2 Stats</h1>
                                    <p className="text-gray-600 text-sm">Tournament Analysis Tool</p>
                              </div>
                              <div className="flex gap-2 flex-wrap">
                                    <button
                                          onClick={() => onNavigate('tournaments')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('tournaments')
                                                      ? 'bg-gray-800 text-white'
                                                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                }`}
                                    >
                                          Tournaments
                                    </button>
                                    <button
                                          onClick={() => onNavigate('player-rankings')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('player-rankings')
                                                      ? 'bg-green-700 text-white'
                                                      : 'bg-green-600 text-white hover:bg-green-700'
                                                }`}
                                    >
                                          Player Rankings
                                    </button>
                                    <button
                                          onClick={() => onNavigate('team-rankings')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('team-rankings')
                                                      ? 'bg-purple-700 text-white'
                                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                                }`}
                                    >
                                          Team Rankings
                                    </button>
                                    <button
                                          onClick={() => onNavigate('race-rankings')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('race-rankings')
                                                      ? 'bg-indigo-700 text-white'
                                                      : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                }`}
                                    >
                                          Race Stats
                                    </button>
                                    <button
                                          onClick={() => onNavigate('team-race-rankings')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('team-race-rankings')
                                                      ? 'bg-purple-700 text-white'
                                                      : 'bg-purple-600 text-white hover:bg-purple-700'
                                                }`}
                                    >
                                          Team Race Stats
                                    </button>
                                    <button
                                          onClick={() => onNavigate('players')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('players')
                                                      ? 'bg-blue-700 text-white'
                                                      : 'bg-blue-600 text-white hover:bg-blue-700'
                                                }`}
                                    >
                                          Manage Players
                                    </button>
                                    <button
                                          onClick={() => onNavigate('matches')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('matches')
                                                      ? 'bg-orange-700 text-white'
                                                      : 'bg-orange-600 text-white hover:bg-orange-700'
                                                }`}
                                    >
                                          Match History
                                    </button>
                                    <button
                                          onClick={() => onNavigate('info')}
                                          className={`px-4 py-2 text-sm font-medium rounded-md transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 ${isActive('info')
                                                      ? 'bg-gray-700 text-white'
                                                      : 'bg-gray-600 text-white hover:bg-gray-700'
                                                }`}
                                    >
                                          Info
                                    </button>
                              </div>
                        </div>
                  </div>
            </div>
      );
}
