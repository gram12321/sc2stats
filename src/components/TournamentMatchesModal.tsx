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

  // TODO: Implement proper display logic here

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
            <div className="space-y-4">
              <p>Found {matches.length} matches. Display logic to be implemented.</p>
              {/* Display raw match data for now */}
              <pre className="text-xs bg-gray-100 p-4 rounded overflow-auto max-h-60">
                {JSON.stringify(matches.slice(0, 5), null, 2)}
              </pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
