import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { usePlayerStats } from '@/hooks/useData'
import { Users, TrendingUp, Trophy, Target } from 'lucide-react'

export default function Players() {
  const { playerStats, loading, error } = usePlayerStats()

  const getWinRateBadgeVariant = (winPercentage: number) => {
    if (winPercentage >= 80) return 'success'
    if (winPercentage >= 60) return 'default'
    if (winPercentage >= 40) return 'warning'
    return 'destructive'
  }

  const formatTeammates = (teammates: string) => {
    const teammatesList = teammates.split(', ')
    if (teammatesList.length <= 3) {
      return teammates
    }
    return `${teammatesList.slice(0, 3).join(', ')} +${teammatesList.length - 3} more`
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Players</h1>
          <p className="text-muted-foreground">
            Individual player statistics and performance analysis
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
              <h3 className="text-lg font-semibold mb-2">Loading Player Statistics...</h3>
              <p className="text-muted-foreground">
                Analyzing match data and calculating performance metrics
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Players</h1>
          <p className="text-muted-foreground">
            Individual player statistics and performance analysis
          </p>
        </div>
        <Card>
          <CardContent className="flex items-center justify-center py-12">
            <div className="text-center">
              <TrendingUp className="h-12 w-12 text-destructive mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2 text-destructive">Error Loading Data</h3>
              <p className="text-muted-foreground">
                {error}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Players</h1>
        <p className="text-muted-foreground">
          Individual player statistics and performance analysis from {playerStats.length} active players
        </p>
      </div>

      {/* Statistics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Players</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{playerStats.length}</div>
            <p className="text-xs text-muted-foreground">
              Active in tournaments
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Matches</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {playerStats.reduce((sum, player) => sum + player.total_matches, 0)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all players
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Win Rate</CardTitle>
            <Trophy className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {playerStats.length > 0 
                ? (playerStats.reduce((sum, player) => sum + player.win_percentage, 0) / playerStats.length).toFixed(1)
                : '0.0'
              }%
            </div>
            <p className="text-xs text-muted-foreground">
              Across all players
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Player Statistics Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Player Performance Leaderboard</span>
          </CardTitle>
          <CardDescription>
            Comprehensive statistics for all players, sorted by match count and win rate
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Player Name</TableHead>
                <TableHead className="text-center">Matches</TableHead>
                <TableHead className="text-center">Wins</TableHead>
                <TableHead className="text-center">Losses</TableHead>
                <TableHead className="text-center">Win Rate</TableHead>
                <TableHead>Teammates</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {playerStats.map((player, index) => (
                <TableRow key={`${player.player_name}-${index}`}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium">{player.player_name}</span>
                      {player.nationality && (
                        <span className="text-sm text-muted-foreground">{player.nationality}</span>
                      )}
                      {player.preferred_race && (
                        <span className="text-xs text-muted-foreground">{player.preferred_race}</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {player.total_matches}
                  </TableCell>
                  <TableCell className="text-center font-mono text-green-600">
                    {player.wins}
                  </TableCell>
                  <TableCell className="text-center font-mono text-red-600">
                    {player.losses}
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge variant={getWinRateBadgeVariant(player.win_percentage)}>
                      {player.win_percentage}%
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground" title={player.teammates}>
                      {formatTeammates(player.teammates)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {playerStats.length === 0 && (
            <div className="text-center py-12">
              <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Player Data Available</h3>
              <p className="text-muted-foreground">
                Player statistics will appear here once tournament data is loaded
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
