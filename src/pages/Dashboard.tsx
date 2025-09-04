import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useOverallStats } from '@/hooks/useData'
import { Trophy, Users, UserCheck, BarChart3, TrendingUp, Calendar } from 'lucide-react'

export default function Dashboard() {
  const { stats, loading, error } = useOverallStats()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Loading tournament statistics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-red-500">Error loading data: {error}</p>
        </div>
      </div>
    )
  }

  const statCards = [
    {
      title: 'Tournaments',
      value: stats.total_tournaments,
      icon: Trophy,
      description: 'Total tournament events',
      color: 'text-blue-600'
    },
    {
      title: 'Matches',
      value: stats.total_matches,
      icon: BarChart3,
      description: 'Matches played',
      color: 'text-green-600'
    },
    {
      title: 'Players',
      value: stats.total_players,
      icon: Users,
      description: 'Unique participants',
      color: 'text-purple-600'
    },
    {
      title: 'Teams',
      value: stats.total_teams,
      icon: UserCheck,
      description: '2v2 partnerships',
      color: 'text-orange-600'
    }
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of SC2 2v2 tournament statistics from the UThermal Circuit series
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat) => {
          const Icon = stat.icon
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">
                  {stat.description}
                </p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Feature Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Trophy className="h-5 w-5 text-blue-600" />
              <span>Tournament Analysis</span>
            </CardTitle>
            <CardDescription>
              View detailed tournament breakdowns, brackets, and results from the UThermal 2v2 Circuit
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button className="w-full">Explore Tournaments</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              <span>Player Performance</span>
            </CardTitle>
            <CardDescription>
              Analyze individual player statistics, win rates, and favorite maps
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full">View Players</Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Calendar className="h-5 w-5 text-purple-600" />
              <span>Recent Activity</span>
            </CardTitle>
            <CardDescription>
              Latest matches and tournament updates from the competitive scene
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="secondary" className="w-full">View Recent</Button>
          </CardContent>
        </Card>
      </div>

      {/* Data Source Info */}
      <Card>
        <CardHeader>
          <CardTitle>Data Source</CardTitle>
          <CardDescription>
            Tournament data is automatically scraped from Liquipedia and stored in Supabase
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm font-medium">Last Updated</p>
              <p className="text-sm text-muted-foreground">
                Data is refreshed automatically when new tournaments are detected
              </p>
            </div>
            <Button variant="outline">Refresh Data</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
