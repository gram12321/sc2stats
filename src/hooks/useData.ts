import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { Tournament, Player, Team, Match, TournamentStats } from '@/types/database'

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
