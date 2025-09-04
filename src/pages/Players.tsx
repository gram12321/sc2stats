import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, TrendingUp } from 'lucide-react'

export default function Players() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Players</h1>
        <p className="text-muted-foreground">
          Individual player statistics and performance analysis
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="h-5 w-5" />
            <span>Player Analytics</span>
          </CardTitle>
          <CardDescription>
            Detailed player performance metrics coming soon
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-12">
          <div className="text-center">
            <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
            <p className="text-muted-foreground">
              Player statistics and analytics will be available in the next update
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
