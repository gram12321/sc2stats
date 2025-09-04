import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useTournaments } from '@/hooks/useData'
import { Trophy, Calendar, MapPin, DollarSign } from 'lucide-react'

export default function Tournaments() {
  const { tournaments, loading, error } = useTournaments()

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <p className="text-muted-foreground">Loading tournament data...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardHeader>
                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-gray-200 rounded"></div>
                  <div className="h-3 bg-gray-200 rounded w-2/3"></div>
                </div>
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
          <h1 className="text-3xl font-bold">Tournaments</h1>
          <p className="text-red-500">Error loading tournaments: {error}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Tournaments</h1>
        <p className="text-muted-foreground">
          Browse all SC2 2v2 tournaments from the UThermal Circuit series
        </p>
      </div>

      {/* Tournament Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tournaments.map((tournament) => (
          <Card key={tournament.id} className="hover:shadow-lg transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Trophy className="h-5 w-5 text-blue-600" />
                <span className="truncate">{tournament.name}</span>
              </CardTitle>
              <CardDescription>
                {tournament.liquipedia_slug}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center space-x-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>
                    {tournament.start_date ? new Date(tournament.start_date).toLocaleDateString() : 'TBD'}
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    tournament.status === 'completed' ? 'bg-green-100 text-green-800' :
                    tournament.status === 'ongoing' ? 'bg-blue-100 text-blue-800' :
                    tournament.status === 'upcoming' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {tournament.status}
                  </span>
                </div>
                {tournament.location && (
                  <div className="flex items-center space-x-2 col-span-2">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{tournament.location}</span>
                  </div>
                )}
                {tournament.prize_pool && tournament.prize_pool > 0 && (
                  <div className="flex items-center space-x-2 col-span-2">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>${tournament.prize_pool.toLocaleString()}</span>
                  </div>
                )}
              </div>
              
              <div className="flex space-x-2">
                <Button size="sm" className="flex-1">View Matches</Button>
                <Button size="sm" variant="outline" className="flex-1">Results</Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {tournaments.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No tournaments found</h3>
            <p className="text-muted-foreground text-center max-w-md">
              It looks like no tournament data has been loaded yet. Try running the scraper to fetch data from Liquipedia.
            </p>
            <Button className="mt-4">Run Scraper</Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
