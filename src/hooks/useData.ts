import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Tournament, Player, Team, Match, TournamentStats, PlayerStats } from '@/types/database'

// Hook for fetching all tournaments
export function useTournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTournaments() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('tournaments')
          .select('*')
          .order('start_date', { ascending: false })

        if (error) throw error
        setTournaments(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchTournaments()
  }, [])

  return { tournaments, loading, error }
}

// Hook for fetching tournament stats
export function useTournamentStats() {
  const [stats, setStats] = useState<TournamentStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchStats() {
      try {
        setLoading(true)
        
        // Fetch tournaments with aggregated stats
        const { data: tournaments, error: tournamentsError } = await supabase
          .from('tournaments')
          .select('*')

        if (tournamentsError) throw tournamentsError

        // For each tournament, get match and game counts
        const statsPromises = (tournaments || []).map(async (tournament) => {
          const [matchesResult, gamesResult, teamsResult] = await Promise.all([
            supabase
              .from('matches')
              .select('id')
              .eq('tournament_id', tournament.id),
            supabase
              .from('games')
              .select('id')
              .in('match_id', 
                await supabase
                  .from('matches')
                  .select('id')
                  .eq('tournament_id', tournament.id)
                  .then(res => res.data?.map(m => m.id) || [])
              ),
            supabase
              .from('matches')
              .select('team1_id, team2_id')
              .eq('tournament_id', tournament.id)
          ])

          const total_matches = matchesResult.data?.length || 0
          const total_games = gamesResult.data?.length || 0
          
          // Calculate unique teams
          const teamIds = new Set<string>()
          
          teamsResult.data?.forEach(match => {
            teamIds.add(match.team1_id)
            teamIds.add(match.team2_id)
          })

          // For now, estimate unique players as teams * 2
          const unique_players = teamIds.size * 2

          return {
            tournament,
            total_matches,
            total_games,
            unique_players,
            unique_teams: teamIds.size,
            avg_games_per_match: total_matches > 0 ? total_games / total_matches : 0
          }
        })

        const statsData = await Promise.all(statsPromises)
        setStats(statsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchStats()
  }, [])

  return { stats, loading, error }
}

// Hook for fetching matches with full details
export function useMatches(tournamentId?: string) {
  const [matches, setMatches] = useState<Match[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchMatches() {
      try {
        setLoading(true)
        
        let query = supabase
          .from('matches')
          .select(`
            *,
            tournament:tournaments(*),
            team1:teams!team1_id(
              *,
              player1:players!player1_id(*),
              player2:players!player2_id(*)
            ),
            team2:teams!team2_id(
              *,
              player1:players!player1_id(*),
              player2:players!player2_id(*)
            ),
            winner:teams!winner_id(
              *,
              player1:players!player1_id(*),
              player2:players!player2_id(*)
            ),
            games(*)
          `)
          .order('match_date', { ascending: false })

        if (tournamentId) {
          query = query.eq('tournament_id', tournamentId)
        }

        const { data, error } = await query

        if (error) throw error
        setMatches(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchMatches()
  }, [tournamentId])

  return { matches, loading, error }
}

// Hook for fetching players
export function usePlayers() {
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayers() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('players')
          .select('*')
          .order('name')

        if (error) throw error
        setPlayers(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayers()
  }, [])

  return { players, loading, error }
}

// Hook for fetching teams
export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchTeams() {
      try {
        setLoading(true)
        const { data, error } = await supabase
          .from('teams')
          .select(`
            *,
            player1:players!player1_id(*),
            player2:players!player2_id(*)
          `)
          .order('name')

        if (error) throw error
        setTeams(data || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchTeams()
  }, [])

  return { teams, loading, error }
}

// Hook for getting overall statistics
export function useOverallStats() {
  const [stats, setStats] = useState({
    total_tournaments: 0,
    total_matches: 0,
    total_games: 0,
    total_players: 0,
    total_teams: 0
  })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchOverallStats() {
      try {
        setLoading(true)
        
        const [
          tournamentsResult,
          matchesResult,
          gamesResult,
          playersResult,
          teamsResult
        ] = await Promise.all([
          supabase.from('tournaments').select('id'),
          supabase.from('matches').select('id'),
          supabase.from('games').select('id'),
          supabase.from('players').select('id'),
          supabase.from('teams').select('id')
        ])

        setStats({
          total_tournaments: tournamentsResult.data?.length || 0,
          total_matches: matchesResult.data?.length || 0,
          total_games: gamesResult.data?.length || 0,
          total_players: playersResult.data?.length || 0,
          total_teams: teamsResult.data?.length || 0
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchOverallStats()
  }, [])

  return { stats, loading, error }
}

// Hook for fetching player statistics
export function usePlayerStats() {
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPlayerStats() {
      try {
        setLoading(true)
        
        // Execute the complex SQL query to get player statistics
        const { data, error } = await supabase.rpc('get_player_statistics')

        if (error) {
          // Fallback to manual query if RPC doesn't exist
          const { data: fallbackData, error: fallbackError } = await supabase
            .from('players')
            .select(`
              name,
              nationality,
              preferred_race
            `)
            .limit(20)
          
          if (fallbackError) throw fallbackError
          
          // Transform to match PlayerStats interface
          const transformedData: PlayerStats[] = (fallbackData || []).map(player => ({
            player_name: player.name,
            nationality: player.nationality,
            preferred_race: player.preferred_race,
            total_matches: 0,
            wins: 0,
            losses: 0,
            win_percentage: 0,
            teammates: ''
          }))
          
          setPlayerStats(transformedData)
        } else {
          setPlayerStats(data || [])
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred')
      } finally {
        setLoading(false)
      }
    }

    fetchPlayerStats()
  }, [])

  return { playerStats, loading, error }
}

// Hook for clearing database and running scraper
export function useScraperActions() {
  const [isClearing, setIsClearing] = useState(false)
  const [isRunning, setIsRunning] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)

  const clearDatabase = async () => {
    try {
      setIsClearing(true)
      setActionError(null)
      setActionSuccess(null)

      // Clear all tables in reverse order of dependencies
      const clearOperations = [
        () => supabase.from('games').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        () => supabase.from('matches').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        () => supabase.from('teams').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        () => supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000'),
        () => supabase.from('tournaments').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      ]

      for (const operation of clearOperations) {
        const { error } = await operation()
        if (error) throw error
      }

      setActionSuccess('Database cleared successfully!')
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to clear database')
    } finally {
      setIsClearing(false)
    }
  }

  const runScraper = async () => {
    try {
      setIsRunning(true)
      setActionError(null)
      setActionSuccess(null)

      // Try to call the API first
      try {
        const response = await fetch('http://localhost:3001/api/scraper/run', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        })

        if (!response.ok) {
          const error = await response.json()
          throw new Error(error.error || 'API request failed')
        }

        await response.json() // Consume the response
        setActionSuccess('Scraper started successfully! Check the API logs for progress.')
        
        // Poll for completion
        const checkStatus = async () => {
          try {
            const statusResponse = await fetch('http://localhost:3001/api/scraper/status')
            const status = await statusResponse.json()
            
            if (!status.isRunning) {
              if (status.lastError) {
                setActionError(`Scraper failed: ${status.lastError}`)
              } else {
                setActionSuccess('Scraper completed successfully!')
              }
              setIsRunning(false)
            } else {
              // Continue polling
              setTimeout(checkStatus, 2000)
            }
          } catch (err) {
            console.error('Error checking scraper status:', err)
            setTimeout(checkStatus, 2000) // Retry
          }
        }
        
        setTimeout(checkStatus, 2000)
        
      } catch (apiError) {
        // Fallback to manual instructions if API is not available
        console.warn('API not available, showing manual instructions:', apiError)
        setActionSuccess(
          'API server not running. To run the scraper manually:\n\n' +
          '1. Start the API server: npm run api:dev\n' +
          '2. Or run directly: cd tools/scraper && python run_scraper.py'
        )
        setIsRunning(false)
      }
      
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to run scraper')
      setIsRunning(false)
    }
  }

  const clearAndRun = async () => {
    await clearDatabase()
    if (!actionError) {
      setTimeout(() => runScraper(), 1000) // Small delay after clearing
    }
  }

  return {
    clearDatabase,
    runScraper, 
    clearAndRun,
    isClearing,
    isRunning,
    actionError,
    actionSuccess
  }
}
