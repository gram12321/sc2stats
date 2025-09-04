import React from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { 
  BarChart3, 
  Trophy, 
  Users, 
  UserCheck, 
  Home,
  Github,
  Database
} from 'lucide-react'

const navigation = [
  { name: 'Dashboard', href: '/', icon: Home },
  { name: 'Tournaments', href: '/tournaments', icon: Trophy },
  { name: 'Players', href: '/players', icon: Users },
  { name: 'Teams', href: '/teams', icon: UserCheck },
  { name: 'Analytics', href: '/analytics', icon: BarChart3 },
]

export function Layout() {
  const location = useLocation()

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-white/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <Trophy className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold">SC2 Stats</h1>
                  <p className="text-xs text-muted-foreground">2v2 Tournament Analytics</p>
                </div>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Button variant="outline" size="sm" asChild>
                <a 
                  href="https://github.com/gram12321/sc2stats" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub</span>
                </a>
              </Button>
              <Button variant="outline" size="sm" className="flex items-center space-x-2">
                <Database className="h-4 w-4" />
                <span>Supabase</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 border-r bg-white/30 backdrop-blur-sm min-h-[calc(100vh-73px)]">
          <nav className="p-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              const Icon = item.icon
              
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.name}</span>
                </Link>
              )
            })}
          </nav>
          
          {/* Sidebar Footer with Stats */}
          <div className="p-4 mt-8">
            <Card className="p-4">
              <h3 className="font-semibold text-sm mb-3">Quick Stats</h3>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Tournaments</span>
                  <span className="font-mono">12</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Matches</span>
                  <span className="font-mono">199</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Players</span>
                  <span className="font-mono">50+</span>
                </div>
              </div>
            </Card>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
