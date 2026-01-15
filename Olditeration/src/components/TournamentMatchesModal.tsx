import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useMatches } from '@/hooks/useData'
import { Match } from '@/types/database'
import { Trophy, Users, Clock } from 'lucide-react'

interface TournamentMatchesModalProps {
  tournamentId: string
  tournamentName: string
  children: React.ReactNode
}

export default function TournamentMatchesModal({ 
  tournamentId, 
  tournamentName, 
  children 
}: TournamentMatchesModalProps) {
  const [open, setOpen] = useState(false)
  const { matches, loading, error } = useMatches(open ? tournamentId : undefined)

  // Organize matches by stage
  const organizedMatches = matches ? {
    groupA: matches.filter(match => match.match_id.includes('_A_')),
    groupB: matches.filter(match => match.match_id.includes('_B_')),
    bracket: matches.filter(match => match.match_id.includes('_R') && match.match_id.includes('M'))
  } : { groupA: [], groupB: [], bracket: [] }

  const renderMatch = (match: Match) => {
    return (
      <Card key={match.id} className="p-3">
        <CardContent className="p-0">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <div className="flex items-center space-x-2 text-sm">
                <Users className="h-4 w-4 text-blue-600" />
                <span className="font-medium">
                  {match.team1?.name} vs {match.team2?.name}
                </span>
                {/* Show score from database */}
                <Badge variant="outline" className="ml-2 font-mono">
                  {match.score || '0-0'}
                </Badge>
              </div>
              <div className="flex items-center space-x-4 mt-2 text-xs text-muted-foreground">
                <div className="flex items-center space-x-1">
                  <Clock className="h-3 w-3" />
                  <span>Bo{match.best_of}</span>
                </div>
                <Badge 
                  variant={match.status === 'completed' ? 'default' : 'secondary'}
                  className="text-xs"
                >
                  {match.status}
                </Badge>
                {match.winner && (
                  <div className="flex items-center space-x-1">
                    <Trophy className="h-3 w-3 text-yellow-500" />
                    <span className="font-medium">Winner: {match.winner.name}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="text-right text-xs text-muted-foreground">
              {match.match_id.split('_').pop()}
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  const renderSection = (title: string, sectionMatches: Match[], icon: React.ReactNode) => (
    <div className="space-y-3">
      <div className="flex items-center space-x-2 border-b pb-2">
        {icon}
        <h3 className="font-semibold text-lg">{title}</h3>
        <Badge variant="outline">{sectionMatches.length} matches</Badge>
      </div>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {sectionMatches.length > 0 ? (
          sectionMatches.map(renderMatch)
        ) : (
          <p className="text-muted-foreground text-sm">No matches found</p>
        )}
      </div>
    </div>
  )

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto bg-white border border-gray-200 shadow-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Trophy className="h-5 w-5 text-blue-600" />
            <span>{tournamentName} - Matches</span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-muted-foreground mt-2">Loading matches...</p>
            </div>
          )}
          
          {error && (
            <div className="text-center py-8">
              <p className="text-red-500">Error loading matches: {error}</p>
            </div>
          )}
          
          {!loading && !error && matches && matches.length === 0 && (
            <div className="text-center py-8">
              <Trophy className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No matches found</h3>
              <p className="text-muted-foreground">
                This tournament doesn't have any matches loaded yet.
              </p>
            </div>
          )}
          
          {!loading && !error && matches && matches.length > 0 && (
            <div className="space-y-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground">
                  Showing {matches.length} matches total
                </p>
              </div>
              
              {/* Group A Section */}
              {organizedMatches.groupA.length > 0 && renderSection(
                "Group A", 
                organizedMatches.groupA, 
                <Users className="h-5 w-5 text-green-600" />
              )}
              
              {/* Group B Section */}
              {organizedMatches.groupB.length > 0 && renderSection(
                "Group B", 
                organizedMatches.groupB, 
                <Users className="h-5 w-5 text-blue-600" />
              )}
              
              {/* Bracket Section */}
              {organizedMatches.bracket.length > 0 && renderSection(
                "Bracket Stage", 
                organizedMatches.bracket, 
                <Trophy className="h-5 w-5 text-yellow-600" />
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
